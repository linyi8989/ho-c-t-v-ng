import crypto from 'node:crypto';
import type { ListeningPart } from '../../features/listening/types.js';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportData,
  ListeningSmartImportPartId,
  SmartImportAnchor,
  SmartImportCrop,
} from '../../features/listening-editor/smart-import/types.js';

export interface SmartImportImageInput {
  assetId: string;
  mimeType: string;
  data: Buffer;
}

export interface SmartImportVisionResult {
  text: string;
  provider: 'gemini' | 'openai';
  errors?: string[];
}

export type SmartImportVisionAnalyzer = (
  prompt: string,
  images: SmartImportImageInput[],
  signal?: AbortSignal
) => Promise<SmartImportVisionResult>;

interface CreateCandidateInput {
  part: ListeningSmartImportPartId;
  currentPart: ListeningPart;
  basePartHash: string;
  sourceImageAssetIds: string[];
  pastedText: string;
  images: SmartImportImageInput[];
  analyzeVision?: SmartImportVisionAnalyzer;
  signal?: AbortSignal;
}

const cleanText = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const clamp = (value: unknown, fallback = 0.5) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
};
const list = (value: unknown) => Array.isArray(value) ? value : [];

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

function randomIndexes(total: number, count: number) {
  const values = Array.from({ length: total }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(index + 1);
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values.slice(0, count);
}

function fixedRegion(raw: any): SmartImportAnchor['region'] {
  const width = 0.12;
  const height = 0.055;
  const centerX = clamp(raw?.centerX ?? raw?.x);
  const centerY = clamp(raw?.centerY ?? raw?.y);
  return {
    shape: 'rect',
    x: Math.min(1 - width, Math.max(0, centerX - width / 2)),
    y: Math.min(1 - height, Math.max(0, centerY - height / 2)),
    width,
    height,
  };
}

function normalizeAnchors(value: unknown, limit = 6): SmartImportAnchor[] {
  return list(value).slice(0, limit).map((entry: any, index) => ({
    label: cleanText(entry?.label || entry?.name || `Vùng ${index + 1}`, 120),
    region: fixedRegion(entry),
    confidence: clamp(entry?.confidence, 0.5),
  }));
}

function normalizeCrop(value: any): SmartImportCrop {
  const x = clamp(value?.x, 0);
  const y = clamp(value?.y, 0);
  const width = Math.min(1 - x, Math.max(0.02, clamp(value?.width, 0.2)));
  const height = Math.min(1 - y, Math.max(0.02, clamp(value?.height, 0.2)));
  return { x, y, width, height };
}

function promptFor(part: ListeningSmartImportPartId, pastedText: string) {
  const common = `You extract structured data for Cambridge Movers Listening Part ${part} from the attached PAGE IMAGES.
Never infer or extract answers from audio or transcript. No audio is attached. Return only JSON, no markdown.
Coordinates are normalized 0..1 relative to the source image. Do not invent unreadable text.
Teacher will review every result before it is applied.`;
  const pasted = pastedText ? `\nTeacher pasted text (may help OCR):\n${pastedText}` : '';
  if (part === 1) return `${common}
Extract the six printed name choices (including the distractor/example when visible) and locate the centre of each pictured person.
Do NOT decide which name belongs to which person. JSON: {"choices":["name"],"exampleLabel":"optional","anchors":[{"label":"visual description","centerX":0.5,"centerY":0.5,"confidence":0.8}]}.${pasted}`;
  if (part === 2) return `${common}
Extract heading, optional example, and exactly five numbered fill-in questions. The darker/bold span is the supplied answer. Replace that answer span in the question with {{blank}}. Preserve answer variants separated by | as separate acceptedAnswers.
If the page contains a main illustration, also return its picture-only rectangle as illustrationCrop and its zero-based illustrationSourceImageIndex; exclude surrounding border/text.
JSON: {"heading":"ABC","exampleText":"optional","illustrationCrop":{"x":0.05,"y":0.1,"width":0.4,"height":0.35},"illustrationSourceImageIndex":0,"questions":[{"prompt":"Lives at: {{blank}} Main Street","acceptedAnswers":["7"]}]}.${pasted}`;
  if (part === 3) return `${common}
The attached image is only the label-list source. Extract only the five row labels (for example weekdays). The separate A-F composite board is deliberately not sent to AI and must not be split. Red highlighting described by the teacher is not present in the real image. Do not choose A-F answers.
JSON: {"labels":["Monday","Tuesday","Wednesday","Thursday","Friday"]}.${pasted}`;
  if (part === 4) return `${common}
Read questions in printed order: top-to-bottom and, when two questions share a row, left-to-right. Extract exactly five prompts and exactly three options A, B, C per question.
Each option picture is inside a black or dark-grey rectangular frame. Return a close rectangle for the PICTURE INSIDE that frame: stay inside the inner edge and exclude the black frame, surrounding card, A/B/C badge, radio circle, tick and question text. Do not use the outer rounded question/card border as an option crop. Keep A/B/C in left-to-right order.
Crop coordinates are only an initial hint: deterministic browser code will detect the dark frames and snap these rectangles to their inner edges. If a frame edge is faint, still return the closest visible picture rectangle instead of omitting an option.
If an answer is EXPLICITLY marked in the source page, set correctOptionIndex to 0, 1 or 2; otherwise omit it. Never infer the answer from picture meaning.
JSON: {"questions":[{"prompt":"What does Daisy want?","sourceImageIndex":0,"crops":[{"x":0.1,"y":0.1,"width":0.2,"height":0.2},{"x":0.4,"y":0.1,"width":0.2,"height":0.2},{"x":0.7,"y":0.1,"width":0.2,"height":0.2}],"correctOptionIndex":1}]}.${pasted}`;
  return `${common}
Locate five relevant objects/people to be coloured. Return only visual labels and centres. Do NOT select colours or infer any colour answer.
JSON: {"anchors":[{"label":"horse tail","centerX":0.2,"centerY":0.25,"confidence":0.8}]}.${pasted}`;
}

function localPart2(pastedText: string) {
  const lines = pastedText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const heading = cleanText(lines.find(line => !/^\d+[.)]/.test(line)) || 'Listening notes', 200);
  const questions = lines.filter(line => /^\d+[.)]/.test(line)).slice(0, 5).map(line => {
    const [rawPrompt, ...answers] = line.split(/\s*(?:=>|\|)\s*/);
    return {
      prompt: cleanText(rawPrompt.replace(/^\d+[.)]\s*/, ''), 1000).replace(/_{2,}/, '{{blank}}'),
      acceptedAnswers: answers.map(answer => cleanText(answer, 200)).filter(Boolean),
    };
  });
  return { heading, questions };
}

