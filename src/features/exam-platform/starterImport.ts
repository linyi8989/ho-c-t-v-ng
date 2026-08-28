import type {
  ExamInteractionDescriptor,
  ExamInteractionRegion,
  ExamPaperContent,
  ExamPaperDefinition,
  ExamPartContent,
  ExamPartDefinition,
  ExamQuestion,
  ExamQuestionType,
  StarterImageMatchingNode,
} from './types';
import {
  STARTER_MATCHING_HITBOX_HEIGHT,
  STARTER_MATCHING_HITBOX_WIDTH,
  STARTER_MATCHING_MAX_CONNECTIONS,
  starterMatchingAnchor,
  starterMatchingModel,
} from './starterMatching';

type JsonRecord = Record<string, unknown>;

export interface StarterImportPartReport {
  part: number;
  status: 'imported' | 'warning' | 'error' | 'missing';
  questionCount: number;
  warnings: string[];
  errors: string[];
}

export interface StarterImportResult {
  content: ExamPaperContent;
  appliedParts: number[];
  reports: StarterImportPartReport[];
  warnings: string[];
}

export class StarterImportError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'StarterImportError';
    this.details = details;
  }
}

const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stringValue = (value: unknown, max = 20_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const normalized = (value: unknown) => stringValue(value, 1_000).normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en');
const identifier = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const stripFence = (source: string) => {
  const trimmed = source.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

const forbiddenTechnicalKey = (key: string) => key === 'id'
  || /^(question|option|asset|target|choice|blank|database|technical)Id$/i.test(key)
  || /^(source|target)NodeId$/i.test(key)
  || key === 'interactionSourceNodeId'
  || key === 'responseKey'
  || /(Url|Uuid)$/i.test(key)
  || /base64|dataUri|filePath/i.test(key);

function findForbiddenTechnicalKey(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findForbiddenTechnicalKey(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenTechnicalKey(key)) return key;
    const found = findForbiddenTechnicalKey(child);
    if (found) return found;
  }
  return undefined;
}

export function parseStarterImportJson(source: string): JsonRecord {
  const json = stripFence(source);
  if (!json) throw new StarterImportError('Chưa nhập JSON Starters.');
  if (json.length > 500_000) throw new StarterImportError('JSON Starters vượt quá giới hạn 500.000 ký tự.');
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new StarterImportError('JSON Starters không đúng cú pháp.'); }
  if (!isRecord(parsed)) throw new StarterImportError('Giá trị gốc phải là một JSON object.');
  const forbidden = findForbiddenTechnicalKey(parsed);
  if (forbidden) throw new StarterImportError(`JSON không được chứa trường kỹ thuật "${forbidden}".`);
  return parsed;
}

function defaultRegion(index: number, total: number, side: 'left' | 'right' | 'center' = 'center'): ExamInteractionRegion {
  const rows = Math.max(1, total);
  const y = Math.min(.88, .05 + index * (.86 / rows));
  return {
    shape: 'rect',
    x: side === 'left' ? .04 : side === 'right' ? .78 : .39,
    y,
    width: side === 'center' ? .2 : .18,
    height: Math.min(.1, .7 / rows),
  };
}

function descriptor(
  raw: JsonRecord,
  fallback: Pick<ExamInteractionDescriptor, 'family' | 'subtype' | 'variant'>,
  readiness: ExamInteractionDescriptor['importReadiness'],
  warnings: string[],
): ExamInteractionDescriptor {
  const interaction = isRecord(raw.interaction) ? raw.interaction : {};
  const family = stringValue(interaction.family, 40);
  return {
    family: ['choice', 'matching', 'text-entry', 'scene', 'writing'].includes(family)
      ? family as ExamInteractionDescriptor['family']
      : fallback.family,
    subtype: stringValue(interaction.subtype, 80) || fallback.subtype,
    variant: stringValue(interaction.variant, 80) || fallback.variant,
    schemaVersion: Number(interaction.schemaVersion) === 1 ? 1 : 1,
    importReadiness: readiness,
    ...(warnings.length ? { warnings: [...new Set(warnings)] } : {}),
  };
}

