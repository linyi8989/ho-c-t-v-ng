import type {
  LearningHistoryActor,
  LearningHistoryDetailResponse,
  LearningHistoryItem,
  LearningSourceType,
} from './learningHistoryTypes';

type DetailPayload = NonNullable<LearningHistoryDetailResponse['detail']>;

function parseJson(value: unknown, fallback: unknown, warnings: string[], field: string) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    warnings.push(`${field}:malformed_json`);
    return fallback;
  }
}

function arrayValue(value: unknown, warnings: string[], field: string) {
  const parsed = parseJson(value, [], warnings, field);
  if (!Array.isArray(parsed)) {
    warnings.push(`${field}:not_array`);
    return [];
  }
  return parsed;
}

function objectValue(value: unknown, warnings: string[], field: string) {
  const parsed = parseJson(value, {}, warnings, field);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnings.push(`${field}:not_object`);
    return {};
  }
  return parsed as Record<string, unknown>;
}

function stripReviewSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripReviewSecrets);
  if (!value || typeof value !== 'object') return value;
  const blocked = new Set([
    'correctanswer',
    'correctanswersnapshot',
    'correctoptionid',
    'acceptedanswers',
    'acceptedanswerssnapshot',
    'explanation',
    'explanationsnapshot',
    'answerkey',
    'expectedanswer',
    'modelanswer',
    'referenceanswer',
    'solution',
    'visualreview',
    'visualreviewsnapshot',
  ]);
  const safe: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '');
    if (blocked.has(normalizedKey)) continue;
    safe[key] = stripReviewSecrets(child);
  }
  return safe;
}

function reviewAllowed(
  actor: LearningHistoryActor,
  attempt: LearningHistoryItem,
  reviewPolicy: Record<string, unknown>,
  staffAuthorized: boolean,
) {
  if (staffAuthorized && (actor.role === 'teacher' || actor.role === 'super_admin')) return true;
  if (attempt.status !== 'completed') return false;
  return reviewPolicy.showReviewAfterSubmit === true;
}

export function normalizeStoredDetail(
  actor: LearningHistoryActor,
  attempt: LearningHistoryItem,
  row: Record<string, unknown>,
  staffAuthorized = false,
): DetailPayload {
  const warnings: string[] = [];
  const reviewPolicy = objectValue(
    row.review_policy_json ?? row.reviewPolicy,
    warnings,
    'reviewPolicy',
  );
  const canReview = reviewAllowed(actor, attempt, reviewPolicy, staffAuthorized);
  const payload: DetailPayload = {
    sourceType: (row.source_type || row.sourceType || attempt.sourceType) as LearningSourceType,
    answerDetails: arrayValue(
      row.answer_details_json ?? row.answerDetails,
      warnings,
      'answerDetails',
    ),
    questionSnapshots: arrayValue(
      row.question_snapshots_json ?? row.questionSnapshots,
      warnings,
      'questionSnapshots',
    ),
    optionSnapshots: arrayValue(
      row.option_snapshots_json ?? row.optionSnapshots,
      warnings,
      'optionSnapshots',
    ),
    extraDetails: objectValue(
      row.extra_details_json ?? row.extraDetails,
      warnings,
      'extraDetails',
    ),
    reviewPolicy: {
      showReviewAfterSubmit: reviewPolicy.showReviewAfterSubmit === true,
      showExplanationImmediately: reviewPolicy.showExplanationImmediately === true,
      policyVersion: Number(reviewPolicy.policyVersion || 1),
    },
    warnings,
  };
  if (canReview) return payload;
  return {
    ...payload,
    answerDetails: stripReviewSecrets(payload.answerDetails) as unknown[],
    questionSnapshots: stripReviewSecrets(payload.questionSnapshots) as unknown[],
    optionSnapshots: stripReviewSecrets(payload.optionSnapshots) as unknown[],
    extraDetails: stripReviewSecrets(payload.extraDetails) as Record<string, unknown>,
  };
}

export function normalizeLegacyDetail(
  actor: LearningHistoryActor,
  attempt: LearningHistoryItem,
  source: Record<string, any>,
  staffAuthorized = false,
): DetailPayload {
  const warnings = ['legacy_fallback'];
  const isGrammar = attempt.sourceType === 'grammar';
  const sourcePolicy = source.reviewPolicySnapshot;
  const reviewPolicy = sourcePolicy && typeof sourcePolicy === 'object'
    ? {
        showReviewAfterSubmit: sourcePolicy.showReviewAfterSubmit === true,
        showExplanationImmediately: sourcePolicy.showExplanationImmediately === true,
        policyVersion: Number(sourcePolicy.policyVersion || 1),
        legacyFallback: false,
      }
    : {
        // A legacy set's current policy is not proof of the policy at submission time.
        showReviewAfterSubmit: false,
        showExplanationImmediately: false,
        policyVersion: 0,
        legacyFallback: true,
      };

  const row = isGrammar
    ? {
        sourceType: 'grammar',
        answerDetails: Array.isArray(source.answers) ? source.answers : [],
        questionSnapshots: Array.isArray(source.questions) ? source.questions : [],
        optionSnapshots: Array.isArray(source.questions)
          ? source.questions.map((question: any) => ({
              attemptQuestionId: question?.id,
              options: Array.isArray(question?.optionsSnapshot) ? question.optionsSnapshot : [],
            }))
          : [],
        extraDetails: {
          grammarSetVersion: source.grammarSetVersion || '',
        },
        reviewPolicy,
      }
    : {
        sourceType: 'vocabulary',
        answerDetails: Array.isArray(source.answerDetails) ? source.answerDetails : [],
        questionSnapshots: Array.isArray(source.privateSnapshot?.items)
          ? source.privateSnapshot.items
          : [],
        optionSnapshots: [],
        extraDetails: {
          gameId: source.gameId || attempt.gameId,
          gradingMode: source.gradingMode || '',
        },
        reviewPolicy,
      };

  const normalized = normalizeStoredDetail(actor, attempt, row, staffAuthorized);
  return {
    ...normalized,
    warnings: [...warnings, ...normalized.warnings],
  };
}