function localLabels(pastedText: string) {
  return pastedText.split(/\r?\n|,/).map(value => cleanText(value, 160)).filter(Boolean).slice(0, 5);
}

function normalizeData(
  part: ListeningSmartImportPartId,
  raw: any,
  currentPart: ListeningPart,
  sourceImageAssetIds: string[],
  warnings: string[]
): ListeningSmartImportData {
  if (part === 1) {
    const current = currentPart.part === 1 ? currentPart : null;
    const choices = list(raw?.choices).map(value => cleanText(value, 120)).filter(Boolean).slice(0, 6);
    while (choices.length < 6 && current?.choices[choices.length]) choices.push(current.choices[choices.length].label);
    const anchors = normalizeAnchors(raw?.anchors, 5);
    const detectedAnchorCount = anchors.length;
    while (anchors.length < 5 && current?.targets[anchors.length]) {
      const fallback = current.targets[anchors.length];
      anchors.push({
        label: `Vùng ${anchors.length + 1} · cần giáo viên đặt lại`,
        region: fixedRegion({
          centerX: fallback.region.x + fallback.region.width / 2,
          centerY: fallback.region.y + fallback.region.height / 2,
        }),
        confidence: 0,
      });
    }
    if (choices.length < 6) warnings.push('Chưa nhận đủ 6 thẻ tên; giáo viên cần điền phần còn thiếu.');
    if (detectedAnchorCount < 5) warnings.push('Chưa nhận đủ 5 nhân vật; đã tạo vùng mặc định để giáo viên tự đặt lại.');
    return {
      part: 1,
      choices,
      anchors,
      exampleLabel: cleanText(raw?.exampleLabel, 120) || undefined,
      provisionalChoiceIndexes: randomIndexes(Math.max(choices.length, 6), 5),
    };
  }
  if (part === 2) {
    const questions = list(raw?.questions).slice(0, 5).map((question: any) => ({
      prompt: cleanText(question?.prompt || question?.question, 1000).replace(/\{\{blank\}\}/g, '{{blank}}'),
      acceptedAnswers: list(question?.acceptedAnswers || [question?.answer])
        .flatMap(value => cleanText(value, 200).split('|'))
        .map(value => value.trim())
        .filter(Boolean)
        .slice(0, 8),
    }));
    if (questions.length < 5) warnings.push('Chưa nhận đủ 5 câu; giáo viên có thể tự điền câu còn thiếu.');
    if (questions.some(question => !question.acceptedAnswers.length)) warnings.push('Có câu chưa nhận được đáp án in đậm.');
    return {
      part: 2,
      heading: cleanText(raw?.heading, 200) || 'Listening notes',
      exampleText: cleanText(raw?.exampleText, 500) || undefined,
      ...(raw?.illustrationCrop ? {
        illustrationCrop: normalizeCrop(raw.illustrationCrop),
        illustrationSourceImageIndex: Math.max(0, Math.floor(Number(raw?.illustrationSourceImageIndex) || 0)),
      } : {}),
      questions,
    };
  }
  if (part === 3) {
    const labels = list(raw?.labels).map(value => cleanText(value, 160)).filter(Boolean).slice(0, 5);
    if (labels.length < 5) warnings.push('Chưa nhận đủ 5 nhãn; giáo viên có thể tự điền.');
    return { part: 3, boardAssetId: sourceImageAssetIds[0] || '', labels };
  }
  if (part === 4) {
    const questions = list(raw?.questions).slice(0, 5).map((question: any) => {
      const crops = list(question?.crops).slice(0, 3).map(normalizeCrop);
      const answer = Number(question?.correctOptionIndex);
      return {
        prompt: cleanText(question?.prompt || question?.question, 1000),
        sourceImageIndex: Math.max(0, Math.floor(Number(question?.sourceImageIndex) || 0)),
        crops,
        ...(Number.isInteger(answer) && answer >= 0 && answer <= 2 ? { correctOptionIndex: answer } : {}),
      };
    });
    if (questions.length < 5) warnings.push('Chưa nhận đủ 5 câu hỏi.');
    if (questions.some(question => question.crops.length < 3)) warnings.push('Có câu chưa nhận đủ ba vùng crop A/B/C.');
    return { part: 4, questions };
  }
  const anchors = normalizeAnchors(raw?.anchors, 5);
  const detectedAnchorCount = anchors.length;
  const current = currentPart.part === 5 ? currentPart : null;
  while (anchors.length < 5 && current?.targets[anchors.length]) {
    const fallback = current.targets[anchors.length];
    anchors.push({
      label: fallback.label || `Vùng ${anchors.length + 1}`,
      region: fixedRegion({
        centerX: fallback.region.x + fallback.region.width / 2,
        centerY: fallback.region.y + fallback.region.height / 2,
      }),
      confidence: 0,
    });
  }
  if (detectedAnchorCount < 5) warnings.push('Chưa nhận đủ 5 vùng tô màu; đã tạo vùng mặc định để giáo viên tự đặt lại.');
  return {
    part: 5,
    anchors,
    provisionalColourIndexes: randomIndexes(6, 5),
  };
}

