import type {
  ListeningPart,
  ListeningPart3ConnectImage,
  ListeningRegion,
} from '../../listening/types';
import { MOVER_COLOUR_CATALOG } from '../../listening-library/modules/mover/editor/colourCatalog';
import {
  PART1_EXTERNAL_PROVIDER,
  Part1ExternalImportError,
  parsePart1ExternalImport,
} from './part1ExternalImport';
import type { ListeningSmartImportData, ListeningSmartImportPartId } from './types';

export const EXTERNAL_PARAMETERS_PROVIDER = PART1_EXTERNAL_PROVIDER;

type ExternalImportData<P extends ListeningSmartImportPartId> = Extract<ListeningSmartImportData, { part: P }>;

export interface ExternalParametersImportOptions {
  assetWidth?: number;
  assetHeight?: number;
  currentPart?: ListeningPart;
}

export class ExternalParametersImportError extends Error {
  details: string[];

  constructor(part: ListeningSmartImportPartId, details: string[]) {
    super(`Thông số bên ngoài Part ${part} không hợp lệ.`);
    this.name = 'ExternalParametersImportError';
    this.details = [...new Set(details)].slice(0, 24);
  }
}

const cleanText = (value: unknown) => typeof value === 'string'
  ? value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  : '';

const comparable = (value: unknown) => cleanText(value).toLocaleLowerCase('en');
const plainObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const integer = (value: unknown) => {
  const number = finiteNumber(value);
  return number !== undefined && Number.isInteger(number) ? number : undefined;
};

const stripJsonFence = (value: string) => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

function rejectUnknownFields(value: Record<string, unknown>, allowed: string[], label: string, errors: string[]) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) errors.push(`${label} chứa trường không hỗ trợ: ${unknown.join(', ')}.`);
}

function parseRoot(part: ListeningSmartImportPartId, source: string) {
  const json = stripJsonFence(source);
  if (!json) throw new ExternalParametersImportError(part, ['Chưa nhập JSON.']);
  if (json.length > 50_000) throw new ExternalParametersImportError(part, ['JSON vượt quá giới hạn 50.000 ký tự.']);
  try {
    const parsed: unknown = JSON.parse(json);
    if (!plainObject(parsed)) throw new ExternalParametersImportError(part, ['Giá trị gốc phải là một JSON object.']);
    return parsed;
  } catch (reason) {
    if (reason instanceof ExternalParametersImportError) throw reason;
    const message = reason instanceof Error ? reason.message : 'JSON malformed';
    throw new ExternalParametersImportError(part, [`Không parse được JSON: ${message}`]);
  }
}

function assertVersion(raw: Record<string, unknown>, part: ListeningSmartImportPartId, allowed: string[], errors: string[]) {
  rejectUnknownFields(raw, ['schemaVersion', 'part', ...allowed], 'JSON gốc', errors);
  if (raw.schemaVersion !== `mover-part${part}-external-v1`) errors.push(`schemaVersion phải là "mover-part${part}-external-v1".`);
  if (raw.part !== part) errors.push(`part phải bằng ${part}.`);
}

function parseQuestionNumber(value: unknown, label: string, seen: Set<number>, errors: string[]) {
  const number = integer(value);
  if (!number || number < 1 || number > 5) {
    errors.push(`${label}.questionNumber phải là số nguyên trong 1..5.`);
    return undefined;
  }
  if (seen.has(number)) {
    errors.push(`questionNumber ${number} bị trùng.`);
    return undefined;
  }
  seen.add(number);
  return number as 1 | 2 | 3 | 4 | 5;
}