function sectionWarnings(section: JsonRecord) {
  const validation = isRecord(section.validation) ? section.validation : {};
  return arrayValue(validation.warnings).map(value => stringValue(value, 1_000)).filter(Boolean);
}

function currentOptionId(question: ExamQuestion | undefined, label: string, index: number) {
  return question?.options.find(option => normalized(option.label) === normalized(label))?.id
    || question?.options[index]?.id
    || identifier('option');
}

function hasDuplicateValues(values: string[]) {
  const keys = values.map(value => normalized(value)).filter(Boolean);
  return new Set(keys).size !== keys.length;
}

function officialSource(value: unknown) {
  return value === 'official-answer-key' || value === 'teacher-supplied';
}

function requireQuestionCount(questions: unknown[], definition: ExamPartDefinition) {
  if (!definition.questionCountFlexible && questions.length !== definition.questionCount) {
    throw new StarterImportError(`${definition.displayName} phải có đúng ${definition.questionCount} câu; JSON có ${questions.length}.`);
  }
  if (definition.questionCountFlexible && questions.length > 40) {
    throw new StarterImportError(`${definition.displayName} không được vượt quá 40 câu.`);
  }
}

function basePart(current: ExamPartContent, section: JsonRecord, questions: ExamQuestion[]): ExamPartContent {
  return {
    ...current,
    title: stringValue(section.title, 240) || current.title,
    instruction: stringValue(section.instruction, 4_000) || current.instruction,
    ...(stringValue(section.passage, 20_000) ? { passage: stringValue(section.passage, 20_000) } : {}),
    questions,
  };
}

