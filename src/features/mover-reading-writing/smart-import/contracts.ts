import type {
  MoverReadingWritingImportChoiceQuestion,
  MoverReadingWritingImportExample,
  MoverReadingWritingImportTextQuestion,
  MoverReadingWritingSmartImportData,
  MoverReadingWritingSmartImportPartId,
} from './types';

export const MOVER_READING_WRITING_EXTERNAL_PROVIDER = 'external-parameters';

const schemaId = (part: MoverReadingWritingSmartImportPartId) => (
  `mover-rw-part${part}-external-v${part === 1 || part === 5 || part === 6 ? 2 : 1}`
);
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value: unknown, max = 20_000) => typeof value === 'string'
  ? value.normalize('NFKC').replace(/\r\n?/g, '\n').trim().slice(0, max)
  : '';

function fail(message: string): never {
  const error: any = new Error(message);
  error.status = 400;
  throw error;
}

function objectAt(value: unknown, label: string) {
  if (!isObject(value)) fail(`${label} phải là object JSON.`);
  return value;
}

function assertKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) fail(`${label} có trường không được hỗ trợ: ${extras.join(', ')}.`);
  if (Object.keys(value).some(key => /(^id$|Id$|uuid|database|technical)/i.test(key))) {
    fail(`${label} không được chứa ID kỹ thuật.`);
  }
}

function arrayAt(value: unknown, label: string) {
  if (!Array.isArray(value)) fail(`${label} phải là mảng JSON.`);
  return value;
}

function exactNumbered<T extends { questionNumber: number }>(rows: T[], count: number, label: string) {
  const numbers = rows.map(row => row.questionNumber);
  const expected = Array.from({ length: count }, (_, index) => index + 1);
  if (numbers.length !== count || numbers.some(number => !Number.isInteger(number)) || new Set(numbers).size !== count) {
    fail(`${label} phải có đúng ${count} số thứ tự không trùng.`);
  }
  if (expected.some(number => !numbers.includes(number))) fail(`${label} phải đánh số liên tục từ 1 đến ${count}.`);
  return [...rows].sort((first, second) => first.questionNumber - second.questionNumber);
}

function answersAt(value: unknown, label: string, warnings: string[], maxWords?: number) {
  const rows = arrayAt(value, label).slice(0, 20).map(answer => cleanText(answer, 200)).filter(Boolean);
  const answers = [...new Set(rows)];
  if (!answers.length) warnings.push(`${label}: chưa đọc được đáp án; dữ liệu hiện có sẽ được giữ nguyên.`);
  if (maxWords && answers.some(answer => answer.split(/\s+/).filter(Boolean).length > maxWords)) {
    fail(`${label}: mỗi đáp án tối đa ${maxWords} từ.`);
  }
  return answers;
}

function exampleAt(value: unknown, label: string, warnings: string[]): MoverReadingWritingImportExample | undefined {
  if (value === undefined || value === null) return undefined;
  const row = objectAt(value, label);
  assertKeys(row, ['prompt', 'answer'], label);
  const prompt = cleanText(row.prompt, 1_000);
  const answer = cleanText(row.answer, 200);
  if (!prompt && !answer) return undefined;
  if (!prompt || !answer) warnings.push(`${label}: ví dụ chưa đủ câu dẫn và đáp án.`);
  return { prompt, answer };
}

function textQuestionAt(value: unknown, label: string, warnings: string[], maxWords?: number): MoverReadingWritingImportTextQuestion {
  const row = objectAt(value, label);
  assertKeys(row, ['questionNumber', 'promptTemplate', 'acceptedAnswers'], label);
  const questionNumber = Number(row.questionNumber);
  const promptTemplate = cleanText(row.promptTemplate, 1_000);
  if (!promptTemplate) warnings.push(`${label}: chưa đọc được nội dung; dữ liệu hiện có sẽ được giữ nguyên.`);
  else validateQuestionMarker(promptTemplate, questionNumber, `${label} promptTemplate`);
  return {
    questionNumber,
    promptTemplate,
    acceptedAnswers: answersAt(row.acceptedAnswers, `${label} đáp án`, warnings, maxWords),
  };
}

function normalizeCorrectOption(
  value: unknown,
  label: string,
  warnings: string[],
): 'A' | 'B' | 'C' | undefined {
  const answer = cleanText(value, 20).toUpperCase();
  if (answer === 'A' || answer === 'B' || answer === 'C') return answer;
  warnings.push(`${label}: chưa có đáp án A/B/C rõ ràng; đáp án hiện có sẽ được giữ nguyên.`);
  return undefined;
}

