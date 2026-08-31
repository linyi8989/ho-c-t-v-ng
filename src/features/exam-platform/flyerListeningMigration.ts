import { examPartUnits } from './examStructure';
import type { ExamInteractionRegion, ExamPaperContent, ExamPartContent } from './types';

export const FLYER_NAME_REGION_WIDTH = .12;
export const FLYER_NAME_REGION_HEIGHT = .055;

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

function moverNameRegion(region: ExamInteractionRegion): ExamInteractionRegion {
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  return {
    shape: 'rect',
    x: clamp(centerX - FLYER_NAME_REGION_WIDTH / 2, 1 - FLYER_NAME_REGION_WIDTH),
    y: clamp(centerY - FLYER_NAME_REGION_HEIGHT / 2, 1 - FLYER_NAME_REGION_HEIGHT),
    width: FLYER_NAME_REGION_WIDTH,
    height: FLYER_NAME_REGION_HEIGHT,
  };
}

function normalizePart1(part: ExamPartContent) {
  const normalizeLayout = (layout: ExamPartContent['interactionLayout']) => layout?.kind === 'flyer-name-placement-v1'
    ? { ...layout, targets: layout.targets.map((target, index) => ({ ...target, label: `Vùng ${index + 1}`, region: moverNameRegion(target.region) })) }
    : layout;
  return {
    ...part,
    interactionLayout: normalizeLayout(part.interactionLayout),
    blocks: part.blocks?.map(block => ({ ...block, interactionLayout: normalizeLayout(block.interactionLayout) })),
  };
}

function normalizeLegacyPart2(part: ExamPartContent) {
  const unit = examPartUnits(part)[0] || part;
  const legacy = unit.interaction?.family !== 'text-entry'
    || unit.interaction.variant !== 'single-input'
    || unit.questions.some(question => question.type !== 'short-answer' || question.options.length > 0 || question.correctOptionIds.length > 0);
  if (!legacy) return part;
  const interaction = { family: 'text-entry' as const, subtype: 'short-answer', variant: 'single-input', schemaVersion: 1, importReadiness: 'needs-assets' as const };
  const questions = part.questions.map((question, index) => ({
    ...question,
    type: 'short-answer' as const,
    prompt: `Question ${index + 1}: ____`,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: question.acceptedAnswers || [],
  }));
  const firstBlock = part.blocks?.[0];
  const oldExample = unit.examples?.[0];
  const passage = unit.passage || (oldExample ? `${oldExample.prompt}${oldExample.answer ? ` — ${oldExample.answer}` : ''}` : undefined);
  return {
    ...part,
    title: 'Listen and write',
    instruction: 'Listen and write a word or a number.',
    passage,
    interaction,
    interactionLayout: undefined,
    examples: undefined,
    questions,
    ...(firstBlock ? { blocks: [{ ...firstBlock, title: 'Listen and write', instruction: 'Listen and write a word or a number.', passage, examples: undefined, interaction, interactionLayout: undefined, questionIds: questions.map(question => question.id) }] } : {}),
  };
}

/** Keeps released Flyer drafts compatible with the fixed five-Part design. */
export function normalizeFixedFlyerListeningContent(content: ExamPaperContent): ExamPaperContent {
  if (content.moduleId !== 'flyer' || content.paperId !== 'listening') return content;
  const part1 = content.parts[0] ? normalizePart1(content.parts[0]) : undefined;
  const part2 = content.parts[1] ? normalizeLegacyPart2(content.parts[1]) : undefined;
  return {
    ...content,
    parts: content.parts.map((part, index) => index === 0 && part1 ? part1 : index === 1 && part2 ? part2 : part),
  };
}
