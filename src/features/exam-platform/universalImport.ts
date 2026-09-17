import type { ExamPaperId } from '../listening-library/types';
import type {
  ExamGeometryHint,
  ExamInteractionDescriptor,
  ExamInteractionFamily,
  ExamInteractionRegion,
  ExamOption,
  ExamPaperContent,
  ExamPartBlock,
  ExamPartContent,
  ExamQuestion,
  ExamQuestionType,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';
import { STARTER_BASIC_COLOURS } from './starterImport';
import { FLYER_NAME_REGION_HEIGHT, FLYER_NAME_REGION_WIDTH } from './flyerListeningMigration';
import { normalizeFixedFlyerReadingWritingContent } from './flyerReadingWritingMigration';
import { normalizeFixedKetReadingWritingContent } from './ketReadingWritingMigration';
import { isFixedKetListeningContent, normalizeFixedKetListeningContent } from './ketListeningMigration';

const MAX_PARTS = 20;
const MAX_BLOCKS_PER_PART = 20;
const MAX_QUESTIONS_PER_BLOCK = 200;
const families = new Set<ExamInteractionFamily>(['choice', 'matching', 'text-entry', 'scene', 'writing']);
const technicalFields = new Set([
  'id', 'questionId', 'questionIds', 'imageAssetId', 'imageUrl', 'secondaryImageAssetId', 'secondaryImageUrl', 'audioAssetId', 'audioUrl',
  'correctOptionIds', 'interactionSourceNodeId', 'responseKey', 'base64', 'filePath', 'url',
]);

type Row = Record<string, any>;

export interface UniversalImportReport {
  part: number;
  blockCount: number;
  questionCount: number;
  warnings: string[];
}

export interface UniversalImportResult {
  content: ExamPaperContent;
  reports: UniversalImportReport[];
}

const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const cleanText = (value: unknown, max = 8_000) => String(value ?? '').trim().slice(0, max);
const identifier = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => cleanText(value, 500).normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en');

function findTechnicalField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findTechnicalField(child);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Row)) {
    if (technicalFields.has(key)) return key;
    const found = findTechnicalField(child);
    if (found) return found;
  }
  return null;
}

function interactionDescriptor(value: unknown): ExamInteractionDescriptor {
  const source = row(value);
  const family = cleanText(source.family, 40) as ExamInteractionFamily;
  if (!families.has(family)) throw new Error(`Interaction family "${family || '(trống)'}" chưa được hỗ trợ.`);
  const subtype = cleanText(source.subtype, 80);
  const variant = cleanText(source.variant, 80);
  if (!subtype || !variant) throw new Error('Mỗi block phải khai báo đủ interaction.family/subtype/variant.');
  const schemaVersion = Number(source.schemaVersion || 1);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 20) throw new Error('interaction.schemaVersion không hợp lệ.');
  return { family, subtype, variant, schemaVersion, importReadiness: 'content-ready' };
}

function questionType(interaction: ExamInteractionDescriptor, rawType: unknown): ExamQuestionType {
  const proposed = cleanText(rawType, 80) as ExamQuestionType;
  const allowed = new Set<ExamQuestionType>([
    'single-choice', 'multiple-choice', 'short-answer', 'true-false', 'true-false-not-given',
    'yes-no-not-given', 'matching', 'long-writing',
    'scene-draw',
  ]);
  if (proposed && allowed.has(proposed)) return proposed;
  if (interaction.family === 'text-entry') return 'short-answer';
  if (interaction.family === 'writing') return 'long-writing';
  if (interaction.family === 'matching') return 'matching';
  if (interaction.family === 'scene' && (interaction.subtype === 'draw-object' || interaction.variant === 'draw')) return 'scene-draw';
  if (interaction.family === 'choice' && /multiple/i.test(interaction.subtype)) return 'multiple-choice';
  return 'single-choice';
}

function trustedAnswerSource(block: Row, question: Row) {
  const source = cleanText(question.answerSource || row(question.answerKey).source || block.answerSource, 80);
  return source === 'official-answer-key' || source === 'teacher-supplied';
}

function parseOptions(rawQuestion: Row, currentQuestion?: ExamQuestion): ExamOption[] {
  const rawOptions = Array.isArray(rawQuestion.options) ? rawQuestion.options : [];
  return rawOptions.slice(0, 30).map((value: unknown, index: number) => {
    const option = typeof value === 'string' ? { text: value } : row(value);
    const previous = currentQuestion?.options[index];
    return {
      id: previous?.id || identifier('option'),
      label: cleanText(option.label || String.fromCharCode(65 + index), 12),
      text: cleanText(option.text ?? option.label, 4_000),
      ...(previous?.imageAssetId ? { imageAssetId: previous.imageAssetId } : {}),
      ...(previous?.imageUrl ? { imageUrl: previous.imageUrl } : {}),
    };
  });
}

function geometryRegion(value: unknown, scaleX: number, scaleY: number): ExamInteractionRegion | null {
  const source = row(value);
  const shape = cleanText(source.shape || 'rect', 20) as ExamInteractionRegion['shape'];
  if (!['rect', 'ellipse', 'polygon'].includes(shape)) return null;
  const x = Number(source.x) / scaleX;
  const y = Number(source.y) / scaleY;
  const width = Number(source.width) / scaleX;
  const height = Number(source.height) / scaleY;
  if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.00001 || y + height > 1.00001) return null;
  const points = shape === 'polygon' && Array.isArray(source.points)
    ? source.points.map((point: unknown) => ({ x: Number(row(point).x) / scaleX, y: Number(row(point).y) / scaleY }))
    : undefined;
  if (shape === 'polygon' && (!points || points.length < 3 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1))) return null;
  return { shape, x, y, width, height, ...(points ? { points } : {}) };
}

