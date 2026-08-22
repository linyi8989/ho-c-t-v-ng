import crypto from 'node:crypto';
import type { ListeningPart, ListeningRegion } from '../../features/listening/types.js';
import {
  isValidListeningRegion,
  pointInListeningRegion,
  regionFromPolygon,
  transformListeningPoint,
  transformListeningRegion,
} from '../../features/listening/geometry.js';
import { MOVER_COLOUR_CATALOG } from '../../features/listening-library/modules/mover/editor/colourCatalog.js';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportData,
  ListeningSmartImportPartId,
  ListeningSmartImportProviderPreference,
  ListeningSmartImportSource,
  ListeningSmartImportSourceRole,
  SmartImportAnchor,
  SmartImportCrop,
  SmartImportPart5Action,
  SmartImportPart5PaletteItem,
} from '../../features/listening-editor/smart-import/types.js';

export interface SmartImportImageInput<TRole extends string = ListeningSmartImportSourceRole> {
  assetId: string;
  role: TRole;
  mimeType: string;
  data: Buffer;
}

export interface SmartImportVisionResult {
  text: string;
  provider: string;
  model?: string;
  errors?: string[];
}

export interface SmartImportVisionOptions {
  preferredProvider: ListeningSmartImportProviderPreference;
  responseJsonSchema: Record<string, unknown>;
  schemaName: string;
  requestId: string;
  attempt: number;
}

export type SmartImportVisionAnalyzer<TRole extends string = ListeningSmartImportSourceRole> = (
  prompt: string,
  images: SmartImportImageInput<TRole>[],
  options: SmartImportVisionOptions,
  signal?: AbortSignal
) => Promise<SmartImportVisionResult>;

interface CreateCandidateInput {
  part: ListeningSmartImportPartId;
  currentPart: ListeningPart;
  basePartHash: string;
  sources: ListeningSmartImportSource[];
  pastedText: string;
  images: SmartImportImageInput[];
  preferredProvider?: ListeningSmartImportProviderPreference;
  analyzeVision?: SmartImportVisionAnalyzer;
  signal?: AbortSignal;
}

const cleanText = (value: unknown, max = 1000) => String(value ?? '').normalize('NFKC').trim().slice(0, max);
const comparable = (value: unknown) => cleanText(value, 300).toLocaleLowerCase('en').replace(/[\u2018\u2019\u02bc`]/g, "'").replace(/\s+/g, ' ');
const clamp = (value: unknown, fallback = 0.5) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const integer = (value: unknown) => Number.isInteger(Number(value)) ? Number(value) : undefined;
const questionNumber = (value: unknown) => {
  const parsed = integer(value);
  return parsed && parsed >= 1 && parsed <= 5 ? parsed as 1 | 2 | 3 | 4 | 5 : undefined;
};
const DEFAULT_SMART_IMPORT_AI_PROVIDER_ID = 'stali:gpt-5.6-sol';
const PART1_SOL_PROVIDER_IDS = new Set([
  'stali:gpt-5.6-sol',
  'devquota:gpt-5.6-sol',
]);

function parseJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('AI không trả về dữ liệu.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const object = fenced?.[1] || trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)?.[1];
    if (!object) throw new Error('AI không trả về JSON hợp lệ.');
    return JSON.parse(object.trim());
  }
}

function providerFailureDetails(reason: any) {
  const rawDetails = Array.isArray(reason?.details)
    ? reason.details
    : Array.isArray(reason?.details?.providers)
      ? reason.details.providers
      : [];
  const details = rawDetails
    .map((value: unknown) => cleanText(value, 300))
    .filter(Boolean)
    .slice(0, 5);
  if (!details.length) {
    const fallback = cleanText(reason?.message || reason || 'Nhà cung cấp AI không khả dụng.', 300);
    if (fallback) details.push(fallback);
  }
  return details;
}

function providerFailureError(
  reason: any,
  part: ListeningSmartImportPartId,
  schemaName: string,
  signal?: AbortSignal,
) {
  const aborted = signal?.aborted || reason?.name === 'AbortError';
  const error: any = new Error(aborted
    ? `Smart Import Part ${part} đã bị hủy do quá thời gian xử lý.`
    : `Nhà cung cấp AI không hoàn tất phân tích Part ${part}. Draft chưa được thay đổi.`);
  const upstreamStatus = Number(reason?.status);
  error.status = aborted
    ? 504
    : upstreamStatus === 503 || upstreamStatus === 504
      ? upstreamStatus
      : 502;
  error.details = providerFailureDetails(reason);
  error.code = aborted ? 'LISTENING_SMART_IMPORT_TIMEOUT' : 'LISTENING_SMART_IMPORT_PROVIDER_FAILED';
  error.schemaName = schemaName;
  return error;
}

const textSchema = (maxLength = 1000) => ({ type: 'string', maxLength });
const numberSchema = { type: 'number', minimum: 0, maximum: 1 };
const pointSchema = {
  type: 'object',
  properties: { x: numberSchema, y: numberSchema },
  required: ['x', 'y'],
  additionalProperties: false,
};
const regionSchema = {
  type: 'object',
  properties: {
    shape: { type: 'string', enum: ['rect', 'ellipse', 'polygon'] },
    x: numberSchema,
    y: numberSchema,
    width: numberSchema,
    height: numberSchema,
    points: { type: 'array', items: pointSchema, maxItems: 80 },
  },
  required: ['shape', 'x', 'y', 'width', 'height'],
  additionalProperties: false,
};
const cropSchema = {
  type: 'object',
  properties: { x: numberSchema, y: numberSchema, width: numberSchema, height: numberSchema },
  required: ['x', 'y', 'width', 'height'],
  additionalProperties: false,
};

function responseSchemaFor(part: ListeningSmartImportPartId): Record<string, unknown> {
  const numbered = { type: 'integer', minimum: 1, maximum: 5 };
  if (part === 1) return {
    type: 'object', additionalProperties: false,
    properties: {
      questionScene: regionSchema,
      positionScene: regionSchema,
      printedNames: { type: 'array', items: { type: 'object', properties: { label: textSchema(120) }, required: ['label'], additionalProperties: false }, maxItems: 12 },
      example: { type: 'object', properties: { label: textSchema(120), targetEndpoint: pointSchema, coordinateRole: { type: 'string', enum: ['question', 'position_key'] } }, required: ['label'], additionalProperties: false },
      targets: { type: 'array', items: { type: 'object', properties: { targetNumber: numbered, visualLabel: textSchema(120), targetEndpoint: pointSchema, coordinateRole: { type: 'string', enum: ['question', 'position_key'] }, confidence: numberSchema }, required: ['targetNumber', 'visualLabel'], additionalProperties: false }, maxItems: 5 },
      answerMappings: { type: 'array', items: { type: 'object', properties: { targetNumber: numbered, visualLabel: textSchema(120), choiceLabel: textSchema(120) }, required: ['targetNumber', 'choiceLabel'], additionalProperties: false }, maxItems: 5 },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['printedNames', 'targets', 'answerMappings', 'warnings'],
  };
  if (part === 2) return {
    type: 'object', additionalProperties: false,
    properties: {
      heading: textSchema(200), instruction: textSchema(500), exampleText: textSchema(500), illustrationCrop: cropSchema,
      questions: { type: 'array', items: { type: 'object', properties: { questionNumber: numbered, prompt: textSchema() }, required: ['questionNumber', 'prompt'], additionalProperties: false }, maxItems: 5 },
      answers: { type: 'array', items: { type: 'object', properties: { questionNumber: numbered, correctAnswer: textSchema(300), answerVariants: { type: 'array', items: textSchema(300), maxItems: 8 } }, required: ['questionNumber'], additionalProperties: false }, maxItems: 5 },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['questions', 'answers', 'warnings'],
  };
  if (part === 3) return {
    type: 'object', additionalProperties: false,
    properties: {
      questionAnswers: { type: 'array', items: { type: 'object', properties: { label: textSchema(160), region: regionSchema, leftAnchorOffset: numberSchema, rightAnchorOffset: numberSchema }, required: ['label'], additionalProperties: false }, maxItems: 7 },
      questionPictures: { type: 'array', items: { type: 'object', properties: { label: textSchema(160), side: { type: 'string', enum: ['left', 'right'] }, row: { type: 'integer', minimum: 1, maximum: 3 }, region: regionSchema, anchorOffset: numberSchema }, required: ['side', 'row'], additionalProperties: false }, maxItems: 6 },
      questionExample: { type: 'object', properties: { answerLabel: textSchema(160), pictureSide: { type: 'string', enum: ['left', 'right'] }, pictureRow: { type: 'integer', minimum: 1, maximum: 3 }, renderOverlayLine: { type: 'boolean' } }, required: ['answerLabel', 'pictureSide', 'pictureRow'], additionalProperties: false },
      answerKeyCells: { type: 'array', items: { type: 'object', properties: { answerLabel: textSchema(160), side: { type: 'string', enum: ['left', 'right'] }, row: { type: 'integer', minimum: 1, maximum: 3 } }, required: ['answerLabel', 'side', 'row'], additionalProperties: false }, maxItems: 6 },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['questionAnswers', 'questionPictures', 'answerKeyCells', 'warnings'],
  };
  if (part === 4) return {
    type: 'object', additionalProperties: false,
    properties: {
      example: { type: 'object', properties: { prompt: textSchema(), crops: { type: 'array', items: cropSchema, maxItems: 3 }, answer: { type: 'string', enum: ['A', 'B', 'C'] } }, required: ['prompt'], additionalProperties: false },
      questions: { type: 'array', items: { type: 'object', properties: { questionNumber: numbered, prompt: textSchema(), crops: { type: 'array', items: cropSchema, maxItems: 3 } }, required: ['questionNumber', 'prompt'], additionalProperties: false }, maxItems: 5 },
      answers: { type: 'array', items: { type: 'object', properties: { questionNumber: numbered, answer: { type: 'string', enum: ['A', 'B', 'C'] } }, required: ['questionNumber', 'answer'], additionalProperties: false }, maxItems: 5 },
      orderedFallbackEvidence: { type: 'string', enum: ['single-row', 'single-column'] },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['questions', 'answers', 'warnings'],
  };
  return {
    type: 'object', additionalProperties: false,
    properties: {
      paletteItems: { type: 'array', items: { type: 'object', properties: { objectType: textSchema(120), label: textSchema(160), color: textSchema(80) }, required: ['objectType', 'label'], additionalProperties: false }, maxItems: 30 },
      questions: { type: 'array', items: { type: 'object', properties: { questionNumber: numbered, prompt: textSchema(), actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['colour_object', 'place_object'] }, objectLabel: textSchema(160), objectType: textSchema(120), correctColor: textSchema(80), color: textSchema(80), targetRegion: regionSchema, relationLabel: textSchema(240), confidence: numberSchema }, required: ['type'], additionalProperties: false }, maxItems: 10 } }, required: ['questionNumber', 'prompt', 'actions'], additionalProperties: false }, maxItems: 5 },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['paletteItems', 'questions', 'warnings'],
  };
}

function part3PassSchema(pass: 'question' | 'answer_key'): Record<string, unknown> {
  if (pass === 'question') return {
    type: 'object', additionalProperties: false,
    properties: {
      questionAnswers: {
        type: 'array', minItems: 7, maxItems: 7,
        items: {
          type: 'object', additionalProperties: false,
          properties: { label: textSchema(160), region: regionSchema, leftAnchorOffset: numberSchema, rightAnchorOffset: numberSchema },
          required: ['label', 'region'],
        },
      },
      questionPictures: {
        type: 'array', minItems: 6, maxItems: 6,
        items: {
          type: 'object', additionalProperties: false,
          properties: { label: textSchema(160), side: { type: 'string', enum: ['left', 'right'] }, row: { type: 'integer', minimum: 1, maximum: 3 }, region: regionSchema, anchorOffset: numberSchema },
          required: ['side', 'row', 'region'],
        },
      },
      questionExample: {
        type: 'object', additionalProperties: false,
        properties: {
          resolved: { type: 'boolean' },
          lineEvidence: { type: 'string', enum: ['printed-line'] },
          answerLabel: textSchema(160),
          pictureSide: { type: 'string', enum: ['left', 'right'] },
          pictureRow: { type: 'integer', minimum: 1, maximum: 3 },
          confidence: numberSchema,
          renderOverlayLine: { type: 'boolean' },
        },
        required: ['resolved'],
      },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['questionAnswers', 'questionPictures', 'questionExample', 'warnings'],
  };
  return {
    type: 'object', additionalProperties: false,
    properties: {
      layoutEvidence: { type: 'string', enum: ['three-rows-two-columns'] },
      answerKeyCells: {
        type: 'array', minItems: 5, maxItems: 6,
        items: {
          type: 'object', additionalProperties: false,
          properties: { answerLabel: textSchema(160), side: { type: 'string', enum: ['left', 'right'] }, row: { type: 'integer', minimum: 1, maximum: 3 } },
          required: ['answerLabel', 'side', 'row'],
        },
      },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['layoutEvidence', 'answerKeyCells', 'warnings'],
  };
}

function promptForPart3QuestionPass() {
  return `You inspect only ROLE question for Cambridge Movers Listening Part 3. Return only JSON and never technical IDs.
The worksheet always contains exactly seven answer labels in the centre, exactly three picture regions on the left, exactly three picture regions on the right, and exactly one pre-drawn printed example line.
Find the example ONLY by visually tracing that existing line on ROLE question. Do not infer it from answer order, typography, likely meaning, or any answer-key convention. Return questionExample.resolved=false if the printed line cannot be traced confidently; never guess.
For the traced line return lineEvidence="printed-line", the centre answer label it touches, the picture side and row it touches, and confidence. Do not return endpoints or line geometry. Rows are top=1, middle=2, bottom=3 independently on each side.
Return all seven questionAnswers with normalized regions, all six questionPictures with normalized regions, questionExample, and warnings. The printed example line is already visible on the background, so renderOverlayLine must be false.`;
}

function promptForPart3AnswerKeyPass(questionRaw: any) {
  const example = questionRaw?.questionExample;
  const verifiedExample = `${cleanText(example?.answerLabel, 160)} -> ${cleanText(example?.pictureSide, 20)} row ${integer(example?.pictureRow) || '?'}`;
  const labels = list(questionRaw?.questionAnswers).map((entry: any) => cleanText(entry?.label, 160)).filter(Boolean).join(', ');
  return `You inspect only ROLE answer_key for Cambridge Movers Listening Part 3. Return only JSON and never technical IDs.
Read the key as a spatial grid, never as linear OCR order: left column top/middle/bottom maps to left picture rows 1/2/3; right column top/middle/bottom maps to right picture rows 1/2/3.
The example was independently verified from the printed line on ROLE question as: ${verifiedExample}. The seven allowed labels are: ${labels}.
The answer key may contain all six picture cells including the example, or only the five scored cells. Preserve each cell's side and row. Do not select or change the example from this image. Do not shift rows when a cell is missing. Return layoutEvidence="three-rows-two-columns", answerKeyCells, and warnings.`;
}

function validatePart3QuestionResponse(raw: any) {
  const answers = list(raw?.questionAnswers);
  const pictures = list(raw?.questionPictures);
  const answerRows = answers.flatMap((entry: any) => {
    const label = cleanText(entry?.label, 160);
    const region = normalizedRegion(entry?.region || entry);
    return label && region ? [{ label, region }] : [];
  });
  const pictureRows = pictures.flatMap((entry: any) => {
    const side = entry?.side === 'left' || entry?.side === 'right' ? entry.side as 'left' | 'right' : undefined;
    const row = integer(entry?.row);
    const region = normalizedRegion(entry?.region || entry);
    return side && row && row >= 1 && row <= 3 && region ? [{ side, row, region }] : [];
  });
  const issues: string[] = [];
  if (answerRows.length !== 7 || new Set(answerRows.map(entry => comparable(entry.label))).size !== 7) issues.push('questionAnswers phải có đúng 7 label/region duy nhất');
  const pictureSlots = pictureRows.map(entry => `${entry.side}:${entry.row}`);
  if (pictureRows.length !== 6 || new Set(pictureSlots).size !== 6) issues.push('questionPictures phải có đúng left/right x row 1..3');
  const example = raw?.questionExample;
  const exampleLabel = cleanText(example?.answerLabel, 160);
  const exampleSide = example?.pictureSide === 'left' || example?.pictureSide === 'right' ? example.pictureSide as 'left' | 'right' : undefined;
  const exampleRow = integer(example?.pictureRow);
  const answer = answerRows.find(entry => comparable(entry.label) === comparable(exampleLabel));
  const picture = pictureRows.find(entry => entry.side === exampleSide && entry.row === exampleRow);
  if (example?.resolved !== true || example?.lineEvidence !== 'printed-line' || !answer || !picture) {
    issues.push('questionExample chưa chứng minh được đúng một printed line từ answer tới picture');
  }
  const confidence = Number(example?.confidence);
  if (!Number.isFinite(confidence) || confidence < 0.55) issues.push('confidence của printed example line quá thấp');
  return issues.length ? issues.join('; ') : undefined;
}

function validatePart3AnswerKeyResponse(raw: any, questionRaw: any) {
  const issues: string[] = [];
  if (raw?.layoutEvidence !== 'three-rows-two-columns') issues.push('answer key thiếu evidence bố cục ba hàng hai cột');
  const allowedLabels = new Set(list(questionRaw?.questionAnswers).map((entry: any) => comparable(entry?.label)).filter(Boolean));
  const cells = list(raw?.answerKeyCells).flatMap((entry: any) => {
    const label = cleanText(entry?.answerLabel, 160);
    const side = entry?.side === 'left' || entry?.side === 'right' ? entry.side as 'left' | 'right' : undefined;
    const row = integer(entry?.row);
    return label && side && row && row >= 1 && row <= 3 ? [{ label, side, row, slot: `${side}:${row}` }] : [];
  });
  if (![5, 6].includes(cells.length)) issues.push('answerKeyCells phải có đúng 5 scored cells hoặc đủ 6 cells gồm example');
  if (new Set(cells.map(cell => cell.slot)).size !== cells.length) issues.push('answer key bị trùng side+row');
  if (new Set(cells.map(cell => comparable(cell.label))).size !== cells.length) issues.push('answer key bị trùng label');
  if (cells.some(cell => !allowedLabels.has(comparable(cell.label)))) issues.push('answer key chứa label không có trên ảnh đề');
  return issues.length ? issues.join('; ') : undefined;
}

function part1PassSchema(pass: 'content' | 'geometry'): Record<string, unknown> {
  const numbered = { type: 'integer', minimum: 1, maximum: 5 };
  if (pass === 'content') return {
    type: 'object', additionalProperties: false,
    properties: {
      questionScene: regionSchema,
      printedNames: { type: 'array', items: { type: 'object', properties: { label: textSchema(120) }, required: ['label'], additionalProperties: false }, maxItems: 12 },
      example: {
        type: 'object', additionalProperties: false,
        properties: {
          label: textSchema(120),
          labelPoint: pointSchema,
          targetPoint: pointSchema,
          confidence: numberSchema,
        },
        required: ['label', 'labelPoint', 'targetPoint'],
      },
      answerMappings: {
        type: 'array', maxItems: 5,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            targetNumber: numbered,
            printedName: textSchema(120),
            visualDescription: textSchema(200),
            questionSubjectRegion: regionSchema,
            questionActionRegion: regionSchema,
            questionTargetPoint: pointSchema,
            confidence: numberSchema,
          },
          required: ['targetNumber', 'printedName'],
        },
      },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['questionScene', 'printedNames', 'example', 'answerMappings', 'warnings'],
  };
  return {
    type: 'object', additionalProperties: false,
    properties: {
      positionScene: regionSchema,
      example: {
        type: 'object', additionalProperties: false,
        properties: {
          label: textSchema(120),
          lineEndpoints: { type: 'array', items: pointSchema, minItems: 2, maxItems: 2 },
          confidence: numberSchema,
        },
        required: ['label', 'lineEndpoints', 'confidence'],
      },
      resolvedTargets: {
        type: 'array', maxItems: 5,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            targetNumber: numbered,
            printedName: textSchema(120),
            visualDescription: textSchema(200),
            lineEndpoints: { type: 'array', items: pointSchema, minItems: 2, maxItems: 2 },
            questionActionRegion: regionSchema,
            questionTargetPoint: pointSchema,
            confidence: numberSchema,
          },
          required: ['targetNumber', 'printedName', 'lineEndpoints', 'questionActionRegion'],
        },
      },
      unresolvedTargetNumbers: { type: 'array', items: numbered, maxItems: 5 },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['positionScene', 'example', 'resolvedTargets', 'unresolvedTargetNumbers', 'warnings'],
  };
}

