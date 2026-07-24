export function normalizeGrammarTextAnswer(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('vi-VN')
    .slice(0, 4000);
}