function choiceQuestionAt(
  value: unknown,
  label: string,
  warnings: string[],
  withNumber: true,
): MoverReadingWritingImportChoiceQuestion;
function choiceQuestionAt(
  value: unknown,
  label: string,
  warnings: string[],
  withNumber: false,
): Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'>;
function choiceQuestionAt(
  value: unknown,
  label: string,
  warnings: string[],
  withNumber: boolean,
): MoverReadingWritingImportChoiceQuestion | Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'> {
  const row = objectAt(value, label);
  const allowed = ['prompt', 'promptSpeaker', 'answerSpeaker', 'options', 'correctOption'];
  if (withNumber) allowed.unshift('questionNumber');
  assertKeys(row, allowed, label);
  const rawOptions = arrayAt(row.options, `${label} lựa chọn`);
  if (rawOptions.length !== 3) fail(`${label} phải có đúng ba lựa chọn A/B/C.`);
  const options = rawOptions.map(option => cleanText(option, 500)) as [string, string, string];
  if (options.some(option => !option)) warnings.push(`${label}: có lựa chọn chưa đọc được; nội dung hiện có sẽ được giữ nguyên.`);
  const result: Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'> = {
    prompt: cleanText(row.prompt, 1_000),
    ...(cleanText(row.promptSpeaker, 120) ? { promptSpeaker: cleanText(row.promptSpeaker, 120) } : {}),
    ...(cleanText(row.answerSpeaker, 120) ? { answerSpeaker: cleanText(row.answerSpeaker, 120) } : {}),
    options,
    correctOption: normalizeCorrectOption(row.correctOption, label, warnings),
  };
  if (!result.prompt) warnings.push(`${label}: chưa đọc được câu dẫn; nội dung hiện có sẽ được giữ nguyên.`);
  return withNumber ? { ...result, questionNumber: Number(row.questionNumber) } : result;
}

function textGapAt(
  value: unknown,
  label: string,
  warnings: string[],
) {
  const row = objectAt(value, label);
  assertKeys(row, ['gapNumber', 'acceptedAnswers'], label);
  return {
    gapNumber: Number(row.gapNumber),
    acceptedAnswers: answersAt(row.acceptedAnswers, `${label} đáp án`, warnings, 1),
  };
}

function validateQuestionMarker(template: string, number: number, label: string) {
  const markers = [...template.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => match[1].trim());
  if (markers.length !== 1 || markers[0] !== String(number)) {
    fail(`${label} phải chứa đúng một marker [[${number}]].`);
  }
}

function validateMarkers(template: string, count: number, label: string) {
  const allMarkers = [...template.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => match[1].trim());
  const found = [...template.matchAll(/\[\[(\d+)\]\]/g)].map(match => Number(match[1]));
  const expected = Array.from({ length: count }, (_, index) => index + 1);
  if (
    allMarkers.length !== found.length
    || found.length !== count
    || new Set(found).size !== count
    || expected.some(number => !found.includes(number))
  ) fail(`${label} phải chứa đúng một lần các marker [[1]] đến [[${count}]].`);
}

function rootAt(part: MoverReadingWritingSmartImportPartId, value: unknown, allowed: string[]) {
  const root = objectAt(value, `JSON Part ${part}`);
  assertKeys(root, ['schema', 'part', ...allowed], `JSON Part ${part}`);
  if (root.schema !== schemaId(part)) fail(`schema phải là "${schemaId(part)}".`);
  if (Number(root.part) !== part) fail(`Dữ liệu không thuộc Part ${part}.`);
  return root;
}