function importStarterListeningPart1(
  current: ExamPartContent,
  section: JsonRecord,
  definition: ExamPartDefinition,
): { part: ExamPartContent; warnings: string[] } {
  const payload = isRecord(section.payload) ? section.payload : {};
  const nodeRows = (value: unknown) => arrayValue(value).map(item => typeof item === 'string' ? { label: item } : item).filter(isRecord);
  const connectionRows = (value: unknown): JsonRecord[] => arrayValue(value).map((item): JsonRecord | undefined => {
    if (Array.isArray(item)) return { sourceLabel: item[0], targetLabel: item[1] };
    if (!isRecord(item)) return undefined;
    return {
      ...item,
      sourceLabel: item.sourceLabel ?? item.leftLabel,
      targetLabel: item.targetLabel ?? item.rightLabel,
    };
  }).filter(isRecord);
  const exampleRow = (value: unknown): JsonRecord | undefined => {
    if (Array.isArray(value)) return { sourceLabel: value[0], targetLabel: value[1] };
    if (!isRecord(value)) return undefined;
    return {
      ...value,
      sourceLabel: value.sourceLabel ?? value.leftLabel,
      targetLabel: value.targetLabel ?? value.rightLabel,
    };
  };
  const rawSources = nodeRows(Array.isArray(payload.sourceNodes) ? payload.sourceNodes : payload.leftItems);
  const rawTargets = nodeRows(Array.isArray(payload.targetNodes) ? payload.targetNodes : payload.rightItems);
  const mappings = connectionRows(
    Array.isArray(payload.correctConnections) ? payload.correctConnections
      : Array.isArray(payload.connections) ? payload.connections
        : payload.mappings,
  );
  const rawExample = exampleRow(payload.exampleConnection)
    || exampleRow(arrayValue(payload.exampleMappings)[0]);
  requireQuestionCount(mappings, definition);
  if (rawSources.length !== mappings.length + 2 || rawTargets.length !== mappings.length + 2) {
    throw new StarterImportError('Part 1 cần đúng 7 node ở mỗi nhóm: 5 câu, 1 example và 1 lựa chọn nhiễu.');
  }
  const sourceLabels = rawSources.map(item => stringValue(item.label, 240));
  const targetLabels = rawTargets.map(item => stringValue(item.label, 240));
  if (sourceLabels.some(label => !label) || targetLabels.some(label => !label)) throw new StarterImportError('Part 1: mọi node phải có label.');
  if (hasDuplicateValues(sourceLabels) || hasDuplicateValues(targetLabels)) throw new StarterImportError('Part 1: label node trong mỗi nhóm không được trùng nhau.');
  const mappingSourceLabels = mappings.map(mapping => stringValue(mapping.sourceLabel, 240));
  const mappingTargetLabels = mappings.map(mapping => stringValue(mapping.targetLabel, 240));
  if (hasDuplicateValues(mappingSourceLabels) || hasDuplicateValues(mappingTargetLabels)) throw new StarterImportError('Part 1: năm đường nối phải là ánh xạ một-một, không lặp node.');
  if (mappingSourceLabels.some(label => !sourceLabels.some(item => normalized(item) === normalized(label)))) throw new StarterImportError('Part 1: connection chứa node nguồn không có trong sourceNodes.');
  if (mappingTargetLabels.some(label => !targetLabels.some(item => normalized(item) === normalized(label)))) throw new StarterImportError('Part 1: connection chứa node đích không có trong targetNodes.');
  if (!rawExample) throw new StarterImportError('Part 1 cần đúng một example connection không chấm điểm.');
  const exampleSourceLabel = stringValue(rawExample.sourceLabel, 240);
  const exampleTargetLabel = stringValue(rawExample.targetLabel, 240);
  if (!sourceLabels.some(label => normalized(label) === normalized(exampleSourceLabel)) || !targetLabels.some(label => normalized(label) === normalized(exampleTargetLabel))) {
    throw new StarterImportError('Part 1: example connection phải tham chiếu đúng node trong hai nhóm.');
  }
  if (mappingSourceLabels.some(label => normalized(label) === normalized(exampleSourceLabel)) || mappingTargetLabels.some(label => normalized(label) === normalized(exampleTargetLabel))) {
    throw new StarterImportError('Part 1: node example không được lặp trong năm câu chấm điểm.');
  }

  const previous = current.interactionLayout && (current.interactionLayout.kind === 'starter-image-matching-v1' || current.interactionLayout.kind === 'starter-image-matching-v2')
    ? starterMatchingModel(current.interactionLayout)
    : undefined;
  const defaultNodeRegion = (index: number, group: 'source' | 'target'): ExamInteractionRegion => ({
    shape: 'rect',
    x: .04 + index * .14,
    y: group === 'source' ? .08 : .86,
    width: STARTER_MATCHING_HITBOX_WIDTH,
    height: STARTER_MATCHING_HITBOX_HEIGHT,
  });
  const createNodes = (
    rows: JsonRecord[],
    existingNodes: StarterImageMatchingNode[] | undefined,
    group: 'source' | 'target',
  ): StarterImageMatchingNode[] => rows.map((item, index) => {
    const label = stringValue(item.label, 240);
    const matched = existingNodes?.find(entry => normalized(entry.label) === normalized(label));
    const existing = matched || existingNodes?.[index];
    const hitRegion = existing?.hitRegion || defaultNodeRegion(index, group);
    return {
      id: existing?.id || identifier(group === 'source' ? 'starter-p1-source' : 'starter-p1-target'),
      label,
      hitRegion,
      anchor: existing?.anchor || starterMatchingAnchor(hitRegion),
      geometryConfirmedByTeacher: matched?.geometryConfirmedByTeacher || false,
    };
  });
  const targetNodes = createNodes(rawTargets, previous?.targetNodes, 'target');
  const sourceNodes = createNodes(rawSources, previous?.sourceNodes, 'source');
  const targetByLabel = new Map(targetNodes.map(item => [normalized(item.label), item]));
  const sourceByLabel = new Map(sourceNodes.map(item => [normalized(item.label), item]));
  const questions: ExamQuestion[] = mappings.map((mapping, index) => {
    const sourceLabel = stringValue(mapping.sourceLabel, 240);
    const targetLabel = stringValue(mapping.targetLabel, 240);
    if (!sourceLabel || !targetLabel) throw new StarterImportError(`Part 1, connection ${index + 1}: thiếu nhãn hai node.`);
    const sourceNode = sourceByLabel.get(normalized(sourceLabel));
    const targetNode = targetByLabel.get(normalized(targetLabel));
    if (!sourceNode || !targetNode) throw new StarterImportError(`Part 1, connection ${index + 1}: không tìm thấy node nguồn hoặc đích.`);
    const old = current.questions[index];
    const options = targetNodes.map(item => ({ id: item.id, label: item.label, text: item.label }));
    return {
      id: old?.id || identifier('starter-p1-question'),
      number: Number(mapping.questionNumber) || old?.number || index + 1,
      type: 'matching',
      prompt: sourceLabel,
      options,
      correctOptionIds: officialSource(mapping.source) ? [targetNode.id] : [],
      acceptedAnswers: [],
      interactionSourceNodeId: sourceNode.id,
      points: old?.points || definition.pointsPerQuestion || 1,
    };
  });

  const exampleSource = sourceByLabel.get(normalized(exampleSourceLabel));
  const exampleTarget = targetByLabel.get(normalized(exampleTargetLabel));
  const warnings = sectionWarnings(section);
  mappings.forEach((mapping, index) => { if (!officialSource(mapping.source)) warnings.push(`Câu ${index + 1}: chưa có đáp án chính thức.`); });
  if (!current.imageAssetId) warnings.push('Part 1 cần gắn ảnh scene.');
  if (!current.audioAssetId) warnings.push('Part 1 cần gắn MP3.');
  warnings.push('Giáo viên phải đặt và xác nhận hitbox/điểm neo cho 14 node trước khi xuất bản.');
  const next = basePart(current, section, questions);
  next.interaction = {
    ...descriptor(section, { family: 'matching', subtype: 'image-image', variant: 'draw-line' }, current.imageAssetId && current.audioAssetId ? 'needs-geometry' : 'needs-assets', warnings),
    schemaVersion: 2,
  };
  next.interactionLayout = {
    kind: 'starter-image-matching-v2',
    sourceNodes,
    targetNodes,
    ...(exampleSource && exampleTarget ? { exampleConnection: { sourceNodeId: exampleSource.id, targetNodeId: exampleTarget.id } } : {}),
    maxConnections: STARTER_MATCHING_MAX_CONNECTIONS,
  };
  return { part: next, warnings };
}

