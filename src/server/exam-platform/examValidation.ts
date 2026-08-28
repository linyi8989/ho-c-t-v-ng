import type {
  ExamAnswers,
  ExamPaperContent,
  ExamPartContent,
  ExamPartDefinition,
  ExamQuestion,
  ExamQuestionType,
} from '../../features/exam-platform/types.js';
import { EXAM_CONTENT_SCHEMA_VERSION } from '../../features/exam-platform/types.js';
import { EXAM_LEGACY_CONTENT_SCHEMA_VERSION } from '../../features/exam-platform/types.js';
import { getExamPaperDefinition } from '../../features/exam-platform/definitions.js';
import { examPartUnits } from '../../features/exam-platform/examStructure.js';
import {
  isExamMatchingConnection,
  starterMatchingModel,
  starterMatchingResponseKey,
} from '../../features/exam-platform/starterMatching.js';

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

const starterBasicColours = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white'];

function starterStudentColourPalette(part: ExamPartContent) {
  const correctColours = examPartUnits(part).flatMap(unit => (
    unit.interactionLayout?.kind === 'starter-scene-colour-v1'
      ? unit.questions.flatMap(question => {
          const correctId = question.correctOptionIds[0];
          const option = question.options.find(item => item.id === correctId);
          const colour = text(option?.text || option?.label, 40).toLocaleLowerCase('en');
          return colour ? [colour] : [];
        })
      : []
  ));
  const uniqueCorrect = [...new Set(correctColours)];
  const distractor = starterBasicColours.find(colour => !uniqueCorrect.includes(colour));
  return [...uniqueCorrect, ...(distractor ? [distractor] : [])];
}

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

function validInteractionRegion(value: unknown) {
  const region = record(value);
  if (!['rect', 'ellipse', 'polygon'].includes(region.shape)) return false;
  const values = [region.x, region.y, region.width, region.height].map(Number);
  if (values.some(number => !Number.isFinite(number))) return false;
  const [x, y, width, height] = values;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.00001 || y + height > 1.00001) return false;
  if (region.shape === 'polygon') {
    return Array.isArray(region.points)
      && region.points.length >= 3
      && region.points.every((point: unknown) => {
        const row = record(point);
        return Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y))
          && Number(row.x) >= 0 && Number(row.x) <= 1 && Number(row.y) >= 0 && Number(row.y) <= 1;
      });
  }
  return true;
}

function validMatchingAnchor(value: unknown, regionValue: unknown) {
  const anchor = record(value);
  const region = record(regionValue);
  const x = Number(anchor.x);
  const y = Number(anchor.y);
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && x <= 1 && y >= 0 && y <= 1
    && x >= Number(region.x) && x <= Number(region.x) + Number(region.width)
    && y >= Number(region.y) && y <= Number(region.y) + Number(region.height);
}

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

function validateDynamicQuestion(question: ExamQuestion, label: string, allIds: Set<string>, errors: string[]) {
  if (!question?.id || allIds.has(question.id)) errors.push(`${label}: ID câu hỏi bị thiếu hoặc trùng.`);
  else allIds.add(question.id);
  if (!text(question.prompt, 8_000)) errors.push(`${label}: thiếu nội dung câu hỏi.`);
  if (!Number.isFinite(question.points) || question.points <= 0 || question.points > 100) errors.push(`${label}: điểm tối đa không hợp lệ.`);
  if (question.type === 'long-writing') {
    if (!text(question.rubric, 8_000)) errors.push(`${label}: thiếu rubric để giáo viên chấm.`);
    return;
  }
  if (!objectiveTypes.has(question.type)) return;
  if (choiceQuestionTypes.has(question.type)) {
    if (question.options.length < 2) errors.push(`${label}: cần ít nhất hai lựa chọn.`);
    const optionIds = new Set(question.options.map(option => option.id));
    if (optionIds.size !== question.options.length || optionIds.has('')) errors.push(`${label}: ID lựa chọn bị thiếu hoặc trùng.`);
    if (!question.correctOptionIds.length) errors.push(`${label}: giáo viên chưa xác nhận đáp án đúng.`);
    if (question.correctOptionIds.some(id => !optionIds.has(id))) errors.push(`${label}: đáp án đúng không thuộc danh sách lựa chọn.`);
    if (question.type !== 'multiple-choice' && question.correctOptionIds.length !== 1) errors.push(`${label}: phải có đúng một đáp án đúng.`);
  } else if (!question.acceptedAnswers.some(answer => normalizeExamText(answer))) {
    errors.push(`${label}: giáo viên chưa nhập đáp án được chấp nhận.`);
  }
}