function part1GeometryContext(contentRaw: any) {
  const mappings = list(contentRaw?.answerMappings).flatMap((entry: any) => {
    const targetNumber = questionNumber(entry?.targetNumber);
    const printedName = cleanText(entry?.printedName || entry?.choiceLabel || entry?.answer, 120);
    if (!targetNumber || !printedName) return [];
    const visualDescription = cleanText(entry?.visualDescription || entry?.visualLabel, 200);
    return [{ targetNumber, printedName, ...(visualDescription ? { visualDescription } : {}) }];
  });
  return {
    printedNames: list(contentRaw?.printedNames).map((entry: any) => cleanText(entry?.label ?? entry, 120)).filter(Boolean),
    mappings,
  };
}

function part1QuestionVerificationSchema(): Record<string, unknown> {
  const numbered = { type: 'integer', minimum: 1, maximum: 5 };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      label: textSchema(120),
      labelPoint: pointSchema,
      targetPoint: pointSchema,
      confidence: numberSchema,
      targets: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            targetNumber: numbered,
            visualDescription: textSchema(200),
            questionSubjectRegion: regionSchema,
            questionActionRegion: regionSchema,
            confidence: numberSchema,
          },
          required: ['targetNumber', 'visualDescription', 'questionSubjectRegion', 'questionActionRegion', 'confidence'],
        },
      },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['label', 'labelPoint', 'targetPoint', 'confidence', 'targets', 'warnings'],
  };
}

function part1SolExampleVerificationSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      label: textSchema(120),
      labelPoint: pointSchema,
      targetPoint: pointSchema,
      confidence: numberSchema,
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['label', 'labelPoint', 'targetPoint', 'confidence', 'warnings'],
  };
}

function part1SolGeometrySchema(): Record<string, unknown> {
  const numbered = { type: 'integer', minimum: 1, maximum: 5 };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      resolvedTargets: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            targetNumber: numbered,
            printedName: textSchema(120),
            questionTargetPoint: pointSchema,
            confidence: numberSchema,
          },
          required: ['targetNumber', 'printedName', 'questionTargetPoint', 'confidence'],
        },
      },
      unresolvedTargetNumbers: { type: 'array', items: numbered, maxItems: 5 },
      warnings: { type: 'array', items: textSchema(500) },
    },
    required: ['resolvedTargets', 'unresolvedTargetNumbers', 'warnings'],
  };
}

function promptForPart1QuestionVerification(contentRaw: any) {
  const printedNames = list(contentRaw?.printedNames)
    .map((entry: any) => cleanText(entry?.label ?? entry, 120))
    .filter(Boolean);
  const mappings = part1GeometryContext(contentRaw).mappings;
  return `Independently verify geometry on only the clean ROLE question image for Cambridge Movers Listening Part 1. Return only JSON matching the schema. Never return UUIDs or technical/database IDs. The visible names are ${JSON.stringify(printedNames)}. The five numbered visual descriptions are ${JSON.stringify(mappings)}. Exactly one visible name has a pre-drawn sample line: return that name as label, labelPoint beside its printed text outside the illustrated scene, and targetPoint at the other physical end inside the scene. Do not inherit an example guess from another pass.
For every targetNumber 1..5, copy visualDescription unchanged, tightly bound the primary person in questionSubjectRegion and tightly bound only the small visible action/contact landmark in questionActionRegion. The action landmark is where a small answer box belongs: banana at mouth, apple at hand/horse mouth, rabbit being held, reaching hands while chasing, pencil/paper while drawing, or the analogous landmark stated by visualDescription. Never use a whole body, torso, feet, secondary object or empty ground as questionActionRegion. The action region may sit immediately beside the primary person's body. Coordinates are normalized 0..1 relative to the complete ROLE question image, never relative to the illustrated-scene crop. Never return technical IDs. Use warnings rather than guessing.`;
}

function promptForPart1SolExampleVerification(contentRaw: any) {
  const printedNames = part1GeometryContext(contentRaw).printedNames;
  return `Inspect only IMAGE 1 (ROLE question). Visible names: ${JSON.stringify(printedNames)}.
Find the one printed name that already has a sample line on IMAGE 1. Return that label, a point beside its printed text, and the other endpoint of the same line inside the picture. Coordinates are normalized to the complete IMAGE 1. Do not inspect the five scored targets in this step.`;
}

