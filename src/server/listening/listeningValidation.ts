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
import { isValidListeningRegion } from '../../features/listening/geometry.js';

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
  if (region && !isValidListeningRegion(region)) {
    errors.push(`${path}: hình học rỗng, tự cắt hoặc không hợp lệ.`);
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
  if (part.displayMode === 'connect-image') {
    if (!isText(part.boardAssetId, 160)) errors.push('Part 3: thiếu ảnh đề bài kết nối.');
    if (part.connectionSchemaVersion !== 1) errors.push('Part 3: phiên bản kết nối không được hỗ trợ.');
    if (part.answers?.length !== 7) errors.push('Part 3: cần đúng 7 answer ở giữa, gồm example, 5 đáp án và 1 nhiễu.');
    if (part.pictures?.length !== 6) errors.push('Part 3: cần đúng 6 picture, ba bên trái và ba bên phải.');
    const answerIds = (part.answers || []).map(answer => answer.id);
    const pictureIds = (part.pictures || []).map(picture => picture.id);
    if (!unique(answerIds) || (part.answers || []).some(answer => !isText(answer.id, 160) || !isText(answer.label, 120))) {
      errors.push('Part 3: answer ID/label phải đầy đủ và không trùng.');
    }
    if (!unique(pictureIds)) errors.push('Part 3: picture ID bị trùng.');
    const pictureSlots = (part.pictures || []).map(picture => `${picture.side}:${picture.row}`);
    if (!unique(pictureSlots) || (part.pictures || []).some(picture => !['left', 'right'].includes(picture.side) || ![1, 2, 3].includes(picture.row))) {
      errors.push('Part 3: picture phải nằm đúng ba hàng bên trái và ba hàng bên phải.');
    }
    if ((part.answers || []).some(answer => answer.leftAnchorOffset < 0 || answer.leftAnchorOffset > 1 || answer.rightAnchorOffset < 0 || answer.rightAnchorOffset > 1)) {
      errors.push('Part 3: anchor answer phải được giới hạn trên đúng cạnh.');
    }
    if ((part.pictures || []).some(picture => picture.anchorOffset < 0 || picture.anchorOffset > 1)) {
      errors.push('Part 3: anchor picture phải được giới hạn trên đúng cạnh.');
    }
    validateRegionCollection(part.answers || [], 'Part 3 answers', errors);
    validateRegionCollection(part.pictures || [], 'Part 3 pictures', errors);
    const example = part.exampleConnection;
    if (!example || !answerIds.includes(example.answerId) || !pictureIds.includes(example.pictureId)) {
      errors.push('Part 3: example connection không hợp lệ.');
    }
    const mappings = part.correctConnections || [];
    if (mappings.length !== 5) errors.push('Part 3: cần đúng 5 connection được chấm điểm.');
    if (
      !unique(mappings.map(item => item.answerId))
      || !unique(mappings.map(item => item.pictureId))
      || mappings.some(item => !answerIds.includes(item.answerId) || !pictureIds.includes(item.pictureId))
      || mappings.some(item => item.answerId === example?.answerId || item.pictureId === example?.pictureId)
    ) {
      errors.push('Part 3: mapping chấm điểm bị trùng, tham chiếu sai hoặc dùng lại example.');
    }
    const unusedAnswers = answerIds.filter(id => id !== example?.answerId && !mappings.some(item => item.answerId === id));
    if (unusedAnswers.length !== 1 || unusedAnswers[0] !== part.distractorAnswerId) {
      errors.push('Part 3: phải có đúng một answer nhiễu không được nối.');
    }
    return;
  }
  const composite = part.displayMode === 'composite';
  if (!['once', 'multiple'].includes(part.reuseMode)) errors.push('Part 3: chế độ dùng đáp án không hợp lệ.');
  if (composite && (part.options || []).length !== 6) errors.push('Part 3: bảng tổng hợp cần đúng 6 lựa chọn A–F.');
  if (!composite && (part.options || []).length < 5) errors.push('Part 3: cần ít nhất 5 lựa chọn hình ảnh.');
  if (part.items?.length !== 5) errors.push('Part 3: cần đúng 5 câu.');
  if (composite && !isText(part.boardAssetId, 160)) errors.push('Part 3: thiếu ảnh bảng A–F tổng hợp.');
  const optionIds = (part.options || []).map(option => option.id);
  if (!unique(optionIds)) errors.push('Part 3: ID lựa chọn bị trùng.');
  if (!composite && (part.options || []).some(option => !isText(option.imageAssetId, 160))) {
    errors.push('Part 3: mọi lựa chọn cần hình ảnh.');
  }
  const answers = (part.items || []).map(item => item.correctOptionId);
  if ((part.items || []).some(item => (!composite && !isText(item.imageAssetId, 160)) || !optionIds.includes(item.correctOptionId))) {
    errors.push('Part 3: câu hỏi hoặc đáp án hình ảnh không hợp lệ.');
  }
  if (part.reuseMode === 'once' && !unique(answers)) {
    errors.push('Part 3: mỗi lựa chọn chỉ được dùng một lần.');
  }
}

