const cleanLine = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 2_000);

/**
 * Reads the two printed Starters Listening Part 2 examples from both the new
 * newline contract and released one-line passages.
 */
export function splitStarterPart2ExampleLines(value = ''): string[] {
  const explicitLines = value
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);
  if (explicitLines.length > 1) return [explicitLines[0], explicitLines.slice(1).join(' ')];

  const inline = explicitLines[0] || '';
  const questionMarks = [...inline.matchAll(/\?/g)].map(match => match.index ?? -1).filter(index => index >= 0);
  if (questionMarks.length < 2) return inline ? [inline] : [];
  const betweenQuestions = inline.slice(questionMarks[0] + 1, questionMarks[1]);
  const sentenceBreaks = [...betweenQuestions.matchAll(/[.!]\s+(?=[A-Z0-9])/g)];
  const lastBreak = sentenceBreaks.at(-1);
  if (lastBreak?.index === undefined) return [inline];
  const splitAt = questionMarks[0] + 1 + lastBreak.index + lastBreak[0].length;
  return [inline.slice(0, splitAt).trim(), inline.slice(splitAt).trim()].filter(Boolean);
}

export function starterPart2ExampleEditorLines(value = ''): [string, string] {
  const normalized = value.replace(/\r\n?/g, '\n');
  if (normalized.includes('\n')) {
    const rows = normalized.split('\n');
    return [cleanLine(rows[0]), cleanLine(rows.slice(1).join(' '))];
  }
  const lines = splitStarterPart2ExampleLines(value);
  return [lines[0] || '', lines[1] || ''];
}

export function joinStarterPart2ExampleLines(lines: readonly string[]) {
  return lines.slice(0, 2).map(cleanLine).join('\n');
}
