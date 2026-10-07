import type { Assessment, LessonInput } from './types';

export interface ReadingMetric { id: string; label: string; value: number | null; emptyText: string; description?: string }
const measured = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

// Provider scores have different meanings. Do not manufacture a second Azure
// rhythm score or replace unavailable metrics with accuracy/fluency/AI scores.
export function readingMetrics(result: Assessment, locale: LessonInput['locale']): ReadingMetric[] {
  const metric = (id: string, label: string, value: number | null, emptyText = 'Dịch vụ chưa trả chỉ số cho lượt đọc này.', description?: string): ReadingMetric => ({ id, label, value: measured(value), emptyText, description });
  const rows = [metric('accuracy', 'Độ chính xác', result.accuracy), metric('fluency', 'Độ trôi chảy', result.fluency), metric('completeness', 'Độ đầy đủ', result.completeness)];
  if (result.provider === 'azure') {
    const emptyText = locale !== 'en-US' || result.prosodyStatus === 'unsupported-locale' ? 'Azure chỉ hỗ trợ chỉ số này với giọng Anh-Mỹ (en-US).'
      : result.prosodyStatus === 'disabled' ? 'Chấm ngữ điệu chưa được bật ở lượt này. Hãy luyện lại sau khi giáo viên bật chức năng.'
      : result.prosodyStatus === 'not-returned' ? 'Azure chưa trả điểm ngữ điệu cho lượt đọc này.'
      : 'Lượt chấm cũ chưa có điểm ngữ điệu. Hãy luyện lại để nhận kết quả mới.';
    rows.push(metric('prosody', 'Ngữ điệu & nhịp điệu (prosody)', result.prosody, emptyText, 'Azure đánh giá chung ngữ điệu, trọng âm, tốc độ và nhịp điệu; không trả điểm rhythm riêng.'));
    if (measured(result.rhythm) !== null) rows.push(metric('rhythm', 'Nhịp điệu (rhythm)', result.rhythm)); // Preserve any measured legacy extension.
  } else {
    rows.push(metric('rhythm', 'Nhịp điệu (rhythm)', result.rhythm));
    if (measured(result.prosody) !== null) rows.push(metric('prosody', 'Ngữ điệu (prosody)', result.prosody));
  }
  return rows;
}