function parseGeometryHints(value: unknown, questions: ExamQuestion[], warnings: string[]): ExamGeometryHint[] {
  const source = row(value);
  const coordinateSpace = cleanText(source.coordinateSpace || 'normalized', 30);
  let scaleX = 1;
  let scaleY = 1;
  if (coordinateSpace === 'pixel') {
    const imageSize = row(source.imageSize);
    scaleX = Number(imageSize.width);
    scaleY = Number(imageSize.height);
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
      warnings.push('geometryHints dùng pixel nhưng thiếu imageSize.width/height; các vùng đã bị bỏ qua.');
      return [];
    }
  } else if (coordinateSpace !== 'normalized') {
    warnings.push(`coordinateSpace "${coordinateSpace}" không hợp lệ; các vùng đã bị bỏ qua.`);
    return [];
  }
  const rawRegions = Array.isArray(source.regions) ? source.regions : [];
  return rawRegions.slice(0, 500).flatMap((value: unknown, index: number) => {
    const hint = row(value);
    const region = geometryRegion(hint.region || hint, scaleX, scaleY);
    if (!region) {
      warnings.push(`Gợi ý tọa độ ${index + 1} không hợp lệ và đã bị bỏ qua.`);
      return [];
    }
    const questionNumber = Number(hint.questionNumber);
    const question = Number.isInteger(questionNumber)
      ? questions.find(item => item.number === questionNumber) || questions[questionNumber - 1]
      : undefined;
    const anchorValue = row(hint.anchor);
    const anchor = Number.isFinite(Number(anchorValue.x)) && Number.isFinite(Number(anchorValue.y))
      ? { x: Number(anchorValue.x) / scaleX, y: Number(anchorValue.y) / scaleY }
      : undefined;
    const confidence = Number(hint.confidence);
    return [{
      id: identifier('geometry-hint'),
      role: cleanText(hint.role, 80) || 'answer-region',
      label: cleanText(hint.ref || hint.label || (question ? `Câu ${question.number}` : `Vùng ${index + 1}`), 240),
      ...(question ? { questionId: question.id } : {}),
      region,
      ...(anchor && anchor.x >= 0 && anchor.x <= 1 && anchor.y >= 0 && anchor.y <= 1 ? { anchor } : {}),
      ...(Number.isFinite(confidence) ? { confidence: Math.max(0, Math.min(1, confidence)) } : {}),
      status: 'suggested' as const,
    }];
  });
}

function findHint(hints: ExamGeometryHint[], role: string, label: string) {
  return hints.find(hint => hint.role === role && normalized(hint.label) === normalized(label));
}

function fallbackRegion(index: number, count: number, y: number): ExamInteractionRegion {
  const width = Math.min(.12, .8 / Math.max(count, 1));
  const x = .05 + index * (.9 - width) / Math.max(count - 1, 1);
  return { shape: 'rect', x, y, width, height: .08 };
}

function matchingLayout(blockValue: Row, interaction: ExamInteractionDescriptor, questions: ExamQuestion[], hints: ExamGeometryHint[], warnings: string[]) {
  if (interaction.family !== 'matching' || interaction.subtype !== 'image-image') return undefined;
  const payload = row(blockValue.content);
  const sourceValues = Array.isArray(payload.sourceNodes) ? payload.sourceNodes : Array.isArray(blockValue.sourceNodes) ? blockValue.sourceNodes : [];
  const targetValues = Array.isArray(payload.targetNodes) ? payload.targetNodes : Array.isArray(blockValue.targetNodes) ? blockValue.targetNodes : [];
  if (sourceValues.length < questions.length || targetValues.length < questions.length) {
    warnings.push('Block image-image chưa đủ sourceNodes/targetNodes; cần bổ sung trong JSON hoặc editor.');
  }
  const sourceNodes = sourceValues.slice(0, 50).map((value: unknown, index: number) => {
    const label = cleanText(row(value).label ?? value, 240) || `Nguồn ${index + 1}`;
    const hint = findHint(hints, 'source-node', label);
    const hitRegion = hint?.region || fallbackRegion(index, sourceValues.length, .08);
    return { id: identifier('matching-source'), label, hitRegion, anchor: hint?.anchor || { x: hitRegion.x + hitRegion.width / 2, y: hitRegion.y + hitRegion.height / 2 }, geometryConfirmedByTeacher: false };
  });
  const targetNodes = targetValues.slice(0, 50).map((value: unknown, index: number) => {
    const label = cleanText(row(value).label ?? value, 240) || `Đích ${index + 1}`;
    const hint = findHint(hints, 'target-node', label);
    const hitRegion = hint?.region || fallbackRegion(index, targetValues.length, .84);
    return { id: identifier('matching-target'), label, hitRegion, anchor: hint?.anchor || { x: hitRegion.x + hitRegion.width / 2, y: hitRegion.y + hitRegion.height / 2 }, geometryConfirmedByTeacher: false };
  });
  const example = row(payload.exampleConnection || blockValue.exampleConnection);
  const exampleSource = sourceNodes.find(node => normalized(node.label) === normalized(example.sourceLabel));
  const exampleTarget = targetNodes.find(node => normalized(node.label) === normalized(example.targetLabel));
  return {
    kind: 'starter-image-matching-v2' as const,
    sourceNodes,
    targetNodes,
    ...(exampleSource && exampleTarget ? { exampleConnection: { sourceNodeId: exampleSource.id, targetNodeId: exampleTarget.id } } : {}),
    maxConnections: questions.length,
  };
}