function parseCoordinateContext(
  raw: Record<string, unknown>,
  options: ExternalParametersImportOptions,
  errors: string[],
  warnings: string[],
) {
  const coordinateSpace = raw.coordinateSpace;
  if (coordinateSpace !== 'pixel' && coordinateSpace !== 'normalized') {
    errors.push('coordinateSpace chỉ nhận "pixel" hoặc "normalized".');
  }
  let width: number | undefined;
  let height: number | undefined;
  if (raw.imageSize !== undefined) {
    if (!plainObject(raw.imageSize)) {
      errors.push('imageSize phải là object { width, height }.');
    } else {
      rejectUnknownFields(raw.imageSize, ['width', 'height'], 'imageSize', errors);
      width = integer(raw.imageSize.width);
      height = integer(raw.imageSize.height);
      if (!width || width <= 0) errors.push('imageSize.width phải là số nguyên dương.');
      if (!height || height <= 0) errors.push('imageSize.height phải là số nguyên dương.');
    }
  }
  if (coordinateSpace === 'pixel' && (!width || !height)) errors.push('coordinateSpace="pixel" bắt buộc có imageSize hợp lệ.');
  if (width && height && options.assetWidth && options.assetHeight
    && (width !== options.assetWidth || height !== options.assetHeight)) {
    errors.push(`imageSize ${width}×${height} không khớp ảnh đề đã chọn ${options.assetWidth}×${options.assetHeight}.`);
  } else if (coordinateSpace === 'pixel' && (!options.assetWidth || !options.assetHeight)) {
    warnings.push('Asset cũ chưa có metadata kích thước; đã dùng imageSize khai báo để chuẩn hóa pixel.');
  }
  return { coordinateSpace, width, height };
}

function parseRegion(
  value: unknown,
  label: string,
  context: { coordinateSpace?: unknown; width?: number; height?: number },
  errors: string[],
): ListeningRegion | undefined {
  if (!plainObject(value)) {
    errors.push(`${label} phải là object { x, y, width, height }.`);
    return undefined;
  }
  rejectUnknownFields(value, ['x', 'y', 'width', 'height'], label, errors);
  const rawX = finiteNumber(value.x);
  const rawY = finiteNumber(value.y);
  const rawWidth = finiteNumber(value.width);
  const rawHeight = finiteNumber(value.height);
  if (rawX === undefined || rawY === undefined || rawWidth === undefined || rawHeight === undefined) {
    errors.push(`${label} phải có x, y, width, height là số hữu hạn.`);
    return undefined;
  }
  const pixel = context.coordinateSpace === 'pixel';
  const x = pixel && context.width ? rawX / context.width : rawX;
  const y = pixel && context.height ? rawY / context.height : rawY;
  const width = pixel && context.width ? rawWidth / context.width : rawWidth;
  const height = pixel && context.height ? rawHeight / context.height : rawHeight;
  if (x < 0 || y < 0 || width < 0.005 || height < 0.005 || x + width > 1 || y + height > 1) {
    errors.push(`${label} nằm ngoài ảnh hoặc quá nhỏ.`);
    return undefined;
  }
  return { shape: 'rect', x, y, width, height };
}

