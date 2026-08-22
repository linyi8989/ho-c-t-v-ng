import type {
  MoverReadingWritingAnswers,
  MoverReadingWritingChoiceQuestion,
  MoverReadingWritingContent,
} from '../../features/mover-reading-writing/types.js';
import {
  MOVER_READING_WRITING_PAPER_ID,
} from '../../features/mover-reading-writing/types.js';
import {
  isSupportedMoverReadingWritingSchemaVersion,
  normalizeMoverReadingWritingContent,
} from '../../features/mover-reading-writing/compatibility.js';

const nonEmptyText = (value: unknown, max = 1000) => (
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
);
const unique = (values: string[]) => values.length === new Set(values).size;
const normalizedWordCount = (value: string) => value.normalize('NFKC').trim().split(/\s+/).filter(Boolean).length;
const templateText = (value: string) => value.replace(/\{\{[^}]+\}\}/g, '').trim();
const markerCount = (template: string, id: string) => template.split(`{{${id}}}`).length - 1;

function validateTextAnswers(
  acceptedAnswers: unknown,
  label: string,
  errors: string[],
  maxWords?: number,
) {
  if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length < 1 || acceptedAnswers.length > 20) {
    errors.push(`${label}: cần từ 1 đến 20 đáp án chấp nhận.`);
    return;
  }
  if (acceptedAnswers.some(answer => !nonEmptyText(answer, 200))) {
    errors.push(`${label}: đáp án chấp nhận không được để trống và tối đa 200 ký tự.`);
  }
  if (maxWords && acceptedAnswers.some(answer => normalizedWordCount(String(answer)) > maxWords)) {
    errors.push(`${label}: mỗi đáp án tối đa ${maxWords} từ.`);
  }
}

function validateChoiceQuestion(
  question: MoverReadingWritingChoiceQuestion | undefined,
  label: string,
  errors: string[],
) {
  if (!question || !nonEmptyText(question.id, 160)) {
    errors.push(`${label}: thiếu ID câu hỏi.`);
    return;
  }
  if (!nonEmptyText(question.prompt, 1000)) errors.push(`${label}: thiếu nội dung câu hỏi.`);
  if (!Array.isArray(question.options) || question.options.length !== 3) {
    errors.push(`${label}: cần đúng 3 lựa chọn.`);
    return;
  }
  const optionIds = question.options.map(option => option.id);
  if (!unique(optionIds) || question.options.some(option => !nonEmptyText(option.id, 160) || !nonEmptyText(option.text, 500))) {
    errors.push(`${label}: ba lựa chọn phải có ID riêng và nội dung đầy đủ.`);
  }
  if (!optionIds.includes(question.correctOptionId)) errors.push(`${label}: đáp án đúng phải thuộc ba lựa chọn.`);
}

