import type {
  ListeningAnswers,
  ListeningPart1,
  ListeningPart2,
  ListeningPart3,
  ListeningPart4,
  ListeningPart5,
  ListeningRegion,
  ListeningSetContent,
} from '../../features/listening/types.js';

const isText = (value: unknown, max = 500) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

const unique = (values: string[]) => new Set(values).size === values.length;

function validateRegion(region: ListeningRegion | undefined, path: string, errors: string[]) {
  if (!region || !['rect', 'ellipse', 'polygon'].includes(region.shape)) {
    errors.push(`${path}: vùng tương tác không hợp lệ.`);
    return;
  }
  for (const [key, value] of Object.entries({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors.push(`${path}.${key}: phải nằm trong khoảng 0–1.`);
    }
  }
  if (region.width <= 0 || region.height <= 0 || region.x + region.width > 1 || region.y + region.height > 1) {
    errors.push(`${path}: vùng tương tác vượt ra ngoài hình.`);
  }
  if (region.shape === 'polygon') {
    if (!Array.isArray(region.points) || region.points.length < 3) {
      errors.push(`${path}: polygon cần ít nhất 3 điểm.`);
    } else {
      region.points.forEach((point, index) => {
        if (
          !Number.isFinite(point.x) || !Number.isFinite(point.y)
          || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1
        ) {
          errors.push(`${path}.points[${index}]: điểm phải nằm trong khoảng 0–1.`);
        }
      });
    }
  }
}

function regionsOverlap(a: ListeningRegion, b: ListeningRegion) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right - left > 0.01 && bottom - top > 0.01;
}

function validateRegionCollection(
  items: Array<{ id: string; region: ListeningRegion }>,
  path: string,
  errors: string[]
) {
  items.forEach((item, index) => validateRegion(item.region, `${path}[${index}].region`, errors));
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      if (regionsOverlap(items[first].region, items[second].region)) {
        errors.push(`${path}: vùng "${items[first].id}" chồng lên vùng "${items[second].id}".`);
      }
    }
  }
}

function validateBase(part: any, number: number, errors: string[]) {
  if (part?.schemaVersion !== undefined && part.schemaVersion !== 1) {
    errors.push(`Part ${number}: phiên bản cấu trúc không được hỗ trợ.`);
  }
  if (part?.part !== number) errors.push(`Part ${number}: sai loại Part.`);
  if (!isText(part?.title, 160)) errors.push(`Part ${number}: thiếu tiêu đề.`);
  if (!isText(part?.instruction, 1000)) errors.push(`Part ${number}: thiếu hướng dẫn.`);
  if (!isText(part?.audioAssetId, 160)) errors.push(`Part ${number}: cần đúng một file audio.`);
}

function validatePart1(part: ListeningPart1, errors: string[]) {
  validateBase(part, 1, errors);
  if (!isText(part.sceneAssetId, 160)) errors.push('Part 1: thiếu hình tình huống.');
  if (part.choices?.length !== 6) errors.push('Part 1: cần đúng 6 thẻ tên (5 đáp án và 1 nhiễu).');
  if (part.targets?.length !== 5) errors.push('Part 1: cần đúng 5 vùng chấm điểm.');
  const choiceIds = (part.choices || []).map(choice => choice.id);
  if (!unique(choiceIds) || (part.choices || []).some(choice => !isText(choice.id, 160) || !isText(choice.label, 120))) {
    errors.push('Part 1: ID và nhãn thẻ tên phải đầy đủ, không trùng.');
  }
  const targetIds = (part.targets || []).map(target => target.id);
  if (!unique(targetIds) || (part.targets || []).some(target => !choiceIds.includes(target.choiceId))) {
    errors.push('Part 1: vùng hoặc đáp án vùng không hợp lệ.');
  }
  validateRegionCollection(part.targets || [], 'Part 1 targets', errors);
  if (part.example) validateRegion(part.example.region, 'Part 1 example.region', errors);
}