function buildQuestions(blockValue: Row, interaction: ExamInteractionDescriptor, currentPart: ExamPartContent | undefined, blockIndex: number, nextNumber: () => number, warnings: string[]) {
  const rawQuestions = rawBlockQuestions(blockValue);
  if (!rawQuestions || !rawQuestions.length) throw new Error(`Block ${blockIndex + 1} phải có mảng questions không rỗng.`);
  if (rawQuestions.length > MAX_QUESTIONS_PER_BLOCK) throw new Error(`Block ${blockIndex + 1} vượt quá ${MAX_QUESTIONS_PER_BLOCK} câu.`);
  const currentBlock = currentPart?.blocks?.[blockIndex];
  const currentById = new Map((currentPart?.questions || []).map(question => [question.id, question]));
  return rawQuestions.map((value: unknown, questionIndex: number) => {
    const rawQuestion = row(value);
    const currentQuestionId = currentBlock?.questionIds[questionIndex];
    const currentQuestion = currentQuestionId
      ? currentById.get(currentQuestionId)
      : !currentPart?.blocks?.length && blockIndex === 0
        ? currentPart?.questions[questionIndex]
        : undefined;
    const type = questionType(interaction, rawQuestion.type);
    const options = parseOptions(rawQuestion, currentQuestion);
    const answerKey = row(rawQuestion.answerKey);
    const trusted = trustedAnswerSource(blockValue, rawQuestion);
    const refs = [
      ...(Array.isArray(answerKey.correctOptionLabels) ? answerKey.correctOptionLabels : []),
      ...(Array.isArray(rawQuestion.correctOptionLabels) ? rawQuestion.correctOptionLabels : []),
    ].map(normalized).filter(Boolean);
    const indexes = Array.isArray(answerKey.correctOptionIndexes) ? answerKey.correctOptionIndexes.map((item: unknown) => Number(item) - 1) : [];
    const correctOptionIds = trusted ? options.filter((option, index) => refs.includes(normalized(option.label)) || refs.includes(normalized(option.text)) || indexes.includes(index)).map(option => option.id) : [];
    const acceptedSource = Array.isArray(answerKey.acceptedAnswers) ? answerKey.acceptedAnswers : Array.isArray(rawQuestion.acceptedAnswers) ? rawQuestion.acceptedAnswers : [];
    const acceptedAnswers = trusted ? acceptedSource.map((item: unknown) => cleanText(item, 4_000)).filter(Boolean).slice(0, 30) : [];
    if (!trusted && type !== 'long-writing') warnings.push(`Câu ${questionIndex + 1} của block ${blockIndex + 1}: đáp án chưa có nguồn chính thức, giáo viên cần xác nhận.`);
    const points = Number(rawQuestion.points);
    const number = nextNumber();
    const displayNumber = Number(rawQuestion.displayNumber ?? rawQuestion.questionNumber);
    const answerLength = Number(rawQuestion.answerLength);
    const writingGrading = row(rawQuestion.writingGrading);
    return {
      id: currentQuestion?.id || identifier('question'),
      number,
      ...(Number.isInteger(displayNumber) && displayNumber > 0 ? { displayNumber } : currentQuestion?.displayNumber ? { displayNumber: currentQuestion.displayNumber } : {}),
      type,
      prompt: cleanText(rawQuestion.prompt, 8_000),
      ...(cleanText(rawQuestion.context, 8_000) ? { context: cleanText(rawQuestion.context, 8_000) } : {}),
      ...(currentQuestion?.imageAssetId ? { imageAssetId: currentQuestion.imageAssetId } : {}),
      ...(currentQuestion?.imageUrl ? { imageUrl: currentQuestion.imageUrl } : {}),
      ...(currentQuestion?.secondaryImageAssetId ? { secondaryImageAssetId: currentQuestion.secondaryImageAssetId } : {}),
      ...(currentQuestion?.secondaryImageUrl ? { secondaryImageUrl: currentQuestion.secondaryImageUrl } : {}),
      options,
      correctOptionIds,
      acceptedAnswers,
      points: Number.isFinite(points) && points > 0 && points <= 100 ? points : 1,
      ...(Number(rawQuestion.maxSelections) > 0 ? { maxSelections: Number(rawQuestion.maxSelections) } : {}),
      ...(Number(rawQuestion.maxWords) > 0 ? { maxWords: Number(rawQuestion.maxWords) } : {}),
      ...(Number(rawQuestion.minWords) > 0 ? { minWords: Number(rawQuestion.minWords) } : {}),
      ...(cleanText(rawQuestion.answerPrefix, 20) ? { answerPrefix: cleanText(rawQuestion.answerPrefix, 20) } : currentQuestion?.answerPrefix !== undefined ? { answerPrefix: currentQuestion.answerPrefix } : {}),
      ...(Number.isInteger(answerLength) && answerLength > 0 ? { answerLength } : currentQuestion?.answerLength ? { answerLength: currentQuestion.answerLength } : {}),
      ...(cleanText(rawQuestion.answerSuffix, 80) ? { answerSuffix: cleanText(rawQuestion.answerSuffix, 80) } : currentQuestion?.answerSuffix !== undefined ? { answerSuffix: currentQuestion.answerSuffix } : {}),
      ...(type === 'long-writing' ? {
        rubric: cleanText(rawQuestion.rubric, 8_000) || 'Giáo viên chấm theo rubric của đề.',
        ...(cleanText(rawQuestion.modelAnswer, 20_000) ? { modelAnswer: cleanText(rawQuestion.modelAnswer, 20_000) } : {}),
        ...(writingGrading.enabled === true ? {
          writingGrading: {
            enabled: true,
            providerId: cleanText(writingGrading.providerId, 120),
            taskContext: cleanText(writingGrading.taskContext, 8_000),
            gradingInstructions: cleanText(writingGrading.gradingInstructions, 8_000),
            scoreScale: 10 as const,
          },
        } : currentQuestion?.writingGrading ? { writingGrading: currentQuestion.writingGrading } : {}),
      } : {}),
    } satisfies ExamQuestion;
  });
}