export function validateMoverReadingWritingContent(input: MoverReadingWritingContent) {
  const errors: string[] = [];
  if (!input || !isSupportedMoverReadingWritingSchemaVersion(input.schemaVersion)) {
    return ['Phiên bản cấu trúc Reading & Writing không được hỗ trợ.'];
  }
  let content: MoverReadingWritingContent;
  try { content = normalizeMoverReadingWritingContent(input); }
  catch (error: any) { return [error?.message || 'Cấu trúc Reading & Writing không hợp lệ.']; }
  if (content.moduleId !== 'mover' || content.paperId !== MOVER_READING_WRITING_PAPER_ID) {
    errors.push('Bộ đề phải thuộc Mover / Reading & Writing.');
  }
  if (!nonEmptyText(content.title, 160)) errors.push('Thiếu tên bộ đề.');
  if (typeof content.description !== 'string' || content.description.length > 2000) errors.push('Mô tả tối đa 2.000 ký tự.');
  if (!nonEmptyText(content.level, 80)) errors.push('Thiếu trình độ.');
  if (content.timeLimitMinutes !== undefined && (!Number.isInteger(content.timeLimitMinutes) || content.timeLimitMinutes < 1 || content.timeLimitMinutes > 300)) {
    errors.push('Giới hạn thời gian phải từ 1 đến 300 phút.');
  }
  if (!Array.isArray(content.parts) || content.parts.length !== 6) return [...errors, 'Reading & Writing cần đúng 6 Part.'];
  content.parts.forEach((part, index) => {
    if (part?.part !== index + 1) errors.push(`Part ${index + 1}: sai thứ tự hoặc loại Part.`);
    if (!nonEmptyText(part?.title, 160)) errors.push(`Part ${index + 1}: thiếu tiêu đề.`);
    if (!nonEmptyText(part?.instruction, 1000)) errors.push(`Part ${index + 1}: thiếu hướng dẫn.`);
  });

  const part1 = content.parts[0];
  if (!nonEmptyText(part1.wordBankAssetId, 160)) errors.push('Part 1: thiếu ảnh ngân hàng từ.');
  if (part1.questions?.length !== 6) errors.push('Part 1: cần đúng 6 câu.');
  if (!unique((part1.questions || []).map(question => question.id))) errors.push('Part 1: ID câu hỏi bị trùng.');
  (part1.questions || []).forEach((question, index) => {
    if (!nonEmptyText(question.id, 160) || !nonEmptyText(templateText(question.prompt), 1000)) errors.push(`Part 1 câu ${index + 1}: thiếu ID hoặc nội dung.`);
    if (markerCount(question.prompt, question.id) !== 1 || /\[\[[^\]]+\]\]/.test(question.prompt)) errors.push(`Part 1 câu ${index + 1}: nội dung phải có đúng một marker ô trả lời.`);
    validateTextAnswers(question.acceptedAnswers, `Part 1 câu ${index + 1}`, errors);
  });

  const part2 = content.parts[1];
  if (!nonEmptyText(part2.sceneAssetId, 160)) errors.push('Part 2: thiếu ảnh tình huống.');
  if (part2.questions?.length !== 6) errors.push('Part 2: cần đúng 6 câu.');
  if (!unique((part2.questions || []).map(question => question.id))) errors.push('Part 2: ID câu hỏi bị trùng.');
  (part2.questions || []).forEach((question, index) => {
    if (!nonEmptyText(question.id, 160) || !nonEmptyText(question.statement, 1000)) errors.push(`Part 2 câu ${index + 1}: thiếu ID hoặc nhận định.`);
    if (!['yes', 'no'].includes(question.correctAnswer)) errors.push(`Part 2 câu ${index + 1}: đáp án phải là yes hoặc no.`);
  });

  const part3 = content.parts[2];
  if (!nonEmptyText(part3.sceneAssetId, 160)) errors.push('Part 3: thiếu ảnh hội thoại.');
  if (part3.questions?.length !== 6) errors.push('Part 3: cần đúng 6 câu.');
  if (!unique((part3.questions || []).map(question => question.id))) errors.push('Part 3: ID câu hỏi bị trùng.');
  (part3.questions || []).forEach((question, index) => validateChoiceQuestion(question, `Part 3 câu ${index + 1}`, errors));

  const part4 = content.parts[3];
  if (!nonEmptyText(part4.wordBankAssetId, 160)) errors.push('Part 4: thiếu ảnh ngân hàng từ.');
  if (!nonEmptyText(part4.storyTemplate, 20_000)) errors.push('Part 4: thiếu nội dung câu chuyện.');
  if (part4.gaps?.length !== 6) errors.push('Part 4: cần đúng 6 chỗ trống.');
  if (!unique((part4.gaps || []).map(gap => gap.id))) errors.push('Part 4: ID chỗ trống bị trùng.');
  (part4.gaps || []).forEach((gap, index) => {
    if (!nonEmptyText(gap.id, 160) || !part4.storyTemplate.includes(`{{${gap.id}}}`)) errors.push(`Part 4 chỗ trống ${index + 1}: nội dung truyện thiếu token tương ứng.`);
    validateTextAnswers(gap.acceptedAnswers, `Part 4 chỗ trống ${index + 1}`, errors);
  });
  validateChoiceQuestion(part4.titleQuestion, 'Part 4 câu chọn tiêu đề', errors);

  const part5 = content.parts[4];
  if (!Array.isArray(part5.scenes) || part5.scenes.length !== 3) errors.push('Part 5: cần đúng 3 nhóm tranh và câu chuyện.');
  const part5Questions = (part5.scenes || []).flatMap(scene => scene.questions || []);
  if (part5Questions.length !== 10) errors.push('Part 5: ba nhóm cần tổng cộng đúng 10 câu.');
  if (!unique(part5Questions.map(question => question.id))) errors.push('Part 5: ID câu hỏi bị trùng.');
  (part5.scenes || []).forEach((scene, sceneIndex) => {
    if (!nonEmptyText(scene.id, 160) || !nonEmptyText(scene.imageAssetId, 160)) errors.push(`Part 5 tranh ${sceneIndex + 1}: thiếu ID hoặc ảnh.`);
    if (!nonEmptyText(scene.passage, 10_000)) errors.push(`Part 5 tranh ${sceneIndex + 1}: thiếu nội dung câu chuyện.`);
    if (!scene.questions?.length) errors.push(`Part 5 tranh ${sceneIndex + 1}: cần ít nhất một câu hỏi.`);
    (scene.questions || []).forEach((question, questionIndex) => {
      if (!nonEmptyText(question.id, 160) || !nonEmptyText(templateText(question.prompt), 1000)) errors.push(`Part 5 tranh ${sceneIndex + 1}, câu ${questionIndex + 1}: thiếu ID hoặc nội dung.`);
      if (markerCount(question.prompt, question.id) !== 1 || /\[\[[^\]]+\]\]/.test(question.prompt)) errors.push(`Part 5 tranh ${sceneIndex + 1}, câu ${questionIndex + 1}: nội dung phải có đúng một marker ô trả lời.`);
      validateTextAnswers(question.acceptedAnswers, `Part 5 tranh ${sceneIndex + 1}, câu ${questionIndex + 1}`, errors, 3);
    });
  });

  const part6 = content.parts[5];
  if (!nonEmptyText(part6.illustrationAssetId, 160)) errors.push('Part 6: thiếu ảnh bài đọc đã crop để hiển thị.');
  if (!nonEmptyText(part6.optionsAssetId, 160)) errors.push('Part 6: thiếu ảnh bảng lựa chọn.');
  if (!nonEmptyText(part6.passageTitle, 300)) errors.push('Part 6: thiếu tiêu đề bài đọc.');
  if (!nonEmptyText(part6.passageTemplate, 20_000)) errors.push('Part 6: thiếu nội dung bài đọc.');
  if (/\[\[[^\]]+\]\]/.test(part6.passageTemplate || '')) errors.push('Part 6: bài đọc còn marker Smart Import chưa được chuẩn hóa.');
  if (part6.gaps?.length !== 5) errors.push('Part 6: cần đúng 5 chỗ trống.');
  if (!unique((part6.gaps || []).map(gap => gap.id))) errors.push('Part 6: ID chỗ trống bị trùng.');
  (part6.gaps || []).forEach((gap, index) => {
    if (!nonEmptyText(gap.id, 160)) errors.push(`Part 6 chỗ trống ${index + 1}: thiếu ID.`);
    validateTextAnswers(gap.acceptedAnswers, `Part 6 chỗ trống ${index + 1}`, errors, 1);
    if (!part6.passageTemplate.includes(`{{${gap.id}}}`)) errors.push(`Part 6 chỗ trống ${index + 1}: bài đọc thiếu token {{${gap.id}}}.`);
  });
  return errors;
}

