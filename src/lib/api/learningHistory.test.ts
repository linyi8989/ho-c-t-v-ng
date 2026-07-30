import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LearningHistoryApiError,
  buildLearningHistoryHeaders,
  buildLearningHistoryQuery,
  fetchLearningHistory,
  fetchLearningHistoryDetail
} from './learningHistory';
import {
  DEFAULT_HISTORY_FILTERS,
  normalizeHistoryDetailEntries,
  parseLearningHistoryResponse,
  resolveHistoryOptionAnswer
} from '../../components/history/historyTypes';

test('history query only sends allowlisted filters and normalizes pagination', () => {
  const query = new URLSearchParams(buildLearningHistoryQuery({
    ...DEFAULT_HISTORY_FILTERS,
    page: -4,
    pageSize: 50,
    historyType: 'assignment',
    sourceType: 'grammar',
    scoreFrom: 70,
    scoreTo: 100,
    search: '  câu điều kiện  ',
    groupByAssignment: true
  }));

  assert.deepEqual(Object.fromEntries(query), {
    page: '1',
    pageSize: '50',
    sourceType: 'grammar',
    historyType: 'assignment',
    scoreFrom: '70',
    scoreTo: '100',
    search: 'câu điều kiện',
    groupByAssignment: 'true'
  });
});

test('authenticated history headers take precedence and guest access requires both values', () => {
  assert.deepEqual(buildLearningHistoryHeaders({
    authToken: 'auth-token',
    guestCredential: { guestId: 'guest-one', accessToken: 'guest-token' }
  }), {
    Accept: 'application/json',
    Authorization: 'Bearer auth-token'
  });

  assert.deepEqual(buildLearningHistoryHeaders({
    guestCredential: { guestId: 'guest-one', accessToken: 'guest-token' }
  }), {
    Accept: 'application/json',
    'X-Guest-Id': 'guest-one',
    'X-Guest-Access-Token': 'guest-token'
  });

  assert.throws(
    () => buildLearningHistoryHeaders({ guestCredential: null }),
    (error: unknown) => (
      error instanceof LearningHistoryApiError
      && error.code === 'GUEST_HISTORY_ACCESS_REQUIRED'
    )
  );
});

test('list client forwards AbortSignal and parses malformed rows without crashing', async () => {
  const controller = new AbortController();
  let capturedSignal: AbortSignal | null | undefined;
  let capturedAuthorization = '';
  const response = await fetchLearningHistory(
    DEFAULT_HISTORY_FILTERS,
    { authToken: 'student-token' },
    controller.signal,
    async (_input, init) => {
      capturedSignal = init?.signal;
      capturedAuthorization = String((init?.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({
        items: [
          {
            attemptId: 'attempt-1',
            sourceType: 'grammar',
            lessonTitle: 'Câu điều kiện',
            gameId: 'grammar-practice',
            gameTitle: 'Trắc nghiệm',
            score: 87.5,
            correctCount: 7,
            incorrectCount: 1,
            unansweredCount: 0,
            totalQuestions: 8,
            durationSeconds: 90,
            status: 'completed',
            attemptNumber: 2,
            detailStatus: 'available'
          },
          null
        ],
        summary: { totalAttempts: 2, averageScore: 87.5 },
        pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
        filterOptions: {
          classes: [{ id: 'class-1', label: 'Lớp 6' }],
          lessons: [],
          assignments: [],
          games: []
        },
        assignmentGroups: [{
          assignmentId: 'assignment-1',
          assignmentTitle: 'Bài tập tuần 1',
          attempts: 2,
          latestScore: 88,
          bestScore: 92,
          averageScore: 90
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  );

  assert.equal(capturedSignal, controller.signal);
  assert.equal(capturedAuthorization, 'Bearer student-token');
  assert.equal(response.items[0].attemptStatus, 'completed');
  assert.equal(response.items[1].malformed, true);
  assert.equal(response.assignmentGroups?.[0].bestScore, 92);
  assert.equal(response.filterOptions.classes[0].label, 'Lớp 6');
});

test('detail client preserves explicit unavailable status without requiring detail JSON', async () => {
  const response = await fetchLearningHistoryDetail(
    'attempt/legacy',
    { authToken: 'student-token' },
    undefined,
    async input => {
      assert.equal(String(input), '/api/my-learning-history/attempt%2Flegacy');
      return new Response(JSON.stringify({
        attempt: {
          attemptId: 'attempt/legacy',
          sourceType: 'vocabulary',
          lessonTitle: 'Từ vựng cũ',
          gameId: 'flashcard',
          gameTitle: 'Flashcard',
          status: 'completed',
          detailStatus: 'legacy',
          score: 80
        },
        detailStatus: 'legacy_unavailable',
        detail: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  );

  assert.equal(response.detailStatus, 'legacy_unavailable');
  assert.equal(response.detail, null);
  assert.equal(response.attempt?.attemptId, 'attempt/legacy');
});

test('defensive detail normalization merges option envelopes and isolates malformed rows', () => {
  const entries = normalizeHistoryDetailEntries({
    answerDetails: [
      { userAnswer: 'B', isCorrect: true },
      'malformed-answer'
    ],
    questionSnapshots: [
      { questionText: 'Choose B' },
      { questionText: 'Still render this question' }
    ],
    optionSnapshots: [
      { options: ['A', 'B'] },
      null
    ]
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].data.optionsSnapshot, ['A', 'B']);
  assert.equal(entries[0].data.userAnswer, 'B');
  assert.equal(entries[1].malformed, true);
});

test('grammar option ids resolve to the same lettered answer text shown in the modal', () => {
  const options = [
    { id: 'question-1-option-0', text: 'gone' },
    { id: 'question-1-option-1', text: 'going' },
    { id: 'question-1-option-2', text: 'goes' },
    { id: 'question-1-option-3', text: 'go' }
  ];

  assert.equal(
    resolveHistoryOptionAnswer('question-1-option-3', options),
    'D. go'
  );
  assert.equal(
    resolveHistoryOptionAnswer('question-1-option-2', options),
    'C. goes'
  );
  assert.equal(resolveHistoryOptionAnswer('unknown-option', options), undefined);
});

test('response parser supplies safe defaults for a non-object payload', () => {
  const parsed = parseLearningHistoryResponse('not-an-object');
  assert.deepEqual(parsed.items, []);
  assert.equal(parsed.summary.totalAttempts, 0);
  assert.equal(parsed.pagination.page, 1);
  assert.equal(parsed.pagination.pageSize, 20);
  assert.deepEqual(parsed.filterOptions.games, []);
});
