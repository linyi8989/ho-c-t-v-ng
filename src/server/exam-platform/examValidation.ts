import type {
  ExamAnswers,
  ExamPaperContent,
  ExamPartContent,
  ExamPartDefinition,
  ExamQuestion,
  ExamQuestionType,
} from '../../features/exam-platform/types.js';
import { EXAM_CONTENT_SCHEMA_VERSION } from '../../features/exam-platform/types.js';
import { getExamPaperDefinition } from '../../features/exam-platform/definitions.js';

const text = (value: unknown, max = 20_000) => String(value ?? '').trim().slice(0, max);
const objectiveTypes = new Set<ExamQuestionType>([
  'single-choice',
  'multiple-choice',
  'short-answer',
  'true-false',
  'true-false-not-given',
  'yes-no-not-given',
  'matching',
]);

const choiceQuestionTypes = new Set<ExamQuestionType>([
  'single-choice',
  'multiple-choice',
  'true-false',
  'true-false-not-given',
  'yes-no-not-given',
  'matching',
]);

const smartImportTechnicalFields = new Set([
  'id',
  'imageAssetId',
  'imageUrl',
  'audioAssetId',
  'audioUrl',
  'correctOptionIds',
]);

const record = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
);

function findTechnicalSmartImportField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTechnicalSmartImportField(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (smartImportTechnicalFields.has(key)) return key;
    const found = findTechnicalSmartImportField(child);
    if (found) return found;
  }
  return null;
}

function defaultSmartImportOptions(type: ExamQuestionType) {
  if (type === 'true-false') return ['True', 'False'];
  if (type === 'true-false-not-given') return ['True', 'False', 'Not Given'];
  if (type === 'yes-no-not-given') return ['Yes', 'No', 'Not Given'];
  if (type === 'single-choice' || type === 'matching' || type === 'multiple-choice') return ['A', 'B', 'C'];
  return [];
}

export interface ExamSmartImportResult {
  part: ExamPartContent;
  errors: string[];
  warnings: string[];
}

/**
 * Converts AI/external JSON into application-owned content. Technical identifiers,
 * asset references and internal answer IDs are never accepted from the importer.
 */