function rawBlockQuestions(blockValue: Row) {
  const payload = row(blockValue.content);
  if (Array.isArray(blockValue.questions)) return blockValue.questions;
  if (Array.isArray(payload.questions)) return payload.questions;
  if (Array.isArray(payload.scenes)) {
    return payload.scenes.flatMap((sceneValue: unknown) => {
      const scene = row(sceneValue);
      return Array.isArray(scene.questions) ? scene.questions : [];
    });
  }
  return [];
}

function applySceneQuestionContract(
  blockValue: Row,
  interaction: ExamInteractionDescriptor,
  questions: ExamQuestion[],
  currentPart: ExamPartContent | undefined,
  blockIndex: number,
  warnings: string[],
) {
  if (interaction.family !== 'scene') return questions;
  const rawQuestions = rawBlockQuestions(blockValue);
  if (interaction.subtype === 'draw-object' || interaction.variant === 'draw') {
    return questions.map(question => ({
      ...question,
      type: 'scene-draw' as const,
      options: [],
      correctOptionIds: [],
      acceptedAnswers: [],
    }));
  }
  if (interaction.subtype !== 'colour-object' && interaction.variant !== 'paint') return questions;
  const currentBlock = currentPart?.blocks?.[blockIndex];
  const currentQuestionId = currentBlock?.questionIds[0];
  const currentQuestion = currentPart?.questions.find(question => question.id === currentQuestionId);
  const palette = STARTER_BASIC_COLOURS.map((colour, index) => ({
    id: currentQuestion?.options.find(option => normalized(option.text) === colour)?.id || identifier('scene-colour'),
    label: String.fromCharCode(65 + index),
    text: colour,
  }));
  return questions.map((question, index) => {
    const rawQuestion = row(rawQuestions[index]);
    const answerKey = row(rawQuestion.answerKey);
    const colour = normalized(answerKey.colour || answerKey.color || rawQuestion.correctColour || rawQuestion.correctColor);
    const correct = palette.find(option => normalized(option.text) === colour);
    if (trustedAnswerSource(blockValue, rawQuestion) && !correct) warnings.push(`Câu ${index + 1}: đáp án màu chưa thuộc catalog 10 màu cơ bản; giáo viên cần chọn lại.`);
    return {
      ...question,
      type: 'single-choice' as const,
      options: palette.map(option => ({ ...option })),
      correctOptionIds: trustedAnswerSource(blockValue, rawQuestion) && correct ? [correct.id] : [],
      acceptedAnswers: [],
    };
  });
}

function connectMatchingAnswers(blockValue: Row, questions: ExamQuestion[], layout: ReturnType<typeof matchingLayout>, warnings: string[]) {
  if (!layout) return questions;
  const payload = row(blockValue.content);
  const rawQuestions = Array.isArray(blockValue.questions) ? blockValue.questions : Array.isArray(payload.questions) ? payload.questions : [];
  return questions.map((question, index) => {
    const rawQuestion = row(rawQuestions[index]);
    const sourceLabel = cleanText(rawQuestion.sourceLabel || row(rawQuestion.answerKey).sourceLabel, 240);
    const targetLabel = cleanText(row(rawQuestion.answerKey).targetLabel || rawQuestion.targetLabel, 240);
    const source = layout.sourceNodes.find(node => normalized(node.label) === normalized(sourceLabel));
    const target = layout.targetNodes.find(node => normalized(node.label) === normalized(targetLabel));
    const trusted = trustedAnswerSource(blockValue, rawQuestion);
    if (!source || (trusted && !target)) warnings.push(`Câu matching ${index + 1}: không đối chiếu được sourceLabel/targetLabel với danh sách node.`);
    return {
      ...question,
      interactionSourceNodeId: source?.id,
      options: layout.targetNodes.map(node => ({ id: node.id, label: node.label, text: node.label })),
      correctOptionIds: trusted && target ? [target.id] : [],
    };
  });
}

