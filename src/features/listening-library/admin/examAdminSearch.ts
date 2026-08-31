const normalizeExamAdminSearchValue = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/đ/gi, character => character === 'Đ' ? 'D' : 'd')
  .toLocaleLowerCase('vi-VN')
  .trim();

export function filterExamAdminSetsByTitle<T extends { title?: string }>(sets: readonly T[], query: string) {
  const normalizedQuery = normalizeExamAdminSearchValue(query);
  if (!normalizedQuery) return [...sets];
  return sets.filter(set => normalizeExamAdminSearchValue(set.title).includes(normalizedQuery));
}