function importTextEntry(
  current: ExamPartContent,
  section: JsonRecord,
  definition: ExamPartDefinition,
): { part: ExamPartContent; warnings: string[] } {
  const payload = isRecord(section.payload) ? section.payload : {};
  const rows = arrayValue(payload.questions).filter(isRecord);
  requireQuestionCount(rows, definition);
  const warnings = sectionWarnings(section);
  const questions = rows.map((row, index): ExamQuestion => {
    const gaps = arrayValue(row.gaps).filter(isRecord);
    if (definition.requiresAudio && current.part === 2 && gaps.length !== 1) {
      throw new StarterImportError(`Câu ${index + 1}: Starter Listening Part 2 cần đúng một ô trả lời.`);
    }
    const acceptedAnswers = gaps.flatMap(gap => officialSource(gap.source)
      ? arrayValue(gap.acceptedAnswers).map(answer => stringValue(answer, 4_000)).filter(Boolean)
      : []);
    if (!acceptedAnswers.length) warnings.push(`Câu ${index + 1}: chưa có đáp án chính thức.`);
    const old = current.questions[index];
    return {
      id: old?.id || identifier('starter-text-question'),
      number: Number(row.number) || old?.number || index + 1,
      type: 'short-answer',
      prompt: stringValue(row.template, 8_000) || stringValue(row.prompt, 8_000) || `Câu ${index + 1}`,
      options: [],
      correctOptionIds: [],
      acceptedAnswers,
      points: old?.points || definition.pointsPerQuestion || 1,
      ...(Number(gaps[0]?.maxWords) > 0 ? { maxWords: Number(gaps[0]?.maxWords) } : {}),
    };
  });
  const next = basePart(current, section, questions);
  const needsAudio = definition.requiresAudio && !current.audioAssetId;
  next.interaction = descriptor(section, { family: 'text-entry', subtype: 'short-answer', variant: 'single-input' }, needsAudio ? 'needs-assets' : 'content-ready', warnings);
  delete next.interactionLayout;
  return { part: next, warnings };
}