function validateDynamicUnit(unit: ExamPartContent, partIndex: number, blockIndex: number, allIds: Set<string>, errors: string[]) {
  const label = `Part ${partIndex + 1}, dạng ${blockIndex + 1}`;
  if (!unit.interaction || !text(unit.interaction.family, 40) || !text(unit.interaction.subtype, 80) || !text(unit.interaction.variant, 80)) errors.push(`${label}: thiếu mô tả interaction family/subtype/variant.`);
  if (!unit.questions.length) errors.push(`${label}: phải có ít nhất một câu.`);
  if (unit.interaction?.family === 'matching' && unit.interaction.subtype === 'image-image' && unit.interactionLayout?.kind !== 'starter-image-matching-v2') errors.push(`${label}: matching image-image phải có layout node để giáo viên xác nhận.`);
  if (unit.interactionLayout?.kind === 'starter-image-matching-v2') {
    if (!text(unit.imageAssetId, 180)) errors.push(`${label}: phải chọn ảnh nguồn cho matching.`);
    const sourceNodes = unit.interactionLayout.sourceNodes || [];
    const targetNodes = unit.interactionLayout.targetNodes || [];
    const nodes = [...sourceNodes, ...targetNodes];
    const sourceIds = new Set(sourceNodes.map(node => node.id));
    const targetIds = new Set(targetNodes.map(node => node.id));
    if (sourceNodes.length < unit.questions.length || targetNodes.length < unit.questions.length) errors.push(`${label}: số source/target node ít hơn số câu được chấm.`);
    if (new Set(nodes.map(node => node.id)).size !== nodes.length || nodes.some(node => !text(node.id, 180) || !text(node.label, 240))) errors.push(`${label}: node matching bị thiếu hoặc trùng ID.`);
    const scoredSources = unit.questions.map(question => question.interactionSourceNodeId).filter(Boolean) as string[];
    const scoredTargets = unit.questions.flatMap(question => question.correctOptionIds || []);
    if (scoredSources.length !== unit.questions.length || new Set(scoredSources).size !== unit.questions.length || scoredSources.some(id => !sourceIds.has(id))) errors.push(`${label}: source node chưa ánh xạ một-một với câu.`);
    if (scoredTargets.length !== unit.questions.length || new Set(scoredTargets).size !== unit.questions.length || scoredTargets.some(id => !targetIds.has(id))) errors.push(`${label}: target node/đáp án chưa ánh xạ một-một.`);
    if (unit.interactionLayout.maxConnections !== unit.questions.length) errors.push(`${label}: maxConnections phải bằng số câu.`);
    if (nodes.some(node => node.geometryConfirmedByTeacher !== true || !validInteractionRegion(node.hitRegion) || !validMatchingAnchor(node.anchor, node.hitRegion))) errors.push(`${label}: giáo viên chưa xác nhận đầy đủ hitbox/điểm neo.`);
  }
  if (unit.interactionLayout?.kind === 'starter-scene-colour-v1') {
    if (!text(unit.imageAssetId, 180)) errors.push(`${label}: phải chọn ảnh scene.`);
    if (unit.interactionLayout.targets.length !== unit.questions.length || unit.interactionLayout.targets.some(target => target.geometryConfirmedByTeacher !== true || !validInteractionRegion(target.region))) errors.push(`${label}: giáo viên chưa xác nhận đủ vùng tô màu.`);
  }
  if (unit.interactionLayout?.kind === 'scene-draw-v1') {
    if (!text(unit.imageAssetId, 180)) errors.push(`${label}: phải chọn ảnh scene cho thao tác vẽ.`);
    const questionIds = new Set(unit.questions.map(question => question.id));
    const targets = unit.interactionLayout.targets;
    if (targets.length !== unit.questions.length
      || new Set(targets.map(target => target.questionId)).size !== unit.questions.length
      || targets.some(target => !questionIds.has(target.questionId)
        || !text(target.object, 120)
        || !text(target.label, 500)
        || target.geometryConfirmedByTeacher !== true
        || !validInteractionRegion(target.targetRegion))) {
      errors.push(`${label}: giáo viên chưa xác nhận đúng một vật và vùng đích cho mỗi yêu cầu vẽ.`);
    }
    if (targets.some(target => !text(target.tokenAssetId, 180))) {
      errors.push(`${label}: phải tải ảnh PNG kéo thả cho mỗi vật Draw.`);
    }
  }
  if (unit.interactionLayout?.kind === 'image-text-entry-v1') {
    if (!text(unit.imageAssetId, 180)) errors.push(`${label}: phải chọn ảnh chứa vùng điền đáp án.`);
    const questionIds = new Set(unit.questions.map(question => question.id));
    const targets = unit.interactionLayout.targets;
    if (targets.length !== unit.questions.length || new Set(targets.map(target => target.questionId)).size !== unit.questions.length || targets.some(target => !questionIds.has(target.questionId) || target.geometryConfirmedByTeacher !== true || !validInteractionRegion(target.region))) errors.push(`${label}: giáo viên chưa xác nhận đúng một vùng điền cho mỗi câu.`);
  }
  if (unit.interaction?.variant === 'image-options' && unit.questions.some(question => question.options.some(option => !text(option.imageAssetId, 180)))) errors.push(`${label}: phải gắn/crop ảnh cho mọi lựa chọn.`);
  unit.questions.forEach((question, questionIndex) => validateDynamicQuestion(question, `${label}, câu ${questionIndex + 1}`, allIds, errors));
}