function buildPart(partValue: unknown, partIndex: number, current: ExamPartContent | undefined, nextNumber: () => number): { part: ExamPartContent; report: UniversalImportReport } {
  const source = row(partValue);
  const partNumber = Number(source.partNumber ?? source.part ?? partIndex + 1);
  if (partNumber !== partIndex + 1) throw new Error(`Part ở vị trí ${partIndex + 1} phải có partNumber=${partIndex + 1}.`);
  const rawBlocks = Array.isArray(source.blocks) ? source.blocks : null;
  if (!rawBlocks?.length) throw new Error(`Part ${partNumber} phải có ít nhất một block.`);
  if (rawBlocks.length > MAX_BLOCKS_PER_PART) throw new Error(`Part ${partNumber} vượt quá ${MAX_BLOCKS_PER_PART} block.`);
  const warnings: string[] = [];
  const questions: ExamQuestion[] = [];
  const blocks: ExamPartBlock[] = rawBlocks.map((blockValue: unknown, blockIndex: number) => {
    const blockSource = row(blockValue);
    const blockNumber = Number(blockSource.blockNumber ?? blockIndex + 1);
    if (blockNumber !== blockIndex + 1) throw new Error(`Part ${partNumber}, block ở vị trí ${blockIndex + 1} phải có blockNumber=${blockIndex + 1}.`);
    const interaction = interactionDescriptor(blockSource.interaction);
    let blockQuestions = buildQuestions(blockSource, interaction, current, blockIndex, nextNumber, warnings);
    blockQuestions = applySceneQuestionContract(blockSource, interaction, blockQuestions, current, blockIndex, warnings);
    const geometryHints = parseGeometryHints(blockSource.geometryHints, blockQuestions, warnings);
    const layout = matchingLayout(blockSource, interaction, blockQuestions, geometryHints, warnings);
    blockQuestions = connectMatchingAnswers(blockSource, blockQuestions, layout, warnings);
    const currentBlock = current?.blocks?.[blockIndex];
    const payload = row(blockSource.content);
    const rawExamples = Array.isArray(payload.examples)
      ? payload.examples
      : Array.isArray(blockSource.examples)
        ? blockSource.examples
        : [];
    const examples = rawExamples.slice(0, 10).map((value: unknown, index: number) => {
      const example = row(value);
      const previous = currentBlock?.examples?.[index]
        || (!current?.blocks?.length ? current?.examples?.[index] : undefined);
      const options = Array.isArray(example.options)
        ? example.options.slice(0, 10).map((optionValue: unknown) => {
            const option = row(optionValue);
            return {
              label: cleanText(option.label, 20),
              text: cleanText(option.text, 1_000),
            };
          }).filter(option => option.label && option.text)
        : [];
      return {
        prompt: cleanText(example.prompt, 2_000),
        answer: cleanText(example.answer, 1_000),
        ...(options.length ? { options } : {}),
        ...(previous?.imageAssetId ? { imageAssetId: previous.imageAssetId } : {}),
        ...(previous?.imageUrl ? { imageUrl: previous.imageUrl } : {}),
        ...(previous?.secondaryImageAssetId ? { secondaryImageAssetId: previous.secondaryImageAssetId } : {}),
        ...(previous?.secondaryImageUrl ? { secondaryImageUrl: previous.secondaryImageUrl } : {}),
      };
    });
    const rawScenes = Array.isArray(payload.scenes)
      ? payload.scenes
      : Array.isArray(blockSource.scenes)
        ? blockSource.scenes
        : [];
    let sceneQuestionOffset = 0;
    const parsedReadingScenes = rawScenes.slice(0, 10).map((value: unknown, index: number) => {
      const scene = row(value);
      const rawSceneQuestions = Array.isArray(scene.questions) ? scene.questions : [];
      const questionIds = blockQuestions
        .slice(sceneQuestionOffset, sceneQuestionOffset + rawSceneQuestions.length)
        .map(question => question.id);
      sceneQuestionOffset += rawSceneQuestions.length;
      const previous = currentBlock?.readingScenes?.[index]
        || (!current?.blocks?.length ? current?.readingScenes?.[index] : undefined);
      return {
        id: previous?.id || identifier('reading-scene'),
        passage: cleanText(scene.passage, 20_000),
        questionIds,
        ...(previous?.imageAssetId ? { imageAssetId: previous.imageAssetId } : {}),
        ...(previous?.imageUrl ? { imageUrl: previous.imageUrl } : {}),
      };
    });
    const readingScenes = parsedReadingScenes.length
      ? parsedReadingScenes
      : currentBlock?.readingScenes || (!current?.blocks?.length ? current?.readingScenes : undefined);
    const imageTextEntryLayout = !layout && interaction.family === 'text-entry' && interaction.variant === 'image-regions'
      ? {
          kind: 'image-text-entry-v1' as const,
          targets: blockQuestions.map((question, index) => {
            const hint = geometryHints.find(item => item.role === 'answer-region' && item.questionId === question.id);
            return { id: identifier('text-entry-target'), questionId: question.id, label: hint?.label || `Câu ${question.number}`, region: hint?.region || fallbackRegion(index, blockQuestions.length, .1 + index * Math.min(.12, .75 / Math.max(blockQuestions.length, 1))), geometryConfirmedByTeacher: false };
          }),
        }
      : undefined;
    const sceneLayout = !layout && interaction.family === 'scene' && interaction.subtype === 'colour-object' && interaction.variant === 'paint'
      ? {
          kind: 'starter-scene-colour-v1' as const,
          targets: blockQuestions.map((question, index) => {
            const hint = geometryHints.find(item => item.role === 'colour-mask' && (item.questionId === question.id || normalized(item.label) === normalized(question.prompt)));
            return { id: identifier('scene-target'), questionId: question.id, label: question.prompt, region: hint?.region || fallbackRegion(index, blockQuestions.length, .1 + index * Math.min(.12, .75 / Math.max(blockQuestions.length, 1))), geometryConfirmedByTeacher: false };
          }),
        }
      : undefined;
    const drawLayout = !layout && interaction.family === 'scene' && (interaction.subtype === 'draw-object' || interaction.variant === 'draw')
      ? {
          kind: 'scene-draw-v1' as const,
          targets: blockQuestions.map((question, index) => {
            const rawQuestion = row(rawBlockQuestions(blockSource)[index]);
            const answerKey = row(rawQuestion.answerKey);
            const object = cleanText(rawQuestion.drawObject || rawQuestion.object || answerKey.object, 120) || 'object';
            const previousLayout = currentBlock?.interactionLayout?.kind === 'scene-draw-v1' ? currentBlock.interactionLayout : undefined;
            const previousTarget = previousLayout?.targets[index];
            const hint = geometryHints.find(item => item.role === 'draw-region' && (item.questionId === question.id || normalized(item.label) === normalized(question.prompt)));
            return {
              id: previousTarget?.id || identifier('scene-draw-target'),
              questionId: question.id,
              label: cleanText(rawQuestion.targetDescription, 500) || question.prompt,
              object,
              ...(previousTarget && normalized(previousTarget.object) === normalized(object) && previousTarget.tokenAssetId
                ? { tokenAssetId: previousTarget.tokenAssetId, tokenUrl: previousTarget.tokenUrl }
                : {}),
              targetRegion: hint?.region || fallbackRegion(index, blockQuestions.length, .2 + index * Math.min(.12, .6 / Math.max(blockQuestions.length, 1))),
              geometryConfirmedByTeacher: false,
            };
          }),
        }
      : undefined;
    questions.push(...blockQuestions);
    return {
      id: currentBlock?.id || identifier('block'),
      block: blockNumber,
      title: cleanText(blockSource.title, 240) || `Dạng bài ${blockNumber}`,
      instruction: cleanText(blockSource.instruction, 4_000),
      ...(cleanText(blockSource.passage ?? row(blockSource.content).passage, 20_000) ? { passage: cleanText(blockSource.passage ?? row(blockSource.content).passage, 20_000) } : {}),
      ...(currentBlock?.imageAssetId ? { imageAssetId: currentBlock.imageAssetId, imageUrl: currentBlock.imageUrl } : {}),
      ...(currentBlock?.audioAssetId ? { audioAssetId: currentBlock.audioAssetId, audioUrl: currentBlock.audioUrl } : {}),
      interaction: { ...interaction, importReadiness: geometryHints.length ? 'needs-geometry' : 'needs-assets', ...(warnings.length ? { warnings: [...warnings] } : {}) },
      ...(layout || imageTextEntryLayout || sceneLayout || drawLayout ? { interactionLayout: layout || imageTextEntryLayout || sceneLayout || drawLayout } : {}),
      ...(examples.length ? { examples } : currentBlock?.examples?.length ? { examples: currentBlock.examples } : {}),
      ...(readingScenes?.length ? { readingScenes } : {}),
      ...(geometryHints.length ? { geometryHints } : {}),
      questionIds: blockQuestions.map(question => question.id),
    };
  });
  return {
    part: {
      id: current?.id || identifier('part'),
      part: partNumber,
      title: cleanText(source.title, 240) || `Part ${partNumber}`,
      instruction: cleanText(source.instruction, 4_000),
      ...(cleanText(source.passage, 20_000) ? { passage: cleanText(source.passage, 20_000) } : {}),
      ...(current?.imageAssetId ? { imageAssetId: current.imageAssetId, imageUrl: current.imageUrl } : {}),
      ...(current?.audioAssetId ? { audioAssetId: current.audioAssetId, audioUrl: current.audioUrl } : {}),
      ...(current?.audioTranscript ? { audioTranscript: current.audioTranscript } : {}),
      blocks,
      questions,
    },
    report: { part: partNumber, blockCount: blocks.length, questionCount: questions.length, warnings },
  };
}