function importChoice(
  current: ExamPartContent,
  section: JsonRecord,
  definition: ExamPartDefinition,
): { part: ExamPartContent; warnings: string[] } {
  const payload = isRecord(section.payload) ? section.payload : {};
  const rows = arrayValue(payload.questions).filter(isRecord);
  requireQuestionCount(rows, definition);
  const interaction = isRecord(section.interaction) ? section.interaction : {};
  const subtype = stringValue(interaction.subtype, 80);
  const variant = stringValue(interaction.variant, 80) || 'text-options';
  const warnings = sectionWarnings(section);
  const questions = rows.map((row, index): ExamQuestion => {
    const old = current.questions[index];
    const prompt = stringValue(row.prompt, 8_000) || `Câu ${index + 1}`;
    const rawOptions = arrayValue(row.options).map(value => typeof value === 'string' ? { label: value, text: value } : value).filter(isRecord);
    if (variant === 'image-options' && rawOptions.length !== 3) throw new StarterImportError(`Câu ${index + 1}: Part chọn hình cần đúng ba lựa chọn A/B/C.`);
    const options = rawOptions.map((option, optionIndex) => {
      const label = stringValue(option.label, 8) || String.fromCharCode(65 + optionIndex);
      const text = stringValue(option.text, 4_000);
      const oldOption = old?.options[optionIndex];
      const keepsExistingImage = normalized(old?.prompt) === normalized(prompt) && normalized(oldOption?.text) === normalized(text);
      return {
        id: currentOptionId(old, label, optionIndex),
        label,
        text,
        ...(keepsExistingImage && oldOption?.imageAssetId ? { imageAssetId: oldOption.imageAssetId } : {}),
        ...(keepsExistingImage && oldOption?.imageUrl ? { imageUrl: oldOption.imageUrl } : {}),
      };
    });
    if (options.length < 2) throw new StarterImportError(`Câu ${index + 1}: cần ít nhất hai lựa chọn.`);
    const answer = isRecord(row.answer) ? row.answer : {};
    const correctLabels = officialSource(answer.source) ? arrayValue(answer.value).map(normalized) : [];
    const correctOptionIds = options.filter(option => correctLabels.includes(normalized(option.label)) || correctLabels.includes(normalized(option.text))).map(option => option.id);
    if (!correctOptionIds.length) warnings.push(`Câu ${index + 1}: chưa có đáp án chính thức.`);
    const type: ExamQuestionType = subtype === 'multiple' ? 'multiple-choice'
      : subtype === 'boolean' ? 'true-false'
        : 'single-choice';
    return {
      id: old?.id || identifier('starter-choice-question'),
      number: Number(row.number) || old?.number || index + 1,
      type,
      prompt,
      ...(stringValue(row.context, 8_000) ? { context: stringValue(row.context, 8_000) } : {}),
      options,
      correctOptionIds,
      acceptedAnswers: [],
      points: old?.points || definition.pointsPerQuestion || 1,
    };
  });
  const next = basePart(current, section, questions);
  const imageOptionsIncomplete = variant === 'image-options' && questions.some(question => question.options.some(option => !option.imageAssetId));
  const needsAudio = definition.requiresAudio && !current.audioAssetId;
  if (imageOptionsIncomplete) warnings.push('Cần gắn hoặc crop ảnh cho từng lựa chọn A/B/C.');
  next.interaction = descriptor(section, { family: 'choice', subtype: subtype || 'single', variant }, needsAudio || imageOptionsIncomplete ? 'needs-assets' : 'content-ready', warnings);
  delete next.interactionLayout;
  return { part: next, warnings };
}