export function validateAndNormalizeMoverReadingWritingImport(
  part: MoverReadingWritingSmartImportPartId,
  value: unknown,
): { data: MoverReadingWritingSmartImportData; warnings: string[] } {
  const warnings: string[] = [];
  if (part === 1) {
    const root = rootAt(part, value, ['title', 'instruction', 'example', 'questions']);
    const questions = exactNumbered(
      arrayAt(root.questions, 'Part 1 questions').map((row, index) => textQuestionAt(row, `Part 1 câu ${index + 1}`, warnings)),
      6,
      'Part 1 questions',
    );
    return { data: { part, title: cleanText(root.title, 160), instruction: cleanText(root.instruction, 1_000), example: exampleAt(root.example, 'Part 1 example', warnings), questions }, warnings };
  }
  if (part === 2) {
    const root = rootAt(part, value, ['title', 'instruction', 'examples', 'questions']);
    const examples = arrayAt(root.examples, 'Part 2 examples').slice(0, 4).flatMap((value, index) => {
      const row = objectAt(value, `Part 2 example ${index + 1}`);
      assertKeys(row, ['prompt', 'answer'], `Part 2 example ${index + 1}`);
      const prompt = cleanText(row.prompt, 1_000);
      const answerText = cleanText(row.answer, 20).toLowerCase();
      const answer: 'yes' | 'no' | undefined = answerText === 'yes' || answerText === 'no' ? answerText : undefined;
      if (!prompt) return [];
      if (!answer) warnings.push(`Part 2 example ${index + 1}: chưa đọc được đáp án Yes/No.`);
      return [{ prompt, answer }];
    });
    const questions = exactNumbered(arrayAt(root.questions, 'Part 2 questions').map((value, index) => {
      const row = objectAt(value, `Part 2 câu ${index + 1}`);
      assertKeys(row, ['questionNumber', 'statement', 'correctAnswer'], `Part 2 câu ${index + 1}`);
      const answerText = cleanText(row.correctAnswer, 20).toLowerCase();
      const correctAnswer: 'yes' | 'no' | undefined = answerText === 'yes' || answerText === 'no' ? answerText : undefined;
      if (!correctAnswer) warnings.push(`Part 2 câu ${index + 1}: chưa có đáp án Yes/No rõ ràng.`);
      const statement = cleanText(row.statement, 1_000);
      if (!statement) warnings.push(`Part 2 câu ${index + 1}: chưa đọc được nhận định.`);
      return { questionNumber: Number(row.questionNumber), statement, correctAnswer };
    }), 6, 'Part 2 questions');
    return { data: { part, title: cleanText(root.title, 160), instruction: cleanText(root.instruction, 1_000), examples, questions }, warnings };
  }
  if (part === 3) {
    const root = rootAt(part, value, ['title', 'instruction', 'example', 'questions']);
    const example = root.example ? choiceQuestionAt(root.example, 'Part 3 example', warnings, false) : undefined;
    const questions = exactNumbered(
      arrayAt(root.questions, 'Part 3 questions').map((row, index) => choiceQuestionAt(row, `Part 3 câu ${index + 1}`, warnings, true)),
      6,
      'Part 3 questions',
    );
    return { data: { part, title: cleanText(root.title, 160), instruction: cleanText(root.instruction, 1_000), example, questions }, warnings };
  }
  if (part === 4) {
    const root = rootAt(part, value, ['title', 'instruction', 'storyTemplate', 'example', 'gaps', 'titleQuestion']);
    const storyTemplate = cleanText(root.storyTemplate);
    validateMarkers(storyTemplate, 6, 'Part 4 storyTemplate');
    const gaps = arrayAt(root.gaps, 'Part 4 gaps').map((value, index) => {
      const row = objectAt(value, `Part 4 gap ${index + 1}`);
      assertKeys(row, ['gapNumber', 'acceptedAnswers'], `Part 4 gap ${index + 1}`);
      return { gapNumber: Number(row.gapNumber), acceptedAnswers: answersAt(row.acceptedAnswers, `Part 4 gap ${index + 1}`, warnings) };
    });
    exactNumbered(gaps.map(row => ({ ...row, questionNumber: row.gapNumber })), 6, 'Part 4 gaps');
    const titleQuestion = choiceQuestionAt(root.titleQuestion, 'Part 4 câu 7', warnings, false);
    return { data: { part, title: cleanText(root.title, 160), instruction: cleanText(root.instruction, 1_000), storyTemplate, example: exampleAt(root.example, 'Part 4 example', warnings), gaps: gaps.sort((a, b) => a.gapNumber - b.gapNumber), titleQuestion }, warnings };
  }
  if (part === 5) {
    const root = rootAt(part, value, ['title', 'instruction', 'example', 'scenes']);
    const scenes = arrayAt(root.scenes, 'Part 5 scenes').map((value, sceneIndex) => {
      const row = objectAt(value, `Part 5 scene ${sceneIndex + 1}`);
      assertKeys(row, ['sceneNumber', 'passage', 'questions'], `Part 5 scene ${sceneIndex + 1}`);
      return {
        sceneNumber: Number(row.sceneNumber),
        passage: cleanText(row.passage, 10_000),
        questions: arrayAt(row.questions, `Part 5 scene ${sceneIndex + 1} questions`).map((question, index) => textQuestionAt(question, `Part 5 câu ${index + 1}`, warnings, 3)),
      };
    });
    if (scenes.length !== 3 || new Set(scenes.map(scene => scene.sceneNumber)).size !== 3 || [1, 2, 3].some(number => !scenes.some(scene => scene.sceneNumber === number))) {
      fail('Part 5 phải có đúng ba scene đánh số 1, 2, 3.');
    }
    const allQuestions = scenes.flatMap(scene => scene.questions);
    exactNumbered(allQuestions, 10, 'Part 5 questions');
    scenes.forEach(scene => {
      scene.questions.sort((first, second) => first.questionNumber - second.questionNumber);
      if (!scene.passage) warnings.push(`Part 5 scene ${scene.sceneNumber}: chưa đọc được nội dung truyện.`);
      if (!scene.questions.length) fail(`Part 5 scene ${scene.sceneNumber} phải có ít nhất một câu.`);
    });
    return { data: { part, title: cleanText(root.title, 160), instruction: cleanText(root.instruction, 1_000), example: exampleAt(root.example, 'Part 5 example', warnings), scenes: scenes.sort((a, b) => a.sceneNumber - b.sceneNumber) }, warnings };
  }

  const root = rootAt(part, value, ['title', 'instruction', 'passageTitle', 'passageTemplate', 'example', 'gaps']);
  const passageTemplate = cleanText(root.passageTemplate);
  validateMarkers(passageTemplate, 5, 'Part 6 passageTemplate');
  const gaps = arrayAt(root.gaps, 'Part 6 gaps').map((row, index) => (
    textGapAt(row, `Part 6 gap ${index + 1}`, warnings)
  ));
  exactNumbered(
    gaps.map(row => ({ ...row, questionNumber: row.gapNumber })),
    5,
    'Part 6 gaps',
  );
  gaps.sort((first, second) => first.gapNumber - second.gapNumber);
  const passageTitle = cleanText(root.passageTitle, 300);
  if (!passageTitle) warnings.push('Part 6: chưa đọc được tiêu đề bài đọc.');
  return { data: { part, title: cleanText(root.title, 160), instruction: cleanText(root.instruction, 1_000), passageTitle, passageTemplate, example: exampleAt(root.example, 'Part 6 example', warnings), gaps }, warnings };
}