function promptForPart1SolGeometry(contentRaw: any) {
  const context = part1GeometryContext(contentRaw).mappings;
  return `IMAGE 1 is ROLE question, IMAGE 2 is ROLE answer_key, and IMAGE 3 is ROLE position_key.
Verified mappings: ${JSON.stringify(context)}.
Use IMAGES 2 and 3 to identify the correct person for each mapping, then locate that same person on IMAGE 1. On IMAGE 3, follow the line from printedName to its person-side endpoint; never use the name-side endpoint. Return questionTargetPoint at the equivalent point on IMAGE 1, normalized to the complete IMAGE 1.
Do not re-read or change names, target numbers, descriptions, answers, or the example. Return only targets 1..5; exclude the example. If one target is uncertain, put only its number in unresolvedTargetNumbers instead of guessing.`;
}

function promptForPart1Pass(pass: 'content' | 'geometry', contentRaw?: any) {
  const common = 'You extract structured data for Cambridge Movers Listening Part 1. Each attached image is explicitly preceded by its technical ROLE label. Never use audio or transcript. Return only JSON matching the supplied schema. Coordinates are normalized 0..1 relative to the complete image for the named role. Never return UUIDs or technical/database/question/choice/target IDs. Do not guess unreadable text or geometry; use warnings and unresolvedTargetNumbers.';
  if (pass === 'content') return `${common}
Only ROLE question and ROLE answer_key are supplied. From question, detect every printed name. The example is not an unused-name guess: it is the one printed name that already has a visible pre-drawn sample line on ROLE question. Return its labelPoint beside the printed name and targetPoint at the other end inside the illustrated scene. Detect all visible names first, prove and remove that example, and leave exactly six draggable choices. From each numbered answer-key line, printedName is only the person's printed name immediately after the number (for example "1 Paul and the boy..." means printedName="Paul"); visualDescription is the remaining description of the destination person/picture. Return exactly five mappings keyed by targetNumber 1..5. Never put the visual description in printedName. On the clean ROLE question image, questionSubjectRegion tightly bounds the primary person described by visualDescription. questionActionRegion tightly bounds only the small visible action/contact landmark where an answer box belongs, such as banana at mouth, apple at hand/horse mouth, rabbit being held, reaching hands while chasing, or pencil/paper while drawing. questionActionRegion must not be the whole person, torso, feet or empty ground. questionTargetPoint, when returned, is the centre of questionActionRegion. The action region may be immediately beside questionSubjectRegion but must remain near that primary person. When a secondary object is mentioned, keep questionSubjectRegion on the primary person ("girl chasing the sheep" means the girl; "boy giving an apple to the horse" means the boy). Return questionScene around only the illustrated scene and exclude every printed-name band. Every coordinate is relative to the complete ROLE question image, not relative to questionScene. Do not use ROLE answer_key for coordinates; omit uncertain optional localization fields and add a warning rather than selecting a different subject.`;
  const context = JSON.stringify(part1GeometryContext(contentRaw));
  return `${common}
ROLE question, ROLE answer_key and ROLE position_key are supplied together for cross-image verification. ROLE position_key is the only source for completed line geometry; ROLE question is the canonical coordinate target and ROLE answer_key confirms the five name/description mappings.
The verified names and numbered answer mappings are: ${context}
For each numbered mapping, follow the line associated with printedName in position_key. Return printedName and visualDescription unchanged from the verified context. Return both physical line endpoints in lineEndpoints, in position_key coordinates. The endpoint beside the printed name is NOT the target. The target endpoint is the other endpoint, inside the illustrated scene and touching or nearest the person/picture. This is not always the lower endpoint because some printed names are below the scene.
Independently inspect ROLE question for the single pre-drawn example line. Do not inherit or guess an example from the content pass. Return example.label plus both endpoints of that one visible line in complete ROLE question coordinates; one endpoint must be beside the printed name outside questionScene and the other must be inside questionScene.
Use visualDescription to confirm the subject reached by the physical line. After tracing the endpoint on position_key, locate the same exact contact/action landmark on ROLE question. questionActionRegion must tightly bound only that small landmark (banana at mouth, apple at hand/horse mouth, rabbit being held, reaching hands while chasing, or pencil/paper while drawing), never a whole person, torso, feet or empty ground. questionTargetPoint, when returned, is the centre of questionActionRegion. A contact landmark may sit immediately beside the primary person's body. When visualDescription mentions a secondary object, retain the primary person's action landmark: for example use the chasing girl's reaching hands rather than the sheep, and the boy's apple/hand rather than the horse's body. Coordinates for questionActionRegion and questionTargetPoint are relative to the complete ROLE question image, not questionScene and not position_key. positionScene must bound the illustrated scene only, excluding the printed-name bands. Return resolvedTargets keyed by targetNumber, and put uncertain numbers in unresolvedTargetNumbers. Handle the example separately and never count it among the five scored targets.`;
}

function promptForPart5Content() {
  return `Return only JSON matching the supplied schema. Three role-labelled images are supplied: ROLE question is the clean image shown to students, ROLE answer_key is the authoritative source for the five numbered Colour/Draw instructions, and ROLE position_key shows the completed answer positions on the same scene. Transcribe every numbered instruction from ROLE answer_key and always return all of its logical actions; one question may contain several actions. A Colour action must keep objectLabel and correctColor from the instruction. A Draw action must keep objectType, optional color and relationLabel even when its position is uncertain. Never omit an action merely because targetRegion is uncertain: omit only targetRegion and add a warning. The already-coloured illustration on ROLE question is the unscored example, never an action or palette item. paletteItems contains only Draw objects, not printed colour swatches and not invented distractors. Use only these colour labels: ${MOVER_COLOUR_CATALOG.map(colour => colour.label).join(', ')}. For every place_object, compare position_key with question and, when certain, return a normalized rectangular targetRegion in complete ROLE question coordinates around the intended placement (for example the lamp location on the bedside table or the toy plane location between the boys). Do not return geometry for colour_object because the teacher paints those masks. Never return technical IDs. Never use audio or transcript. Add warnings instead of guessing uncertain content or Draw position.`;
}

function validatePart5ContentResponse(raw: any, attempt: number) {
  if (attempt > 1) return undefined;
  const questions = list(raw?.questions);
  const issues: string[] = [];
  const seenNumbers = new Set<number>();
  questions.forEach((question: any) => {
    const number = Number(question?.questionNumber);
    if (!Number.isInteger(number) || number < 1 || number > 5 || seenNumbers.has(number)) {
      issues.push('questionNumber phải duy nhất trong 1..5');
      return;
    }
    seenNumbers.add(number);
    const actions = list(question?.actions);
    if (!actions.length) issues.push(`câu ${number} thiếu action`);
    actions.forEach((action: any) => {
      if (action?.type === 'colour_object' && (!cleanText(action?.objectLabel, 160) || !catalogColourLabel(action?.correctColor || action?.color))) {
        issues.push(`câu ${number} có Colour thiếu objectLabel/correctColor`);
      }
      if (action?.type === 'place_object' && !cleanText(action?.objectType, 120)) issues.push(`câu ${number} có Draw thiếu objectType`);
    });
  });
  if (seenNumbers.size !== 5) issues.push(`chỉ nhận ${seenNumbers.size}/5 câu`);
  return issues.length ? [...new Set(issues)].join('; ') : undefined;
}

const normalizedCoordinate = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.NaN;
  return numeric > 1 && numeric <= 1000 ? numeric / 1000 : numeric;
};

function normalizedRect(value: any, minimum = 0.005): ListeningRegion | undefined {
  const source = value?.boundingBox || value?.bbox || value;
  if (Array.isArray(value?.box_2d) && value.box_2d.length === 4) {
    const [top, left, bottom, right] = value.box_2d.map(normalizedCoordinate);
    return normalizedRect({ x: left, y: top, width: right - left, height: bottom - top }, minimum);
  }
  const x = normalizedCoordinate(source?.x ?? source?.left);
  const y = normalizedCoordinate(source?.y ?? source?.top);
  const right = normalizedCoordinate(source?.right);
  const bottom = normalizedCoordinate(source?.bottom);
  const width = Number.isFinite(right) ? right - x : normalizedCoordinate(source?.width);
  const height = Number.isFinite(bottom) ? bottom - y : normalizedCoordinate(source?.height);
  const region: ListeningRegion = { shape: value?.shape === 'ellipse' ? 'ellipse' : 'rect', x, y, width, height };
  return width >= minimum && height >= minimum && isValidListeningRegion(region) ? region : undefined;
}

function normalizedRegion(value: any): ListeningRegion | undefined {
  if (value?.shape === 'polygon' || (!value?.shape && Array.isArray(value?.points) && value.points.length > 0)) {
    const points = list(value?.points).slice(0, 80).map((point: any) => ({ x: normalizedCoordinate(point?.x), y: normalizedCoordinate(point?.y) }));
    return regionFromPolygon(points) || undefined;
  }
  return normalizedRect(value);
}