export function normalizeExamSmartImportPart(
  currentPart: ExamPartContent,
  candidateValue: unknown,
  definition: ExamPartDefinition,
): ExamSmartImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const technicalField = findTechnicalSmartImportField(candidateValue);
  if (technicalField) {
    return {
      part: currentPart,
      errors: [`Smart Import không được chứa trường kỹ thuật "${technicalField}".`],
      warnings,
    };
  }

  const candidate = record(candidateValue);
  const rawQuestions = Array.isArray(candidate.questions) ? candidate.questions : null;
  if (!rawQuestions) errors.push('Smart Import phải có mảng questions.');
  if (rawQuestions && !definition.questionCountFlexible && rawQuestions.length !== definition.questionCount) {
    errors.push(`${definition.displayName} phải có đúng ${definition.questionCount} câu.`);
  }
  if (rawQuestions && definition.questionCountFlexible && rawQuestions.length > 40) {
    errors.push(`${definition.displayName} không được vượt quá 40 câu.`);
  }
  if (errors.length || !rawQuestions) return { part: currentPart, errors, warnings };

  const questions: ExamQuestion[] = rawQuestions.map((rawValue, questionIndex) => {
    const raw = record(rawValue);
    const currentQuestion = currentPart.questions[questionIndex];
    const proposedType = text(raw.type, 80) as ExamQuestionType;
    const type = definition.allowedQuestionTypes.includes(proposedType)
      ? proposedType
      : currentQuestion?.type && definition.allowedQuestionTypes.includes(currentQuestion.type)
        ? currentQuestion.type
        : definition.defaultQuestionType;
    if (proposedType && proposedType !== type) {
      errors.push(`Câu ${questionIndex + 1}: dạng câu "${proposedType}" không phù hợp ${definition.displayName}.`);
    }

    const rawOptions = Array.isArray(raw.options) ? raw.options : [];
    const optionValues = rawOptions.length
      ? rawOptions
      : choiceQuestionTypes.has(type)
        ? defaultSmartImportOptions(type)
        : [];
    const options = optionValues.map((optionValue: unknown, optionIndex: number) => {
      const option = typeof optionValue === 'string' ? { text: optionValue } : record(optionValue);
      const currentOption = currentQuestion?.type === type ? currentQuestion.options[optionIndex] : undefined;
      return {
        id: currentOption?.id || `option-${crypto.randomUUID()}`,
        label: text(option.label || String.fromCharCode(65 + optionIndex), 8),
        text: text(option.text, 4_000),
      };
    });
    if (choiceQuestionTypes.has(type) && options.length < 2) {
      errors.push(`Câu ${questionIndex + 1}: cần ít nhất hai lựa chọn.`);
    }

    const refs = [
      ...(Array.isArray(raw.correctOptionLabels) ? raw.correctOptionLabels : []),
      ...(Array.isArray(raw.correctOptions) ? raw.correctOptions : []),
    ].map(value => normalizeExamText(value)).filter(Boolean);
    const indexes = Array.isArray(raw.correctOptionIndexes)
      ? raw.correctOptionIndexes.map((value: unknown) => Number(value) - 1).filter((value: number) => Number.isInteger(value) && value >= 0)
      : [];
    const correctOptionIds = choiceQuestionTypes.has(type)
      ? options.filter((option, optionIndex) => (
          refs.includes(normalizeExamText(option.label))
          || refs.includes(normalizeExamText(option.text))
          || indexes.includes(optionIndex)
        )).map(option => option.id)
      : [];
    const acceptedAnswers = type === 'short-answer' && Array.isArray(raw.acceptedAnswers)
      ? raw.acceptedAnswers.map((value: unknown) => text(value, 4_000)).filter(Boolean).slice(0, 30)
      : [];
    if (choiceQuestionTypes.has(type) && !correctOptionIds.length) {
      warnings.push(`Câu ${questionIndex + 1}: chưa có đáp án đúng; giáo viên phải chọn trong editor.`);
    }
    if (choiceQuestionTypes.has(type) && type !== 'multiple-choice' && correctOptionIds.length > 1) {
      errors.push(`Câu ${questionIndex + 1}: chỉ được có một đáp án đúng.`);
    }
    if (type === 'short-answer' && !acceptedAnswers.length) {
      warnings.push(`Câu ${questionIndex + 1}: chưa có đáp án chấp nhận; giáo viên phải nhập trong editor.`);
    }

    const points = Number(raw.points);
    return {
      id: currentQuestion?.id || `question-${crypto.randomUUID()}`,
      number: currentQuestion?.number || questionIndex + 1,
      type,
      prompt: text(raw.prompt, 8_000),
      ...(text(raw.context, 8_000) ? { context: text(raw.context, 8_000) } : {}),
      ...(currentQuestion?.imageAssetId ? { imageAssetId: currentQuestion.imageAssetId } : {}),
      ...(currentQuestion?.imageUrl ? { imageUrl: currentQuestion.imageUrl } : {}),
      options,
      correctOptionIds,
      acceptedAnswers,
      points: Number.isFinite(points) && points > 0 && points <= 100
        ? points
        : currentQuestion?.points || definition.pointsPerQuestion || 1,
      ...(Number(raw.maxSelections) > 0 ? { maxSelections: Number(raw.maxSelections) } : {}),
      ...(Number(raw.maxWords) > 0 ? { maxWords: Number(raw.maxWords) } : {}),
      ...(Number(raw.minWords) > 0
        ? { minWords: Number(raw.minWords) }
        : currentQuestion?.minWords
          ? { minWords: currentQuestion.minWords }
          : definition.minWords
            ? { minWords: definition.minWords }
            : {}),
      ...(type === 'long-writing' ? {
        rubric: text(raw.rubric, 8_000) || currentQuestion?.rubric || 'Giáo viên chấm theo rubric của bài thi.',
        ...(text(raw.modelAnswer, 20_000) ? { modelAnswer: text(raw.modelAnswer, 20_000) } : {}),
      } : {}),
    };
  });

  return {
    part: {
      id: currentPart.id,
      part: currentPart.part,
      title: text(candidate.title, 240) || currentPart.title,
      instruction: text(candidate.instruction, 4_000) || currentPart.instruction,
      ...(text(candidate.passage, 20_000) ? { passage: text(candidate.passage, 20_000) } : {}),
      ...(currentPart.imageAssetId ? { imageAssetId: currentPart.imageAssetId } : {}),
      ...(currentPart.imageUrl ? { imageUrl: currentPart.imageUrl } : {}),
      ...(currentPart.audioAssetId ? { audioAssetId: currentPart.audioAssetId } : {}),
      ...(currentPart.audioUrl ? { audioUrl: currentPart.audioUrl } : {}),
      questions,
    },
    errors,
    warnings,
  };
}

export function normalizeExamText(value: unknown) {
  return text(value, 4_000)
    .normalize('NFKC')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');
}

