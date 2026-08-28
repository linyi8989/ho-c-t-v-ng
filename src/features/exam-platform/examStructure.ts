import type { ExamInteractionDescriptor, ExamPartBlock, ExamPartContent, ExamQuestion } from './types';

export function examPartBlocks(part: ExamPartContent): ExamPartBlock[] {
  return Array.isArray(part.blocks) ? part.blocks : [];
}

export function examBlockQuestions(part: ExamPartContent, block: ExamPartBlock): ExamQuestion[] {
  const questions = new Map(part.questions.map(question => [question.id, question]));
  return block.questionIds.flatMap(questionId => {
    const question = questions.get(questionId);
    return question ? [question] : [];
  });
}

/**
 * Projects schema-v2 blocks onto the released Part contract. This lets the
 * editor, player, sanitizer and grader share the existing interaction views
 * while schema-v1 content remains unchanged.
 */
export function examPartUnits(part: ExamPartContent): ExamPartContent[] {
  const blocks = examPartBlocks(part);
  if (!blocks.length) return [part];
  return blocks.map(block => ({
    id: block.id,
    part: part.part,
    title: block.title || part.title,
    instruction: block.instruction || part.instruction,
    passage: block.passage ?? part.passage,
    imageAssetId: block.imageAssetId ?? part.imageAssetId,
    imageUrl: block.imageUrl ?? part.imageUrl,
    audioAssetId: block.audioAssetId ?? part.audioAssetId,
    audioUrl: block.audioUrl ?? part.audioUrl,
    interaction: block.interaction,
    interactionLayout: block.interactionLayout,
    examples: block.examples,
    readingScenes: block.readingScenes,
    questions: examBlockQuestions(part, block),
  }));
}

export function replaceExamPartUnit(part: ExamPartContent, unit: ExamPartContent): ExamPartContent {
  if (!part.blocks?.length) return unit;
  const blockIndex = part.blocks.findIndex(block => block.id === unit.id);
  if (blockIndex < 0) return part;
  const currentBlock = part.blocks[blockIndex];
  const currentIds = new Set(currentBlock.questionIds);
  const questions = [
    ...part.questions.filter(question => !currentIds.has(question.id)),
    ...unit.questions,
  ].sort((left, right) => left.number - right.number);
  const nextBlock: ExamPartBlock = {
    ...currentBlock,
    title: unit.title,
    instruction: unit.instruction,
    passage: unit.passage,
    imageAssetId: unit.imageAssetId,
    imageUrl: unit.imageUrl,
    audioAssetId: unit.audioAssetId,
    audioUrl: unit.audioUrl,
    interaction: unit.interaction || currentBlock.interaction,
    interactionLayout: unit.interactionLayout,
    examples: unit.examples,
    readingScenes: unit.readingScenes,
    questionIds: unit.questions.map(question => question.id),
  };
  return {
    ...part,
    questions,
    blocks: part.blocks.map((block, index) => index === blockIndex ? nextBlock : block),
  };
}

function implicitInteraction(part: ExamPartContent): ExamInteractionDescriptor {
  if (part.interaction) return part.interaction;
  const types = new Set(part.questions.map(question => question.type));
  if (types.has('long-writing')) return { family: 'writing', subtype: 'guided', variant: 'text-area', schemaVersion: 1, importReadiness: 'content-ready' };
  if (types.size === 1 && types.has('short-answer')) return { family: 'text-entry', subtype: 'short-answer', variant: 'inline-gap', schemaVersion: 1, importReadiness: 'content-ready' };
  if (types.size === 1 && types.has('matching')) return { family: 'matching', subtype: 'text-text', variant: 'select-pair', schemaVersion: 1, importReadiness: 'content-ready' };
  if (types.size === 1 && types.has('scene-draw')) return { family: 'scene', subtype: 'draw-object', variant: 'draw', schemaVersion: 2, importReadiness: 'needs-geometry' };
  return { family: 'choice', subtype: types.has('multiple-choice') ? 'multiple' : 'single', variant: 'text-options', schemaVersion: 1, importReadiness: 'content-ready' };
}

/** Converts a released single-interaction Part into one explicit schema-v2 block. */
export function promoteExamPartToBlocks(part: ExamPartContent): ExamPartContent {
  if (part.blocks?.length) return part;
  const block: ExamPartBlock = {
    id: `block-${crypto.randomUUID()}`,
    block: 1,
    title: part.title,
    instruction: part.instruction,
    interaction: implicitInteraction(part),
    interactionLayout: part.interactionLayout,
    examples: part.examples,
    readingScenes: part.readingScenes,
    questionIds: part.questions.map(question => question.id),
  };
  return { ...part, blocks: [block] };
}