function stripJsonFence(source: string) {
  const trimmed = source.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export function parseMoverReadingWritingExternalImport(part: MoverReadingWritingSmartImportPartId, source: string) {
  if (!source.trim()) fail(`Chưa nhập JSON thông số bên ngoài Part ${part}.`);
  let parsed: unknown;
  try { parsed = JSON.parse(stripJsonFence(source)); }
  catch { fail(`JSON thông số bên ngoài Part ${part} không hợp lệ.`); }
  return validateAndNormalizeMoverReadingWritingImport(part, parsed);
}

const choice = (questionNumber: number, prompt = '') => ({ questionNumber, prompt, promptSpeaker: '', answerSpeaker: '', options: ['A', 'B', 'C'], correctOption: 'A' });
const textQuestion = (questionNumber: number) => ({ questionNumber, promptTemplate: `Question text [[${questionNumber}]]`, acceptedAnswers: [''] });

const templates: Record<MoverReadingWritingSmartImportPartId, Record<string, unknown>> = {
  1: { schema: schemaId(1), part: 1, title: 'Part 1', instruction: 'Look and read...', example: { prompt: '', answer: '' }, questions: Array.from({ length: 6 }, (_, index) => textQuestion(index + 1)) },
  2: { schema: schemaId(2), part: 2, title: 'Part 2', instruction: 'Look and read. Write yes or no.', examples: [{ prompt: '', answer: 'yes' }], questions: Array.from({ length: 6 }, (_, index) => ({ questionNumber: index + 1, statement: '', correctAnswer: 'yes' })) },
  3: { schema: schemaId(3), part: 3, title: 'Part 3', instruction: 'Read the text and choose the best answer.', example: { prompt: '', promptSpeaker: '', answerSpeaker: '', options: ['A', 'B', 'C'], correctOption: 'A' }, questions: Array.from({ length: 6 }, (_, index) => choice(index + 1)) },
  4: { schema: schemaId(4), part: 4, title: 'Part 4', instruction: 'Read the story...', storyTemplate: 'Text [[1]] text [[2]] text [[3]] text [[4]] text [[5]] text [[6]].', example: { prompt: '', answer: '' }, gaps: Array.from({ length: 6 }, (_, index) => ({ gapNumber: index + 1, acceptedAnswers: [''] })), titleQuestion: { prompt: 'Choose the best name for the story.', promptSpeaker: '', answerSpeaker: '', options: ['A', 'B', 'C'], correctOption: 'A' } },
  5: { schema: schemaId(5), part: 5, title: 'Part 5', instruction: 'Look at the pictures and read the story...', example: { prompt: '', answer: '' }, scenes: [
    { sceneNumber: 1, passage: '', questions: [1, 2, 3].map(textQuestion) },
    { sceneNumber: 2, passage: '', questions: [4, 5, 6, 7].map(textQuestion) },
    { sceneNumber: 3, passage: '', questions: [8, 9, 10].map(textQuestion) },
  ] },
  6: { schema: schemaId(6), part: 6, title: 'Part 6', instruction: 'Read the text. Choose the right words...', passageTitle: '', passageTemplate: 'Text [[1]] text [[2]] text [[3]] text [[4]] text [[5]].', example: { prompt: '', answer: '' }, gaps: Array.from({ length: 5 }, (_, index) => ({ gapNumber: index + 1, acceptedAnswers: ['and'] })) },
};

export const moverReadingWritingExternalTemplate = (part: MoverReadingWritingSmartImportPartId) => JSON.stringify(templates[part], null, 2);

export const moverReadingWritingExternalHelp: Record<MoverReadingWritingSmartImportPartId, string> = {
  1: 'Đọc ảnh ngân hàng từ, sáu câu mô tả và answer key. Mỗi promptTemplate phải chứa đúng marker [[questionNumber]] tại vị trí học sinh viết đáp án; acceptedAnswers chỉ lấy từ nguồn đáp án chính thức.',
  2: 'Đọc các ví dụ, đúng sáu nhận định và đáp án yes/no theo số câu.',
  3: 'Đọc ví dụ và đúng sáu lượt hội thoại, mỗi câu ba lựa chọn A/B/C; đáp án đúng chỉ lấy từ answer key.',
  4: 'Dùng marker [[1]]…[[6]] đúng một lần trong truyện, sáu đáp án và một câu chọn tiêu đề.',
  5: 'Đọc ba scene theo thứ tự, tổng đúng mười câu. Mỗi promptTemplate phải chứa đúng marker [[questionNumber]] tại vị trí học sinh viết đáp án; mỗi acceptedAnswers không quá ba từ.',
  6: 'Dùng marker [[1]]…[[5]] đúng một lần trong bài đọc; không đưa dòng Example vào passageTemplate. Mỗi gap chỉ trả gapNumber và acceptedAnswers lấy nguyên văn từ answer key, tối đa một từ; không trả A/B/C hoặc tự giải từ bảng lựa chọn.',
};

export const moverReadingWritingExternalInstructions = (part: MoverReadingWritingSmartImportPartId) => [
  `Bạn đang trích xuất Movers Reading & Writing Part ${part}.`,
  'Hãy đọc đúng chữ nhìn thấy trong ảnh và nguồn đáp án. Không tự giải, không đoán dữ liệu bị thiếu.',
  'Nếu không đọc được một trường chữ, dùng chuỗi rỗng; nếu không xác định được đáp án, dùng "unknown" hoặc mảng rỗng.',
  'Không trả UUID, database ID, questionId, optionId, gapId hoặc field ngoài mẫu.',
  'Chỉ trả đúng một JSON, không giải thích.',
  moverReadingWritingExternalHelp[part],
  '',
  moverReadingWritingExternalTemplate(part),
].join('\n');

function schemaFromTemplate(value: unknown): any {
  if (Array.isArray(value)) return { type: 'array', items: schemaFromTemplate(value[0] ?? ''), maxItems: 20 };
  if (isObject(value)) {
    const properties = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schemaFromTemplate(child)]));
    return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
  }
  if (typeof value === 'number') return { type: 'number' };
  return { type: 'string', maxLength: 20_000 };
}

export const moverReadingWritingImportResponseSchema = (part: MoverReadingWritingSmartImportPartId) => schemaFromTemplate(templates[part]);
export const moverReadingWritingImportSchemaName = (part: MoverReadingWritingSmartImportPartId) => `mover_rw_part_${part}_v${part === 1 || part === 5 || part === 6 ? 2 : 1}`;