function extractPaper(parsed: Row, content: ExamPaperContent) {
  if (parsed.format !== 'exam-bundle-import-v2' || Number(parsed.formatVersion) !== 2) {
    throw new Error('JSON tổng quát phải dùng format "exam-bundle-import-v2" và formatVersion 2.');
  }
  const exam = row(parsed.exam);
  if (cleanText(exam.moduleId, 80) !== content.moduleId) throw new Error(`JSON dành cho module "${cleanText(exam.moduleId, 80)}", không phải "${content.moduleId}".`);
  const papers = Array.isArray(parsed.papers) ? parsed.papers : [];
  const paper = papers.find((value: unknown) => cleanText(row(value).paperId, 80) === content.paperId);
  if (!paper) throw new Error(`JSON không có paper "${content.paperId}".`);
  return { exam, paper: row(paper) };
}

function normalizeFlyerListeningPartShape(part: ExamPartContent, current: ExamPartContent | undefined): ExamPartContent {
  if (part.part === 1) {
    const unit = part.blocks?.[0];
    const importedQuestions = part.questions.slice(0, 5);
    const optionRows = importedQuestions.flatMap(question => question.options);
    const labels = [...new Map(optionRows.map(option => [normalized(option.text || option.label), option])).values()].slice(0, 6);
    const previousOptions = current?.questions[0]?.options || [];
    const canonical = labels.map((option, index) => {
      const previous = previousOptions.find(item => normalized(item.text || item.label) === normalized(option.text || option.label));
      return { ...option, id: previous?.id || identifier(`flyer-p${part.part}-name`), label: String.fromCharCode(65 + index) };
    });
    const questions = importedQuestions.map(question => {
      const selected = question.options.find(option => question.correctOptionIds.includes(option.id));
      const correct = selected ? canonical.find(option => normalized(option.text || option.label) === normalized(selected.text || selected.label)) : undefined;
      return { ...question, type: 'matching' as const, options: canonical.map(option => ({ ...option })), correctOptionIds: correct ? [correct.id] : [] };
    });
    const hints = unit?.geometryHints || [];
    const previousLayout = current?.interactionLayout?.kind === 'flyer-name-placement-v1' ? current.interactionLayout : undefined;
    const targets = questions.map((question, index) => {
      const hint = hints.find(item => item.questionId === question.id && ['target-node', 'answer-region'].includes(item.role));
      const previous = previousLayout?.targets[index];
      const sourceRegion = hint?.region || previous?.region || fallbackRegion(index, questions.length, .12 + index * .14);
      const region = {
        shape: 'rect' as const,
        x: Math.max(0, Math.min(1 - FLYER_NAME_REGION_WIDTH, sourceRegion.x)),
        y: Math.max(0, Math.min(1 - FLYER_NAME_REGION_HEIGHT, sourceRegion.y)),
        width: FLYER_NAME_REGION_WIDTH,
        height: FLYER_NAME_REGION_HEIGHT,
      };
      return {
        id: previous?.id || identifier(`flyer-p${part.part}-target`),
        questionId: question.id,
        label: `Vùng ${index + 1}`,
        region,
        geometryConfirmedByTeacher: Boolean(hint?.region) || Boolean(previous?.geometryConfirmedByTeacher),
      };
    });
    const nextUnit = unit ? { ...unit, interaction: { family: 'matching' as const, subtype: 'name-scene', variant: 'drag-name-to-region', schemaVersion: 1, importReadiness: 'needs-geometry' as const }, interactionLayout: { kind: 'flyer-name-placement-v1' as const, targets }, questionIds: questions.map(question => question.id) } : undefined;
    return {
      ...part,
      interaction: nextUnit?.interaction || { family: 'matching', subtype: 'name-scene', variant: 'drag-name-to-region', schemaVersion: 1, importReadiness: 'needs-geometry' },
      interactionLayout: { kind: 'flyer-name-placement-v1', targets },
      examples: unit?.examples || part.examples || current?.examples || [{ prompt: 'Example', answer: '' }],
      questions,
      ...(nextUnit ? { blocks: [nextUnit] } : {}),
    };
  }
  if (part.part === 2) {
    const unit = part.blocks?.[0];
    const questions = part.questions.slice(0, 5).map(question => ({
      ...question,
      type: 'short-answer' as const,
      options: [],
      correctOptionIds: [],
    }));
    const interaction = { family: 'text-entry' as const, subtype: 'short-answer', variant: 'single-input', schemaVersion: 1, importReadiness: 'needs-assets' as const };
    const nextUnit = unit ? {
      ...unit,
      interaction,
      interactionLayout: undefined,
      questionIds: questions.map(question => question.id),
    } : undefined;
    return {
      ...part,
      interaction,
      interactionLayout: undefined,
      questions,
      ...(nextUnit ? { blocks: [nextUnit] } : {}),
    };
  }
  if (part.part === 3) {
    const questions = part.questions.slice(0, 5).map(question => ({ ...question, type: 'short-answer' as const, options: [], correctOptionIds: [], maxWords: 1 }));
    const blocks = part.blocks?.map(block => ({ ...block, interaction: { family: 'text-entry' as const, subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1, importReadiness: 'needs-assets' as const }, questionIds: questions.map(question => question.id) }));
    return { ...part, interaction: { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1, importReadiness: 'needs-assets' }, examples: part.blocks?.[0]?.examples || part.examples || current?.examples || [{ prompt: 'Example', answer: '' }], readingScenes: part.blocks?.[0]?.readingScenes || part.readingScenes || current?.readingScenes, questions, ...(blocks?.length ? { blocks } : {}) };
  }
  if (part.part === 4) {
    return { ...part, interaction: { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1, importReadiness: 'needs-assets' } };
  }
  return part;
}