const colourHex: Record<string, string> = {
  black: '#111827', blue: '#2563eb', brown: '#92400e', green: '#16a34a', grey: '#6b7280', gray: '#6b7280',
  orange: '#f97316', pink: '#ec4899', purple: '#9333ea', red: '#dc2626', white: '#ffffff', yellow: '#eab308',
};

export const STARTER_BASIC_COLOURS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white',
] as const;

function importStarterListeningPart4(
  current: ExamPartContent,
  section: JsonRecord,
  definition: ExamPartDefinition,
): { part: ExamPartContent; warnings: string[] } {
  const payload = isRecord(section.payload) ? section.payload : {};
  const rows = arrayValue(payload.questions).filter(isRecord);
  requireQuestionCount(rows, definition);
  const warnings = sectionWarnings(section);
  const previous = current.interactionLayout?.kind === 'starter-scene-colour-v1' ? current.interactionLayout : undefined;
  const rawColours = arrayValue(payload.choices).filter(isRecord).map(item => stringValue(item.label, 80)).filter(Boolean);
  const actionColours = rows.flatMap(row => arrayValue(row.actions).filter(isRecord).map(action => stringValue(action.colour, 80)).filter(Boolean));
  const colours = [...new Set([...rawColours, ...actionColours].map(value => normalized(value)).filter(Boolean))];
  if (colours.length < 2 || colours.length > 20) throw new StarterImportError('Part 4 cần từ 2 đến 20 màu hợp lệ trong choices/actions.');
  const palette = colours.map((label, index) => ({
    id: current.questions[0]?.options.find(option => normalized(option.text) === label)?.id || identifier('starter-colour'),
    label: String.fromCharCode(65 + index),
    text: label,
  }));
  const questions = rows.map((row, index): ExamQuestion => {
    const actions = arrayValue(row.actions).filter(isRecord);
    if (actions.length !== 1) throw new StarterImportError(`Câu ${index + 1}: Starter Listening Part 4 cần đúng một hành động tô màu.`);
    const action = actions[0];
    const colour = normalized(action.colour);
    const target = stringValue(action.targetLabel, 500);
    const old = current.questions[index];
    const options = palette.map(option => ({ ...option }));
    const correct = options.find(option => normalized(option.text) === colour);
    if (!correct || !officialSource(action.source)) warnings.push(`Câu ${index + 1}: chưa có đáp án màu chính thức.`);
    return {
      id: old?.id || identifier('starter-colour-question'),
      number: Number(row.number) || old?.number || index + 1,
      type: 'single-choice',
      prompt: stringValue(row.prompt, 8_000) || target || `Đối tượng ${index + 1}`,
      options,
      correctOptionIds: correct && officialSource(action.source) ? [correct.id] : [],
      acceptedAnswers: [],
      points: old?.points || definition.pointsPerQuestion || 1,
    };
  });
  const targets = questions.map((question, index) => {
    const action = arrayValue(rows[index].actions).filter(isRecord)[0] || {};
    const label = stringValue(action.targetLabel, 500) || question.prompt;
    const matched = previous?.targets.find(target => normalized(target.label) === normalized(label));
    const existing = matched || previous?.targets[index];
    return {
      id: existing?.id || identifier('starter-colour-target'),
      questionId: question.id,
      label,
      region: existing?.region || defaultRegion(index, questions.length),
      geometryConfirmedByTeacher: matched?.geometryConfirmedByTeacher || false,
    };
  });
  if (!current.imageAssetId) warnings.push('Part 4 cần gắn ảnh scene.');
  if (!current.audioAssetId) warnings.push('Part 4 cần gắn MP3.');
  warnings.push('Giáo viên phải khoanh và xác nhận mask của năm đối tượng trước khi xuất bản.');
  const next = basePart(current, section, questions);
  next.interaction = descriptor(section, { family: 'scene', subtype: 'colour-object', variant: 'paint' }, current.imageAssetId && current.audioAssetId ? 'needs-geometry' : 'needs-assets', warnings);
  next.interactionLayout = { kind: 'starter-scene-colour-v1', targets };
  return { part: next, warnings };
}