function parsePart2(source: string): { data: ExternalImportData<2>; warnings: string[] } {
  const raw = parseRoot(2, source);
  const errors: string[] = [];
  const warnings: string[] = [];
  assertVersion(raw, 2, ['heading', 'instruction', 'exampleText', 'questions'], errors);
  const entries = Array.isArray(raw.questions) ? raw.questions : [];
  if (!Array.isArray(raw.questions)) errors.push('questions phải là một array.');
  if (entries.length !== 5) errors.push(`questions phải có đúng 5 câu; hiện có ${entries.length}.`);
  const seen = new Set<number>();
  const questions: ExternalImportData<2>['questions'] = [];
  entries.forEach((entry, index) => {
    const label = `questions[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['questionNumber', 'prompt', 'acceptedAnswers'], label, errors);
    const questionNumber = parseQuestionNumber(entry.questionNumber, label, seen, errors);
    if (!questionNumber) return;
    const prompt = cleanText(entry.prompt);
    if (!prompt) warnings.push(`Part 2 câu ${questionNumber}: thiếu prompt; giữ prompt draft hiện tại.`);
    let acceptedAnswers: string[] | undefined;
    if (entry.acceptedAnswers !== undefined) {
      if (!Array.isArray(entry.acceptedAnswers)) {
        errors.push(`${label}.acceptedAnswers phải là array chuỗi.`);
      } else {
        acceptedAnswers = [...new Set(entry.acceptedAnswers.map(cleanText).filter(Boolean))];
        if (!acceptedAnswers.length) warnings.push(`Part 2 câu ${questionNumber}: không có đáp án chắc chắn; giữ đáp án draft hiện tại.`);
      }
    } else {
      warnings.push(`Part 2 câu ${questionNumber}: thiếu acceptedAnswers; giữ đáp án draft hiện tại.`);
    }
    questions.push({ questionNumber, ...(prompt ? { prompt } : {}), ...(acceptedAnswers?.length ? { acceptedAnswers } : {}) });
  });
  if (errors.length) throw new ExternalParametersImportError(2, errors);
  return {
    data: {
      part: 2,
      ...(cleanText(raw.heading) ? { heading: cleanText(raw.heading) } : {}),
      ...(cleanText(raw.instruction) ? { instruction: cleanText(raw.instruction) } : {}),
      ...(cleanText(raw.exampleText) ? { exampleText: cleanText(raw.exampleText) } : {}),
      questions,
    },
    warnings,
  };
}

function parsePart3(
  source: string,
  options: ExternalParametersImportOptions,
): { data: ExternalImportData<3>; warnings: string[] } {
  const raw = parseRoot(3, source);
  const errors: string[] = [];
  const warnings: string[] = [];
  assertVersion(raw, 3, ['coordinateSpace', 'imageSize', 'answers', 'pictures', 'example', 'connections', 'distractorLabel'], errors);
  const coordinates = parseCoordinateContext(raw, options, errors, warnings);
  const current = options.currentPart?.part === 3 && options.currentPart.displayMode === 'connect-image'
    ? options.currentPart as ListeningPart3ConnectImage
    : undefined;

  const answerEntries = Array.isArray(raw.answers) ? raw.answers : [];
  if (!Array.isArray(raw.answers)) errors.push('answers phải là một array.');
  if (answerEntries.length !== 7) errors.push(`answers phải có đúng 7 nhãn; hiện có ${answerEntries.length}.`);
  const answerKeys = new Set<string>();
  const answers: ExternalImportData<3>['answers'] = [];
  answerEntries.forEach((entry, index) => {
    const label = `answers[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['label', 'region'], label, errors);
    const answerLabel = cleanText(entry.label);
    const key = comparable(answerLabel);
    if (!answerLabel) errors.push(`${label}.label không được để trống.`);
    if (key && answerKeys.has(key)) errors.push(`Nhãn answer bị trùng: "${answerLabel}".`);
    const existing = current?.answers.find(answer => comparable(answer.label) === key);
    let region = entry.region === undefined ? undefined : parseRegion(entry.region, `${label}.region`, coordinates, errors);
    let sourceKind: 'current-part' | undefined;
    if (!region && entry.region === undefined && existing) {
      region = existing.region;
      sourceKind = 'current-part';
      warnings.push(`Part 3 answer "${answerLabel}": giữ region draft hiện tại.`);
    }
    if (!region && entry.region === undefined && !existing) errors.push(`${label}.region bắt buộc khi draft chưa có geometry tương ứng.`);
    if (answerLabel && key && !answerKeys.has(key) && region) {
      answerKeys.add(key);
      answers.push({
        label: answerLabel,
        region,
        leftAnchorOffset: existing?.leftAnchorOffset ?? 0.5,
        rightAnchorOffset: existing?.rightAnchorOffset ?? 0.5,
        ...(sourceKind ? { source: sourceKind } : {}),
      });
    }
  });

  const pictureEntries = Array.isArray(raw.pictures) ? raw.pictures : [];
  if (!Array.isArray(raw.pictures)) errors.push('pictures phải là một array.');
  if (pictureEntries.length !== 6) errors.push(`pictures phải có đúng 6 vị trí; hiện có ${pictureEntries.length}.`);
  const pictureSlots = new Set<string>();
  const pictures: ExternalImportData<3>['pictures'] = [];
  pictureEntries.forEach((entry, index) => {
    const label = `pictures[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['label', 'side', 'row', 'region'], label, errors);
    const side = entry.side === 'left' || entry.side === 'right' ? entry.side : undefined;
    const rowNumber = integer(entry.row);
    const row = rowNumber && rowNumber >= 1 && rowNumber <= 3 ? rowNumber as 1 | 2 | 3 : undefined;
    if (!side) errors.push(`${label}.side chỉ nhận "left" hoặc "right".`);
    if (!row) errors.push(`${label}.row chỉ nhận 1, 2 hoặc 3.`);
    if (!side || !row) return;
    const slot = `${side}:${row}`;
    if (pictureSlots.has(slot)) errors.push(`Vị trí picture ${slot} bị trùng.`);
    const existing = current?.pictures.find(picture => picture.side === side && picture.row === row);
    const pictureLabel = cleanText(entry.label) || existing?.label || `Hình ${side} ${row}`;
    let region = entry.region === undefined ? undefined : parseRegion(entry.region, `${label}.region`, coordinates, errors);
    let sourceKind: 'current-part' | undefined;
    if (!region && entry.region === undefined && existing) {
      region = existing.region;
      sourceKind = 'current-part';
      warnings.push(`Part 3 picture ${slot}: giữ region draft hiện tại.`);
    }
    if (!region && entry.region === undefined && !existing) errors.push(`${label}.region bắt buộc khi draft chưa có geometry tương ứng.`);
    if (!pictureSlots.has(slot) && region) {
      pictureSlots.add(slot);
      pictures.push({
        label: pictureLabel,
        side,
        row,
        region,
        anchorOffset: existing?.anchorOffset ?? 0.5,
        ...(sourceKind ? { source: sourceKind } : {}),
      });
    }
  });

  let example: ExternalImportData<3>['example'];
  if (!plainObject(raw.example)) {
    errors.push('example phải là object { answerLabel, pictureSide, pictureRow }.');
  } else {
    rejectUnknownFields(raw.example, ['answerLabel', 'pictureSide', 'pictureRow'], 'example', errors);
    const answerLabel = cleanText(raw.example.answerLabel);
    const pictureSide = raw.example.pictureSide === 'left' || raw.example.pictureSide === 'right' ? raw.example.pictureSide : undefined;
    const rawRow = integer(raw.example.pictureRow);
    const pictureRow = rawRow && rawRow >= 1 && rawRow <= 3 ? rawRow as 1 | 2 | 3 : undefined;
    if (!answerKeys.has(comparable(answerLabel))) errors.push('example.answerLabel phải khớp một answer duy nhất.');
    if (!pictureSide || !pictureRow || !pictureSlots.has(`${pictureSide}:${pictureRow}`)) errors.push('example phải tham chiếu một picture side/row hợp lệ.');
    if (answerLabel && pictureSide && pictureRow) example = { answerLabel, pictureSide, pictureRow, renderOverlayLine: false };
  }

  const connectionEntries = Array.isArray(raw.connections) ? raw.connections : [];
  if (!Array.isArray(raw.connections)) errors.push('connections phải là một array.');
  if (connectionEntries.length !== 5) errors.push(`connections phải có đúng 5 mapping; hiện có ${connectionEntries.length}.`);
  const connectionLabels = new Set<string>();
  const connectionSlots = new Set<string>();
  const connections: ExternalImportData<3>['connections'] = [];
  connectionEntries.forEach((entry, index) => {
    const label = `connections[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['answerLabel', 'pictureSide', 'pictureRow'], label, errors);
    const answerLabel = cleanText(entry.answerLabel);
    const key = comparable(answerLabel);
    const pictureSide = entry.pictureSide === 'left' || entry.pictureSide === 'right' ? entry.pictureSide : undefined;
    const rawRow = integer(entry.pictureRow);
    const pictureRow = rawRow && rawRow >= 1 && rawRow <= 3 ? rawRow as 1 | 2 | 3 : undefined;
    const slot = pictureSide && pictureRow ? `${pictureSide}:${pictureRow}` : '';
    if (!answerKeys.has(key)) errors.push(`${label}.answerLabel không khớp answer.`);
    if (!slot || !pictureSlots.has(slot)) errors.push(`${label} không tham chiếu picture hợp lệ.`);
    if (key && connectionLabels.has(key)) errors.push(`${label} dùng lại answer đã mapping.`);
    if (slot && connectionSlots.has(slot)) errors.push(`${label} dùng lại picture đã mapping.`);
    if (example && (key === comparable(example.answerLabel) || slot === `${example.pictureSide}:${example.pictureRow}`)) errors.push(`${label} không được dùng lại example.`);
    if (key && slot && answerKeys.has(key) && pictureSlots.has(slot) && !connectionLabels.has(key) && !connectionSlots.has(slot)) {
      connectionLabels.add(key);
      connectionSlots.add(slot);
      connections.push({ answerLabel, pictureSide: pictureSide!, pictureRow: pictureRow! });
    }
  });
  const distractorLabel = cleanText(raw.distractorLabel);
  const used = new Set([comparable(example?.answerLabel), ...connectionLabels]);
  const unused = answers.filter(answer => !used.has(comparable(answer.label)));
  if (unused.length !== 1 || comparable(unused[0]?.label) !== comparable(distractorLabel)) {
    errors.push(`distractorLabel phải là đáp án duy nhất còn lại${unused.length === 1 ? `: "${unused[0].label}"` : ''}.`);
  }
  if (errors.length) throw new ExternalParametersImportError(3, errors);
  return { data: { part: 3, answers, pictures, example, connections, distractorLabel }, warnings };
}

