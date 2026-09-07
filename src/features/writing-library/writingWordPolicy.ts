export const STANDALONE_WRITING_TEMPLATE_VERSION = 'standalone-writing-v1';

export const DEFAULT_WRITING_RUBRIC = 'Chấm theo mức độ hoàn thành yêu cầu, nội dung, tổ chức bài, từ vựng và ngữ pháp. Điểm nguyên từ 0 đến 10.';

export const DEFAULT_WRITING_GRADING_INSTRUCTIONS = [
  'Chấm điểm nguyên từ 0 đến 10 dựa trên mức độ hoàn thành yêu cầu, nội dung, tổ chức bài, từ vựng và ngữ pháp.',
  'Khoảng từ mục tiêu chỉ là hướng dẫn, không phải điều kiện trừ điểm máy móc.',
  'Nếu bài viết dài hơn khoảng mục tiêu nhưng đúng trọng tâm, mạch lạc, giàu ý và dùng tiếng Anh tốt thì ghi nhận, khuyến khích và cho điểm theo chất lượng thực tế.',
  'Nếu bài dài nhưng lan man, lặp ý, sai nhiều hoặc kém rõ ràng thì nêu cụ thể điểm yếu và giảm điểm tương xứng với chất lượng.',
  'Được phép linh hoạt theo năng lực và bài làm thực tế của học sinh; chỉ ra lỗi cụ thể và trả về nhận xét ngắn gọn, đầy đủ trong khoảng 4–5 câu.',
].join(' ');

export interface FlexibleWritingWordPolicy {
  recommendedMin: number;
  recommendedMax: number;
  flexibleMin: number;
  flexibleMax: number;
}

const positiveInteger = (value: unknown, fallback: number) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * The authored range is a learning target, never an automatic score gate.
 * A 25–30-word task intentionally maps to the broad 6–70-word guidance requested
 * for mixed-ability learners. Text outside the flexible range is still accepted.
 */
export function getFlexibleWritingWordPolicy(minWords: unknown, maxWords: unknown): FlexibleWritingWordPolicy {
  const recommendedMin = positiveInteger(minWords, 25);
  const recommendedMax = Math.max(recommendedMin, positiveInteger(maxWords, 30));
  return {
    recommendedMin,
    recommendedMax,
    flexibleMin: Math.max(1, Math.floor(recommendedMin / 4)),
    flexibleMax: Math.max(recommendedMax + 40, Math.ceil(recommendedMax * 7 / 3)),
  };
}

export function countWritingWords(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}
