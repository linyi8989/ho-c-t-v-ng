import type { ExamPaperContent } from './types';
import { composeListeningPart2Prompt, parseListeningPart2Affix } from '../listening/part2TextLayout';

/** Printed hints belong to the answer slot only in these two fixed Part 2 forms. */
export function isYoungListeningPart2(identity: Pick<ExamPaperContent, 'moduleId' | 'paperId'> | undefined, partNumber: number) {
  return identity?.paperId === 'listening' && (identity.moduleId === 'starter' || identity.moduleId === 'flyer') && partNumber === 2;
}

export function parseYoungListeningAffixes(raw: { answerPrefix?: unknown; answerSuffix?: unknown; prompt?: unknown; template?: unknown }, options: { allowLegacyEmptyHints?: boolean } = {}) {
  const answerPrefix = parseListeningPart2Affix(raw.answerPrefix, 'answerPrefix');
  const answerSuffix = parseListeningPart2Affix(raw.answerSuffix, 'answerSuffix');
  if (typeof raw.prompt === 'string' || typeof raw.template === 'string') {
    // Released drafts can encode hints inline while their optional fields are
    // empty. Accept that existing representation at publish without rewriting it;
    // new imports still reject contradictory declarations.
    composeListeningPart2Prompt({
      prompt: typeof raw.template === 'string' ? raw.template : raw.prompt as string,
      blankId: 'answer',
      answerPrefix: options.allowLegacyEmptyHints && answerPrefix === '' ? undefined : answerPrefix,
      answerSuffix: options.allowLegacyEmptyHints && answerSuffix === '' ? undefined : answerSuffix,
    });
  }
  return {
    ...(answerPrefix ? { answerPrefix } : {}),
    ...(answerSuffix ? { answerSuffix } : {}),
  };
}