function normalizedPoint(value: any) {
  const x = normalizedCoordinate(value?.x);
  const y = normalizedCoordinate(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
    ? { x, y }
    : undefined;
}

function pointNearListeningRegion(
  point: { x: number; y: number },
  region: ListeningRegion,
  margin = 0.035,
) {
  return pointInListeningRegion(point, region)
    || (point.x >= region.x - margin
      && point.x <= region.x + region.width + margin
      && point.y >= region.y - margin
      && point.y <= region.y + region.height + margin);
}

function part1QuestionActionPoint(entry: any) {
  const actionRegion = normalizedRegion(entry?.questionActionRegion);
  if (actionRegion && actionRegion.width <= 0.18 && actionRegion.height <= 0.18) {
    return {
      x: actionRegion.x + actionRegion.width / 2,
      y: actionRegion.y + actionRegion.height / 2,
    };
  }
  return normalizedPoint(entry?.questionTargetPoint);
}

function hasSafePart1QuestionLocation(entry: any, questionScene: ListeningRegion | undefined) {
  const point = part1QuestionActionPoint(entry);
  const subjectRegion = normalizedRegion(entry?.questionSubjectRegion);
  return Boolean(
    questionScene
    && point
    && subjectRegion
    && subjectRegion.width <= 0.35
    && subjectRegion.height <= 0.5
    && cleanText(entry?.visualDescription || entry?.visualLabel, 200)
    && clamp(entry?.confidence, 0) >= 0.85
    && pointInListeningRegion(point, questionScene)
    && pointNearListeningRegion(point, subjectRegion, 0.08),
  );
}

function part1TransformedGeometryPoint(
  entry: any,
  expectedEntry: any,
  questionScene: ListeningRegion | undefined,
  positionScene: ListeningRegion | undefined,
) {
  const expectedPoint = part1QuestionActionPoint(expectedEntry);
  const subjectRegion = normalizedRegion(expectedEntry?.questionSubjectRegion);
  const endpoints = list(entry?.lineEndpoints).map(normalizedPoint).filter(Boolean) as Array<{ x: number; y: number }>;
  if (!expectedPoint || !subjectRegion || endpoints.length !== 2 || !questionScene || !positionScene) return undefined;
  const inside = endpoints.filter(point => pointInListeningRegion(point, positionScene));
  if (inside.length !== 1) return undefined;
  const transformed = transformListeningPoint(inside[0], positionScene, questionScene);
  return transformed
    && pointInListeningRegion(transformed, questionScene)
    && pointNearListeningRegion(transformed, subjectRegion, 0.08)
    && part1PointDistance(transformed, expectedPoint) <= 0.12
    ? transformed
    : undefined;
}

function part1GeometryEvidenceIsUsable(
  entry: any,
  expectedEntry: any,
  questionScene: ListeningRegion | undefined,
  positionScene: ListeningRegion | undefined,
) {
  return Boolean(part1TransformedGeometryPoint(entry, expectedEntry, questionScene, positionScene));
}

function validatePart1ContentResponse(raw: any) {
  const questionScene = normalizedRegion(raw?.questionScene);
  const names = list(raw?.printedNames).map(value => cleanText((value as any)?.label ?? (value as any)?.name ?? value, 120)).filter(Boolean);
  const exampleLabel = cleanText(raw?.example?.label || raw?.exampleLabel, 120);
  const exampleLabelPoint = normalizedPoint(raw?.example?.labelPoint);
  const exampleTargetPoint = normalizedPoint(raw?.example?.targetPoint);
  const choices = names.filter(name => comparable(name) !== comparable(exampleLabel));
  const mappings = list(raw?.answerMappings);
  const issues: string[] = [];
  if (!exampleLabel || names.length !== 7 || choices.length !== 6 || new Set(names.map(comparable)).size !== 7) {
    issues.push('content phải có bảy printedNames duy nhất, gồm một example và sáu choices');
  }
  if (!questionScene) issues.push('content phải có questionScene hợp lệ, không gồm dải tên');
  if (!exampleLabelPoint || !exampleTargetPoint || !questionScene
    || pointInListeningRegion(exampleLabelPoint, questionScene)
    || !pointInListeningRegion(exampleTargetPoint, questionScene)) {
    issues.push('example phải được chứng minh bằng labelPoint ngoài scene và targetPoint trong scene của đường mẫu có sẵn');
  }
  const seenNumbers = new Set<number>();
  const seenNames = new Set<string>();
  mappings.forEach((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    const printedName = cleanText(entry?.printedName || entry?.choiceLabel, 120);
    const key = comparable(printedName);
    if (!number || seenNumbers.has(number)) issues.push('targetNumber mapping thiếu hoặc trùng');
    else seenNumbers.add(number);
    if (!key || seenNames.has(key) || !choices.some(choice => comparable(choice) === key)) issues.push('printedName mapping phải khớp duy nhất một choice không phải example');
    else seenNames.add(key);
  });
  if (mappings.length !== 5 || seenNumbers.size !== 5 || seenNames.size !== 5) issues.push('content phải có đúng năm mapping đánh số');
  return issues.length ? [...new Set(issues)].join('; ') : undefined;
}

function verifiedPart1GeometryExample(raw: any, contentRaw: any, questionScene: ListeningRegion | undefined) {
  const label = cleanText(raw?.example?.label, 120);
  const expectedLabel = cleanText(contentRaw?.example?.label, 120);
  const printedNames = list(contentRaw?.printedNames)
    .map((entry: any) => cleanText(entry?.label ?? entry, 120))
    .filter(Boolean);
  const endpoints = list(raw?.example?.lineEndpoints)
    .map(normalizedPoint)
    .filter(Boolean) as Array<{ x: number; y: number }>;
  if (!label || !expectedLabel || comparable(label) !== comparable(expectedLabel)
    || !printedNames.some(name => comparable(name) === comparable(label))
    || !questionScene || endpoints.length !== 2 || clamp(raw?.example?.confidence, 0) < 0.8) return undefined;
  const inside = endpoints.filter(point => pointInListeningRegion(point, questionScene));
  if (inside.length !== 1) return undefined;
  return { label, targetPoint: inside[0], confidence: clamp(raw?.example?.confidence, 0.8) };
}

function verifiedPart1QuestionExample(raw: any, contentRaw: any) {
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  const label = cleanText(raw?.label, 120);
  const labelPoint = normalizedPoint(raw?.labelPoint);
  const targetPoint = normalizedPoint(raw?.targetPoint);
  const printedNames = list(contentRaw?.printedNames)
    .map((entry: any) => cleanText(entry?.label ?? entry, 120))
    .filter(Boolean);
  if (!questionScene || !label || !labelPoint || !targetPoint
    || !printedNames.some(name => comparable(name) === comparable(label))
    || clamp(raw?.confidence, 0) < 0.8
    || pointInListeningRegion(labelPoint, questionScene)
    || !pointInListeningRegion(targetPoint, questionScene)) return undefined;
  return { label, targetPoint, confidence: clamp(raw?.confidence, 0.8) };
}

function validatePart1QuestionVerification(raw: any, contentRaw: any) {
  const issues: string[] = [];
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  if (!verifiedPart1QuestionExample(raw, contentRaw)) {
    issues.push('không chứng minh được duy nhất tên example bằng đường mẫu trên ảnh đề');
  }
  const expected = new Map(list(contentRaw?.answerMappings).flatMap((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    return number ? [[number, entry] as const] : [];
  }));
  const seen = new Set<number>();
  list(raw?.targets).forEach((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    if (!number || seen.has(number) || !expected.has(number)) {
      issues.push('question verification có targetNumber thiếu, trùng hoặc ngoài mapping');
      return;
    }
    seen.add(number);
    if (comparable(entry?.visualDescription) !== comparable(expected.get(number)?.visualDescription)) {
      issues.push(`target ${number} không giữ đúng visualDescription từ content pass`);
    }
    if (!hasSafePart1QuestionLocation({ ...expected.get(number), ...entry }, questionScene)) {
      issues.push(`target ${number} thiếu action landmark an toàn trên ảnh đề`);
    }
    const expectedSubject = normalizedRegion(expected.get(number)?.questionSubjectRegion);
    const verifiedSubject = normalizedRegion(entry?.questionSubjectRegion);
    if (expectedSubject && verifiedSubject) {
      const expectedCenter = { x: expectedSubject.x + expectedSubject.width / 2, y: expectedSubject.y + expectedSubject.height / 2 };
      const verifiedCenter = { x: verifiedSubject.x + verifiedSubject.width / 2, y: verifiedSubject.y + verifiedSubject.height / 2 };
      if (part1PointDistance(expectedCenter, verifiedCenter) > 0.16) {
        issues.push(`target ${number} lệch primary subject so với lượt content độc lập`);
      }
    }
  });
  if (seen.size !== 5 || [1, 2, 3, 4, 5].some(number => !seen.has(number))) {
    issues.push('question verification phải phủ đúng targetNumber 1..5');
  }
  return issues.length ? [...new Set(issues)].join('; ') : undefined;
}

function validatePart1SolExampleVerification(raw: any, contentRaw: any) {
  return verifiedPart1QuestionExample(raw, contentRaw)
    ? undefined
    : 'không chứng minh được duy nhất tên example bằng đường mẫu trên ảnh đề';
}

function validatePart1SolGeometryResponse(raw: any, contentRaw: any) {
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  const expected = new Map(list(contentRaw?.answerMappings).flatMap((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    return number ? [[number, entry] as const] : [];
  }));
  const seen = new Set<number>();
  const issues: string[] = [];
  if (!questionScene) issues.push('content pass thiếu questionScene hợp lệ');
  list(raw?.resolvedTargets).forEach((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    if (!number || seen.has(number)) {
      issues.push('resolved targetNumber thiếu hoặc trùng');
      return;
    }
    seen.add(number);
    if (!expected.has(number)
      || comparable(expected.get(number)?.printedName) !== comparable(entry?.printedName)) {
      issues.push(`target ${number} không giữ đúng printedName từ content pass`);
    }
    const point = normalizedPoint(entry?.questionTargetPoint);
    if (!point || !questionScene || !pointInListeningRegion(point, questionScene)) {
      issues.push(`target ${number} thiếu questionTargetPoint hợp lệ trên ảnh đề`);
    }
    if (clamp(entry?.confidence, 0) < 0.7) {
      issues.push(`target ${number} confidence thấp; phải chuyển target này sang unresolved`);
    }
  });
  list(raw?.unresolvedTargetNumbers).forEach(value => {
    const number = questionNumber(value);
    if (!number || seen.has(number)) {
      issues.push('unresolved targetNumber thiếu, trùng hoặc vừa resolved vừa unresolved');
      return;
    }
    seen.add(number);
  });
  if (seen.size !== 5 || [1, 2, 3, 4, 5].some(number => !seen.has(number))) {
    issues.push('resolvedTargets và unresolvedTargetNumbers phải phủ đúng 1..5');
  }
  return issues.length ? [...new Set(issues)].join('; ') : undefined;
}

function validatePart1GeometryResponse(raw: any, contentRaw: any, requireEveryResolvedTarget = false) {
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  const positionScene = normalizedRegion(raw?.positionScene);
  const expected = new Map(list(contentRaw?.answerMappings).flatMap((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    return number ? [[number, entry] as const] : [];
  }));
  const resolved = list(raw?.resolvedTargets);
  const unresolved = list(raw?.unresolvedTargetNumbers).flatMap(value => {
    const number = questionNumber(value);
    return number ? [number] : [];
  });
  const issues: string[] = [];
  if (!questionScene) issues.push('content pass thiếu questionScene hợp lệ');
  if (!positionScene) issues.push('thiếu positionScene hợp lệ');
  if (!verifiedPart1GeometryExample(raw, contentRaw, questionScene)) {
    issues.push('example geometry phải độc lập chứng minh đúng tên và một endpoint ngoài/một endpoint trong questionScene');
  }
  const seenNumbers = new Set<number>();
  let usableResolvedTargets = 0;
  resolved.forEach((entry: any) => {
    const number = questionNumber(entry?.targetNumber);
    const printedName = cleanText(entry?.printedName || entry?.choiceLabel, 120);
    if (!number || seenNumbers.has(number)) {
      issues.push('resolved targetNumber thiếu hoặc trùng');
      return;
    }
    seenNumbers.add(number);
    if (!expected.has(number) || comparable(expected.get(number)?.printedName) !== comparable(printedName)) {
      issues.push(`target ${number} không giữ đúng printedName từ content pass`);
    }
    if (part1GeometryEvidenceIsUsable(entry, expected.get(number), questionScene, positionScene)) usableResolvedTargets += 1;
    else if (requireEveryResolvedTarget) issues.push(`target ${number} không khớp subject/scene evidence; cần trace lại đúng đường của printedName`);
  });
  unresolved.forEach(number => {
    if (seenNumbers.has(number)) issues.push(`target ${number} vừa resolved vừa unresolved`);
    seenNumbers.add(number);
  });
  if (seenNumbers.size !== 5 || [1, 2, 3, 4, 5].some(number => !seenNumbers.has(number))) {
    issues.push('resolvedTargets và unresolvedTargetNumbers phải phủ đúng 1..5');
  }
  if (resolved.length && usableResolvedTargets === 0) issues.push('không có resolved target nào đủ direct point và line/scene evidence nhất quán');
  return issues.length ? [...new Set(issues)].join('; ') : undefined;
}

function normalizeCrop(value: any): SmartImportCrop | undefined {
  const region = normalizedRect(value, 0.02);
  return region ? { x: region.x, y: region.y, width: region.width, height: region.height } : undefined;
}

function fixedRegionFromPoint(point: { x: number; y: number }): ListeningRegion {
  const width = 0.12;
  const height = 0.055;
  return {
    shape: 'rect',
    x: Math.min(1 - width, Math.max(0, point.x - width / 2)),
    y: Math.min(1 - height, Math.max(0, point.y - height / 2)),
    width,
    height,
  };
}

function promptFor(part: ListeningSmartImportPartId, pastedText: string) {
  const common = `You extract structured data for Cambridge Movers Listening Part ${part}. Each attached image is explicitly preceded by its technical ROLE label; never infer roles from image order. Never use audio or transcript. Return only JSON. Coordinates are normalized 0..1. Do not invent unreadable text, answers, objects, colours, geometry or IDs. Never return UUID/database/question/action/object/choice IDs. Use warnings for uncertainty.`;
  const pasted = pastedText ? `\nTeacher supplied an explicit manual OCR fallback for the answer text:\n${pastedText}` : '';
  if (part === 1) return `${common}
ROLE question: detect every printed name, identify and separate the example, and locate the canonical scene. After removing the example there must be six draggable names. ROLE answer_key: read the five name-to-picture mappings. ROLE position_key: identify the five line endpoints on the picture/person side, never the name-side endpoints, plus the corresponding scene rectangle. Return questionScene, positionScene, printedNames, example, targets and answerMappings. Each target should have visualLabel, optional targetNumber, targetEndpoint and confidence; each mapping should have visualLabel/targetNumber and choiceLabel.${pasted}`;
  if (part === 2) return `${common}
ROLE question supplies optional heading/instruction, the example, and exactly five numbered prompts. ROLE answer_key supplies accepted answers numbered 1..5. Never infer an answer from the question image. Preserve text such as 4b exactly and split variants only when the source explicitly separates them with |. Return heading, instruction, exampleText, questions [{questionNumber,prompt}], answers [{questionNumber,correctAnswer,answerVariants}], and optional picture-only illustrationCrop from the question image.${pasted}`;
  if (part === 3) return `${common}
ROLE question is the full worksheet: detect seven centre answer labels/regions with left/right anchor hints, six picture regions arranged three left and three right, and the printed example connection. ROLE answer_key is a two-column by three-row mapping; preserve side+row and do not flatten OCR order. Return questionAnswers, questionPictures, questionExample, answerKeyCells and warnings. The example is unscored and the remaining unused answer is the distractor.${pasted}`;
  if (part === 4) return `${common}
ROLE question contains one example followed by exactly five numbered questions. Read only the example prompt and five numbered prompts; deterministic browser pixel code handles all picture crops, so crops may be omitted. ROLE answer_key supplies only scored answers 1..5 as A/B/C; map by questionNumber, never OCR index. Only the explicit example marker on the question image may set the example answer. Return valid JSON with example, questions, answers, orderedFallbackEvidence and warnings using exactly the supplied schema.${pasted}`;
  return `${common}
ROLE question, ROLE answer_key and ROLE position_key supply Part 5 content. Detect every colour_object/place_object action and return Draw target regions in ROLE question coordinates by comparing the completed position key with the clean question. Never return Colour masks or technical IDs; teachers paint Colour regions manually. Colours must use only: ${MOVER_COLOUR_CATALOG.map(colour => colour.label).join(', ')}.${pasted}`;
}

function localNumberedLines(pastedText: string) {
  return pastedText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([1-5])[.)\s:-]+(.+)$/);
    return match ? { questionNumber: Number(match[1]), value: match[2].trim() } : { value: line };
  });
}