function importGenericMatching(
  current: ExamPartContent,
  section: JsonRecord,
  definition: ExamPartDefinition,
): { part: ExamPartContent; warnings: string[] } {
  const payload = isRecord(section.payload) ? section.payload : {};
  const mappings = arrayValue(payload.mappings).filter(isRecord);
  const right = arrayValue(payload.rightItems).filter(isRecord);
  requireQuestionCount(mappings, definition);
  const warnings = sectionWarnings(section);
  const rightLabels = right.map(item => stringValue(item.label, 240));
  if (rightLabels.length < 2 || rightLabels.some(label => !label)) throw new StarterImportError(`Part ${current.part}: matching cần ít nhất hai rightItems có label.`);
  if (hasDuplicateValues(rightLabels)) throw new StarterImportError(`Part ${current.part}: rightItems không được trùng label.`);
  const leftLabels = mappings.map(mapping => stringValue(mapping.leftLabel, 8_000));
  const answerLabels = mappings.map(mapping => stringValue(mapping.rightLabel, 240));
  if (leftLabels.some(label => !label) || hasDuplicateValues(leftLabels)) throw new StarterImportError(`Part ${current.part}: mỗi mapping phải có leftLabel riêng.`);
  if (hasDuplicateValues(answerLabels)) throw new StarterImportError(`Part ${current.part}: các đáp án matching phải là ánh xạ một-một.`);
  const questions = mappings.map((mapping, index): ExamQuestion => {
    const old = current.questions[index];
    const options = right.map((item, optionIndex) => {
      const label = stringValue(item.label, 240) || String.fromCharCode(65 + optionIndex);
      return { id: currentOptionId(old, label, optionIndex), label: String.fromCharCode(65 + optionIndex), text: label };
    });
    const answer = normalized(mapping.rightLabel);
    const answerExists = options.some(option => normalized(option.text) === answer);
    if (!answerExists) throw new StarterImportError(`Câu ${index + 1}: rightLabel không có trong rightItems.`);
    if (!officialSource(mapping.source)) warnings.push(`Câu ${index + 1}: chưa có đáp án chính thức.`);
    return {
      id: old?.id || identifier('starter-match-question'),
      number: Number(mapping.questionNumber) || old?.number || index + 1,
      type: 'matching',
      prompt: stringValue(mapping.leftLabel, 8_000),
      options,
      correctOptionIds: officialSource(mapping.source) ? options.filter(option => normalized(option.text) === answer).map(option => option.id) : [],
      acceptedAnswers: [],
      points: old?.points || definition.pointsPerQuestion || 1,
    };
  });
  const next = basePart(current, section, questions);
  next.interaction = descriptor(section, { family: 'matching', subtype: 'text-text', variant: 'select' }, 'content-ready', warnings);
  delete next.interactionLayout;
  return { part: next, warnings };
}

export function normalizeStarterImportSection(
  current: ExamPartContent,
  section: JsonRecord,
  definition: ExamPartDefinition,
  paperId: ExamPaperContent['paperId'],
): { part: ExamPartContent; warnings: string[] } {
  const slot = stringValue(section.slot, 40);
  const partNumber = Number(slot.match(/^part-(\d+)$/)?.[1]);
  if (partNumber !== current.part) throw new StarterImportError(`JSON thuộc ${slot || 'Part không xác định'}, không phải Part ${current.part}.`);
  const interaction = isRecord(section.interaction) ? section.interaction : {};
  const family = stringValue(interaction.family, 40);
  if (paperId === 'listening' && current.part === 1 && family === 'matching') return importStarterListeningPart1(current, section, definition);
  if (paperId === 'listening' && current.part === 4 && family === 'scene') return importStarterListeningPart4(current, section, definition);
  if (family === 'text-entry') return importTextEntry(current, section, definition);
  if (family === 'choice') return importChoice(current, section, definition);
  if (family === 'matching') return importGenericMatching(current, section, definition);
  throw new StarterImportError(`Part ${current.part}: interaction family "${family || 'unknown'}" chưa được hỗ trợ.`);
}

