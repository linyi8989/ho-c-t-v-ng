import crypto from 'node:crypto';
import type { ListeningPart, ListeningRegion } from '../../features/listening/types.js';
import {
  isValidListeningRegion,
  regionFromPolygon,
  transformListeningPoint,
  transformListeningRegion,
} from '../../features/listening/geometry.js';
import { MOVER_COLOUR_CATALOG } from '../../features/listening-library/modules/mover/editor/colourCatalog.js';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportData,
  ListeningSmartImportPartId,
  ListeningSmartImportSource,
  ListeningSmartImportSourceRole,
  SmartImportAnchor,
  SmartImportCrop,
  SmartImportPart5Action,
} from '../../features/listening-editor/smart-import/types.js';

export interface SmartImportImageInput {
  assetId: string;
  role: ListeningSmartImportSourceRole;
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
  sources: ListeningSmartImportSource[];
  pastedText: string;
  images: SmartImportImageInput[];
  analyzeVision?: SmartImportVisionAnalyzer;
  signal?: AbortSignal;
}

const cleanText = (value: unknown, max = 1000) => String(value ?? '').normalize('NFKC').trim().slice(0, max);
const comparable = (value: unknown) => cleanText(value, 300).toLocaleLowerCase('en').replace(/[\u2018\u2019\u02bc`]/g, "'").replace(/\s+/g, ' ');
const clamp = (value: unknown, fallback = 0.5) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const integer = (value: unknown) => Number.isInteger(Number(value)) ? Number(value) : undefined;
const questionNumber = (value: unknown) => {
  const parsed = integer(value);
  return parsed && parsed >= 1 && parsed <= 5 ? parsed as 1 | 2 | 3 | 4 | 5 : undefined;
};

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

function normalizedRect(value: any, minimum = 0.005): ListeningRegion | undefined {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const width = Number(value?.width);
  const height = Number(value?.height);
  const region: ListeningRegion = { shape: value?.shape === 'ellipse' ? 'ellipse' : 'rect', x, y, width, height };
  return width >= minimum && height >= minimum && isValidListeningRegion(region) ? region : undefined;
}

function normalizedRegion(value: any): ListeningRegion | undefined {
  if (value?.shape === 'polygon' || Array.isArray(value?.points)) {
    const points = list(value?.points).slice(0, 80).map((point: any) => ({ x: Number(point?.x), y: Number(point?.y) }));
    return regionFromPolygon(points) || undefined;
  }
  return normalizedRect(value);
}

function normalizeCrop(value: any): SmartImportCrop | undefined {
  const region = normalizedRect(value, 0.02);
  return region ? { x: region.x, y: region.y, width: region.width, height: region.height } : undefined;
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

function promptFor(part: ListeningSmartImportPartId, pastedText: string) {
  const common = `You extract structured data for Cambridge Movers Listening Part ${part}. Each attached image is explicitly preceded by its technical ROLE label; never infer roles from image order. Never use audio or transcript. Return only JSON. Coordinates are normalized 0..1. Do not invent unreadable text, answers, objects, colours, geometry or IDs. Never return UUID/database/question/action/object/choice IDs. Use warnings for uncertainty.`;
  const pasted = pastedText ? `\nTeacher supplied an explicit manual OCR fallback for the answer text:\n${pastedText}` : '';
  if (part === 1) return `${common}
ROLE question: detect every printed name, identify and separate the example, and locate the canonical scene. After removing the example there must be six draggable names. ROLE answer_key: read the five name-to-picture mappings. ROLE position_key: identify the five line endpoints on the picture/person side, never the name-side endpoints, plus the corresponding scene rectangle. Return questionScene, positionScene, printedNames, example, targets and answerMappings. Each target should have visualLabel, optional targetNumber, targetEndpoint and confidence; each mapping should have visualLabel/targetNumber and choiceLabel.${pasted}`;
  if (part === 2) return `${common}
ROLE question supplies optional heading/instruction, the example, and exactly five numbered prompts. ROLE answer_key supplies accepted answers numbered 1..5. Never infer an answer from the question image. Preserve text such as 4b exactly and split variants only when the source explicitly separates them with |. Return heading, instruction, exampleText, questions [{questionNumber,prompt}], answers [{questionNumber,correctAnswer,answerVariants}], and optional picture-only illustrationCrop from the question image.${pasted}`;
  if (part === 3) return `${common}
ROLE question is the full worksheet: detect seven centre answer labels/regions with left/right anchor hints, six picture regions arranged three left and three right, and the printed example connection. ROLE answer_key is a two-column by three-row mapping; preserve side+row and do not flatten OCR order. Return questionAnswers, questionPictures, questionExample, answerKeyCells and warnings. The example is unscored and the remaining unused answer is the distractor.${pasted}`;
  if (part === 4) return `${common}
ROLE question contains one example followed by exactly five numbered questions. Each block has three framed pictures A/B/C. Return example and questions with close picture-only crops inside frame edges, excluding A/B/C text, checkbox/tick, border and prompt. ROLE answer_key supplies only scored answers 1..5 as A/B/C; map by questionNumber, never OCR index. Only the explicit example marker on the question image may set the example answer. Return {example:{prompt,crops,answer},questions:[{questionNumber,prompt,crops}],answers:[{questionNumber,answer}],orderedFallbackEvidence?}.${pasted}`;
  return `${common}
ROLE question is the canonical student scene. ROLE answer_key supplies five numbered staff prompts and their colour/draw actions. ROLE position_key, when present, shows final object/placement locations. Detect a reviewable public set of colourable interactive objects, including plausible non-answer objects already visible in the scene. Detect the number of actions per question from evidence; never assume one action or hard-code question 1. Actions are colour_object or place_object. Colours must use only: ${MOVER_COLOUR_CATALOG.map(colour => colour.label).join(', ')}. Return questionScene, positionScene, interactiveObjects [{label,geometry,geometrySource,confidence}], optional paletteItems explicitly visible in source, questions [{questionNumber,prompt,actions:[{type,objectLabel/objectType,correctColor,color,geometry,targetRegion,geometrySource,relationLabel,confidence}]}], warnings. Do not invent distractor palette items.${pasted}`;
}

function localNumberedLines(pastedText: string) {
  return pastedText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([1-5])[.)\s:-]+(.+)$/);
    return match ? { questionNumber: Number(match[1]), value: match[2].trim() } : { value: line };
  });
}

function normalizeNumberedEntries<T>(
  values: unknown[],
  convert: (entry: any) => T | undefined,
  warnings: string[],
  label: string,
  allowOrderedFallback = false,
) {
  const numbered = new Map<number, T>();
  const conflicts = new Set<number>();
  const unnumbered: T[] = [];
  values.forEach(entry => {
    const value = convert(entry);
    if (value === undefined) return;
    const number = questionNumber((entry as any)?.questionNumber ?? (entry as any)?.number);
    if (!number) {
      unnumbered.push(value);
      return;
    }
    if (numbered.has(number)) {
      numbered.delete(number);
      conflicts.add(number);
    } else if (!conflicts.has(number)) numbered.set(number, value);
  });
  conflicts.forEach(number => warnings.push(`${label}: số câu ${number} bị trùng nên được giữ unresolved.`));
  if (!numbered.size && allowOrderedFallback && unnumbered.length === 5) {
    warnings.push(`${label}: dùng ordered fallback vì có đúng năm giá trị không đánh số với cấu trúc rõ ràng.`);
    unnumbered.forEach((value, index) => numbered.set(index + 1, value));
  } else if (numbered.size && unnumbered.length) {
    warnings.push(`${label}: bỏ qua giá trị không đánh số; không dồn index vào chỗ trống.`);
  }
  return numbered;
}

function normalizePart1(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 1 }> {
  const exampleLabel = cleanText(raw?.example?.label || raw?.exampleLabel, 120);
  const allNames = list(raw?.printedNames || raw?.choices).map(value => cleanText((value as any)?.label ?? value, 120)).filter(Boolean);
  const seenNames = new Set<string>();
  const choices = allNames.filter(name => {
    const key = comparable(name);
    if ((exampleLabel && key === comparable(exampleLabel)) || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  }).slice(0, 6);
  if (!exampleLabel) warnings.push('Part 1: chưa xác định chắc tên example.');
  if (choices.length !== 6) warnings.push(`Part 1: sau khi tách example nhận ${choices.length}/6 choices; không tự ép đủ bằng dữ liệu giả.`);

  const questionScene = normalizedRegion(raw?.questionScene);
  const positionScene = normalizedRegion(raw?.positionScene);
  const mappings = list(raw?.answerMappings);
  const rawTargets = list(raw?.targets || raw?.questionTargets || raw?.anchors);
  const byNumber = new Map<number, any>();
  rawTargets.forEach((target: any, index) => {
    const number = questionNumber(target?.targetNumber) || (index < 5 ? index + 1 : undefined);
    if (number && !byNumber.has(number)) byNumber.set(number, target);
  });
  const anchors: SmartImportAnchor[] = [];
  const targetChoiceLabels: Array<string | undefined> = Array.from({ length: 5 });
  for (let number = 1; number <= 5; number += 1) {
    const target = byNumber.get(number);
    if (!target) continue;
    let point = {
      x: Number(target?.targetEndpoint?.x ?? target?.centerX ?? target?.x),
      y: Number(target?.targetEndpoint?.y ?? target?.centerY ?? target?.y),
    };
    if (target?.coordinateRole === 'position_key' || target?.targetEndpoint) {
      const transformed = questionScene && positionScene ? transformListeningPoint(point, positionScene, questionScene) : null;
      if (!transformed) {
        warnings.push(`Part 1 target ${number}: không xác định được scene transform/endpoint phía hình.`);
        continue;
      }
      point = transformed;
    }
    if (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      warnings.push(`Part 1 target ${number}: endpoint không hợp lệ.`);
      continue;
    }
    const visualLabel = cleanText(target?.visualLabel || target?.label || `Vùng ${number}`, 120);
    anchors.push({ targetNumber: number as 1 | 2 | 3 | 4 | 5, label: visualLabel, region: fixedRegionFromPoint(point), confidence: clamp(target?.confidence, 0.5) });
    const mapping = mappings.find((entry: any) => questionNumber(entry?.targetNumber) === number
      || (visualLabel && comparable(entry?.visualLabel) === comparable(visualLabel)));
    const choiceLabel = cleanText(mapping?.choiceLabel || target?.choiceLabel || target?.answer, 120);
    targetChoiceLabels[number - 1] = choiceLabel || undefined;
  }
  if (anchors.length !== 5) warnings.push(`Part 1: chỉ resolve được ${anchors.length}/5 target endpoints.`);
  if (targetChoiceLabels.filter(Boolean).length !== 5) warnings.push('Part 1: answer key chưa resolve đủ năm mapping; giữ đáp án draft ở mục unresolved.');

  let example: { label: string; region: ListeningRegion } | undefined;
  const examplePointRaw = raw?.example?.targetEndpoint || raw?.example?.center;
  if (exampleLabel && examplePointRaw) {
    const rawPoint = { x: Number(examplePointRaw.x), y: Number(examplePointRaw.y) };
    const point = raw?.example?.coordinateRole === 'position_key' || raw?.example?.targetEndpoint
      ? questionScene && positionScene ? transformListeningPoint(rawPoint, positionScene, questionScene) : null
      : rawPoint;
    if (point && [point.x, point.y].every(Number.isFinite)) example = { label: exampleLabel, region: fixedRegionFromPoint(point) };
  }
  return { part: 1, choices, anchors, targetChoiceLabels, ...(example ? { example } : {}) };
}

function answerVariants(entry: any) {
  const source = list(entry?.answerVariants).length
    ? list(entry.answerVariants)
    : [entry?.correctAnswer ?? entry?.answer];
  const seen = new Set<string>();
  return source.flatMap(value => cleanText(value, 300).split('|')).map(value => value.trim()).filter(value => {
    const key = comparable(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function normalizePart2(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 2 }> {
  const questionMap = normalizeNumberedEntries(list(raw?.questions), entry => {
    const prompt = cleanText(entry?.prompt || entry?.question, 1000).replace(/_{2,}/g, '{{blank}}');
    return prompt ? prompt : undefined;
  }, warnings, 'Part 2 prompts');
  const answerMap = normalizeNumberedEntries(list(raw?.answers).length ? list(raw.answers) : list(raw?.questions), entry => {
    const answers = answerVariants(entry);
    return answers.length ? answers : undefined;
  }, warnings, 'Part 2 answer key', true);
  const numbers = new Set([...questionMap.keys(), ...answerMap.keys()]);
  const questions = [...numbers].sort().flatMap(number => {
    const valid = questionNumber(number);
    if (!valid) return [];
    return [{ questionNumber: valid, prompt: questionMap.get(number), acceptedAnswers: answerMap.get(number) }];
  });
  if (questionMap.size !== 5) warnings.push(`Part 2: nhận ${questionMap.size}/5 prompt đánh số.`);
  if (answerMap.size !== 5) warnings.push(`Part 2: nhận ${answerMap.size}/5 answer mappings; mục thiếu giữ dữ liệu cũ.`);
  const illustrationCrop = normalizeCrop(raw?.illustrationCrop);
  return {
    part: 2,
    heading: cleanText(raw?.heading, 200) || undefined,
    instruction: cleanText(raw?.instruction, 500) || undefined,
    exampleText: cleanText(raw?.exampleText || raw?.example, 500) || undefined,
    ...(illustrationCrop ? { illustrationCrop } : {}),
    questions,
  };
}

function normalizePart3(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 3 }> {
  const answers = list(raw?.questionAnswers || raw?.answers).slice(0, 7).flatMap((entry: any) => {
    const label = cleanText(entry?.label, 160);
    const region = normalizedRegion(entry?.region);
    if (!label || !region) return [];
    return [{ label, region, leftAnchorOffset: clamp(entry?.leftAnchorOffset ?? entry?.leftAnchor?.offset, 0.5), rightAnchorOffset: clamp(entry?.rightAnchorOffset ?? entry?.rightAnchor?.offset, 0.5) }];
  });
  const pictures = list(raw?.questionPictures || raw?.pictures).slice(0, 6).flatMap((entry: any) => {
    const side = entry?.side === 'left' || entry?.side === 'right' ? entry.side as 'left' | 'right' : undefined;
    const row = integer(entry?.row);
    const region = normalizedRegion(entry?.region);
    if (!side || !row || row < 1 || row > 3 || !region) return [];
    return [{ label: cleanText(entry?.label || `${side}-${row}`, 160), side, row: row as 1 | 2 | 3, region, anchorOffset: clamp(entry?.anchorOffset ?? entry?.anchor?.offset, 0.5) }];
  });
  const rawExample = raw?.questionExample || raw?.example;
  const exampleSide = rawExample?.pictureSide === 'left' || rawExample?.pictureSide === 'right' ? rawExample.pictureSide as 'left' | 'right' : undefined;
  const exampleRow = integer(rawExample?.pictureRow ?? rawExample?.row);
  const exampleLabel = cleanText(rawExample?.answerLabel || rawExample?.label, 160);
  const example = exampleLabel && exampleSide && exampleRow && exampleRow >= 1 && exampleRow <= 3
    ? { answerLabel: exampleLabel, pictureSide: exampleSide, pictureRow: exampleRow as 1 | 2 | 3, renderOverlayLine: Boolean(rawExample?.renderOverlayLine) }
    : undefined;
  const cells = list(raw?.answerKeyCells || raw?.connections).flatMap((entry: any) => {
    const side = entry?.side === 'left' || entry?.side === 'right' ? entry.side as 'left' | 'right' : undefined;
    const row = integer(entry?.row);
    const answerLabel = cleanText(entry?.answerLabel || entry?.label, 160);
    if (!side || !row || row < 1 || row > 3 || !answerLabel) return [];
    return [{ answerLabel, pictureSide: side, pictureRow: row as 1 | 2 | 3 }];
  });
  const connections = cells.filter(connection => !example || !(comparable(connection.answerLabel) === comparable(example.answerLabel)
    && connection.pictureSide === example.pictureSide && connection.pictureRow === example.pictureRow)).slice(0, 5);
  const used = new Set([...(example ? [comparable(example.answerLabel)] : []), ...connections.map(connection => comparable(connection.answerLabel))]);
  const distractors = answers.filter(answer => !used.has(comparable(answer.label)));
  if (answers.length !== 7) warnings.push(`Part 3: nhận ${answers.length}/7 answer regions.`);
  if (pictures.length !== 6 || new Set(pictures.map(picture => `${picture.side}-${picture.row}`)).size !== 6) warnings.push('Part 3: cần đúng ba picture bên trái và ba bên phải theo row 1-3.');
  if (!example) warnings.push('Part 3: chưa resolve được example từ ảnh đề.');
  if (connections.length !== 5) warnings.push(`Part 3: resolve được ${connections.length}/5 scored connections; không dùng OCR order để bù.`);
  if (distractors.length !== 1) warnings.push('Part 3: distractor không xác định duy nhất bằng set difference.');
  return { part: 3, answers, pictures, ...(example ? { example } : {}), connections, distractorLabel: distractors.length === 1 ? distractors[0].label : undefined };
}

function optionIndex(value: unknown) {
  const normalized = cleanText(value, 10).toUpperCase();
  return normalized === 'A' ? 0 : normalized === 'B' ? 1 : normalized === 'C' ? 2 : undefined;
}

function normalizePart4(raw: any, warnings: string[]): Extract<ListeningSmartImportData, { part: 4 }> {
  const questionMap = normalizeNumberedEntries(list(raw?.questions), entry => {
    const prompt = cleanText(entry?.prompt || entry?.question, 1000);
    const crops = list(entry?.crops).slice(0, 3).map(normalizeCrop).filter(Boolean) as SmartImportCrop[];
    return prompt ? { prompt, crops } : undefined;
  }, warnings, 'Part 4 prompts');
  const rawAnswers = list(raw?.answers);
  const hasAnyNumber = rawAnswers.some((entry: any) => Boolean(questionNumber(entry?.questionNumber ?? entry?.number)));
  const orderedEvidence = raw?.orderedFallbackEvidence === 'single-row' || raw?.orderedFallbackEvidence === 'single-column';
  const answerMap = normalizeNumberedEntries(rawAnswers, entry => optionIndex(entry?.answer ?? entry), warnings, 'Part 4 answer key', !hasAnyNumber && orderedEvidence);
  if (!hasAnyNumber && rawAnswers.length === 5 && !orderedEvidence) warnings.push('Part 4: năm đáp án không số thiếu evidence một hàng/cột nên không dùng ordered fallback.');
  const questions = ([1, 2, 3, 4, 5] as const).flatMap(number => {
    const question = questionMap.get(number);
    if (!question) return [];
    const answer = answerMap.get(number);
    return [{ questionNumber: number, ...question, ...(answer === undefined ? {} : { correctOptionIndex: answer }), answerSource: answer === undefined ? 'current-part' as const : hasAnyNumber ? 'answer-key-numbered' as const : 'answer-key-ordered-fallback' as const }];
  });
  const rawExample = raw?.example;
  const exampleCrops = list(rawExample?.crops).slice(0, 3).map(normalizeCrop).filter(Boolean) as SmartImportCrop[];
  const examplePrompt = cleanText(rawExample?.prompt || rawExample?.question, 1000);
  const exampleAnswer = optionIndex(rawExample?.answer ?? rawExample?.correctOption);
  const example = examplePrompt ? { prompt: examplePrompt, crops: exampleCrops, ...(exampleAnswer === undefined ? {} : { correctOptionIndex: exampleAnswer }) } : undefined;
  if (!example) warnings.push('Part 4: chưa tách được example khỏi năm câu scored.');
  if (questions.length !== 5) warnings.push(`Part 4: nhận ${questions.length}/5 câu đánh số.`);
  if (answerMap.size !== 5) warnings.push(`Part 4: nhận ${answerMap.size}/5 answer mappings; câu thiếu giữ đáp án draft.`);
  return { part: 4, ...(example ? { example } : {}), questions };
}

function catalogColourLabel(value: unknown) {
  const key = comparable(value);
  return MOVER_COLOUR_CATALOG.find(colour => comparable(colour.label) === key)?.label;
}

function normalizePart5(raw: any, currentPart: ListeningPart, warnings: string[]): Extract<ListeningSmartImportData, { part: 5 }> {
  const questionScene = normalizedRegion(raw?.questionScene);
  const positionScene = normalizedRegion(raw?.positionScene);
  const convertGeometry = (value: any, sourceRole: unknown) => {
    const region = normalizedRegion(value);
    if (!region) return undefined;
    if (sourceRole !== 'position_key') return region;
    if (!positionScene || !questionScene) return undefined;
    return transformListeningRegion(region, positionScene, questionScene) || undefined;
  };
  const interactiveObjects = list(raw?.interactiveObjects).flatMap((entry: any) => {
    const label = cleanText(entry?.label, 160);
    const geometry = convertGeometry(entry?.geometry, entry?.geometrySource);
    if (!label || !geometry) return [];
    return [{ label, geometry, confidence: clamp(entry?.confidence, 0.5) }];
  });
  const paletteItems = list(raw?.paletteItems).flatMap((entry: any) => {
    const objectType = cleanText(entry?.objectType, 120);
    const label = cleanText(entry?.label || entry?.objectType, 160);
    if (!objectType || !label) return [];
    const rawColour = cleanText(entry?.color || entry?.colour, 80);
    const colourLabel = rawColour ? catalogColourLabel(rawColour) : undefined;
    if (rawColour && !colourLabel) warnings.push(`Part 5 palette "${label}": màu ngoài catalog nên để unresolved.`);
    return [{ objectType, label, ...(colourLabel ? { colourLabel } : {}) }];
  });
  const questionMap = normalizeNumberedEntries(list(raw?.questions), entry => {
    const staffPrompt = cleanText(entry?.prompt || entry?.staffPrompt, 1000);
    const actions = list(entry?.actions).slice(0, 10).flatMap((action: any): SmartImportPart5Action[] => {
      const confidence = clamp(action?.confidence, 0.5);
      if (action?.type === 'colour_object') {
        const objectLabel = cleanText(action?.objectLabel, 160);
        const rawColour = cleanText(action?.correctColor || action?.color, 80);
        const correctColourLabel = catalogColourLabel(rawColour);
        if (rawColour && !correctColourLabel) warnings.push(`Part 5 "${objectLabel}": màu "${rawColour}" ngoài catalog.`);
        const geometry = convertGeometry(action?.geometry, action?.geometrySource);
        return objectLabel ? [{ type: 'colour_object', objectLabel, ...(correctColourLabel ? { correctColourLabel } : {}), ...(geometry ? { geometry } : {}), confidence }] : [];
      }
      if (action?.type === 'place_object') {
        const objectType = cleanText(action?.objectType, 120);
        const rawColour = cleanText(action?.color || action?.correctColor, 80);
        const colourLabel = rawColour ? catalogColourLabel(rawColour) : undefined;
        if (rawColour && !colourLabel) warnings.push(`Part 5 object "${objectType}": màu "${rawColour}" ngoài catalog.`);
        const targetRegion = convertGeometry(action?.targetRegion, action?.geometrySource);
        return objectType ? [{ type: 'place_object', objectType, ...(colourLabel ? { colourLabel } : {}), ...(targetRegion ? { targetRegion } : {}), relationLabel: cleanText(action?.relationLabel, 240) || undefined, confidence }] : [];
      }
      return [];
    });
    return staffPrompt ? { staffPrompt, actions } : undefined;
  }, warnings, 'Part 5 questions');
  const questions = ([1, 2, 3, 4, 5] as const).flatMap(number => {
    const value = questionMap.get(number);
    return value ? [{ questionNumber: number, ...value }] : [];
  });
  if (questions.length !== 5) warnings.push(`Part 5: nhận ${questions.length}/5 câu đánh số.`);
  questions.forEach(question => {
    if (!question.actions.length) warnings.push(`Part 5 câu ${question.questionNumber}: chưa resolve được action nào.`);
    question.actions.forEach((action, index) => {
      if (action.type === 'colour_object' && (!action.correctColourLabel || (!action.geometry && !interactiveObjects.some(object => comparable(object.label) === comparable(action.objectLabel))))) warnings.push(`Part 5 câu ${question.questionNumber} action ${index + 1}: thiếu màu hoặc object geometry chắc chắn.`);
      if (action.type === 'place_object' && !action.targetRegion) warnings.push(`Part 5 câu ${question.questionNumber} action ${index + 1}: thiếu target region; không đoán vị trí.`);
    });
  });
  const placeActions = questions.flatMap(question => question.actions).filter(action => action.type === 'place_object');
  const colourActions = questions.flatMap(question => question.actions).filter(action => action.type === 'colour_object');
  const requestedColourObjects = new Set(colourActions.map(action => comparable(action.objectLabel)));
  if (colourActions.length && interactiveObjects.length <= requestedColourObjects.size) {
    warnings.push('Part 5: public geometry chưa có object nhiễu ngoài các object được hỏi; giáo viên phải bổ sung trước khi publish.');
  }
  const paletteTypes = new Set(paletteItems.map(item => comparable(item.objectType)));
  if (placeActions.some(action => !paletteTypes.has(comparable(action.objectType)))) warnings.push('Part 5: palette thiếu token đúng cho ít nhất một place action; giáo viên phải bổ sung.');
  if (placeActions.length && paletteItems.length <= new Set(placeActions.map(action => comparable(action.objectType))).size) warnings.push('Part 5: object palette chưa có distractor; không tự tạo object giả.');

  if (currentPart.part === 5 && currentPart.displayMode === 'scene-colour-draw') {
    currentPart.questions.forEach(question => question.actions.forEach(action => {
      const matched = questions.some(nextQuestion => nextQuestion.questionNumber === question.questionNumber && nextQuestion.actions.some(next => {
        if (next.type !== action.type) return false;
        if (next.type === 'colour_object' && action.type === 'colour_object') {
          const object = currentPart.interactiveObjects.find(item => item.id === action.correctObjectId);
          return comparable(next.objectLabel) === comparable(object?.label);
        }
        if (next.type === 'place_object' && action.type === 'place_object') {
          const item = currentPart.objectPalette.find(entry => entry.id === action.correctPaletteItemId);
          return comparable(next.objectType) === comparable(item?.objectType);
        }
        return false;
      }));
      if (!matched) warnings.push(`Part 5 câu ${question.questionNumber}: giữ action cũ ${action.id} vì lần phân tích mới không match chắc chắn.`);
    }));
  }
  return { part: 5, interactiveObjects, paletteItems, questions };
}

function normalizeData(part: ListeningSmartImportPartId, raw: any, currentPart: ListeningPart, warnings: string[]): ListeningSmartImportData {
  if (part === 1) return normalizePart1(raw, warnings);
  if (part === 2) return normalizePart2(raw, warnings);
  if (part === 3) return normalizePart3(raw, warnings);
  if (part === 4) return normalizePart4(raw, warnings);
  return normalizePart5(raw, currentPart, warnings);
}

function localFallback(part: ListeningSmartImportPartId, text: string) {
  const rows = localNumberedLines(text);
  if (part === 2) return { questions: [], answers: rows.map(row => ({ questionNumber: row.questionNumber, answer: row.value })) };
  if (part === 3) return { answerKeyCells: rows.map(row => ({ label: row.value })) };
  return {};
}

export async function createListeningSmartImportCandidate(input: CreateCandidateInput): Promise<ListeningSmartImportCandidate> {
  const warnings: string[] = [];
  let provider: ListeningSmartImportCandidate['provider'] = 'local';
  let raw: any;
  if (input.images.length && input.analyzeVision) {
    const result = await input.analyzeVision(promptFor(input.part, input.pastedText), input.images, input.signal);
    provider = result.provider;
    raw = parseJson(result.text);
    if (result.errors?.length) warnings.push(...result.errors.map(value => cleanText(value, 240)));
  } else if (input.pastedText && (input.part === 2 || input.part === 3)) {
    raw = localFallback(input.part, input.pastedText);
    warnings.push(`Part ${input.part}: đang dùng fallback văn bản thủ công thay cho ảnh answer key.`);
  } else if (input.images.length && !input.analyzeVision) {
    const error: any = new Error('Backend chưa cấu hình AI thị giác để đọc ảnh.');
    error.status = 503;
    throw error;
  } else {
    const error: any = new Error('Cần đủ ảnh nguồn theo role hoặc fallback văn bản được hỗ trợ.');
    error.status = 400;
    throw error;
  }
  const data = normalizeData(input.part, raw, input.currentPart, warnings);
  return {
    id: `limport-${crypto.randomUUID()}`,
    moduleId: 'mover',
    part: input.part,
    basePartHash: input.basePartHash,
    sources: input.sources,
    sourceImageAssetIds: input.sources.map(source => source.assetId),
    provider,
    warnings,
    createdAt: new Date().toISOString(),
    data,
  };
}