function normalizeNumberedEntries<T>(
  values: unknown[],
  convert: (entry: any) => T | undefined,
  warnings: string[],
  label: string,
  allowOrderedFallback = false,
) {
  const numbered = new Map<number, T>();
  const conflicts = new Set<number>();
  const unnumbered: T[] = [];
  values.forEach(entry => {
    const value = convert(entry);
    if (value === undefined) return;
    const number = questionNumber((entry as any)?.questionNumber ?? (entry as any)?.number);
    if (!number) {
      unnumbered.push(value);
      return;
    }
    if (numbered.has(number)) {
      numbered.delete(number);
      conflicts.add(number);
    } else if (!conflicts.has(number)) numbered.set(number, value);
  });
  conflicts.forEach(number => warnings.push(`${label}: số câu ${number} bị trùng nên được giữ unresolved.`));
  if (!numbered.size && allowOrderedFallback && unnumbered.length === 5) {
    warnings.push(`${label}: dùng ordered fallback vì có đúng năm giá trị không đánh số với cấu trúc rõ ràng.`);
    unnumbered.forEach((value, index) => numbered.set(index + 1, value));
  } else if (numbered.size && unnumbered.length) {
    warnings.push(`${label}: bỏ qua giá trị không đánh số; không dồn index vào chỗ trống.`);
  }
  return numbered;
}

const part1PointDistance = (first: { x: number; y: number }, second: { x: number; y: number }) => (
  Math.hypot(first.x - second.x, first.y - second.y)
);