export function sanitizeMoverReadingWritingContentForStudent(content: MoverReadingWritingContent) {
  const clone: any = normalizeMoverReadingWritingContent(content);
  clone.parts[0].questions.forEach((question: any) => delete question.acceptedAnswers);
  clone.parts[1].questions.forEach((question: any) => delete question.correctAnswer);
  clone.parts[2].questions.forEach((question: any) => delete question.correctOptionId);
  clone.parts[3].gaps.forEach((gap: any) => delete gap.acceptedAnswers);
  delete clone.parts[3].titleQuestion.correctOptionId;
  clone.parts[4].scenes.forEach((scene: any) => scene.questions.forEach((question: any) => delete question.acceptedAnswers));
  delete clone.parts[5].passageSourceAssetId;
  delete clone.parts[5].passageSourceUrl;
  clone.parts[5].gaps.forEach((gap: any) => delete gap.acceptedAnswers);
  return clone as MoverReadingWritingContent;
}

const safeAnswer = (value: unknown) => typeof value === 'string' ? value.normalize('NFKC').slice(0, 300) : '';

export function sanitizeMoverReadingWritingAnswers(
  inputContent: MoverReadingWritingContent,
  input: unknown,
): MoverReadingWritingAnswers {
  const content = normalizeMoverReadingWritingContent(inputContent);
  const raw = input && typeof input === 'object' ? input as any : {};
  const answers: MoverReadingWritingAnswers = {
    part1: {}, part2: {}, part3: {}, part4: { gaps: {}, titleOptionId: '' }, part5: {}, part6: {},
  };
  content.parts[0].questions.forEach(question => { answers.part1[question.id] = safeAnswer(raw.part1?.[question.id]); });
  content.parts[1].questions.forEach(question => {
    const value = safeAnswer(raw.part2?.[question.id]).toLowerCase();
    answers.part2[question.id] = value === 'yes' || value === 'no' ? value : '';
  });
  content.parts[2].questions.forEach(question => {
    const value = safeAnswer(raw.part3?.[question.id]);
    answers.part3[question.id] = question.options.some(option => option.id === value) ? value : '';
  });
  content.parts[3].gaps.forEach(gap => { answers.part4.gaps[gap.id] = safeAnswer(raw.part4?.gaps?.[gap.id]); });
  const titleOptionId = safeAnswer(raw.part4?.titleOptionId);
  answers.part4.titleOptionId = content.parts[3].titleQuestion.options.some(option => option.id === titleOptionId) ? titleOptionId : '';
  content.parts[4].scenes.forEach(scene => scene.questions.forEach(question => { answers.part5[question.id] = safeAnswer(raw.part5?.[question.id]); }));
  content.parts[5].gaps.forEach(gap => {
    answers.part6[gap.id] = safeAnswer(raw.part6?.[gap.id]);
  });
  return answers;
}
