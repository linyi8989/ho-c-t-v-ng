interface GrammarAttemptServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createGrammarAttemptRepository>;
  lazySessionEnabled: boolean;
  gradingVersion: string | number;
  getClientRunCredentials: (payload: any) => { clientRunId: string; runSecret: string };
  getActor: (request: any) => Promise<any>;
  canOpenSet: (set: any, actor: any, request: any) => boolean;
  canAccessAttempt: (attempt: any, actor: any, set: any, request: any, review?: boolean) => boolean;
  canManageSet: (actor: any, set: any) => boolean;
  buildPreparedAttempt: (set: any, actor: any, payload: any, clientRunId: string, runSecret: string) => any;
  buildAttemptAnswer: (attempt: any, set: any, payload: any) => { answer: any; feedback: any };
  buildAnswerFeedback: (attempt: any, set: any, answer: any) => any;
  sanitizeAttempt: (attempt: any, includeReview: boolean, token?: string) => any;
  sanitizeAnswer: (answer: any, includeCorrect: boolean) => any;
  deterministicRunDocumentId: (namespace: string, parts: string[]) => string;
  getSetVersion: (set: any) => string;
  safeText: (value: any, maxLength: number) => string;
  makeId: (prefix: string) => string;
  fisherYates: (items: any[]) => any[];
  getQuestionType: (value: any, fallback?: any) => any;
  getLessonGradeClass: (set: any) => { classId: string; className: string };
  createSessionToken: () => string;
  hashSessionToken: (token: string) => string;
  normalizeTextAnswer: (value: any) => string;
  isTextAnswerCorrect: (answer: string, correct: string, accepted: string[]) => boolean;
  grammarAttemptToLeaderboardEvent: (attempt: any, set: any) => any;
  clearLeaderboardCache: () => void;
  now?: () => Date;
}

interface TimingLike { mark(label: string): void }

function grammarAttemptHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function createGrammarAttemptService(options: GrammarAttemptServiceOptions) {
  const now = options.now || (() => new Date());
  const actorOrThrow = async (request: any, message: string, timing?: TimingLike) => {
    const actor = await options.getActor(request);
    timing?.mark('identity');
    if (!actor) throw grammarAttemptHttpError(401, message);
    return actor;
  };
  const setOrThrow = async (id: string, message: string, timing?: TimingLike) => {
    const set = await options.repository.getSet(id);
    timing?.mark('set_read');
    if (!set) throw grammarAttemptHttpError(404, message);
    return set;
  };
  const attemptOrThrow = async (id: string, timing?: TimingLike) => {
    const attempt = await options.repository.getAttempt(id);
    timing?.mark('attempt_read');
    if (!attempt) throw grammarAttemptHttpError(404, 'Lượt làm bài không tồn tại.');
    return attempt;
  };
  const assertAttemptLimit = async (set: any, actor: any, timing?: TimingLike, ascii = false) => {
    const maxAttempts = Math.max(1, Number(set.maxAttempts || 1));
    const actorField = actor.isGuest ? 'guestId' : 'userId';
    const count = await options.repository.countCompletedAttempts(set.id, actorField, actor.id, maxAttempts);
    timing?.mark('attempt_limit');
    if (count >= maxAttempts) {
      throw grammarAttemptHttpError(403, ascii
        ? 'Ban da het so lan lam bai duoc phep.'
        : 'Bạn đã hết số lần làm bài được phép.');
    }
  };

  const prepareAttempt = async (request: any, timing?: TimingLike) => {
    if (!options.lazySessionEnabled) throw grammarAttemptHttpError(404, 'Lazy session v3 is disabled.');
    const credentials = options.getClientRunCredentials(request.body || {});
    const actor = await actorOrThrow(request, 'Vui long nhap ten hoc sinh de luyen ngu phap.', timing);
    const set = await setOrThrow(request.params.id, 'Bai ngu phap khong ton tai.', timing);
    if (!options.canOpenSet(set, actor, request)) {
      throw grammarAttemptHttpError(403, 'Ban khong co quyen lam bai nay.');
    }
    await assertAttemptLimit(set, actor, timing, true);
    const prepared = options.buildPreparedAttempt(
      set, actor, request.body || {}, credentials.clientRunId, credentials.runSecret,
    );
    return { body: options.sanitizeAttempt(prepared, false, credentials.runSecret) };
  };

  const activateAttempt = async (request: any, timing?: TimingLike) => {
    if (!options.lazySessionEnabled) throw grammarAttemptHttpError(404, 'Lazy session v3 is disabled.');
    const payload = request.body || {};
    const credentials = options.getClientRunCredentials(payload);
    const actor = await actorOrThrow(request, 'Vui long nhap ten hoc sinh de luyen ngu phap.', timing);
    const set = await setOrThrow(request.params.id, 'Bai ngu phap khong ton tai.', timing);
    if (!options.canOpenSet(set, actor, request)) {
      throw grammarAttemptHttpError(403, 'Ban khong co quyen lam bai nay.');
    }
    const attemptId = options.deterministicRunDocumentId('grammar-attempt-v2', [actor.id, set.id, credentials.clientRunId]);
    const existingAttempt = await options.repository.getAttempt(attemptId);
    timing?.mark('idempotency_lookup');
    if (existingAttempt) {
      if (!options.canAccessAttempt(existingAttempt, actor, set, request)) {
        throw grammarAttemptHttpError(403, 'Ban khong co quyen tiep tuc luot lam bai nay.');
      }
      const existingAnswer = (existingAttempt.answers || []).find((item: any) => item.attemptQuestionId === payload.attemptQuestionId);
      if (existingAnswer) {
        const feedback = options.buildAnswerFeedback(existingAttempt, set, existingAnswer);
        return { body: {
          attempt: options.sanitizeAttempt(existingAttempt, false, credentials.runSecret),
          answer: options.sanitizeAnswer(existingAnswer, Boolean(feedback)),
          feedback,
          alreadyActivated: true,
        } };
      }
      if (existingAttempt.status === 'completed') {
        return { body: {
          attempt: options.sanitizeAttempt(existingAttempt, Boolean(set.showReviewAfterSubmit), credentials.runSecret),
          alreadyCompleted: true,
        } };
      }
      const { answer, feedback } = options.buildAttemptAnswer(existingAttempt, set, payload);
      const answers = [...(existingAttempt.answers || []).filter((item: any) => item.attemptQuestionId !== answer.attemptQuestionId), answer];
      const updatedAt = now().toISOString();
      const updatedAttempt = { ...existingAttempt, status: 'in_progress', answers, lastSavedAt: updatedAt, updatedAt };
      await options.repository.saveAttempt(updatedAttempt, set, false);
      timing?.mark('persist');
      return { body: {
        attempt: options.sanitizeAttempt(updatedAttempt, false, credentials.runSecret),
        answer: options.sanitizeAnswer(answer, Boolean(feedback)),
        feedback,
        alreadyActivated: true,
      } };
    }
    if (options.safeText(payload.grammarSetVersion, 160) !== options.getSetVersion(set)) {
      throw grammarAttemptHttpError(409, 'Bai da duoc cap nhat. Hay bat dau lai de nhan noi dung moi.');
    }
    await assertAttemptLimit(set, actor, timing, true);
    const prepared = options.buildPreparedAttempt(set, actor, payload, credentials.clientRunId, credentials.runSecret);
    const { answer, feedback } = options.buildAttemptAnswer(prepared, set, payload);
    const timestamp = now().toISOString();
    const activated = {
      ...prepared, status: 'in_progress', activatedAt: timestamp,
      lastSavedAt: timestamp, updatedAt: timestamp, answers: [answer],
    };
    await options.repository.saveAttempt(activated, set, false);
    timing?.mark('persist');
    return { status: 201, body: {
      attempt: options.sanitizeAttempt(activated, false, credentials.runSecret),
      answer: options.sanitizeAnswer(answer, Boolean(feedback)),
      feedback,
    } };
  };

  const createAttempt = async (request: any, timing?: TimingLike) => {
    const actor = await actorOrThrow(request, 'Vui lòng nhập tên học sinh để luyện ngữ pháp.', timing);
    const set = await setOrThrow(request.params.id, 'Bài ngữ pháp không tồn tại.', timing);
    if (!options.canOpenSet(set, actor, request)) {
      throw grammarAttemptHttpError(403, 'Bạn không có quyền làm bài này.');
    }
    await assertAttemptLimit(set, actor, timing);
    const timestamp = now().toISOString();
    const questions = set.shuffleQuestions ? options.fisherYates(set.questions || []) : [...(set.questions || [])];
    const attemptQuestions = questions.map((question: any, index: number) => {
      const questionType = options.getQuestionType(question.questionType, options.getQuestionType(set.questionType));
      const choices = questionType === 'multiple_choice' && set.shuffleOptions
        ? options.fisherYates(question.options || [])
        : [...(question.options || [])];
      return {
        id: options.makeId(`grammar-attempt-question-${index + 1}`),
        questionId: question.id,
        questionType,
        displayPosition: index + 1,
        optionOrder: choices.map((choice: any) => choice.id),
        questionSnapshot: question.questionText,
        explanationSnapshot: question.explanation,
        scoreSnapshot: question.score,
        optionsSnapshot: choices,
        correctOptionId: questionType === 'multiple_choice' ? question.correctOptionId : '',
        correctAnswerSnapshot: questionType === 'rewrite' ? question.correctAnswer : '',
        acceptedAnswersSnapshot: questionType === 'rewrite' && Array.isArray(question.acceptedAnswers)
          ? [...question.acceptedAnswers] : [],
      };
    });
    const attemptId = options.makeId('grammar-attempt');
    const attemptToken = actor.isGuest ? options.createSessionToken() : '';
    const gradeClass = options.getLessonGradeClass(set);
    const attempt = {
      id: attemptId, grammarSetId: set.id, grammarSetTitle: set.title,
      assignmentId: request.body?.assignmentId || '', userId: actor.id,
      studentId: actor.id, guestId: actor.isGuest ? actor.id : '', studentName: actor.name,
      classId: request.body?.classId || set.classId || gradeClass.classId || '',
      className: request.body?.className || set.className || gradeClass.className || '',
      status: 'in_progress', score: 0,
      maxScore: attemptQuestions.reduce((sum: number, question: any) => sum + Number(question.scoreSnapshot || 1), 0),
      correctCount: 0, wrongCount: 0, unansweredCount: attemptQuestions.length,
      startedAt: timestamp, createdAt: timestamp, questions: attemptQuestions, answers: [],
      reviewPolicySnapshot: {
        showReviewAfterSubmit: set.showReviewAfterSubmit !== false,
        showExplanationImmediately: Boolean(set.showExplanationImmediately),
        policyVersion: 1, capturedAt: timestamp,
      },
      attemptTokenHash: attemptToken ? options.hashSessionToken(attemptToken) : '',
    };
    await options.repository.saveAttempt(attempt, set, false);
    timing?.mark('persist');
    return { status: 201, body: options.sanitizeAttempt(attempt, false, attemptToken) };
  };

  const saveAnswer = async (request: any, timing?: TimingLike) => {
    const actor = await actorOrThrow(request, 'Vui lòng nhập tên học sinh để luyện ngữ pháp.', timing);
    const attempt = await attemptOrThrow(request.params.attemptId, timing);
    const set = await setOrThrow(attempt.grammarSetId, 'Bài ngữ pháp không tồn tại.', timing);
    if (!options.canAccessAttempt(attempt, actor, set, request)) {
      throw grammarAttemptHttpError(403, 'Bạn không có quyền sửa lượt làm bài này.');
    }
    if (attempt.status === 'completed') throw grammarAttemptHttpError(400, 'Bài đã nộp, không thể thay đổi đáp án.');
    const attemptQuestion = (attempt.questions || []).find((question: any) => question.id === request.body?.attemptQuestionId);
    if (!attemptQuestion) throw grammarAttemptHttpError(400, 'Câu hỏi không hợp lệ.');
    const questionType = options.getQuestionType(attemptQuestion.questionType, options.getQuestionType(set?.questionType));
    const selectedOptionId = questionType === 'multiple_choice' ? String(request.body?.selectedOptionId || '') : '';
    const textAnswer = questionType === 'rewrite' ? options.safeText(request.body?.textAnswer, 4000) : '';
    if (questionType === 'multiple_choice') {
      const selected = (attemptQuestion.optionsSnapshot || []).find((choice: any) => choice.id === selectedOptionId);
      if (!selected) throw grammarAttemptHttpError(400, 'Phương án đã chọn không hợp lệ.');
    } else if (!options.normalizeTextAnswer(textAnswer)) {
      throw grammarAttemptHttpError(400, 'Vui lòng nhập câu trả lời.');
    }
    const isCorrect = questionType === 'rewrite'
      ? options.isTextAnswerCorrect(textAnswer, attemptQuestion.correctAnswerSnapshot, attemptQuestion.acceptedAnswersSnapshot)
      : selectedOptionId === attemptQuestion.correctOptionId;
    const answer: any = {
      id: options.makeId('grammar-answer'), attemptQuestionId: attemptQuestion.id,
      questionId: attemptQuestion.questionId, questionType, isCorrect,
      scoreAwarded: isCorrect ? Number(attemptQuestion.scoreSnapshot || 1) : 0,
      answeredAt: now().toISOString(),
    };
    if (questionType === 'rewrite') {
      answer.textAnswer = textAnswer;
      answer.correctAnswer = attemptQuestion.correctAnswerSnapshot;
      answer.gradingVersion = options.gradingVersion;
    } else {
      answer.selectedOptionId = selectedOptionId;
      answer.correctOptionId = attemptQuestion.correctOptionId;
    }
    const answers = (attempt.answers || []).filter((item: any) => item.attemptQuestionId !== attemptQuestion.id);
    answers.push(answer);
    const updatedAt = now().toISOString();
    const updatedAttempt = { ...attempt, answers, lastSavedAt: updatedAt, updatedAt };
    await options.repository.saveAttempt(updatedAttempt, set, false);
    timing?.mark('persist');
    const feedback = set?.showExplanationImmediately ? {
      isCorrect,
      correctOptionId: questionType === 'multiple_choice' ? attemptQuestion.correctOptionId : '',
      correctAnswer: questionType === 'rewrite' ? attemptQuestion.correctAnswerSnapshot : '',
      explanation: attemptQuestion.explanationSnapshot,
      scoreAwarded: answer.scoreAwarded,
    } : null;
    return { body: { answer: options.sanitizeAnswer(answer, Boolean(feedback)), feedback } };
  };

  const submitAttempt = async (request: any, timing?: TimingLike) => {
    const actor = await actorOrThrow(request, 'Vui lòng nhập tên học sinh để luyện ngữ pháp.', timing);
    const attempt = await attemptOrThrow(request.params.attemptId, timing);
    const set = await setOrThrow(attempt.grammarSetId, 'Bài ngữ pháp không tồn tại.', timing);
    if (!options.canAccessAttempt(attempt, actor, set, request)) {
      throw grammarAttemptHttpError(403, 'Bạn không có quyền nộp lượt làm bài này.');
    }
    if (attempt.status === 'completed') {
      return { body: { ...options.sanitizeAttempt(attempt, Boolean(set?.showReviewAfterSubmit)), alreadyCompleted: true } };
    }
    const answerMap = new Map((attempt.answers || []).map((answer: any) => [answer.attemptQuestionId, answer]));
    let score = 0; let correctCount = 0; let wrongCount = 0; let unansweredCount = 0;
    for (const question of attempt.questions || []) {
      const answer: any = answerMap.get(question.id);
      if (!answer) unansweredCount++;
      else if (answer.isCorrect) { correctCount++; score += Number(question.scoreSnapshot || 1); }
      else wrongCount++;
    }
    const completedAt = now().toISOString();
    const startedAt = attempt.startedAt || completedAt;
    const durationSeconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
    const updatedAttempt = {
      ...attempt, status: 'completed', submissionStatus: 'completed', score,
      correctCount, wrongCount, unansweredCount, completedAt, durationSeconds, updatedAt: completedAt,
    };
    const event = options.grammarAttemptToLeaderboardEvent(updatedAttempt, set);
    await options.repository.saveCompletedAttempt(updatedAttempt, set, event);
    options.clearLeaderboardCache();
    timing?.mark('persist');
    return { body: options.sanitizeAttempt(updatedAttempt, Boolean(set?.showReviewAfterSubmit)) };
  };

  const reviewAttempt = async (request: any) => {
    const actor = await actorOrThrow(request, 'Vui lòng nhập tên học sinh để luyện ngữ pháp.');
    const attempt = await attemptOrThrow(request.params.attemptId);
    const set = await setOrThrow(attempt.grammarSetId, 'Bài ngữ pháp không tồn tại.');
    if (!options.canAccessAttempt(attempt, actor, set, request, true)) {
      throw grammarAttemptHttpError(403, 'Bạn không có quyền xem lượt làm bài này.');
    }
    if (attempt.status !== 'completed' && actor.role === 'student') {
      throw grammarAttemptHttpError(403, 'Chỉ được xem lại sau khi nộp bài.');
    }
    const staffReview = !actor.isGuest && (actor.role === 'super_admin' || options.canManageSet(actor, set));
    return { body: options.sanitizeAttempt(attempt, staffReview || Boolean(set?.showReviewAfterSubmit)) };
  };

  const listMyAttempts = async (request: any) => {
    const actor = await actorOrThrow(request, 'Vui lòng nhập tên học sinh để xem lịch sử làm bài.');
    const set = await options.repository.getSet(request.params.id);
    const actorField = actor.isGuest ? 'guestId' : 'userId';
    const attempts = await options.repository.listAttemptsForActor(request.params.id, actorField, actor.id);
    const list = attempts.map(attempt => options.sanitizeAttempt(
      attempt,
      !actor.isGuest && attempt.status === 'completed' && Boolean(set?.showReviewAfterSubmit),
    ));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return { body: list };
  };

  return { activateAttempt, createAttempt, listMyAttempts, prepareAttempt, reviewAttempt, saveAnswer, submitAttempt };
}