function validatePart2(part: ListeningPart2, errors: string[]) {
  validateBase(part, 2, errors);
  if (!isText(part.heading, 200)) errors.push('Part 2: thiếu tiêu đề bài.');
  if (part.questions?.length !== 5) errors.push('Part 2: cần đúng 5 câu.');
  const ids = (part.questions || []).map(question => question.id);
  if (!unique(ids)) errors.push('Part 2: ID câu hỏi bị trùng.');
  (part.questions || []).forEach((question, index) => {
    if (!isText(question.prompt, 1000)) errors.push(`Part 2 câu ${index + 1}: thiếu nội dung.`);
    if (!question.blanks?.length) errors.push(`Part 2 câu ${index + 1}: cần ít nhất một ô trống.`);
    const blankIds = (question.blanks || []).map(blank => blank.id);
    if (!unique(blankIds)) errors.push(`Part 2 câu ${index + 1}: ID ô trống bị trùng.`);
    (question.blanks || []).forEach(blank => {
      if (!question.prompt.includes(`{{${blank.id}}}`)) {
        errors.push(`Part 2 câu ${index + 1}: nội dung thiếu ký hiệu {{${blank.id}}}.`);
      }
      if (!blank.acceptedAnswers?.length || blank.acceptedAnswers.some(answer => !isText(answer, 200))) {
        errors.push(`Part 2 câu ${index + 1}: mỗi ô trống cần ít nhất một đáp án.`);
      }
    });
  });
}

function validatePart3(part: ListeningPart3, errors: string[]) {
  validateBase(part, 3, errors);
  if (!['once', 'multiple'].includes(part.reuseMode)) errors.push('Part 3: chế độ dùng đáp án không hợp lệ.');
  if ((part.options || []).length < 5) errors.push('Part 3: cần ít nhất 5 lựa chọn hình ảnh.');
  if (part.items?.length !== 5) errors.push('Part 3: cần đúng 5 câu.');
  const optionIds = (part.options || []).map(option => option.id);
  if (!unique(optionIds)) errors.push('Part 3: ID lựa chọn bị trùng.');
  if ((part.options || []).some(option => !isText(option.imageAssetId, 160))) {
    errors.push('Part 3: mọi lựa chọn cần hình ảnh.');
  }
  const answers = (part.items || []).map(item => item.correctOptionId);
  if ((part.items || []).some(item => !isText(item.imageAssetId, 160) || !optionIds.includes(item.correctOptionId))) {
    errors.push('Part 3: câu hỏi hoặc đáp án hình ảnh không hợp lệ.');
  }
  if (part.reuseMode === 'once' && !unique(answers)) {
    errors.push('Part 3: mỗi lựa chọn chỉ được dùng một lần.');
  }
}

function validatePart4(part: ListeningPart4, errors: string[]) {
  validateBase(part, 4, errors);
  if (part.questions?.length !== 5) errors.push('Part 4: cần đúng 5 câu.');
  (part.questions || []).forEach((question, index) => {
    if (!isText(question.prompt, 1000)) errors.push(`Part 4 câu ${index + 1}: thiếu nội dung.`);
    if (question.options?.length !== 3) errors.push(`Part 4 câu ${index + 1}: cần đúng 3 lựa chọn.`);
    const optionIds = (question.options || []).map(option => option.id);
    if (!unique(optionIds) || !optionIds.includes(question.correctOptionId)) {
      errors.push(`Part 4 câu ${index + 1}: lựa chọn hoặc đáp án đúng không hợp lệ.`);
    }
    if ((question.options || []).some(option => !isText(option.imageAssetId, 160))) {
      errors.push(`Part 4 câu ${index + 1}: mọi lựa chọn cần hình ảnh.`);
    }
  });
}

