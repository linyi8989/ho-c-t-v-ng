function matchesShape(value: unknown, template: unknown): boolean {
  if (Array.isArray(template)) return Array.isArray(value);
  if (template === null) return value === null;
  if (typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(template).every(([key, expected]) => matchesShape((value as Record<string, unknown>)[key], expected));
  }
  return typeof value === typeof template && (typeof value !== 'number' || Number.isFinite(value));
}
export function restoreFields<T extends Record<string, unknown>>(value: T, template: T, setters: { [K in keyof T]: (value: T[K]) => void }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bản nháp không đúng định dạng.');
  const keys = Object.keys(setters) as Array<keyof T>;
  for (const key of keys) if (!matchesShape(value[key], template[key])) throw new Error('Bản nháp có trường không hợp lệ; dữ liệu hiện tại được giữ.');
  // Validate every field before touching the current editor.
  for (const key of keys) setters[key](value[key]);
}