export async function createListeningSmartImportCandidate(
  input: CreateCandidateInput
): Promise<ListeningSmartImportCandidate> {
  const warnings: string[] = [];
  let provider: ListeningSmartImportCandidate['provider'] = 'local';
  let raw: any = {};

  const analysisImages = input.part === 3 ? input.images.slice(1) : input.images;
  const part3BoardOnly = input.part === 3
    && input.images.length === 1
    && !input.pastedText.trim();
  if (analysisImages.length && input.analyzeVision) {
    const result = await input.analyzeVision(
      promptFor(input.part, input.pastedText),
      analysisImages,
      input.signal
    );
    provider = result.provider;
    raw = parseJson(result.text);
    if (result.errors?.length) warnings.push(...result.errors.map(value => cleanText(value, 240)));
  } else if (input.pastedText && (input.part === 2 || input.part === 3)) {
    if (input.part === 2) raw = localPart2(input.pastedText);
    else raw = { labels: localLabels(input.pastedText) };
  } else if (part3BoardOnly) {
    raw = { labels: [] };
    warnings.push('Chỉ có ảnh bảng A–F. Ảnh này được giữ nguyên và không gửi AI; hãy nhập thủ công 5 nhãn hoặc phân tích lại với ảnh nguồn thứ hai/văn bản OCR.');
  } else if (analysisImages.length && !input.analyzeVision) {
    const error: any = new Error('Backend chưa cấu hình AI thị giác để đọc ảnh.');
    error.status = 503;
    throw error;
  } else {
    const error: any = new Error('Cần ảnh nguồn hoặc văn bản để phân tích.');
    error.status = 400;
    throw error;
  }

  return {
    id: `limport-${crypto.randomUUID()}`,
    moduleId: 'mover',
    part: input.part,
    basePartHash: input.basePartHash,
    sourceImageAssetIds: input.sourceImageAssetIds,
    provider,
    warnings,
    createdAt: new Date().toISOString(),
    data: normalizeData(
      input.part,
      raw,
      input.currentPart,
      input.sourceImageAssetIds,
      warnings
    ),
  };
}
