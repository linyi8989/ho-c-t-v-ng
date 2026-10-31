/** Private, teacher-reviewable input equivalents for young Listening Part 2. */
export const LISTENING_PART2_INPUT_VARIANTS_MAX_COUNT = 20;
export const LISTENING_PART2_INPUT_VARIANT_MAX_LENGTH = 200;

export function parseListeningPart2InputVariants(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('inputAnswerVariants phải là mảng chuỗi văn bản.');
  if (value.length > LISTENING_PART2_INPUT_VARIANTS_MAX_COUNT) {
    throw new Error(`inputAnswerVariants chỉ nhận tối đa ${LISTENING_PART2_INPUT_VARIANTS_MAX_COUNT} cách nhập.`);
  }
  const seen = new Set<string>();
  return value.flatMap((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`inputAnswerVariants[${index}] phải là chuỗi văn bản không rỗng.`);
    }
    const text = entry.normalize('NFKC').trim();
    if (text.length > LISTENING_PART2_INPUT_VARIANT_MAX_LENGTH || /[\r\n\u0000-\u001f\u007f]/.test(text)) {
      throw new Error(`inputAnswerVariants[${index}] phải nằm trên một dòng, tối đa ${LISTENING_PART2_INPUT_VARIANT_MAX_LENGTH} ký tự.`);
    }
    const normalized = text.toLocaleLowerCase('en').replace(/[\u2018\u2019\u02bc\u0060]/g, "'").replace(/\s+/g, ' ');
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [text.replace(/\s+/g, ' ')];
  });
}