export function validateExamPaperContent(content: ExamPaperContent) {
  const errors: string[] = [];
  if (!content || typeof content !== 'object') return ['Nội dung đề không hợp lệ.'];
  if (content.schemaVersion !== EXAM_CONTENT_SCHEMA_VERSION) errors.push('Schema đề thi không được hỗ trợ.');
  const definition = getExamPaperDefinition(content.moduleId, content.paperId);
  if (!definition) return ['Module hoặc loại bài thi không được hỗ trợ.'];
  if (!text(content.title, 240)) errors.push('Thiếu tên bộ đề.');
  if (content.parts?.length !== definition.parts.length) {
    errors.push(`${definition.displayName} phải có đúng ${definition.parts.length} Part/Section.`);
    return errors;
  }

  const allIds = new Set<string>();
  let totalQuestions = 0;
  content.parts.forEach((part, partIndex) => {
    const partDefinition = definition.parts[partIndex];
    if (!part || part.part !== partIndex + 1) errors.push(`Part ${partIndex + 1} không đúng thứ tự.`);
    if (!text(part?.title, 240)) errors.push(`Part ${partIndex + 1}: thiếu tiêu đề.`);
    if (partDefinition.requiresAudio && !text(part?.audioAssetId, 180)) {
      errors.push(`Part ${partIndex + 1}: phải chọn audio từ thư viện media.`);
    }
    if (!partDefinition.questionCountFlexible && part?.questions?.length !== partDefinition.questionCount) {
      errors.push(`Part ${partIndex + 1}: phải có đúng ${partDefinition.questionCount} câu.`);
    }
    totalQuestions += part?.questions?.length || 0;

    (part?.questions || []).forEach((question, questionIndex) => {
      const label = `Part ${partIndex + 1}, câu ${questionIndex + 1}`;
      if (!question?.id || allIds.has(question.id)) errors.push(`${label}: ID câu hỏi bị thiếu hoặc trùng.`);
      else allIds.add(question.id);
      if (!partDefinition.allowedQuestionTypes.includes(question.type)) errors.push(`${label}: dạng câu hỏi không phù hợp Part này.`);
      if (!text(question.prompt, 8_000)) errors.push(`${label}: thiếu nội dung câu hỏi.`);
      if (!Number.isFinite(question.points) || question.points <= 0 || question.points > 100) errors.push(`${label}: điểm tối đa không hợp lệ.`);
      if (question.type === 'long-writing') {
        if (!text(question.rubric, 8_000)) errors.push(`${label}: thiếu rubric để giáo viên chấm.`);
        return;
      }
      if (!objectiveTypes.has(question.type)) return;
      if (['single-choice', 'multiple-choice', 'true-false', 'true-false-not-given', 'yes-no-not-given', 'matching'].includes(question.type)) {
        if (question.options.length < 2) errors.push(`${label}: cần ít nhất hai lựa chọn.`);
        const optionIds = new Set(question.options.map(option => option.id));
        if (optionIds.size !== question.options.length || optionIds.has('')) errors.push(`${label}: ID lựa chọn bị thiếu hoặc trùng.`);
        if (!question.correctOptionIds.length) errors.push(`${label}: giáo viên chưa xác nhận đáp án đúng.`);
        if (question.correctOptionIds.some(id => !optionIds.has(id))) errors.push(`${label}: đáp án đúng không thuộc danh sách lựa chọn.`);
        if (question.type !== 'multiple-choice' && question.correctOptionIds.length !== 1) errors.push(`${label}: phải có đúng một đáp án đúng.`);
      } else if (!question.acceptedAnswers.some(answer => normalizeExamText(answer))) {
        errors.push(`${label}: giáo viên chưa nhập đáp án được chấp nhận.`);
      }
    });
  });

  if (definition.flexiblePartDistribution && totalQuestions !== definition.totalQuestionCount) {
    errors.push(`${definition.displayName} phải có đúng ${definition.totalQuestionCount} câu trên toàn bài.`);
  }
  return errors;
}

export function sanitizeExamContentForStudent(content: ExamPaperContent): ExamPaperContent {
  return {
    ...structuredClone(content),
    parts: content.parts.map(part => ({
      ...structuredClone(part),
      questions: part.questions.map(question => {
        const safe: any = structuredClone(question);
        delete safe.correctOptionIds;
        delete safe.acceptedAnswers;
        delete safe.modelAnswer;
        if (question.type !== 'long-writing') delete safe.rubric;
        return safe;
      }),
    })),
  } as ExamPaperContent;
}

export function sanitizeExamAnswers(raw: unknown, content: ExamPaperContent): ExamAnswers {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const allowed = new Map(content.parts.flatMap(part => part.questions.map(question => [question.id, question])));
  const answers: ExamAnswers = {};
  for (const [questionId, question] of allowed) {
    const value = input[questionId];
    if (Array.isArray(value)) {
      answers[questionId] = [...new Set(value.map(item => text(item, 500)).filter(Boolean))].slice(0, 20);
    } else {
      answers[questionId] = text(value, question.type === 'long-writing' ? 20_000 : 4_000);
    }
  }
  return answers;
}

export function displayCorrectAnswer(question: ExamQuestion) {
  if (question.correctOptionIds.length) {
    const byId = new Map(question.options.map(option => [option.id, option.text]));
    return question.correctOptionIds.map(id => byId.get(id) || '').filter(Boolean);
  }
  return question.acceptedAnswers;
}
