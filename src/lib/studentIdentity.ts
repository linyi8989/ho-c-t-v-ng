export const STUDENT_NAME_MIN_LENGTH = 2;
export const STUDENT_NAME_MAX_LENGTH = 20;

export type StudentNameValidation =
  | { valid: true; value: string; error: '' }
  | { valid: false; value: string; error: string };

export function normalizeStudentDisplayName(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateStudentDisplayName(value: unknown): StudentNameValidation {
  const normalized = normalizeStudentDisplayName(value);
  const length = Array.from(normalized).length;

  if (length < STUDENT_NAME_MIN_LENGTH) {
    return {
      valid: false,
      value: normalized,
      error: `Tên hiển thị phải có ít nhất ${STUDENT_NAME_MIN_LENGTH} ký tự.`
    };
  }

  if (length > STUDENT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      value: normalized,
      error: `Tên hiển thị không được vượt quá ${STUDENT_NAME_MAX_LENGTH} ký tự.`
    };
  }

  if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(normalized)) {
    return {
      valid: false,
      value: normalized,
      error: 'Tên chỉ được chứa chữ cái, khoảng trắng, dấu nháy hoặc dấu gạch nối.'
    };
  }

  return { valid: true, value: normalized, error: '' };
}