function answerIndex(value: unknown, label: string, errors: string[]) {
  const answer = cleanText(value).toUpperCase();
  if (!answer) return undefined;
  const index = ['A', 'B', 'C'].indexOf(answer);
  if (index < 0) {
    errors.push(`${label} chỉ nhận A, B hoặc C.`);
    return undefined;
  }
  return index;
}

function parsePart4(source: string): { data: ExternalImportData<4>; warnings: string[] } {
  const raw = parseRoot(4, source);
  const errors: string[] = [];
  const warnings: string[] = [];
  assertVersion(raw, 4, ['example', 'questions'], errors);
  let example: ExternalImportData<4>['example'];
  if (raw.example !== undefined) {
    if (!plainObject(raw.example)) {
      errors.push('example phải là object { prompt, correctAnswer }.');
    } else {
      rejectUnknownFields(raw.example, ['prompt', 'correctAnswer'], 'example', errors);
      const prompt = cleanText(raw.example.prompt);
      const correctOptionIndex = answerIndex(raw.example.correctAnswer, 'example.correctAnswer', errors);
      if (!prompt) warnings.push('Part 4 example thiếu prompt; giữ prompt draft hiện tại.');
      example = { prompt, crops: [], ...(correctOptionIndex === undefined ? {} : { correctOptionIndex }) };
    }
  }
  const entries = Array.isArray(raw.questions) ? raw.questions : [];
  if (!Array.isArray(raw.questions)) errors.push('questions phải là một array.');
  if (entries.length !== 5) errors.push(`questions phải có đúng 5 câu; hiện có ${entries.length}.`);
  const seen = new Set<number>();
  const questions: ExternalImportData<4>['questions'] = [];
  entries.forEach((entry, index) => {
    const label = `questions[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['questionNumber', 'prompt', 'correctAnswer'], label, errors);
    const questionNumber = parseQuestionNumber(entry.questionNumber, label, seen, errors);
    if (!questionNumber) return;
    const prompt = cleanText(entry.prompt);
    if (!prompt) warnings.push(`Part 4 câu ${questionNumber}: thiếu prompt; giữ prompt draft hiện tại.`);
    const correctOptionIndex = answerIndex(entry.correctAnswer, `${label}.correctAnswer`, errors);
    if (correctOptionIndex === undefined) warnings.push(`Part 4 câu ${questionNumber}: thiếu đáp án chắc chắn; giữ đáp án draft hiện tại.`);
    questions.push({
      questionNumber,
      prompt,
      crops: [],
      ...(correctOptionIndex === undefined ? {} : { correctOptionIndex }),
      answerSource: correctOptionIndex === undefined ? 'current-part' : 'answer-key-numbered',
    });
  });
  if (errors.length) throw new ExternalParametersImportError(4, errors);
  return { data: { part: 4, ...(example ? { example } : {}), questions }, warnings };
}

const catalogColour = (value: unknown) => {
  const key = comparable(value);
  return MOVER_COLOUR_CATALOG.find(colour => comparable(colour.label) === key)?.label;
};

function parsePart5(source: string): { data: ExternalImportData<5>; warnings: string[] } {
  const raw = parseRoot(5, source);
  const errors: string[] = [];
  const warnings: string[] = [];
  assertVersion(raw, 5, ['paletteItems', 'questions'], errors);
  const paletteEntries = Array.isArray(raw.paletteItems) ? raw.paletteItems : [];
  if (!Array.isArray(raw.paletteItems)) errors.push('paletteItems phải là một array.');
  if (paletteEntries.length > 3) errors.push('paletteItems chỉ nhận tối đa 3 vật kéo thả, gồm vật nhiễu nếu có.');
  const paletteKeys = new Set<string>();
  const paletteItems: ExternalImportData<5>['paletteItems'] = [];
  paletteEntries.forEach((entry, index) => {
    const label = `paletteItems[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['objectType', 'label', 'colourLabel'], label, errors);
    const objectType = cleanText(entry.objectType);
    const itemLabel = cleanText(entry.label);
    const colourLabel = entry.colourLabel === undefined ? undefined : catalogColour(entry.colourLabel);
    const key = comparable(objectType);
    if (!objectType || !itemLabel) errors.push(`${label} cần objectType và label.`);
    if (entry.colourLabel !== undefined && !colourLabel) errors.push(`${label}.colourLabel không thuộc catalog màu Mover.`);
    if (key && paletteKeys.has(key)) errors.push(`paletteItems bị trùng objectType "${objectType}".`);
    if (objectType && itemLabel && !paletteKeys.has(key)) {
      paletteKeys.add(key);
      paletteItems.push({ objectType, label: itemLabel, ...(colourLabel ? { colourLabel } : {}) });
    }
  });

  const entries = Array.isArray(raw.questions) ? raw.questions : [];
  if (!Array.isArray(raw.questions)) errors.push('questions phải là một array.');
  if (entries.length !== 5) errors.push(`questions phải có đúng 5 câu; hiện có ${entries.length}.`);
  const seen = new Set<number>();
  const questions: ExternalImportData<5>['questions'] = [];
  entries.forEach((entry, index) => {
    const label = `questions[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['questionNumber', 'staffPrompt', 'actions'], label, errors);
    const questionNumber = parseQuestionNumber(entry.questionNumber, label, seen, errors);
    if (!questionNumber) return;
    const staffPrompt = cleanText(entry.staffPrompt);
    if (!staffPrompt) warnings.push(`Part 5 câu ${questionNumber}: thiếu staffPrompt; giữ nội dung draft hiện tại.`);
    const actionEntries = Array.isArray(entry.actions) ? entry.actions : [];
    if (!Array.isArray(entry.actions)) errors.push(`${label}.actions phải là một array.`);
    if (!actionEntries.length) warnings.push(`Part 5 câu ${questionNumber}: không có action chắc chắn; giữ action draft hiện tại.`);
    const actions: ExternalImportData<5>['questions'][number]['actions'] = [];
    actionEntries.forEach((action, actionIndex) => {
      const actionLabel = `${label}.actions[${actionIndex}]`;
      if (!plainObject(action)) {
        errors.push(`${actionLabel} phải là object.`);
        return;
      }
      if (action.type === 'colour_object') {
        rejectUnknownFields(action, ['type', 'objectLabel', 'correctColourLabel'], actionLabel, errors);
        const objectLabel = cleanText(action.objectLabel);
        const correctColourLabel = catalogColour(action.correctColourLabel);
        if (!objectLabel) errors.push(`${actionLabel}.objectLabel không được để trống.`);
        if (action.correctColourLabel !== undefined && !correctColourLabel) errors.push(`${actionLabel}.correctColourLabel không thuộc catalog màu Mover.`);
        if (!correctColourLabel) warnings.push(`Part 5 câu ${questionNumber} action ${actionIndex + 1}: thiếu màu chắc chắn; giữ action cũ nếu có.`);
        if (objectLabel) actions.push({ type: 'colour_object', objectLabel, ...(correctColourLabel ? { correctColourLabel } : {}), confidence: 1 });
        return;
      }
      if (action.type === 'place_object') {
        rejectUnknownFields(action, ['type', 'objectType', 'colourLabel', 'relationLabel', 'targetRegion'], actionLabel, errors);
        const objectType = cleanText(action.objectType);
        const colourLabel = action.colourLabel === undefined ? undefined : catalogColour(action.colourLabel);
        if (!objectType) errors.push(`${actionLabel}.objectType không được để trống.`);
        if (action.colourLabel !== undefined && !colourLabel) errors.push(`${actionLabel}.colourLabel không thuộc catalog màu Mover.`);
        const targetRegion = action.targetRegion === undefined
          ? undefined
          : parseRegion(action.targetRegion, `${actionLabel}.targetRegion`, { coordinateSpace: 'normalized' }, errors);
        if (!targetRegion) warnings.push(`Part 5 câu ${questionNumber} action ${actionIndex + 1}: chưa có vùng Draw; giữ vùng cũ hoặc yêu cầu giáo viên chọn.`);
        if (objectType) actions.push({
          type: 'place_object',
          objectType,
          ...(colourLabel ? { colourLabel } : {}),
          ...(targetRegion ? { targetRegion } : {}),
          ...(cleanText(action.relationLabel) ? { relationLabel: cleanText(action.relationLabel) } : {}),
          confidence: 1,
        });
      } else {
        errors.push(`${actionLabel}.type chỉ nhận "colour_object" hoặc "place_object".`);
      }
    });
    questions.push({ questionNumber, staffPrompt, actions });
  });

  const drawActions = questions.flatMap(question => question.actions.filter(action => action.type === 'place_object'));
  drawActions.forEach(action => {
    if (paletteItems.some(item => comparable(item.objectType) === comparable(action.objectType))) return;
    if (paletteItems.length >= 3) {
      errors.push(`Thiếu paletteItem tương ứng với Draw objectType "${action.objectType}".`);
      return;
    }
    paletteItems.push({ objectType: action.objectType, label: action.objectType, ...(action.colourLabel ? { colourLabel: action.colourLabel } : {}) });
    warnings.push(`Đã tạo paletteItem từ Draw objectType "${action.objectType}"; giáo viên cần tải icon PNG.`);
  });
  if (errors.length) throw new ExternalParametersImportError(5, errors);
  return { data: { part: 5, paletteItems, questions }, warnings };
}

export function parseExternalParametersImport<P extends ListeningSmartImportPartId>(
  part: P,
  source: string,
  options: ExternalParametersImportOptions = {},
): { data: ExternalImportData<P>; warnings: string[] } {
  try {
    if (part === 1) return parsePart1ExternalImport(source, options) as { data: ExternalImportData<P>; warnings: string[] };
    if (part === 2) return parsePart2(source) as { data: ExternalImportData<P>; warnings: string[] };
    if (part === 3) return parsePart3(source, options) as { data: ExternalImportData<P>; warnings: string[] };
    if (part === 4) return parsePart4(source) as { data: ExternalImportData<P>; warnings: string[] };
    return parsePart5(source) as { data: ExternalImportData<P>; warnings: string[] };
  } catch (reason) {
    if (reason instanceof Part1ExternalImportError) throw new ExternalParametersImportError(1, reason.details);
    throw reason;
  }
}

export const externalParametersHelp: Record<ListeningSmartImportPartId, string> = {
  1: 'Nhập đúng 7 nhân vật và tọa độ, sample, 5 answers theo questionNumber và distractor. Với pixel, imageSize phải khớp đúng ảnh đề.',
  2: 'Nhập heading/instruction/example và đúng 5 prompt + acceptedAnswers. Không nhập crop; sau khi ghép vẫn chọn vùng tranh minh họa như cũ.',
  3: 'Nhập 7 answer, 6 picture trái/phải, example, 5 mapping và distractor. Draft mới cần region; anchor được code tự đặt theo cạnh.',
  4: 'Nhập example, đúng 5 prompt và đáp án A/B/C. Không nhập crop; code vẫn dò khung và tách 15/18 hình từ ảnh đề.',
  5: 'Nhập 5 câu và các action Colour/Draw. Colour mask, icon PNG và bước xác nhận vùng vẫn thực hiện trong editor hiện tại.',
};

const templates: Record<ListeningSmartImportPartId, unknown> = {
  1: {
    schemaVersion: 'mover-part1-external-v1', part: 1, coordinateSpace: 'pixel', imageSize: { width: 628, height: 869 },
    people: [
      { name: 'Mary', point: { x: 527, y: 695 } }, { name: 'Ben', point: { x: 436, y: 558 } },
      { name: 'Tom', point: { x: 402, y: 260 } }, { name: 'Paul', point: { x: 281, y: 262 } },
      { name: 'Jane', point: { x: 272, y: 545 } }, { name: 'Anna', point: { x: 123, y: 542 } },
      { name: 'Pat', point: { x: 503, y: 356 } },
    ],
    sample: { name: 'Mary' },
    answers: [1, 2, 3, 4, 5].map((questionNumber, index) => ({ questionNumber, name: ['Ben', 'Tom', 'Paul', 'Jane', 'Anna'][index] })),
    distractor: 'Pat',
  },
  2: {
    schemaVersion: 'mover-part2-external-v1', part: 2, heading: 'Listen and write.', instruction: 'Listen and complete the notes.', exampleText: 'Name: Jill Walker',
    questions: [
      { questionNumber: 1, prompt: 'Lives at: {{blank}} Street', acceptedAnswers: ['Main'] },
      { questionNumber: 2, prompt: 'Class number: {{blank}}', acceptedAnswers: ['4b'] },
      { questionNumber: 3, prompt: 'Favourite sport: {{blank}}', acceptedAnswers: ['hockey'] },
      { questionNumber: 4, prompt: 'Likes reading: {{blank}}', acceptedAnswers: ['comics'] },
      { questionNumber: 5, prompt: 'Pet: {{blank}}', acceptedAnswers: ['snake'] },
    ],
  },
  3: {
    schemaVersion: 'mover-part3-external-v1', part: 3, coordinateSpace: 'normalized',
    answers: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label, index) => ({ label, region: { x: 0.42, y: 0.1 + index * 0.1, width: 0.16, height: 0.055 } })),
    pictures: [
      { label: 'Hình trên bên trái', side: 'left', row: 1, region: { x: 0.08, y: 0.08, width: 0.24, height: 0.2 } },
      { label: 'Hình trên bên phải', side: 'right', row: 1, region: { x: 0.68, y: 0.08, width: 0.24, height: 0.2 } },
      { label: 'Hình giữa bên trái', side: 'left', row: 2, region: { x: 0.08, y: 0.38, width: 0.24, height: 0.2 } },
      { label: 'Hình giữa bên phải', side: 'right', row: 2, region: { x: 0.68, y: 0.38, width: 0.24, height: 0.2 } },
      { label: 'Hình dưới bên trái', side: 'left', row: 3, region: { x: 0.08, y: 0.68, width: 0.24, height: 0.2 } },
      { label: 'Hình dưới bên phải', side: 'right', row: 3, region: { x: 0.68, y: 0.68, width: 0.24, height: 0.2 } },
    ],
    example: { answerLabel: 'Thursday', pictureSide: 'left', pictureRow: 2 },
    connections: [
      { answerLabel: 'Saturday', pictureSide: 'left', pictureRow: 1 }, { answerLabel: 'Monday', pictureSide: 'right', pictureRow: 1 },
      { answerLabel: 'Sunday', pictureSide: 'right', pictureRow: 2 }, { answerLabel: 'Tuesday', pictureSide: 'left', pictureRow: 3 },
      { answerLabel: 'Wednesday', pictureSide: 'right', pictureRow: 3 },
    ],
    distractorLabel: 'Friday',
  },
  4: {
    schemaVersion: 'mover-part4-external-v1', part: 4, example: { prompt: "Where is Pat's dad going?", correctAnswer: 'A' },
    questions: [
      { questionNumber: 1, prompt: "Which one is Pat's mother?", correctAnswer: 'A' },
      { questionNumber: 2, prompt: 'What does Pat want to buy?', correctAnswer: 'C' },
      { questionNumber: 3, prompt: 'What was the weather like?', correctAnswer: 'C' },
      { questionNumber: 4, prompt: "Where's Peter?", correctAnswer: 'B' },
      { questionNumber: 5, prompt: 'What will they take?', correctAnswer: 'C' },
    ],
  },
  5: {
    schemaVersion: 'mover-part5-external-v1', part: 5,
    paletteItems: [{ objectType: 'lamp', label: 'Lamp' }, { objectType: 'toy-plane', label: 'Red toy plane', colourLabel: 'Red' }],
    questions: [
      { questionNumber: 1, staffPrompt: 'Colour the big cupboard green and the small cupboard yellow.', actions: [{ type: 'colour_object', objectLabel: 'big cupboard', correctColourLabel: 'Green' }, { type: 'colour_object', objectLabel: 'small cupboard', correctColourLabel: 'Yellow' }] },
      { questionNumber: 2, staffPrompt: 'Draw a lamp on the table by the bed.', actions: [{ type: 'place_object', objectType: 'lamp', relationLabel: 'on the table by the bed' }] },
      { questionNumber: 3, staffPrompt: 'Colour the T-shirt of the boy standing up red.', actions: [{ type: 'colour_object', objectLabel: 'T-shirt of the boy standing up', correctColourLabel: 'Red' }] },
      { questionNumber: 4, staffPrompt: 'Colour the mat in front of the door brown.', actions: [{ type: 'colour_object', objectLabel: 'mat in front of the door', correctColourLabel: 'Brown' }] },
      { questionNumber: 5, staffPrompt: 'Draw a red toy plane between the boys.', actions: [{ type: 'place_object', objectType: 'toy-plane', colourLabel: 'Red', relationLabel: 'between the boys' }] },
    ],
  },
};

export const externalParametersTemplate = (part: ListeningSmartImportPartId) => JSON.stringify(templates[part], null, 2);