function validatePart4(part: ListeningPart4, errors: string[]) {
  validateBase(part, 4, errors);
  if (part.questions?.length !== 5) errors.push('Part 4: cần đúng 5 câu.');
  const validateQuestion = (
    question: ListeningPart4['questions'][number],
    label: string
  ) => {
    if (!isText(question.prompt, 1000)) errors.push(`${label}: thiếu nội dung.`);
    if (question.options?.length !== 3) errors.push(`${label}: cần đúng 3 lựa chọn.`);
    const optionIds = (question.options || []).map(option => option.id);
    if (!unique(optionIds) || !optionIds.includes(question.correctOptionId)) {
      errors.push(`${label}: lựa chọn hoặc đáp án đúng không hợp lệ.`);
    }
    if ((question.options || []).some(option => !isText(option.id, 160) || !isText(option.imageAssetId, 160))) {
      errors.push(`${label}: mọi lựa chọn cần ID và hình ảnh.`);
    }
  };
  (part.questions || []).forEach((question, index) => {
    validateQuestion(question, `Part 4 câu ${index + 1}`);
  });
  if (part.example) validateQuestion(part.example, 'Part 4 example');
}

function validatePart5(part: ListeningPart5, errors: string[]) {
  validateBase(part, 5, errors);
  if (part.displayMode === 'scene-colour-draw') {
    if (!isText(part.sceneAssetId, 160)) errors.push('Part 5: thiếu tranh tương tác.');
    if (![1, 2].includes(part.interactionSchemaVersion)) errors.push('Part 5: phiên bản tương tác không được hỗ trợ.');
    if (part.colours?.length !== 20) errors.push('Part 5: palette màu cần đủ 20 màu chuẩn.');
    const colourIds = (part.colours || []).map(colour => colour.id);
    if (!unique(colourIds) || (part.colours || []).some(colour => !/^#[0-9a-f]{6}$/i.test(colour.value))) {
      errors.push('Part 5: màu phải có ID riêng và mã #RRGGBB hợp lệ.');
    }
    const studentColourIds = part.interactionSchemaVersion === 2 ? (part.colourPaletteIds || []) : colourIds;
    if (part.interactionSchemaVersion === 2 && (
      studentColourIds.length !== 6
      || !unique(studentColourIds)
      || studentColourIds.some(id => !colourIds.includes(id))
    )) errors.push('Part 5: palette học sinh cần đúng 6 màu hợp lệ, không trùng (gồm màu nhiễu).');
    if (part.questions?.length !== 5 || !unique((part.questions || []).map(question => String(question.questionNumber)))) {
      errors.push('Part 5: cần đúng 5 câu có questionNumber 1–5 không trùng.');
    }
    const objectIds = (part.interactiveObjects || []).map(object => object.id);
    const paletteIds = (part.objectPalette || []).map(item => item.id);
    if (!unique(objectIds) || !unique(paletteIds)) errors.push('Part 5: ID object/palette bị trùng.');
    if (part.interactionSchemaVersion === 2 && (
      paletteIds.length !== 3
      || part.objectPalette.some(item => !isText(item.label, 160) || !isText(item.tokenAssetId, 160))
    )) errors.push('Part 5: Draw cần đúng 3 icon PNG đã upload (2 lựa chọn làm bài và 1 nhiễu).');
    (part.interactiveObjects || []).forEach((object, index) => {
      validateRegion(object.geometry, `Part 5 interactiveObjects[${index}].geometry`, errors);
      if (part.interactionSchemaVersion === 2 && object.geometryConfirmedByTeacher !== true) {
        errors.push(`Part 5 interactiveObjects[${index}]: giáo viên chưa xác nhận mask Colour.`);
      }
    });
    const actionIds = (part.questions || []).flatMap(question => (question.actions || []).map(action => action.id));
    if (!unique(actionIds)) errors.push('Part 5: action ID bị trùng.');
    if (part.interactionSchemaVersion === 1 && (part.questions || []).some(question => question.actions?.some(action => action.type === 'colour_object')) && objectIds.length < 2) {
      errors.push('Part 5: colour_object cần ít nhất hai public object để geometry không trở thành gợi ý đáp án.');
    }
    (part.questions || []).forEach((question, questionIndex) => {
      if (!isText(question.staffPrompt, 1000)) errors.push(`Part 5 câu ${questionIndex + 1}: thiếu nội dung.`);
      if (!question.actions?.length) errors.push(`Part 5 câu ${questionIndex + 1}: cần ít nhất một action.`);
      question.actions?.forEach((action, actionIndex) => {
        if (action.type === 'colour_object') {
          if (!objectIds.includes(action.correctObjectId) || !colourIds.includes(action.correctColourId) || !studentColourIds.includes(action.correctColourId)) {
            errors.push(`Part 5 câu ${questionIndex + 1}, action ${actionIndex + 1}: object/màu đúng không hợp lệ.`);
          }
        } else {
          if (!paletteIds.includes(action.correctPaletteItemId)) {
            errors.push(`Part 5 câu ${questionIndex + 1}, action ${actionIndex + 1}: object đặt không hợp lệ.`);
          }
          validateRegion(action.targetRegion, `Part 5 questions[${questionIndex}].actions[${actionIndex}].targetRegion`, errors);
          if (part.interactionSchemaVersion === 2 && action.geometryConfirmedByTeacher !== true) {
            errors.push(`Part 5 câu ${questionIndex + 1}, action ${actionIndex + 1}: giáo viên chưa xác nhận drop-zone Draw.`);
          }
          const correctItem = part.objectPalette.find(item => item.id === action.correctPaletteItemId);
          if (part.interactionSchemaVersion === 1 && (!correctItem || !part.objectPalette.some(item => item.id !== correctItem.id && item.objectType === correctItem.objectType))) {
            errors.push(`Part 5 câu ${questionIndex + 1}: place_object cần ít nhất một lựa chọn nhiễu cùng loại.`);
          }
        }
      });
    });
    if (part.interactionSchemaVersion === 2) {
      const usedColourIds = new Set(part.questions.flatMap(question => question.actions.flatMap(action => action.type === 'colour_object' ? [action.correctColourId] : [])));
      const usedPaletteIds = new Set(part.questions.flatMap(question => question.actions.flatMap(action => action.type === 'place_object' ? [action.correctPaletteItemId] : [])));
      if (!studentColourIds.some(id => !usedColourIds.has(id))) errors.push('Part 5: palette màu cần ít nhất một màu nhiễu không phải đáp án.');
      if (!paletteIds.some(id => !usedPaletteIds.has(id))) errors.push('Part 5: object palette cần ít nhất một icon nhiễu không phải đáp án.');
    }
    return;
  }
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
  const part5Record = (input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const sanitized: Record<string, any> = {};
    Object.entries(input as Record<string, unknown>).slice(0, 100).forEach(([key, rawAnswer]) => {
        if (!/^[a-zA-Z0-9_-]{1,160}$/.test(key)) return;
        if (typeof rawAnswer === 'string') {
          sanitized[key] = rawAnswer.slice(0, 500);
          return;
        }
        if (!rawAnswer || typeof rawAnswer !== 'object' || Array.isArray(rawAnswer)) return;
        const answer = rawAnswer as Record<string, unknown>;
        if (answer.type === 'colour_object') {
          const objectId = String(answer.objectId ?? '').slice(0, 160);
          const colourId = String(answer.colourId ?? '').slice(0, 160);
          if (/^[a-zA-Z0-9_-]{1,160}$/.test(objectId) && /^[a-zA-Z0-9_-]{1,160}$/.test(colourId)) {
            sanitized[key] = { type: 'colour_object', objectId, colourId };
          }
          return;
        }
        if (answer.type === 'place_object') {
          const paletteItemId = String(answer.paletteItemId ?? '').slice(0, 160);
          const anchor = answer.anchor && typeof answer.anchor === 'object' && !Array.isArray(answer.anchor)
            ? answer.anchor as Record<string, unknown>
            : {};
          const x = Number(anchor.x);
          const y = Number(anchor.y);
          if (/^[a-zA-Z0-9_-]{1,160}$/.test(paletteItemId)
            && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
            sanitized[key] = { type: 'place_object', paletteItemId, anchor: { x, y } };
          }
        }
      });
    return sanitized;
  };
  return {
    part1: record(source.part1),
    part2: record(source.part2, true),
    part3: record(source.part3),
    part4: record(source.part4),
    part5: part5Record(source.part5),
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
  if (copy.parts[2].displayMode === 'connect-image') {
    delete copy.parts[2].correctConnections;
    delete copy.parts[2].distractorAnswerId;
  } else {
    copy.parts[2].items = copy.parts[2].items.map(({ correctOptionId: _answer, ...item }: any) => item);
    if (copy.parts[2].example) delete copy.parts[2].example.correctOptionId;
  }
  copy.parts[3].questions = copy.parts[3].questions.map(({ correctOptionId: _answer, ...question }: any) => question);
  const part5 = copy.parts[4];
  if (part5.displayMode === 'scene-colour-draw') {
    if (part5.interactionSchemaVersion === 2) {
      const publicColourIds = new Set(part5.colourPaletteIds || []);
      part5.colours = part5.colours.filter((colour: any) => publicColourIds.has(colour.id));
    }
    part5.interactiveObjects = part5.interactiveObjects.map(({ geometryConfirmedByTeacher: _confirmed, ...object }: any) => object);
    part5.questions = part5.questions.map((question: any) => ({
      id: question.id,
      questionNumber: question.questionNumber,
      actions: question.actions.map((action: any) => ({ id: action.id, type: action.type })),
    }));
  } else {
    part5.targets = part5.targets.map(({ correctColourId: _answer, ...target }: any) => target);
    if (part5.example) delete part5.example.correctColourId;
  }
  return copy;
}