function paperFromBundle(root: JsonRecord, paperId: string) {
  if (root.format !== 'exam-bundle-import-v1' || Number(root.formatVersion) !== 1) {
    throw new StarterImportError('JSON tổng phải dùng format "exam-bundle-import-v1" và formatVersion 1.');
  }
  const exam = isRecord(root.exam) ? root.exam : {};
  if (exam.moduleId !== 'starter') throw new StarterImportError('JSON tổng không thuộc module starter.');
  const paper = arrayValue(root.papers).filter(isRecord).find(item => item.paperId === paperId);
  if (!paper) throw new StarterImportError(`JSON tổng không chứa paper "${paperId}".`);
  return { exam, paper };
}

export function importStarterExamBundle(
  current: ExamPaperContent,
  source: string,
  definition: ExamPaperDefinition,
): StarterImportResult {
  const root = parseStarterImportJson(source);
  const { exam, paper } = paperFromBundle(root, current.paperId);
  const sections = arrayValue(paper.sections).filter(isRecord);
  const sectionByPart = new Map<number, JsonRecord>();
  sections.forEach(section => {
    const part = Number(stringValue(section.slot, 40).match(/^part-(\d+)$/)?.[1]);
    if (!Number.isInteger(part) || part < 1 || part > definition.parts.length) return;
    if (sectionByPart.has(part)) throw new StarterImportError(`JSON chứa Part ${part} nhiều hơn một lần.`);
    sectionByPart.set(part, section);
  });

  const reports: StarterImportPartReport[] = [];
  const appliedParts: number[] = [];
  const nextParts = current.parts.map((part, index) => {
    const section = sectionByPart.get(index + 1);
    if (!section) {
      reports.push({ part: index + 1, status: 'missing', questionCount: 0, warnings: [], errors: [`Thiếu Part ${index + 1}.`] });
      return part;
    }
    try {
      const result = normalizeStarterImportSection(part, section, definition.parts[index], current.paperId);
      appliedParts.push(index + 1);
      reports.push({
        part: index + 1,
        status: result.warnings.length ? 'warning' : 'imported',
        questionCount: result.part.questions.length,
        warnings: result.warnings,
        errors: [],
      });
      return result.part;
    } catch (reason) {
      const error = reason instanceof StarterImportError ? reason : new StarterImportError(reason instanceof Error ? reason.message : `Không thể nhập Part ${index + 1}.`);
      reports.push({ part: index + 1, status: 'error', questionCount: 0, warnings: [], errors: [error.message, ...error.details] });
      return part;
    }
  });
  if (!appliedParts.length) throw new StarterImportError('Không có Part Starters hợp lệ để nhập.', reports.flatMap(report => report.errors));
  const warnings = [
    ...reports.filter(report => report.status === 'missing' || report.status === 'error').map(report => `Part ${report.part} chưa được nhập.`),
    ...arrayValue(root.warnings).map(value => stringValue(value, 1_000)).filter(Boolean),
  ];
  return {
    content: {
      ...current,
      title: stringValue(exam.title, 240) || stringValue(paper.title, 240) || current.title,
      description: stringValue(exam.description, 4_000) || stringValue(paper.description, 4_000) || current.description,
      parts: nextParts,
    },
    appliedParts,
    reports,
    warnings,
  };
}

export function importStarterSinglePart(
  current: ExamPaperContent,
  partIndex: number,
  source: string,
  definition: ExamPaperDefinition,
) {
  const root = parseStarterImportJson(source);
  let section: JsonRecord | undefined;
  if (root.format === 'exam-bundle-import-v1') {
    const bundle = paperFromBundle(root, current.paperId);
    section = arrayValue(bundle.paper.sections).filter(isRecord).find(item => item.slot === `part-${partIndex + 1}`);
  } else if (isRecord(root.section)) section = root.section;
  else section = root;
  if (!section) throw new StarterImportError(`Không tìm thấy Part ${partIndex + 1} trong JSON.`);
  return normalizeStarterImportSection(current.parts[partIndex], section, definition.parts[partIndex], current.paperId);
}

export function starterColourValue(label: string) {
  return colourHex[normalized(label)] || '#64748b';
}