function validateStarterReadingWritingPart(part: ExamPartContent, partIndex: number, errors: string[]) {
  const units = examPartUnits(part);
  const unit = units[0];
  const partNumber = partIndex + 1;
  const expectedVariants = ['yes-no', 'yes-no', 'image-spelling', 'story-gaps', 'scene-story'];
  if (units.length !== 1) {
    errors.push(`Starters Reading & Writing Part ${partNumber}: phải có đúng một dạng bài.`);
    return;
  }
  if (!unit || unit.questions.length !== 5) {
    errors.push(`Starters Reading & Writing Part ${partNumber}: phải có đúng 5 câu.`);
    return;
  }
  if (unit.interaction?.variant !== expectedVariants[partIndex]) {
    errors.push(`Starters Reading & Writing Part ${partNumber}: dạng bài không đúng cấu trúc đã thiết kế.`);
  }

  if (partNumber <= 2) {
    if (!text(unit.imageAssetId, 180)) errors.push(`Starters Reading & Writing Part ${partNumber}: phải tải ảnh bài làm cho học sinh.`);
    if (unit.questions.some(question => question.type !== 'true-false' || question.options.length !== 2)) {
      errors.push(`Starters Reading & Writing Part ${partNumber}: mỗi câu phải có đúng hai lựa chọn Yes/No.`);
    }
    if (partNumber === 1 && !text(unit.examples?.[0]?.imageAssetId, 180)) {
      errors.push('Starters Reading & Writing Part 1: phải tải ảnh example riêng ở phía trên.');
    }
    const expectedExamples = partNumber === 1 ? 1 : 2;
    if ((unit.examples || []).length !== expectedExamples) {
      errors.push(`Starters Reading & Writing Part ${partNumber}: phải có đúng ${expectedExamples} example không chấm điểm.`);
    }
  }

  if (partNumber === 3) {
    if (!text(unit.imageAssetId, 180)) errors.push('Starters Reading & Writing Part 3: phải tải ảnh trang bài tập hiển thị bên trái.');
    if (unit.questions.some(question => question.type !== 'short-answer')) errors.push('Starters Reading & Writing Part 3: cả 5 câu phải là dạng điền từ.');
  }

  if (partNumber === 4) {
    if (!text(unit.imageAssetId, 180)) errors.push('Starters Reading & Writing Part 4: phải tải ảnh ngân hàng từ/hình.');
    const passage = unit.passage || '';
    for (let number = 1; number <= 5; number += 1) {
      const marker = `[[${number}]]`;
      if (passage.split(marker).length - 1 !== 1) errors.push(`Starters Reading & Writing Part 4: nội dung truyện phải có đúng một marker ${marker}.`);
    }
    if ((unit.examples || []).length !== 1) errors.push('Starters Reading & Writing Part 4: phải có đúng 1 example không chấm điểm.');
  }

  if (partNumber === 5) {
    const scenes = unit.readingScenes || [];
    const expectedCounts = [1, 2, 2];
    if (scenes.length !== 3) errors.push('Starters Reading & Writing Part 5: phải có đúng 3 tranh/cảnh.');
    if ((unit.examples || []).length !== 2) errors.push('Starters Reading & Writing Part 5: cảnh 1 phải có đúng 2 example không chấm điểm.');
    scenes.forEach((scene, sceneIndex) => {
      if (!text(scene.imageAssetId, 180)) errors.push(`Starters Reading & Writing Part 5: phải tải ảnh cho cảnh ${sceneIndex + 1}.`);
      const expectedCount = expectedCounts[sceneIndex];
      if (expectedCount !== undefined && scene.questionIds.length !== expectedCount) {
        errors.push(`Starters Reading & Writing Part 5: cảnh ${sceneIndex + 1} phải có đúng ${expectedCount} câu chấm điểm.`);
      }
    });
    const referencedIds = scenes.flatMap(scene => scene.questionIds);
    const questionIds = unit.questions.map(question => question.id);
    if (referencedIds.length !== 5 || new Set(referencedIds).size !== 5 || questionIds.some(id => !referencedIds.includes(id))) {
      errors.push('Starters Reading & Writing Part 5: ba cảnh phải phủ đúng 5 câu, mỗi câu một lần.');
    }
  }
}