function preserveFlyerListeningQuestionIds(part: ExamPartContent, current: ExamPartContent | undefined): ExamPartContent {
  if (!current || part.questions.length !== current.questions.length) return part;
  const idMap = new Map(part.questions.map((question, index) => [question.id, current.questions[index].id]));
  const remapQuestion = (question: ExamQuestion, index: number): ExamQuestion => {
    const previous = current.questions[index];
    const selected = question.options.find(option => question.correctOptionIds.includes(option.id));
    const options = question.options.map(option => {
      const existing = previous.options.find(item => normalized(item.text || item.label) === normalized(option.text || option.label));
      return { ...option, id: existing?.id || option.id };
    });
    const selectedOption = selected ? options.find(option => normalized(option.text || option.label) === normalized(selected.text || selected.label)) : undefined;
    return { ...question, id: previous.id, options, correctOptionIds: selectedOption ? [selectedOption.id] : [] };
  };
  const remapLayout = (layout: ExamPartContent['interactionLayout']) => {
    if (!layout) return layout;
    if (layout.kind === 'flyer-name-placement-v1' || layout.kind === 'starter-scene-colour-v1' || layout.kind === 'scene-draw-v1' || layout.kind === 'image-text-entry-v1') {
      return { ...layout, targets: layout.targets.map(target => ({ ...target, questionId: idMap.get(target.questionId) || target.questionId })) } as typeof layout;
    }
    return layout;
  };
  return {
    ...part,
    questions: part.questions.map(remapQuestion),
    interactionLayout: remapLayout(part.interactionLayout),
    readingScenes: part.readingScenes?.map(scene => ({ ...scene, questionIds: scene.questionIds.map(id => idMap.get(id) || id) })),
    blocks: part.blocks?.map(block => ({
      ...block,
      questionIds: block.questionIds.map(id => idMap.get(id) || id),
      interactionLayout: remapLayout(block.interactionLayout),
      readingScenes: block.readingScenes?.map(scene => ({ ...scene, questionIds: scene.questionIds.map(id => idMap.get(id) || id) })),
      geometryHints: block.geometryHints?.map(hint => ({ ...hint, ...(hint.questionId ? { questionId: idMap.get(hint.questionId) || hint.questionId } : {}) })),
    })),
  };
}

function normalizeFlyerListeningPart(part: ExamPartContent, current: ExamPartContent | undefined): ExamPartContent {
  return preserveFlyerListeningQuestionIds(normalizeFlyerListeningPartShape(part, current), current);
}

