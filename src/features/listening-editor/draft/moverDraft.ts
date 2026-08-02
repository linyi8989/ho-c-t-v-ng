import type { ListeningPart, ListeningSetContent } from '../../listening/types';

export function replaceMoverListeningPart(
  content: ListeningSetContent,
  index: number,
  part: ListeningPart
): ListeningSetContent {
  if (!Number.isInteger(index) || index < 0 || index >= content.parts.length) return content;
  const parts = [...content.parts] as ListeningSetContent['parts'];
  parts[index] = part as never;
  return { ...content, parts };
}