function validatePart5(part: ListeningPart5, errors: string[]) {
  validateBase(part, 5, errors);
  if (!isText(part.sceneAssetId, 160)) errors.push('Part 5: thiếu tranh tô màu.');
  if (part.colours?.length !== 6) errors.push('Part 5: cần đúng 6 màu (5 đáp án và 1 nhiễu).');
  if (part.targets?.length !== 5) errors.push('Part 5: cần đúng 5 vùng chấm điểm.');
  const colourIds = (part.colours || []).map(colour => colour.id);
  if (!unique(colourIds) || (part.colours || []).some(colour => !/^#[0-9a-f]{6}$/i.test(colour.value))) {
    errors.push('Part 5: màu phải có ID riêng và mã #RRGGBB hợp lệ.');
  }
  if ((part.targets || []).some(target => !colourIds.includes(target.correctColourId))) {
    errors.push('Part 5: vùng có đáp án màu không hợp lệ.');
  }
  validateRegionCollection(part.targets || [], 'Part 5 targets', errors);
  if (part.example) validateRegion(part.example.region, 'Part 5 example.region', errors);
}

export function validateListeningSetContent(content: ListeningSetContent) {
  const errors: string[] = [];
  if (content?.moduleId !== undefined && content.moduleId !== 'mover') {
    errors.push('Bộ đề không thuộc module Mover.');
  }
  if (!content || content.schemaVersion !== 1) errors.push('Phiên bản cấu trúc bộ đề không được hỗ trợ.');
  if (!isText(content?.title, 160)) errors.push('Thiếu tên bộ đề.');
  if (!isText(content?.description, 2000)) errors.push('Thiếu mô tả bộ đề.');
  if (!isText(content?.level, 80)) errors.push('Thiếu trình độ.');
  if (
    content?.timeLimitMinutes !== undefined
    && (!Number.isInteger(content.timeLimitMinutes) || content.timeLimitMinutes < 1 || content.timeLimitMinutes > 180)
  ) {
    errors.push('Thời gian làm bài phải từ 1 đến 180 phút.');
  }
  if (!Array.isArray(content?.parts) || content.parts.length !== 5) {
    errors.push('Bộ đề phải có đúng 5 Part.');
    return errors;
  }
  validatePart1(content.parts[0], errors);
  validatePart2(content.parts[1], errors);
  validatePart3(content.parts[2], errors);
  validatePart4(content.parts[3], errors);
  validatePart5(content.parts[4], errors);
  return errors;
}

export function sanitizeListeningAnswers(value: unknown): ListeningAnswers {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const record = (input: unknown, nested = false): any => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const entries = Object.entries(input as Record<string, unknown>).slice(0, 100);
    return Object.fromEntries(entries
      .filter(([key]) => /^[a-zA-Z0-9_-]{1,160}$/.test(key))
      .map(([key, answer]) => [
        key,
        nested ? record(answer, false) : String(answer ?? '').slice(0, 500),
      ]));
  };
  return {
    part1: record(source.part1),
    part2: record(source.part2, true),
    part3: record(source.part3),
    part4: record(source.part4),
    part5: record(source.part5),
  };
}

export function sanitizeListeningContentForStudent(content: ListeningSetContent): ListeningSetContent {
  const copy = structuredClone(content) as any;
  copy.parts[0].targets = copy.parts[0].targets.map(({ choiceId: _answer, ...target }: any) => target);
  if (copy.parts[0].example) delete copy.parts[0].example.choiceId;
  copy.parts[1].questions = copy.parts[1].questions.map((question: any) => ({
    ...question,
    blanks: question.blanks.map(({ acceptedAnswers: _answers, ...blank }: any) => blank),
  }));
  copy.parts[2].items = copy.parts[2].items.map(({ correctOptionId: _answer, ...item }: any) => item);
  if (copy.parts[2].example) delete copy.parts[2].example.correctOptionId;
  copy.parts[3].questions = copy.parts[3].questions.map(({ correctOptionId: _answer, ...question }: any) => question);
  if (copy.parts[3].example) delete copy.parts[3].example.correctOptionId;
  copy.parts[4].targets = copy.parts[4].targets.map(({ correctColourId: _answer, ...target }: any) => target);
  if (copy.parts[4].example) delete copy.parts[4].example.correctColourId;
  return copy;
}