export function importUniversalExamBundle(current: ExamPaperContent, source: string): UniversalImportResult {
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error('JSON tổng không hợp lệ.'); }
  const technical = findTechnicalField(parsed);
  if (technical) throw new Error(`JSON ngoài không được chứa trường kỹ thuật "${technical}".`);
  const { exam, paper } = extractPaper(row(parsed), current);
  const rawParts = Array.isArray(paper.parts) ? paper.parts : null;
  if (!rawParts?.length) throw new Error('Paper phải có mảng parts không rỗng.');
  if (rawParts.length > MAX_PARTS) throw new Error(`Một paper không được vượt quá ${MAX_PARTS} Part.`);
  let questionNumber = 0;
  const nextNumber = () => ++questionNumber;
  const fixedFlyerListening = current.moduleId === 'flyer' && current.paperId === 'listening';
  const fixedFlyerReadingWriting = current.moduleId === 'flyer' && current.paperId === 'reading-writing';
  const fixedStarterReadingWriting = current.moduleId === 'starter' && current.paperId === 'reading-writing';
  const fixedKetListening = isFixedKetListeningContent(current);
  const fixedKetReadingWriting = current.moduleId === 'ket' && current.paperId === 'reading-writing' && current.templateVersion === 'ket-reading-writing-9-v1';
  if (fixedFlyerListening && rawParts.length !== 5) throw new Error('Flyers Listening phải có đúng 5 Part.');
  if (fixedFlyerReadingWriting && rawParts.length !== 7) throw new Error('Flyers Reading & Writing phải có đúng 7 Part.');
  if (fixedStarterReadingWriting && rawParts.length !== 5) throw new Error('Starters Reading & Writing phải có đúng 5 Part.');
  if (fixedKetReadingWriting && rawParts.length !== 9) throw new Error('KET Reading & Writing phải có đúng 9 Part.');
  if (fixedKetListening && rawParts.length !== 5) throw new Error('KET Listening phải có đúng 5 Part.');
  const built = rawParts.map((value: unknown, index: number) => buildPart(value, index, current.parts[index], nextNumber));
  if (fixedFlyerListening && built.some(item => item.part.questions.length !== 5)) throw new Error('Flyers Listening yêu cầu mỗi Part đúng 5 câu chấm điểm.');
  if (fixedStarterReadingWriting && built.some(item => item.part.questions.length !== 5)) throw new Error('Starters Reading & Writing yêu cầu mỗi Part đúng 5 câu chấm điểm.');
  const builtParts = fixedFlyerListening
    ? built.map((item, index) => normalizeFlyerListeningPart(item.part, current.parts[index]))
    : built.map(item => item.part);
  const fixedContent = fixedFlyerReadingWriting
    ? normalizeFixedFlyerReadingWritingContent({ ...current, schemaVersion: EXAM_CONTENT_SCHEMA_VERSION, structureMode: 'definition', parts: builtParts })
    : fixedKetListening
      ? normalizeFixedKetListeningContent({ ...current, schemaVersion: EXAM_CONTENT_SCHEMA_VERSION, structureMode: 'definition', parts: builtParts })
      : fixedKetReadingWriting
        ? normalizeFixedKetReadingWritingContent({ ...current, schemaVersion: EXAM_CONTENT_SCHEMA_VERSION, structureMode: 'definition', parts: builtParts })
        : undefined;
  const parts = fixedContent?.parts || builtParts;
  return {
    content: {
      ...current,
      schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
      ...(fixedStarterReadingWriting || fixedFlyerListening || fixedFlyerReadingWriting || fixedKetListening || fixedKetReadingWriting ? { structureMode: 'definition' as const } : { structureMode: 'dynamic' as const }),
      title: cleanText(paper.title || exam.title, 240) || current.title,
      description: cleanText(paper.description || exam.description, 4_000) || current.description,
      level: cleanText(paper.level || exam.level, 240) || current.level,
      ...(Number(paper.timeLimitMinutes) > 0 ? { timeLimitMinutes: Number(paper.timeLimitMinutes) } : {}),
      parts,
    },
    reports: built.map(item => item.report),
  };
}

export function importUniversalExamPart(currentContent: ExamPaperContent, partIndex: number, source: string): { part: ExamPartContent; report: UniversalImportReport } {
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error('JSON Part không hợp lệ.'); }
  const technical = findTechnicalField(parsed);
  if (technical) throw new Error(`JSON ngoài không được chứa trường kỹ thuật "${technical}".`);
  const parsedRow = row(parsed);
  let partValue: unknown = parsedRow.part && typeof parsedRow.part === 'object' ? parsedRow.part : parsedRow;
  if (parsedRow.format === 'exam-bundle-import-v2') {
    const { paper } = extractPaper(parsedRow, currentContent);
    partValue = Array.isArray(paper.parts)
      ? paper.parts.find((value: unknown) => Number(row(value).partNumber ?? row(value).part) === partIndex + 1) || paper.parts[partIndex]
      : undefined;
  }
  if (!partValue) throw new Error(`JSON không có Part ${partIndex + 1}.`);
  let questionNumber = currentContent.parts.slice(0, partIndex).reduce((sum, part) => sum + part.questions.length, 0);
  const built = buildPart(partValue, partIndex, currentContent.parts[partIndex], () => ++questionNumber);
  if (currentContent.moduleId === 'flyer' && currentContent.paperId === 'listening') {
    if (built.part.questions.length !== 5) throw new Error(`Flyers Listening Part ${partIndex + 1} phải có đúng 5 câu chấm điểm.`);
    return { ...built, part: normalizeFlyerListeningPart(built.part, currentContent.parts[partIndex]) };
  }
  if (currentContent.moduleId === 'flyer' && currentContent.paperId === 'reading-writing') {
    if (!built.part.questions.length) throw new Error(`Flyers Reading & Writing Part ${partIndex + 1} phải có ít nhất một câu chấm điểm.`);
    const parts = currentContent.parts.map((part, index) => index === partIndex ? built.part : part);
    const normalizedContent = normalizeFixedFlyerReadingWritingContent({ ...currentContent, parts });
    return { ...built, part: normalizedContent.parts[partIndex] };
  }
  if (isFixedKetListeningContent(currentContent)) {
    if (!built.part.questions.length) throw new Error(`KET Listening Part ${partIndex + 1} phải có ít nhất một câu chấm điểm.`);
    const parts = currentContent.parts.map((part, index) => index === partIndex ? built.part : part);
    const normalizedContent = normalizeFixedKetListeningContent({ ...currentContent, parts });
    return { ...built, part: normalizedContent.parts[partIndex] };
  }
  if (currentContent.moduleId === 'ket' && currentContent.paperId === 'reading-writing' && currentContent.templateVersion === 'ket-reading-writing-9-v1') {
    if (!built.part.questions.length) throw new Error(`KET Reading & Writing Part ${partIndex + 1} phải có ít nhất một câu chấm điểm.`);
    const parts = currentContent.parts.map((part, index) => index === partIndex ? built.part : part);
    const normalizedContent = normalizeFixedKetReadingWritingContent({ ...currentContent, parts });
    return { ...built, part: normalizedContent.parts[partIndex] };
  }
  return built;
}

export function universalImportPaperId(value: unknown): ExamPaperId | '' {
  return cleanText(value, 80) as ExamPaperId | '';
}