function resolvePart1TargetPoint(
  entry: any,
  questionScene: ListeningRegion | undefined,
  positionScene: ListeningRegion | undefined,
  warnings: string[],
  warningLabel: string,
  requirePositionEvidence = false,
) {
  const explicitQuestionPoint = part1QuestionActionPoint(entry);
  const questionSubjectRegion = normalizedRegion(entry?.questionSubjectRegion);
  let directPoint = explicitQuestionPoint;
  if (!directPoint && entry?.coordinateRole !== 'position_key') {
    directPoint = normalizedPoint(entry?.targetEndpoint || entry?.center || {
      x: entry?.centerX ?? entry?.x,
      y: entry?.centerY ?? entry?.y,
    });
  }
  if ((entry?.questionTargetPoint || entry?.questionActionRegion) && !explicitQuestionPoint) {
    warnings.push(`${warningLabel}: questionActionRegion/questionTargetPoint không hợp lệ.`);
  }
  if (directPoint && questionScene && !pointInListeningRegion(directPoint, questionScene)) {
    warnings.push(`${warningLabel}: questionTargetPoint nằm ngoài questionScene.`);
    directPoint = undefined;
  }
  if (requirePositionEvidence && (!questionSubjectRegion || !directPoint || !pointNearListeningRegion(directPoint, questionSubjectRegion, 0.08))) {
    warnings.push(`${warningLabel}: điểm đích không được xác minh nằm trên hoặc sát action landmark của primary subject trong ảnh đề; giữ unresolved.`);
    return undefined;
  }
  const canUseIndependentQuestionLocation = Boolean(
    requirePositionEvidence
    && directPoint
    && questionSubjectRegion
    && cleanText(entry?.visualDescription || entry?.visualLabel, 200)
    && clamp(entry?.questionLocationConfidence, 0) >= 0.85,
  );

  let positionEndpoint = normalizedPoint(entry?.positionKeyEndpoint);
  if (!positionEndpoint && entry?.coordinateRole === 'position_key') {
    positionEndpoint = normalizedPoint(entry?.targetEndpoint || entry?.center);
  }
  const rawLineEndpoints = list(entry?.lineEndpoints);
  if (rawLineEndpoints.length) {
    const endpoints = rawLineEndpoints.map(normalizedPoint).filter(Boolean) as Array<{ x: number; y: number }>;
    if (endpoints.length !== 2) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: lineEndpoints phải có đúng hai điểm hợp lệ.`);
    } else if (!positionScene) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: thiếu positionScene nên chưa thể xác định đầu phía hình từ hai đầu đường nối.`);
    } else {
      const insideScene = endpoints.filter(point => pointInListeningRegion(point, positionScene));
      if (insideScene.length === 1) positionEndpoint = insideScene[0];
      else if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: không phân biệt duy nhất đầu phía tên và đầu phía hình bằng positionScene.`);
    }
  }

  let transformedPoint: { x: number; y: number } | undefined;
  if (positionEndpoint) {
    if (!questionScene) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: thiếu questionScene để quy đổi endpoint từ ảnh đáp án vị trí.`);
    } else if (!positionScene) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: thiếu positionScene để quy đổi endpoint từ ảnh đáp án vị trí.`);
    } else {
      transformedPoint = transformListeningPoint(positionEndpoint, positionScene, questionScene) || undefined;
      if (!transformedPoint) warnings.push(`${warningLabel}: endpoint phía hình nằm ngoài positionScene hoặc scene transform không hợp lệ.`);
    }
  }

  if (directPoint && transformedPoint && part1PointDistance(directPoint, transformedPoint) > 0.12) {
    if (canUseIndependentQuestionLocation) {
      warnings.push(`${warningLabel}: line/scene evidence mâu thuẫn; dùng localization độc lập confidence cao trên ảnh đề và yêu cầu giáo viên review.`);
      return directPoint;
    }
    warnings.push(`${warningLabel}: vị trí trực tiếp trên ảnh đề mâu thuẫn với scene transform; giữ unresolved.`);
    return undefined;
  }
  if (requirePositionEvidence && transformedPoint && questionSubjectRegion && !pointNearListeningRegion(transformedPoint, questionSubjectRegion, 0.08)) {
    if (canUseIndependentQuestionLocation) {
      warnings.push(`${warningLabel}: endpoint quy đổi lệch primary subject; dùng localization độc lập confidence cao trên ảnh đề và yêu cầu giáo viên review.`);
      return directPoint;
    }
    warnings.push(`${warningLabel}: endpoint quy đổi không nằm trên primary subject trong ảnh đề; giữ unresolved.`);
    return undefined;
  }
  if (requirePositionEvidence && directPoint && !transformedPoint) {
    if (canUseIndependentQuestionLocation) {
      warnings.push(`${warningLabel}: chưa trace chắc endpoint; dùng localization độc lập confidence cao trên ảnh đề và yêu cầu giáo viên review.`);
      return directPoint;
    }
    warnings.push(`${warningLabel}: chưa có endpoint/scene transform để xác minh vị trí trực tiếp trên ảnh đề; giữ unresolved.`);
    return undefined;
  }
  if (directPoint) return directPoint;
  if (transformedPoint) return transformedPoint;
  if (!positionEndpoint && !rawLineEndpoints.length) {
    warnings.push(`${warningLabel}: AI không trả questionTargetPoint hoặc endpoint đường nối phía hình.`);
  }
  return undefined;
}

function normalizePart1(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 1 }> {
  const exampleLabel = cleanText(raw?.example?.label || raw?.exampleLabel, 120);
  const allNames = list(raw?.printedNames || raw?.choices || raw?.detectedNames || raw?.names).map(value => cleanText((value as any)?.label ?? (value as any)?.name ?? value, 120)).filter(Boolean);
  const seenNames = new Set<string>();
  const choices = allNames.filter(name => {
    const key = comparable(name);
    if ((exampleLabel && key === comparable(exampleLabel)) || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  }).slice(0, 6);
  if (!exampleLabel) warnings.push('Part 1: chưa xác định chắc tên example.');
  if (choices.length !== 6) warnings.push(`Part 1: sau khi tách example nhận ${choices.length}/6 choices; không tự ép đủ bằng dữ liệu giả.`);

  const questionScene = normalizedRegion(raw?.questionScene);
  const positionScene = normalizedRegion(raw?.positionScene);
  const mappings = list(raw?.answerMappings);
  const rawTargets = list(raw?.resolvedTargets || raw?.targets || raw?.questionTargets || raw?.anchors);
  const explicitlyUnresolved = new Set(list(raw?.unresolvedTargetNumbers).flatMap(value => {
    const number = questionNumber(value);
    return number ? [number] : [];
  }));
  explicitlyUnresolved.forEach(number => warnings.push(`Part 1 target ${number}: AI đánh dấu unresolved ở lượt geometry; giữ vùng draft cũ.`));
  const byNumber = new Map<number, any>();
  rawTargets.forEach((target: any, index) => {
    const number = questionNumber(target?.targetNumber)
      || (!raw?.geometryPassAttempted && index < 5 ? index + 1 : undefined);
    if (number && !byNumber.has(number)) byNumber.set(number, target);
    else if (!number) warnings.push('Part 1 geometry: bỏ qua target không có targetNumber hợp lệ; không dồn OCR index.');
  });
  const anchors: SmartImportAnchor[] = [];
  const targetChoiceLabels: Array<string | undefined> = Array.from({ length: 5 });
  for (let number = 1; number <= 5; number += 1) {
    const target = byNumber.get(number);
    const visualLabel = cleanText(target?.visualDescription || target?.visualLabel || target?.label || `Vùng ${number}`, 200);
    const mapping = mappings.find((entry: any) => questionNumber(entry?.targetNumber) === number
      || (target && visualLabel && comparable(entry?.visualDescription || entry?.visualLabel) === comparable(visualLabel)));
    const choiceLabel = cleanText(mapping?.printedName || mapping?.choiceLabel || mapping?.answer || target?.printedName || target?.choiceLabel || target?.answer, 120);
    const matchingChoices = choices.filter(choice => comparable(choice) === comparable(choiceLabel));
    if (choiceLabel && matchingChoices.length !== 1) {
      warnings.push(`Part 1 target ${number}: printedName "${choiceLabel}" không khớp duy nhất một trong sáu choices; giữ đáp án draft.`);
    }
    targetChoiceLabels[number - 1] = matchingChoices.length === 1 ? matchingChoices[0] : undefined;
    if (!target) continue;
    if (target?.coordinateRole && target.coordinateRole !== 'question' && target.coordinateRole !== 'position_key') {
      warnings.push(`Part 1 target ${number}: coordinateRole không được hỗ trợ.`);
      continue;
    }
    const requirePositionEvidence = Boolean(raw?.geometryPassAttempted) && raw?.geometryMode !== 'direct-question-points';
    const point = resolvePart1TargetPoint(target, questionScene, positionScene, warnings, `Part 1 target ${number}`, requirePositionEvidence);
    if (!point) {
      continue;
    }
    anchors.push({ targetNumber: number as 1 | 2 | 3 | 4 | 5, label: visualLabel, region: fixedRegionFromPoint(point), confidence: clamp(target?.confidence, 0.5) });
  }
  if (anchors.length !== 5) warnings.push(`Part 1: chỉ resolve được ${anchors.length}/5 target endpoints.`);
  if (targetChoiceLabels.filter(Boolean).length !== 5) warnings.push('Part 1: answer key chưa resolve đủ năm mapping; giữ đáp án draft ở mục unresolved.');

  let example: { label: string; region: ListeningRegion } | undefined;
  if (exampleLabel && raw?.example) {
    const point = resolvePart1TargetPoint(raw.example, questionScene, positionScene, warnings, 'Part 1 example', false);
    if (point) example = { label: exampleLabel, region: fixedRegionFromPoint(point) };
  }
  return { part: 1, choices, anchors, targetChoiceLabels, ...(example ? { example } : {}) };
}

function answerVariants(entry: any) {
  const source = list(entry?.answerVariants).length
    ? list(entry.answerVariants)
    : [entry?.correctAnswer ?? entry?.answer];
  const seen = new Set<string>();
  return source.flatMap(value => cleanText(value, 300).split('|')).map(value => value.trim()).filter(value => {
    const key = comparable(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function normalizePart2(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 2 }> {
  const questionMap = normalizeNumberedEntries(list(raw?.questions), entry => {
    const prompt = cleanText(entry?.prompt || entry?.question, 1000).replace(/_{2,}/g, '{{blank}}');
    return prompt ? prompt : undefined;
  }, warnings, 'Part 2 prompts');
  const answerMap = normalizeNumberedEntries(list(raw?.answers).length ? list(raw.answers) : list(raw?.questions), entry => {
    const answers = answerVariants(entry);
    return answers.length ? answers : undefined;
  }, warnings, 'Part 2 answer key', true);
  const numbers = new Set([...questionMap.keys(), ...answerMap.keys()]);
  const questions = [...numbers].sort().flatMap(number => {
    const valid = questionNumber(number);
    if (!valid) return [];
    return [{ questionNumber: valid, prompt: questionMap.get(number), acceptedAnswers: answerMap.get(number) }];
  });
  if (questionMap.size !== 5) warnings.push(`Part 2: nhận ${questionMap.size}/5 prompt đánh số.`);
  if (answerMap.size !== 5) warnings.push(`Part 2: nhận ${answerMap.size}/5 answer mappings; mục thiếu giữ dữ liệu cũ.`);
  const illustrationCrop = normalizeCrop(raw?.illustrationCrop);
  return {
    part: 2,
    heading: cleanText(raw?.heading, 200) || undefined,
    instruction: cleanText(raw?.instruction, 500) || undefined,
    exampleText: cleanText(raw?.exampleText || raw?.example, 500) || undefined,
    ...(illustrationCrop ? { illustrationCrop } : {}),
    questions,
  };
}

function normalizePart3(raw: any, currentPart: ListeningPart, warnings: string[]): Extract<ListeningSmartImportData, { part: 3 }> {
  type Part3Data = Extract<ListeningSmartImportData, { part: 3 }>;
  const current = currentPart.part === 3 && currentPart.displayMode === 'connect-image' ? currentPart : undefined;
  const rawAnswers = list(raw?.questionAnswers || raw?.answers || raw?.answerLabels).slice(0, 7);
  const extractedAnswers: Part3Data['answers'] = rawAnswers.flatMap((entry: any, index) => {
    const label = cleanText(entry?.label ?? entry, 160);
    const extractedRegion = normalizedRegion(entry?.region || entry);
    const region = extractedRegion || current?.answers[index]?.region;
    if (!label) return [];
    if (!extractedRegion && region) warnings.push(`Part 3 answer "${label}": giữ region draft vì AI không trả geometry hợp lệ.`);
    if (!region) return [];
    return [{ label, region, leftAnchorOffset: clamp(entry?.leftAnchorOffset ?? entry?.leftAnchor?.offset, 0.5), rightAnchorOffset: clamp(entry?.rightAnchorOffset ?? entry?.rightAnchor?.offset, 0.5), source: extractedRegion ? 'ai' as const : 'mixed' as const }];
  });
  const answers: Part3Data['answers'] = [...extractedAnswers];
  (current?.answers || []).forEach(answer => {
    if (answers.length < 7 && !answers.some(item => comparable(item.label) === comparable(answer.label))) {
      answers.push({ label: answer.label, region: answer.region, leftAnchorOffset: answer.leftAnchorOffset, rightAnchorOffset: answer.rightAnchorOffset, source: 'current-part' });
    }
  });
  if (extractedAnswers.length !== 7 && current?.answers.length) warnings.push(`Part 3: AI nhận ${extractedAnswers.length}/7 answer; các slot thiếu giữ dữ liệu draft để review.`);

  const rawPictures = list(raw?.questionPictures || raw?.pictures || raw?.pictureRegions).slice(0, 6);
  const extractedPictures: Part3Data['pictures'] = rawPictures.flatMap((entry: any) => {
    const sideValue = cleanText(entry?.side || entry?.pictureSide, 20).toLowerCase();
    const side = sideValue === 'left' || sideValue === 'right' ? sideValue as 'left' | 'right' : undefined;
    const row = integer(entry?.row);
    const old = side && row ? current?.pictures.find(item => item.side === side && item.row === row) : undefined;
    const extractedRegion = normalizedRegion(entry?.region || entry);
    const region = extractedRegion || old?.region;
    if (!side || !row || row < 1 || row > 3 || !region) return [];
    if (!extractedRegion && old) warnings.push(`Part 3 picture ${side}-${row}: giữ region draft vì AI không trả geometry hợp lệ.`);
    return [{ label: cleanText(entry?.label || `${side}-${row}`, 160), side, row: row as 1 | 2 | 3, region, anchorOffset: clamp(entry?.anchorOffset ?? entry?.anchor?.offset, 0.5), source: extractedRegion ? 'ai' as const : 'mixed' as const }];
  });
  const pictures: Part3Data['pictures'] = [...extractedPictures];
  (current?.pictures || []).forEach(picture => {
    if (!pictures.some(item => item.side === picture.side && item.row === picture.row)) {
      pictures.push({ label: picture.label, side: picture.side, row: picture.row, region: picture.region, anchorOffset: picture.anchorOffset, source: 'current-part' });
    }
  });
  if (extractedPictures.length !== 6 && current?.pictures.length) warnings.push(`Part 3: AI nhận ${extractedPictures.length}/6 picture; các slot thiếu giữ dữ liệu draft để review.`);

  const rawExample = raw?.questionExample || raw?.example;
  const exampleSide = rawExample?.pictureSide === 'left' || rawExample?.pictureSide === 'right' ? rawExample.pictureSide as 'left' | 'right' : undefined;
  const exampleRow = integer(rawExample?.pictureRow ?? rawExample?.row);
  const exampleLabel = cleanText(rawExample?.answerLabel || rawExample?.label, 160);
  const exampleAnswerRegion = answers.find(answer => comparable(answer.label) === comparable(exampleLabel))?.region;
  const examplePictureRegion = pictures.find(picture => picture.side === exampleSide && picture.row === exampleRow)?.region;
  const exampleConfidence = Number(rawExample?.confidence);
  const hasVerifiedPrintedLine = rawExample?.resolved === true
    && rawExample?.lineEvidence === 'printed-line'
    && exampleAnswerRegion
    && examplePictureRegion
    && Number.isFinite(exampleConfidence)
    && exampleConfidence >= 0.55;
  const detectedExample = exampleLabel && exampleSide && exampleRow && exampleRow >= 1 && exampleRow <= 3 && hasVerifiedPrintedLine
    ? { answerLabel: exampleLabel, pictureSide: exampleSide, pictureRow: exampleRow as 1 | 2 | 3, renderOverlayLine: Boolean(rawExample?.renderOverlayLine), source: 'ai' as const }
    : undefined;
  const currentExampleAnswer = current?.answers.find(answer => answer.id === current.exampleConnection.answerId);
  const currentExamplePicture = current?.pictures.find(picture => picture.id === current.exampleConnection.pictureId);
  const example = detectedExample || (currentExampleAnswer && currentExamplePicture ? {
    answerLabel: currentExampleAnswer.label,
    pictureSide: currentExamplePicture.side,
    pictureRow: currentExamplePicture.row,
    renderOverlayLine: current.exampleConnection.renderOverlayLine,
    source: 'current-part' as const,
  } : undefined);
  const cells: Part3Data['connections'] = list(raw?.answerKeyCells || raw?.connections).flatMap((entry: any) => {
    const sideValue = cleanText(entry?.side || entry?.pictureSide, 20).toLowerCase();
    const side = sideValue === 'left' || sideValue === 'right' ? sideValue as 'left' | 'right' : undefined;
    const row = integer(entry?.row);
    const answerLabel = cleanText(entry?.answerLabel || entry?.label || entry?.answer, 160);
    if (!side || !row || row < 1 || row > 3 || !answerLabel) return [];
    return [{ answerLabel, pictureSide: side, pictureRow: row as 1 | 2 | 3, source: 'ai' as const }];
  });
  let detectedConnections: Part3Data['connections'] = [];
  if (example) {
    const isExampleLabel = (connection: Part3Data['connections'][number]) => comparable(connection.answerLabel) === comparable(example.answerLabel);
    const isExampleSlot = (connection: Part3Data['connections'][number]) => connection.pictureSide === example.pictureSide && connection.pictureRow === example.pictureRow;
    const exactExampleCell = cells.find(connection => isExampleLabel(connection) && isExampleSlot(connection));
    if (exactExampleCell) {
      detectedConnections = cells.filter(connection => connection !== exactExampleCell).slice(0, 5);
    } else {
      const exampleLabelCell = cells.find(isExampleLabel);
      const exampleSlotCell = cells.find(isExampleSlot);
      if (exampleLabelCell && exampleSlotCell && exampleLabelCell !== exampleSlotCell) {
        detectedConnections = [
          ...cells.filter(connection => connection !== exampleLabelCell && connection !== exampleSlotCell),
          { ...exampleLabelCell, answerLabel: exampleSlotCell.answerLabel },
        ].slice(0, 5);
        warnings.push(`Part 3: answer key hoán đổi cell example; ưu tiên printed line trên ảnh đề và hòa giải mapping một-một để giáo viên kiểm tra.`);
      } else {
        detectedConnections = cells.filter(connection => !isExampleLabel(connection) && !isExampleSlot(connection)).slice(0, 5);
        if (exampleLabelCell || exampleSlotCell) {
          warnings.push('Part 3: answer key mâu thuẫn example nhưng không đủ bằng chứng để hòa giải; giữ mapping draft cho mục unresolved.');
        }
      }
    }
  }
  const connections: Part3Data['connections'] = [...detectedConnections];
  (current?.correctConnections || []).forEach(connection => {
    const answer = current.answers.find(item => item.id === connection.answerId);
    const picture = current.pictures.find(item => item.id === connection.pictureId);
    if (answer && picture && connections.length < 5 && !connections.some(item => comparable(item.answerLabel) === comparable(answer.label) || (item.pictureSide === picture.side && item.pictureRow === picture.row))) {
      connections.push({ answerLabel: answer.label, pictureSide: picture.side, pictureRow: picture.row, source: 'current-part' });
    }
  });
  const used = new Set([...(example ? [comparable(example.answerLabel)] : []), ...connections.map(connection => comparable(connection.answerLabel))]);
  const distractors = answers.filter(answer => !used.has(comparable(answer.label)));
  const currentDistractor = current?.answers.find(answer => answer.id === current.distractorAnswerId)?.label;
  const distractorLabel = distractors.length === 1 ? distractors[0].label : currentDistractor;
  const distractorSource = distractors.length === 1 ? 'derived' as const : currentDistractor ? 'current-part' as const : undefined;
  if (answers.length !== 7) warnings.push(`Part 3: candidate chỉ có ${answers.length}/7 answer slots.`);
  if (pictures.length !== 6 || new Set(pictures.map(picture => `${picture.side}-${picture.row}`)).size !== 6) warnings.push('Part 3: cần đúng ba picture bên trái và ba bên phải theo row 1-3.');
  if (!detectedExample) warnings.push('Part 3: AI chưa chứng minh được example bằng printed line trên ảnh đề; giữ example draft nếu có.');
  if (detectedConnections.length !== 5) warnings.push(`Part 3: AI resolve được ${detectedConnections.length}/5 scored connections; các mapping thiếu giữ draft, không dồn OCR order.`);
  if (distractors.length !== 1) warnings.push('Part 3: distractor AI không xác định duy nhất bằng set difference; giữ draft nếu có.');
  return { part: 3, answers: answers.slice(0, 7), pictures: pictures.slice(0, 6), ...(example ? { example } : {}), connections, distractorLabel, ...(distractorSource ? { distractorSource } : {}) };
}

function optionIndex(value: unknown) {
  const normalized = cleanText(value, 10).toUpperCase();
  return normalized === 'A' ? 0 : normalized === 'B' ? 1 : normalized === 'C' ? 2 : undefined;
}

function normalizePart4(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 4 }> {
  const questionMap = normalizeNumberedEntries(list(raw?.questions), entry => {
    const prompt = cleanText(entry?.prompt || entry?.question, 1000);
    const crops = list(entry?.crops).slice(0, 3).map(normalizeCrop).filter(Boolean) as SmartImportCrop[];
    return prompt ? { prompt, crops } : undefined;
  }, warnings, 'Part 4 prompts');
  const rawAnswers = list(raw?.answers);
  const hasAnyNumber = rawAnswers.some((entry: any) => Boolean(questionNumber(entry?.questionNumber ?? entry?.number)));
  const orderedEvidence = raw?.orderedFallbackEvidence === 'single-row' || raw?.orderedFallbackEvidence === 'single-column';
  const answerMap = normalizeNumberedEntries(rawAnswers, entry => optionIndex(entry?.answer ?? entry), warnings, 'Part 4 answer key', !hasAnyNumber && orderedEvidence);
  if (!hasAnyNumber && rawAnswers.length === 5 && !orderedEvidence) warnings.push('Part 4: năm đáp án không số thiếu evidence một hàng/cột nên không dùng ordered fallback.');
  const questions = ([1, 2, 3, 4, 5] as const).flatMap(number => {
    const question = questionMap.get(number);
    if (!question) return [];
    const answer = answerMap.get(number);
    return [{ questionNumber: number, ...question, ...(answer === undefined ? {} : { correctOptionIndex: answer }), answerSource: answer === undefined ? 'current-part' as const : hasAnyNumber ? 'answer-key-numbered' as const : 'answer-key-ordered-fallback' as const }];
  });
  const rawExample = raw?.example;
  const exampleCrops = list(rawExample?.crops).slice(0, 3).map(normalizeCrop).filter(Boolean) as SmartImportCrop[];
  const examplePrompt = cleanText(rawExample?.prompt || rawExample?.question, 1000);
  const exampleAnswer = optionIndex(rawExample?.answer ?? rawExample?.correctOption);
  const example = examplePrompt ? { prompt: examplePrompt, crops: exampleCrops, ...(exampleAnswer === undefined ? {} : { correctOptionIndex: exampleAnswer }) } : undefined;
  if (!example) warnings.push('Part 4: chưa tách được example khỏi năm câu scored.');
  if (questions.length !== 5) warnings.push(`Part 4: nhận ${questions.length}/5 câu đánh số.`);
  if (answerMap.size !== 5) warnings.push(`Part 4: nhận ${answerMap.size}/5 answer mappings; câu thiếu giữ đáp án draft.`);
  return { part: 4, ...(example ? { example } : {}), questions };
}

function catalogColourLabel(value: unknown) {
  const key = comparable(value);
  return MOVER_COLOUR_CATALOG.find(colour => comparable(colour.label) === key)?.label;
}

function explicitDrawActionFromPrompt(staffPrompt: string): SmartImportPart5Action | undefined {
  const drawMatch = staffPrompt.match(/^\s*draw\s+(.+?)\s*[.!?]*$/i);
  if (!drawMatch) return undefined;
  let body = drawMatch[1].replace(/^(?:a|an|the)\s+/i, '').trim();
  const relationMatch = body.match(/\s+((?:on|onto|in|inside|under|below|above|over|between|beside|by|near|next to|behind|in front of|at)\b.*)$/i);
  const relationLabel = relationMatch?.[1]?.trim();
  if (relationMatch?.index !== undefined) body = body.slice(0, relationMatch.index).trim();
  const words = body.split(/\s+/).filter(Boolean);
  const colourLabel = catalogColourLabel(words[0]);
  const objectType = cleanText(colourLabel ? words.slice(1).join(' ') : body, 120);
  if (!objectType) return undefined;
  return {
    type: 'place_object',
    objectType,
    ...(colourLabel ? { colourLabel } : {}),
    ...(relationLabel ? { relationLabel } : {}),
    confidence: 0.5,
  };
}

function normalizePart5(raw: any, currentPart: ListeningPart, warnings: string[]): Extract<ListeningSmartImportData, { part: 5 }> {
  const seenPaletteItems = new Set<string>();
  const paletteItems: SmartImportPart5PaletteItem[] = list(raw?.paletteItems).flatMap((entry: any) => {
    const objectType = cleanText(entry?.objectType, 120);
    const label = cleanText(entry?.label || entry?.objectType, 160);
    if (!objectType || !label) return [];
    const rawColour = cleanText(entry?.color || entry?.colour, 80);
    const colourLabel = rawColour ? catalogColourLabel(rawColour) : undefined;
    if (rawColour && !colourLabel) warnings.push(`Part 5 palette "${label}": màu ngoài catalog nên để unresolved.`);
    const key = `${comparable(objectType)}|${comparable(label)}|${comparable(colourLabel)}`;
    if (seenPaletteItems.has(key)) return [];
    seenPaletteItems.add(key);
    return [{ objectType, label, ...(colourLabel ? { colourLabel } : {}) }];
  });
  const questionMap = normalizeNumberedEntries(list(raw?.questions), entry => {
    const staffPrompt = cleanText(entry?.prompt || entry?.staffPrompt, 1000);
    const actions = list(entry?.actions).slice(0, 10).flatMap((action: any): SmartImportPart5Action[] => {
      const confidence = clamp(action?.confidence, 0.5);
      if (action?.type === 'colour_object') {
        const objectLabel = cleanText(action?.objectLabel, 160);
        const rawColour = cleanText(action?.correctColor || action?.color, 80);
        const correctColourLabel = catalogColourLabel(rawColour);
        if (rawColour && !correctColourLabel) warnings.push(`Part 5 "${objectLabel}": màu "${rawColour}" ngoài catalog.`);
        return objectLabel ? [{ type: 'colour_object', objectLabel, ...(correctColourLabel ? { correctColourLabel } : {}), confidence }] : [];
      }
      if (action?.type === 'place_object') {
        const objectType = cleanText(action?.objectType, 120);
        const rawColour = cleanText(action?.color || action?.correctColor, 80);
        const colourLabel = rawColour ? catalogColourLabel(rawColour) : undefined;
        if (rawColour && !colourLabel) warnings.push(`Part 5 object "${objectType}": màu "${rawColour}" ngoài catalog.`);
        const normalizedTarget = normalizedRegion(action?.targetRegion);
        const targetRegion = normalizedTarget ? {
          shape: 'rect' as const,
          x: normalizedTarget.x,
          y: normalizedTarget.y,
          width: normalizedTarget.width,
          height: normalizedTarget.height,
        } : undefined;
        return objectType ? [{ type: 'place_object', objectType, ...(colourLabel ? { colourLabel } : {}), ...(targetRegion ? { targetRegion } : {}), relationLabel: cleanText(action?.relationLabel, 240) || undefined, confidence }] : [];
      }
      return [];
    });
    const recoveredDraw = staffPrompt && !actions.some(action => action.type === 'place_object')
      ? explicitDrawActionFromPrompt(staffPrompt)
      : undefined;
    if (recoveredDraw) {
      actions.push(recoveredDraw);
      warnings.push('Part 5: phục hồi action Draw từ câu lệnh rõ ràng trong answer key; giáo viên cần chọn/xác nhận vùng chữ nhật.');
    }
    return staffPrompt ? { staffPrompt, actions } : undefined;
  }, warnings, 'Part 5 questions');
  const questions = ([1, 2, 3, 4, 5] as const).flatMap(number => {
    const value = questionMap.get(number);
    return value ? [{ questionNumber: number, ...value }] : [];
  });
  if (questions.length !== 5) warnings.push(`Part 5: nhận ${questions.length}/5 câu đánh số.`);
  questions.forEach(question => {
    if (!question.actions.length) warnings.push(`Part 5 câu ${question.questionNumber}: chưa resolve được action nào.`);
    question.actions.forEach((action, index) => {
      if (action.type === 'colour_object' && !action.correctColourLabel) warnings.push(`Part 5 câu ${question.questionNumber} action ${index + 1}: thiếu màu chắc chắn.`);
      if (action.type === 'place_object' && !action.targetRegion) warnings.push(`Part 5 câu ${question.questionNumber} action ${index + 1}: Sol chưa xác định chắc vị trí Draw trên ảnh đề.`);
    });
  });
  const placeActions = questions.flatMap(question => question.actions).filter(action => action.type === 'place_object');
  const colourActions = questions.flatMap(question => question.actions).filter(action => action.type === 'colour_object');
  placeActions.forEach(action => {
    if (paletteItems.some(item => comparable(item.objectType) === comparable(action.objectType)
      && (!action.colourLabel || comparable(item.colourLabel) === comparable(action.colourLabel)))) return;
    paletteItems.push({
      objectType: action.objectType,
      label: [action.colourLabel, action.objectType].filter(Boolean).join(' '),
      ...(action.colourLabel ? { colourLabel: action.colourLabel } : {}),
    });
  });
  if (colourActions.length) warnings.push('Part 5: giáo viên phải tô/xác nhận các vùng Colour; AI không tự tạo mask Colour.');
  const paletteTypes = new Set(paletteItems.map(item => comparable(item.objectType)));
  if (placeActions.some(action => !paletteTypes.has(comparable(action.objectType)))) warnings.push('Part 5: palette thiếu token đúng cho ít nhất một place action; giáo viên phải bổ sung.');
  if (placeActions.length && paletteItems.length <= new Set(placeActions.map(action => comparable(action.objectType))).size) warnings.push('Part 5: object palette chưa có distractor; không tự tạo object giả.');

  if (currentPart.part === 5 && currentPart.displayMode === 'scene-colour-draw') {
    currentPart.questions.forEach(question => question.actions.forEach(action => {
      const matched = questions.some(nextQuestion => nextQuestion.questionNumber === question.questionNumber && nextQuestion.actions.some(next => {
        if (next.type !== action.type) return false;
        if (next.type === 'colour_object' && action.type === 'colour_object') {
          const object = currentPart.interactiveObjects.find(item => item.id === action.correctObjectId);
          return comparable(next.objectLabel) === comparable(object?.label);
        }
        if (next.type === 'place_object' && action.type === 'place_object') {
          const item = currentPart.objectPalette.find(entry => entry.id === action.correctPaletteItemId);
          return comparable(next.objectType) === comparable(item?.objectType);
        }
        return false;
      }));
      if (!matched) warnings.push(`Part 5 câu ${question.questionNumber}: giữ action cũ ${action.id} vì lần phân tích mới không match chắc chắn.`);
    }));
  }
  return { part: 5, paletteItems, questions };
}

function normalizeData(part: ListeningSmartImportPartId, raw: any, currentPart: ListeningPart, warnings: string[]): ListeningSmartImportData {
  if (part === 1) return normalizePart1(raw, warnings);
  if (part === 2) return normalizePart2(raw, warnings);
  if (part === 3) return normalizePart3(raw, currentPart, warnings);
  if (part === 4) return normalizePart4(raw, warnings);
  return normalizePart5(raw, currentPart, warnings);
}

function localFallback(part: ListeningSmartImportPartId, text: string) {
  const rows = localNumberedLines(text);
  if (part === 2) return { questions: [], answers: rows.map(row => ({ questionNumber: row.questionNumber, answer: row.value })) };
  if (part === 3) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const explicit = lines.flatMap(line => {
      const match = line.match(/^(left|right)\s*([1-3])\s*[:=\-]\s*(.+)$/i);
      return match ? [{ side: match[1].toLowerCase(), row: Number(match[2]), answerLabel: match[3].trim() }] : [];
    });
    if (explicit.length === lines.length && explicit.length > 0) return { answerKeyCells: explicit };
    const rowPairs = lines.map(line => line.split(/\t|\s{2,}|\s*\|\s*/).map(value => value.trim()).filter(Boolean));
    if (rowPairs.length === 3 && rowPairs.every(row => row.length === 2)) {
      return {
        answerKeyCells: rowPairs.flatMap((row, index) => ([
          { side: 'left', row: index + 1, answerLabel: row[0] },
          { side: 'right', row: index + 1, answerLabel: row[1] },
        ])),
      };
    }
    return { answerKeyCells: [], warnings: ['Part 3 fallback text cần ba dòng hai cột, hoặc cú pháp left/right + row; không suy luận từ sáu dòng phẳng.'] };
  }
  return {};
}

export async function createListeningSmartImportCandidate(input: CreateCandidateInput): Promise<ListeningSmartImportCandidate> {
  const warnings: string[] = [];
  let provider: ListeningSmartImportCandidate['provider'] = 'local';
  const selectedProvider = input.preferredProvider || DEFAULT_SMART_IMPORT_AI_PROVIDER_ID;
  let raw: any;
  if (input.images.length && input.analyzeVision) {
    const requestId = `limport-analysis-${crypto.randomUUID()}`;
    const usedProviders = new Set<string>();
    const analyzeAndParse = async (
      prompt: string,
      images: SmartImportImageInput[],
      schema: Record<string, unknown>,
      schemaName: string,
      validateResponse?: (parsed: any, attempt: number) => string | undefined,
    ) => {
      let parsed: any;
      let lastParseError = '';
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const retryInstruction = attempt === 1 ? '' : `\nYour previous response was not valid for the required JSON schema and extraction invariants${lastParseError ? `: ${lastParseError}` : ''}. Re-check the source images and re-emit the facts using the supplied schema. Do not add markdown or prose and do not guess missing values; use explicit unresolved fields where supported.`;
        let result: SmartImportVisionResult;
        try {
          result = await input.analyzeVision!(prompt + retryInstruction, images, {
            preferredProvider: selectedProvider,
            responseJsonSchema: schema,
            schemaName,
            requestId,
            attempt,
          }, input.signal);
          if (process.env.LISTENING_SMART_IMPORT_DEBUG_RAW === 'true' && process.env.NODE_ENV !== 'production') {
            console.warn(`[ListeningSmartImport] request=${requestId} schema=${schemaName} attempt=${attempt} raw=${result.text.slice(0, 20_000)}`);
          }
        } catch (reason: any) {
          const details = providerFailureDetails(reason);
          lastParseError = details.join(' | ');
          console.warn(`[ListeningSmartImport] request=${requestId} part=${input.part} schema=${schemaName} attempt=${attempt} provider-error: ${lastParseError}`);
          if (input.signal?.aborted || reason?.name === 'AbortError' || attempt === 2) {
            throw providerFailureError(reason, input.part, schemaName, input.signal);
          }
          continue;
        }
        try {
          parsed = parseJson(result.text);
          const validationError = validateResponse?.(parsed, attempt);
          if (validationError) throw new Error(validationError);
          provider = result.provider;
          usedProviders.add(result.provider);
          if (result.errors?.length) warnings.push(...result.errors.map(value => cleanText(value, 240)));
          if (attempt > 1) warnings.push(`Part ${input.part}: ${provider} đã trả JSON hợp lệ sau lần retry ${schemaName}.`);
          break;
        } catch (reason: any) {
          const returnedProvider = cleanText(result.provider, 60) || 'AI';
          lastParseError = cleanText(reason?.message || 'JSON không hợp lệ.', 240);
          const digest = crypto.createHash('sha256').update(result.text).digest('hex').slice(0, 16);
          console.warn(`[ListeningSmartImport] request=${requestId} part=${input.part} schema=${schemaName} provider=${returnedProvider} attempt=${attempt} invalid-response length=${result.text.length} sha256=${digest}: ${lastParseError}`);
          if (attempt === 2) {
            const invalidJsonError: any = new Error(`Nhà cung cấp AI trả dữ liệu không hợp lệ cho Part ${input.part}. Draft chưa được thay đổi.`);
            invalidJsonError.status = 502;
            invalidJsonError.code = 'LISTENING_SMART_IMPORT_INVALID_JSON';
            invalidJsonError.details = [`${returnedProvider}: ${lastParseError}`];
            throw invalidJsonError;
          }
        }
      }
      return parsed;
    };
    if (input.part === 1) {
      const useSolDirectGeometry = PART1_SOL_PROVIDER_IDS.has(selectedProvider);
      const contentImages = input.images.filter(image => image.role === 'question' || image.role === 'answer_key');
      const questionImages = input.images.filter(image => image.role === 'question');
      const geometryImages = useSolDirectGeometry
        ? (['question', 'answer_key', 'position_key'] as const).flatMap(role => input.images.filter(image => image.role === role))
        : input.images.filter(image => image.role === 'question' || image.role === 'answer_key' || image.role === 'position_key');
      const contentRaw = await analyzeAndParse(
        promptForPart1Pass('content'),
        contentImages,
        part1PassSchema('content'),
        'listening_mover_part_1_content',
        validatePart1ContentResponse,
      );
      const questionRaw = await analyzeAndParse(
        useSolDirectGeometry
          ? promptForPart1SolExampleVerification(contentRaw)
          : promptForPart1QuestionVerification(contentRaw),
        questionImages,
        useSolDirectGeometry
          ? part1SolExampleVerificationSchema()
          : part1QuestionVerificationSchema(),
        'listening_mover_part_1_question_verification',
        parsed => useSolDirectGeometry
          ? validatePart1SolExampleVerification(parsed, contentRaw)
          : validatePart1QuestionVerification(parsed, contentRaw),
      );
      const verifiedExample = verifiedPart1QuestionExample(questionRaw, contentRaw);
      const verifiedTargets = new Map<number, any>(list(useSolDirectGeometry ? [] : questionRaw?.targets).flatMap((entry: any) => {
        const number = questionNumber(entry?.targetNumber);
        return number ? [[number, entry] as const] : [];
      }));
      const verifiedContentRaw = {
        ...contentRaw,
        example: verifiedExample
          ? { label: verifiedExample.label, labelPoint: questionRaw?.labelPoint, targetPoint: verifiedExample.targetPoint, confidence: verifiedExample.confidence }
          : contentRaw?.example,
        answerMappings: list(contentRaw?.answerMappings).map((entry: any) => {
          const number = questionNumber(entry?.targetNumber);
          return { ...entry, ...(number ? verifiedTargets.get(number) : {}) };
        }),
      };
      let geometryRaw: any = { resolvedTargets: [], unresolvedTargetNumbers: [1, 2, 3, 4, 5], warnings: [] };
      try {
        geometryRaw = await analyzeAndParse(
          useSolDirectGeometry
            ? promptForPart1SolGeometry(verifiedContentRaw)
            : promptForPart1Pass('geometry', verifiedContentRaw),
          geometryImages,
          useSolDirectGeometry
            ? part1SolGeometrySchema()
            : part1PassSchema('geometry'),
          'listening_mover_part_1_geometry',
          (parsed, attempt) => useSolDirectGeometry
            ? validatePart1SolGeometryResponse(parsed, verifiedContentRaw)
            : validatePart1GeometryResponse(parsed, verifiedContentRaw, attempt === 1),
        );
      } catch (reason: any) {
        if (input.signal?.aborted || reason?.name === 'AbortError' || reason?.code === 'LISTENING_SMART_IMPORT_TIMEOUT') throw reason;
        const details = providerFailureDetails(reason).join(' | ');
        warnings.push(`Part 1 geometry: AI không hoàn tất lượt xác định vị trí; vẫn nhập tên/đáp án và giữ nguyên các vùng cũ.${details ? ` ${details}` : ''}`);
      }
      if (verifiedExample && comparable(verifiedExample.label) !== comparable(contentRaw?.example?.label)) {
        warnings.push(`Part 1: example được lượt kiểm chứng độc lập sửa từ "${cleanText(contentRaw?.example?.label, 120)}" thành "${verifiedExample.label}".`);
      }
      const contentExample = verifiedExample;
      const questionScene = normalizedRegion(verifiedContentRaw?.questionScene);
      const positionScene = normalizedRegion(geometryRaw?.positionScene);
      const localizedMappings = new Map<number, any>(list(verifiedContentRaw?.answerMappings).flatMap((entry: any) => {
        const number = questionNumber(entry?.targetNumber);
        return number ? [[number, entry] as const] : [];
      }));
      const geometryTargets = new Map<number, any>(list(geometryRaw?.resolvedTargets).flatMap((entry: any) => {
        const number = questionNumber(entry?.targetNumber);
        return number ? [[number, entry] as const] : [];
      }));
      const resolvedTargets = [...localizedMappings].flatMap(([number, mapping]) => {
        const geometry = geometryTargets.get(number);
        if (useSolDirectGeometry) {
          const questionTargetPoint = normalizedPoint(geometry?.questionTargetPoint);
          if (!geometry || !questionTargetPoint || !questionScene || !pointInListeningRegion(questionTargetPoint, questionScene)) return [];
          return [{
            ...mapping,
            ...geometry,
            coordinateRole: 'question',
            questionActionRegion: undefined,
            questionTargetPoint,
            targetNumber: number,
          }];
        }
        if (!geometry && !hasSafePart1QuestionLocation(mapping, questionScene)) return [];
        const verifiedGeometryPoint = geometry && part1TransformedGeometryPoint(geometry, mapping, questionScene, positionScene);
        const verifiedQuestionPoint = part1QuestionActionPoint(mapping);
        return [{
          ...mapping,
          questionLocationConfidence: (mapping as any)?.confidence,
          ...geometry,
          questionActionRegion: (mapping as any).questionActionRegion,
          questionTargetPoint: verifiedQuestionPoint || verifiedGeometryPoint,
          targetNumber: number,
        }];
      });
      const unresolvedFromGeometry = new Set(list(geometryRaw?.unresolvedTargetNumbers).flatMap(value => {
        const number = questionNumber(value);
        return number ? [number] : [];
      }));
      const unresolvedTargetNumbers = ([1, 2, 3, 4, 5] as const).filter(number => {
        if (useSolDirectGeometry) {
          return !geometryTargets.has(number) || unresolvedFromGeometry.has(number);
        }
        const mapping = localizedMappings.get(number);
        return (!geometryTargets.has(number) || unresolvedFromGeometry.has(number))
          && !hasSafePart1QuestionLocation(mapping, questionScene);
      });
      const exampleTargetPoint = normalizedPoint(contentExample?.targetPoint);
      raw = {
        ...verifiedContentRaw,
        questionScene: verifiedContentRaw?.questionScene,
        positionScene: geometryRaw?.positionScene,
        resolvedTargets,
        unresolvedTargetNumbers,
        geometryPassAttempted: true,
        ...(useSolDirectGeometry ? { geometryMode: 'direct-question-points' } : {}),
        example: contentExample && exampleTargetPoint
          ? { label: cleanText(contentExample?.label, 120), questionTargetPoint: exampleTargetPoint, confidence: clamp(contentExample?.confidence, 0.9) }
          : undefined,
        warnings: [...list(contentRaw?.warnings), ...list(questionRaw?.warnings), ...list(geometryRaw?.warnings)],
      };
    } else if (input.part === 3) {
      const questionImages = input.images.filter(image => image.role === 'question');
      const answerKeyImages = input.images.filter(image => image.role === 'answer_key');
      const questionRaw = await analyzeAndParse(
        promptForPart3QuestionPass(),
        questionImages,
        part3PassSchema('question'),
        'listening_mover_part_3_question_example',
        validatePart3QuestionResponse,
      );
      let answerKeyRaw: any;
      if (answerKeyImages.length) {
        answerKeyRaw = await analyzeAndParse(
          promptForPart3AnswerKeyPass(questionRaw),
          answerKeyImages,
          part3PassSchema('answer_key'),
          'listening_mover_part_3_answer_key',
          parsed => validatePart3AnswerKeyResponse(parsed, questionRaw),
        );
      } else if (input.pastedText) {
        answerKeyRaw = localFallback(3, input.pastedText);
        const validationError = validatePart3AnswerKeyResponse({ layoutEvidence: 'three-rows-two-columns', ...answerKeyRaw }, questionRaw);
        if (validationError) {
          const invalidFallbackError: any = new Error(`Văn bản answer key Part 3 không khớp example đã xác minh: ${validationError}`);
          invalidFallbackError.status = 422;
          invalidFallbackError.code = 'LISTENING_SMART_IMPORT_INVALID_PART3_FALLBACK';
          throw invalidFallbackError;
        }
        answerKeyRaw = { layoutEvidence: 'three-rows-two-columns', ...answerKeyRaw };
      } else {
        const missingKeyError: any = new Error('Part 3 cần Ảnh đáp án hoặc fallback văn bản ba hàng hai cột.');
        missingKeyError.status = 400;
        throw missingKeyError;
      }
      raw = {
        ...questionRaw,
        ...answerKeyRaw,
        warnings: [...list(questionRaw?.warnings), ...list(answerKeyRaw?.warnings)],
      };
    } else if (input.part === 5) {
      const contentImages = (['question', 'answer_key', 'position_key'] as const).flatMap(role => input.images.filter(image => image.role === role));
      raw = await analyzeAndParse(
        promptForPart5Content(),
        contentImages,
        responseSchemaFor(5),
        'listening_mover_part_5_content',
        validatePart5ContentResponse,
      );
    } else {
      raw = await analyzeAndParse(
        promptFor(input.part, input.pastedText),
        input.images,
        responseSchemaFor(input.part),
        `listening_mover_part_${input.part}`,
      );
    }
    if (usedProviders.size > 1) provider = [...usedProviders].join('+');
  } else if (input.pastedText && (input.part === 2 || input.part === 3)) {
    raw = localFallback(input.part, input.pastedText);
    warnings.push(`Part ${input.part}: đang dùng fallback văn bản thủ công thay cho ảnh answer key.`);
  } else if (input.images.length && !input.analyzeVision) {
    const error: any = new Error('Backend chưa cấu hình AI thị giác để đọc ảnh.');
    error.status = 503;
    throw error;
  } else {
    const error: any = new Error('Cần đủ ảnh nguồn theo role hoặc fallback văn bản được hỗ trợ.');
    error.status = 400;
    throw error;
  }
  warnings.push(...list(raw?.warnings).map(value => cleanText(value, 500)).filter(Boolean));
  const data = normalizeData(input.part, raw, input.currentPart, warnings);
  return {
    id: `limport-${crypto.randomUUID()}`,
    moduleId: 'mover',
    part: input.part,
    basePartHash: input.basePartHash,
    sources: input.sources,
    sourceImageAssetIds: input.sources.map(source => source.assetId),
    provider,
    warnings,
    createdAt: new Date().toISOString(),
    data,
  };
}