export function validateExamPaperContent(content: ExamPaperContent) {
  const errors: string[] = [];
  if (!content || typeof content !== 'object') return ['Nội dung đề không hợp lệ.'];
  if (![EXAM_LEGACY_CONTENT_SCHEMA_VERSION, EXAM_CONTENT_SCHEMA_VERSION].includes(content.schemaVersion)) errors.push('Schema đề thi không được hỗ trợ.');
  const definition = getExamPaperDefinition(content.moduleId, content.paperId);
  if (!definition) return ['Module hoặc loại bài thi không được hỗ trợ.'];
  if (!text(content.title, 240)) errors.push('Thiếu tên bộ đề.');
  const dynamic = content.schemaVersion === EXAM_CONTENT_SCHEMA_VERSION && content.structureMode === 'dynamic';
  if (!Array.isArray(content.parts) || content.parts.length < 1 || content.parts.length > 20) return [...errors, 'Đề thi phải có từ 1 đến 20 Part/Section.'];
  if (content.moduleId === 'starter' && content.paperId === 'listening' && (content.parts.length !== 4 || content.parts.some((part, index) => part.part !== index + 1 || part.questions.length !== 5))) {
    errors.push('Starters Listening phải có đúng 4 Part theo thứ tự và mỗi Part đúng 5 câu.');
  }
  if (content.moduleId === 'starter' && content.paperId === 'reading-writing' && (content.parts.length !== 5 || content.parts.some((part, index) => part.part !== index + 1 || part.questions.length !== 5))) {
    errors.push('Starters Reading & Writing phải có đúng 5 Part theo thứ tự và mỗi Part đúng 5 câu.');
  }
  if (!dynamic && content.parts?.length !== definition.parts.length) {
    errors.push(`${definition.displayName} phải có đúng ${definition.parts.length} Part/Section.`);
    return errors;
  }

  const allIds = new Set<string>();
  let totalQuestions = 0;
  content.parts.forEach((part, partIndex) => {
    const partDefinition = definition.parts[partIndex]!;
    if (!part || part.part !== partIndex + 1) errors.push(`Part ${partIndex + 1} không đúng thứ tự.`);
    if (!text(part?.title, 240)) errors.push(`Part ${partIndex + 1}: thiếu tiêu đề.`);
    if (content.moduleId === 'starter' && content.paperId === 'listening' && partIndex === 2 && !text(part?.imageAssetId, 180)) {
      errors.push('Part 3: phải tải ảnh hiển thị chung cho học sinh, tách biệt với ảnh nguồn crop đáp án.');
    }
    if (content.moduleId === 'starter' && content.paperId === 'reading-writing') {
      validateStarterReadingWritingPart(part, partIndex, errors);
    }
    if (dynamic) {
      totalQuestions += part?.questions?.length || 0;
      const blocks = part?.blocks || [];
      if (!blocks.length) errors.push(`Part ${partIndex + 1}: schema động phải có ít nhất một block.`);
      const referencedIds = blocks.flatMap(block => block.questionIds || []);
      const canonicalIds = (part?.questions || []).map(question => question.id);
      if (new Set(blocks.map(block => block.id)).size !== blocks.length || blocks.some((block, index) => !block.id || block.block !== index + 1)) errors.push(`Part ${partIndex + 1}: block bị thiếu/trùng ID hoặc sai thứ tự.`);
      if (referencedIds.length !== canonicalIds.length || new Set(referencedIds).size !== canonicalIds.length || canonicalIds.some(id => !referencedIds.includes(id))) errors.push(`Part ${partIndex + 1}: questionIds của blocks phải phủ đúng mỗi câu một lần.`);
      if (content.paperId === 'listening' && !text(part.audioAssetId, 180) && !blocks.some(block => text(block.audioAssetId, 180))) errors.push(`Part ${partIndex + 1}: phải gắn audio ở Part hoặc ít nhất một dạng bài.`);
      examPartUnits(part).forEach((unit, blockIndex) => validateDynamicUnit(unit, partIndex, blockIndex, allIds, errors));
      return;
    }
    if (partDefinition.requiresAudio && !text(part?.audioAssetId, 180)) {
      errors.push(`Part ${partIndex + 1}: phải chọn audio từ thư viện media.`);
    }
    if (!partDefinition.questionCountFlexible && part?.questions?.length !== partDefinition.questionCount) {
      errors.push(`Part ${partIndex + 1}: phải có đúng ${partDefinition.questionCount} câu.`);
    }
    totalQuestions += part?.questions?.length || 0;

    if (content.moduleId === 'starter' && content.paperId === 'listening') {
      if (part?.interactionLayout?.kind === 'starter-image-matching-v1') {
        if (!text(part.imageAssetId, 180)) errors.push(`Part ${partIndex + 1}: phải chọn ảnh scene để nối hình.`);
        const leftItems = part.interactionLayout.leftItems || [];
        const rightItems = part.interactionLayout.rightItems || [];
        const items = [...leftItems, ...rightItems];
        if (leftItems.length !== partDefinition.questionCount + 2 || rightItems.length !== partDefinition.questionCount + 2) errors.push(`Part ${partIndex + 1}: cần đúng 7 hình mỗi nhóm cho 5 câu, example và distractor.`);
        const scoredQuestionIds = leftItems.map(item => item.questionId).filter(Boolean);
        if (scoredQuestionIds.length !== partDefinition.questionCount || new Set(scoredQuestionIds).size !== partDefinition.questionCount) errors.push(`Part ${partIndex + 1}: năm hình được chấm chưa ánh xạ đúng năm câu.`);
        const example = part.interactionLayout.exampleMapping;
        if (!example || !leftItems.some(item => item.id === example.leftItemId && !item.questionId) || !rightItems.some(item => item.id === example.rightItemId)) errors.push(`Part ${partIndex + 1}: example matching không hợp lệ.`);
        const officialRightIds = (part.questions || []).flatMap(question => question.correctOptionIds || []);
        if (officialRightIds.length !== partDefinition.questionCount || new Set(officialRightIds).size !== partDefinition.questionCount || (example && officialRightIds.includes(example.rightItemId))) {
          errors.push(`Part ${partIndex + 1}: năm đáp án matching phải là ánh xạ một-một, không dùng lại hình example.`);
        }
        if (items.some(item => item.geometryConfirmedByTeacher !== true || !validInteractionRegion(item.region))) {
          errors.push(`Part ${partIndex + 1}: giáo viên chưa xác nhận đầy đủ vùng/điểm neo matching trên ảnh.`);
        }
      }
      if (part?.interactionLayout?.kind === 'starter-image-matching-v2') {
        if (!text(part.imageAssetId, 180)) errors.push(`Part ${partIndex + 1}: phải chọn ảnh scene để nối hình.`);
        const sourceNodes = part.interactionLayout.sourceNodes || [];
        const targetNodes = part.interactionLayout.targetNodes || [];
        const nodes = [...sourceNodes, ...targetNodes];
        const sourceIds = new Set(sourceNodes.map(node => node.id));
        const targetIds = new Set(targetNodes.map(node => node.id));
        const sourceLabels = new Set(sourceNodes.map(node => normalizeExamText(node.label)));
        const targetLabels = new Set(targetNodes.map(node => normalizeExamText(node.label)));
        if (sourceNodes.length !== partDefinition.questionCount + 2 || targetNodes.length !== partDefinition.questionCount + 2) errors.push(`Part ${partIndex + 1}: cần đúng 7 node mỗi nhóm cho 5 câu, example và distractor.`);
        if (sourceIds.size !== sourceNodes.length || targetIds.size !== targetNodes.length || new Set(nodes.map(node => node.id)).size !== nodes.length || sourceLabels.size !== sourceNodes.length || targetLabels.size !== targetNodes.length || nodes.some(node => !text(node.id, 180) || !text(node.label, 240))) errors.push(`Part ${partIndex + 1}: node matching bị thiếu hoặc trùng ID/label.`);
        const scoredSourceIds = (part.questions || []).map(question => question.interactionSourceNodeId).filter(Boolean) as string[];
        if (scoredSourceIds.length !== partDefinition.questionCount || new Set(scoredSourceIds).size !== partDefinition.questionCount || scoredSourceIds.some(id => !sourceIds.has(id))) errors.push(`Part ${partIndex + 1}: năm node nguồn được chấm chưa ánh xạ đúng năm câu.`);
        const example = part.interactionLayout.exampleConnection;
        if (!example || !sourceIds.has(example.sourceNodeId) || !targetIds.has(example.targetNodeId) || scoredSourceIds.includes(example.sourceNodeId)) errors.push(`Part ${partIndex + 1}: example matching không hợp lệ.`);
        const officialTargetIds = (part.questions || []).flatMap(question => question.correctOptionIds || []);
        if (officialTargetIds.length !== partDefinition.questionCount || new Set(officialTargetIds).size !== partDefinition.questionCount || officialTargetIds.some(id => !targetIds.has(id)) || (example && officialTargetIds.includes(example.targetNodeId))) {
          errors.push(`Part ${partIndex + 1}: năm đáp án matching phải là ánh xạ một-một, không dùng lại node example.`);
        }
        if (part.interactionLayout.maxConnections !== partDefinition.questionCount) errors.push(`Part ${partIndex + 1}: số đường nối tối đa phải là ${partDefinition.questionCount}.`);
        if (nodes.some(node => node.geometryConfirmedByTeacher !== true || !validInteractionRegion(node.hitRegion) || !validMatchingAnchor(node.anchor, node.hitRegion))) {
          errors.push(`Part ${partIndex + 1}: giáo viên chưa xác nhận đầy đủ hitbox/điểm neo matching trên ảnh.`);
        }
      }
      if (part?.interaction?.variant === 'image-options') {
        if ((part.questions || []).some(question => question.options.length !== 3)) errors.push(`Part ${partIndex + 1}: mỗi câu chọn hình phải có đúng ba lựa chọn A/B/C.`);
        const missingImages = (part.questions || []).some(question => question.options.some(option => !text(option.imageAssetId, 180)));
        if (missingImages) errors.push(`Part ${partIndex + 1}: phải gắn hoặc crop ảnh cho mọi lựa chọn A/B/C.`);
      }
      if (part?.interactionLayout?.kind === 'starter-scene-colour-v1') {
        if (!text(part.imageAssetId, 180)) errors.push(`Part ${partIndex + 1}: phải chọn ảnh scene để tô màu.`);
        if (part.interactionLayout.targets.length !== partDefinition.questionCount) errors.push(`Part ${partIndex + 1}: thiếu đối tượng tô màu.`);
        if (part.interactionLayout.targets.some(target => target.geometryConfirmedByTeacher !== true || !validInteractionRegion(target.region))) {
          errors.push(`Part ${partIndex + 1}: giáo viên chưa khoanh và xác nhận đầy đủ mask tô màu.`);
        }
      }
    }

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

  if (!dynamic && definition.flexiblePartDistribution && totalQuestions !== definition.totalQuestionCount) {
    errors.push(`${definition.displayName} phải có đúng ${definition.totalQuestionCount} câu trên toàn bài.`);
  }
  return errors;
}

export function sanitizeExamContentForStudent(content: ExamPaperContent): ExamPaperContent {
  return {
    ...structuredClone(content),
    parts: content.parts.map(part => {
      const studentColourPalette = starterStudentColourPalette(part);
      const matchingQuestionIds = new Set([
        ...((part.interactionLayout?.kind === 'starter-image-matching-v1' || part.interactionLayout?.kind === 'starter-image-matching-v2') ? part.questions.map(question => question.id) : []),
        ...(part.blocks || []).flatMap(block => block.interactionLayout?.kind === 'starter-image-matching-v1' || block.interactionLayout?.kind === 'starter-image-matching-v2' ? block.questionIds : []),
      ]);
      const safePart: any = {
        ...structuredClone(part),
        questions: part.questions.map((question, questionIndex) => {
        const safe: any = structuredClone(question);
        delete safe.correctOptionIds;
        delete safe.acceptedAnswers;
        delete safe.modelAnswer;
        delete safe.interactionSourceNodeId;
        if (matchingQuestionIds.has(question.id)) safe.prompt = `Đường nối ${questionIndex + 1}`;
        if (question.type !== 'long-writing') delete safe.rubric;
        return safe;
      }),
      };
      // The transcript is review-only content. Never expose it in the playable
      // payload, even when the paper allows answers to be reviewed later.
      delete safePart.audioTranscript;
      if (safePart.interactionLayout?.kind === 'starter-image-matching-v1') {
        safePart.interactionLayout.leftItems = safePart.interactionLayout.leftItems.map((item: Record<string, unknown>) => {
          const safeItem = { ...item };
          delete safeItem.questionId;
          return safeItem;
        });
      }
      if (safePart.interactionLayout?.kind === 'starter-scene-colour-v1') {
        safePart.interactionLayout.studentPalette = studentColourPalette;
      }
      if (safePart.interactionLayout?.kind === 'scene-draw-v1') {
        safePart.interactionLayout.targets = safePart.interactionLayout.targets.map((target: Record<string, unknown>) => {
          const safeTarget = { ...target };
          delete safeTarget.targetRegion;
          delete safeTarget.geometryConfirmedByTeacher;
          return safeTarget;
        });
      }
      if (Array.isArray(safePart.blocks)) {
        safePart.blocks = safePart.blocks.map((block: Record<string, any>) => {
          const safeBlock = { ...block };
          delete safeBlock.geometryHints;
          if (content.moduleId === 'starter' && content.paperId === 'listening' && part.part === 3 && safeBlock.interaction?.variant === 'image-options') {
            delete safeBlock.imageAssetId;
            delete safeBlock.imageUrl;
          }
          if (safeBlock.interactionLayout?.kind === 'starter-image-matching-v1') {
            safeBlock.interactionLayout = {
              ...safeBlock.interactionLayout,
              leftItems: safeBlock.interactionLayout.leftItems.map((item: Record<string, unknown>) => {
                const safeItem = { ...item };
                delete safeItem.questionId;
                return safeItem;
              }),
            };
          }
          if (safeBlock.interactionLayout?.kind === 'starter-scene-colour-v1') {
            safeBlock.interactionLayout = {
              ...safeBlock.interactionLayout,
              studentPalette: studentColourPalette,
            };
          }
          if (safeBlock.interactionLayout?.kind === 'scene-draw-v1') {
            safeBlock.interactionLayout = {
              ...safeBlock.interactionLayout,
              targets: safeBlock.interactionLayout.targets.map((target: Record<string, unknown>) => {
                const safeTarget = { ...target };
                delete safeTarget.targetRegion;
                delete safeTarget.geometryConfirmedByTeacher;
                return safeTarget;
              }),
            };
          }
          return safeBlock;
        });
      }
      return safePart;
    }),
  } as ExamPaperContent;
}

export function sanitizeExamAnswers(raw: unknown, content: ExamPaperContent): ExamAnswers {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const v2MatchingQuestionIds = new Set(content.parts.flatMap(part => examPartUnits(part).flatMap(unit => unit.interactionLayout?.kind === 'starter-image-matching-v2' ? unit.questions.map(question => question.id) : [])));
  const drawTargets = new Map(content.parts.flatMap(part => examPartUnits(part).flatMap(unit => unit.interactionLayout?.kind === 'scene-draw-v1'
    ? unit.interactionLayout.targets.map(target => [target.questionId, target] as const)
    : [])));
  const allowed = new Map(content.parts.flatMap(part => part.questions.map(question => [question.id, question])));
  const answers: ExamAnswers = {};
  for (const [questionId, question] of allowed) {
    if (v2MatchingQuestionIds.has(questionId) || drawTargets.has(questionId)) continue;
    const value = input[questionId];
    if (Array.isArray(value)) {
      answers[questionId] = [...new Set(value.filter(item => typeof item === 'string' || typeof item === 'number').map(item => text(item, 500)).filter(Boolean))].slice(0, 20);
    } else {
      answers[questionId] = text(value, question.type === 'long-writing' ? 20_000 : 4_000);
    }
  }
  for (const part of content.parts) {
    for (const unit of examPartUnits(part)) {
      const rawLayout = unit.interactionLayout;
      if (!rawLayout || (rawLayout.kind !== 'starter-image-matching-v1' && rawLayout.kind !== 'starter-image-matching-v2')) continue;
      const layout = starterMatchingModel(rawLayout);
      const responseKey = starterMatchingResponseKey(unit.id);
      const sourceIds = new Set(layout.sourceNodes.map(node => node.id));
      const targetIds = new Set(layout.targetNodes.map(node => node.id));
      const usedSources = new Set<string>();
      const usedTargets = new Set<string>();
      const connections = (Array.isArray(input[responseKey]) ? input[responseKey] : []).flatMap(value => {
        if (!isExamMatchingConnection(value)) return [];
        const sourceNodeId = text(value.sourceNodeId, 180);
        const targetNodeId = text(value.targetNodeId, 180);
        if (!sourceIds.has(sourceNodeId) || !targetIds.has(targetNodeId)
          || sourceNodeId === layout.exampleConnection?.sourceNodeId
          || targetNodeId === layout.exampleConnection?.targetNodeId
          || usedSources.has(sourceNodeId) || usedTargets.has(targetNodeId)) return [];
        usedSources.add(sourceNodeId);
        usedTargets.add(targetNodeId);
        return [{ sourceNodeId, targetNodeId }];
      }).slice(0, layout.maxConnections);
      answers[responseKey] = connections;
    }
  }
  for (const [questionId, target] of drawTargets) {
    const value = record(input[questionId]);
    const actionId = text(value.actionId, 180);
    const object = text(value.object, 120);
    const x = Number(value.x);
    const y = Number(value.y);
    if (actionId !== target.id
      || normalizeExamText(object) !== normalizeExamText(target.object)
      || !Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || x > 1 || y < 0 || y > 1) continue;
    answers[questionId] = { actionId: target.id, object: target.object, x, y };
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
