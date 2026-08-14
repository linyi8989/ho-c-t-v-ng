import type { ListeningRegion } from '../../listening/types';
import type { ListeningSmartImportData } from './types';

type Part1ImportData = Extract<ListeningSmartImportData, { part: 1 }>;

export const PART1_EXTERNAL_PROVIDER = 'external-parameters';

interface ParsePart1ExternalImportOptions {
  assetWidth?: number;
  assetHeight?: number;
}

interface ParsedPerson {
  name: string;
  key: string;
  point: { x: number; y: number };
}

export class Part1ExternalImportError extends Error {
  details: string[];

  constructor(details: string[]) {
    super('Thông số bên ngoài Part 1 không hợp lệ.');
    this.name = 'Part1ExternalImportError';
    this.details = [...new Set(details)];
  }
}

const cleanText = (value: unknown) => typeof value === 'string'
  ? value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  : '';

const comparable = (value: unknown) => cleanText(value).toLocaleLowerCase('en');

const plainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const finiteNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
};

const stripJsonFence = (value: string) => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
  errors: string[],
) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) errors.push(`${label} chứa trường không hỗ trợ: ${unknown.join(', ')}.`);
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

export function parsePart1ExternalImport(
  source: string,
  options: ParsePart1ExternalImportOptions = {},
): { data: Part1ImportData; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const json = stripJsonFence(source);
  if (!json) throw new Part1ExternalImportError(['Chưa nhập JSON.']);
  if (json.length > 50_000) throw new Part1ExternalImportError(['JSON vượt quá giới hạn 50.000 ký tự.']);

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'JSON malformed';
    throw new Part1ExternalImportError([`Không parse được JSON: ${message}`]);
  }
  if (!plainObject(raw)) throw new Part1ExternalImportError(['Giá trị gốc phải là một JSON object.']);

  rejectUnknownFields(raw, [
    'schemaVersion',
    'part',
    'coordinateSpace',
    'imageSize',
    'people',
    'sample',
    'answers',
    'distractor',
  ], 'JSON gốc', errors);
  if (raw.schemaVersion !== 'mover-part1-external-v1') errors.push('schemaVersion phải là "mover-part1-external-v1".');
  if (raw.part !== 1) errors.push('part phải bằng 1.');

  const coordinateSpace = raw.coordinateSpace;
  if (coordinateSpace !== 'pixel' && coordinateSpace !== 'normalized') {
    errors.push('coordinateSpace chỉ nhận "pixel" hoặc "normalized".');
  }

  let imageWidth: number | undefined;
  let imageHeight: number | undefined;
  if (raw.imageSize !== undefined) {
    if (!plainObject(raw.imageSize)) {
      errors.push('imageSize phải là object { width, height }.');
    } else {
      rejectUnknownFields(raw.imageSize, ['width', 'height'], 'imageSize', errors);
      imageWidth = finiteNumber(raw.imageSize.width);
      imageHeight = finiteNumber(raw.imageSize.height);
      if (!imageWidth || imageWidth <= 0 || !Number.isInteger(imageWidth)) errors.push('imageSize.width phải là số nguyên dương.');
      if (!imageHeight || imageHeight <= 0 || !Number.isInteger(imageHeight)) errors.push('imageSize.height phải là số nguyên dương.');
    }
  }
  if (coordinateSpace === 'pixel' && (!imageWidth || !imageHeight)) {
    errors.push('coordinateSpace="pixel" bắt buộc có imageSize hợp lệ.');
  }
  if (imageWidth && imageHeight && options.assetWidth && options.assetHeight
    && (imageWidth !== options.assetWidth || imageHeight !== options.assetHeight)) {
    errors.push(`imageSize ${imageWidth}×${imageHeight} không khớp ảnh đề đã chọn ${options.assetWidth}×${options.assetHeight}.`);
  } else if (coordinateSpace === 'pixel' && (!options.assetWidth || !options.assetHeight)) {
    warnings.push('Asset cũ chưa có metadata kích thước; đã dùng imageSize do giáo viên khai báo để chuẩn hóa pixel.');
  }

  const normalizePoint = (value: unknown, label: string) => {
    if (!plainObject(value)) {
      errors.push(`${label}.point phải là object { x, y }.`);
      return undefined;
    }
    rejectUnknownFields(value, ['x', 'y'], `${label}.point`, errors);
    const rawX = finiteNumber(value.x);
    const rawY = finiteNumber(value.y);
    if (rawX === undefined || rawY === undefined) {
      errors.push(`${label}.point phải có x và y là số hữu hạn.`);
      return undefined;
    }
    const x = coordinateSpace === 'pixel' && imageWidth ? rawX / imageWidth : rawX;
    const y = coordinateSpace === 'pixel' && imageHeight ? rawY / imageHeight : rawY;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      errors.push(`${label}.point nằm ngoài ảnh.`);
      return undefined;
    }
    return { x, y };
  };

  const rawPeople = Array.isArray(raw.people) ? raw.people : [];
  if (!Array.isArray(raw.people)) errors.push('people phải là một array.');
  if (rawPeople.length !== 7) errors.push(`people phải có đúng 7 nhân vật; hiện có ${rawPeople.length}.`);
  const people: ParsedPerson[] = [];
  const seenPeople = new Set<string>();
  rawPeople.forEach((entry, index) => {
    const label = `people[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['name', 'point'], label, errors);
    const name = cleanText(entry.name);
    const key = comparable(name);
    if (!name) errors.push(`${label}.name không được để trống.`);
    if (key && seenPeople.has(key)) errors.push(`Tên nhân vật bị trùng: "${name}".`);
    const point = normalizePoint(entry.point, label);
    if (name && key && point && !seenPeople.has(key)) {
      seenPeople.add(key);
      people.push({ name, key, point });
    }
  });

  let sampleName = '';
  if (!plainObject(raw.sample)) {
    errors.push('sample phải là object { name }.');
  } else {
    rejectUnknownFields(raw.sample, ['name'], 'sample', errors);
    sampleName = cleanText(raw.sample.name);
    if (!sampleName) errors.push('sample.name không được để trống.');
  }
  const sampleKey = comparable(sampleName);
  const samplePerson = people.find(person => person.key === sampleKey);
  if (sampleName && !samplePerson) errors.push(`sample "${sampleName}" không tồn tại duy nhất trong people.`);

  const rawAnswers = Array.isArray(raw.answers) ? raw.answers : [];
  if (!Array.isArray(raw.answers)) errors.push('answers phải là một array.');
  if (rawAnswers.length !== 5) errors.push(`answers phải có đúng 5 câu; hiện có ${rawAnswers.length}.`);
  const answers = new Map<number, ParsedPerson>();
  const answerKeys = new Set<string>();
  rawAnswers.forEach((entry, index) => {
    const label = `answers[${index}]`;
    if (!plainObject(entry)) {
      errors.push(`${label} phải là object.`);
      return;
    }
    rejectUnknownFields(entry, ['questionNumber', 'name'], label, errors);
    const number = finiteNumber(entry.questionNumber);
    const name = cleanText(entry.name);
    const key = comparable(name);
    if (!number || !Number.isInteger(number) || number < 1 || number > 5) {
      errors.push(`${label}.questionNumber phải là số nguyên trong 1..5.`);
      return;
    }
    if (answers.has(number)) errors.push(`questionNumber ${number} bị trùng.`);
    const person = people.find(candidate => candidate.key === key);
    if (!name || !person) errors.push(`${label}.name phải khớp duy nhất một người trong people.`);
    if (key === sampleKey) errors.push(`${label} không được dùng sample làm đáp án chấm điểm.`);
    if (key && answerKeys.has(key)) errors.push(`Đáp án "${name}" bị dùng cho nhiều câu.`);
    if (!answers.has(number) && person && key !== sampleKey && !answerKeys.has(key)) {
      answers.set(number, person);
      answerKeys.add(key);
    }
  });
  for (let number = 1; number <= 5; number += 1) {
    if (!answers.has(number)) errors.push(`Thiếu đáp án hợp lệ cho questionNumber ${number}.`);
  }

  const distractorName = cleanText(raw.distractor);
  const distractorKey = comparable(distractorName);
  const distractorPerson = people.find(person => person.key === distractorKey);
  if (!distractorName || !distractorPerson) errors.push('distractor phải khớp duy nhất một người trong people.');
  if (distractorKey === sampleKey) errors.push('distractor không được trùng sample.');
  if (answerKeys.has(distractorKey)) errors.push('distractor không được đồng thời là đáp án chấm điểm.');

  const expectedDistractors = people.filter(person => person.key !== sampleKey && !answerKeys.has(person.key));
  if (expectedDistractors.length !== 1) {
    errors.push(`Sau khi loại sample và 5 đáp án phải còn đúng 1 tên nhiễu; hiện còn ${expectedDistractors.length}.`);
  } else if (distractorPerson && expectedDistractors[0].key !== distractorPerson.key) {
    errors.push(`distractor phải là "${expectedDistractors[0].name}" theo set difference.`);
  }

  if (errors.length) throw new Part1ExternalImportError(errors);

  const orderedAnswers = ([1, 2, 3, 4, 5] as const).map(number => ({ number, person: answers.get(number)! }));
  const distractor = distractorPerson!;
  return {
    data: {
      part: 1,
      choices: [...orderedAnswers.map(answer => answer.person.name), distractor.name],
      anchors: orderedAnswers.map(answer => ({
        targetNumber: answer.number,
        label: answer.person.name,
        region: fixedRegionFromPoint(answer.person.point),
        confidence: 1,
      })),
      targetChoiceLabels: orderedAnswers.map(answer => answer.person.name),
      example: {
        label: samplePerson!.name,
        region: fixedRegionFromPoint(samplePerson!.point),
      },
    },
    warnings,
  };
}
