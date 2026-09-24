import type { Class, GrammarSet, VocabSet } from '../../types';

export const DEFAULT_HOME_GRADE_OPTIONS = ['Lớp 3', 'Lớp 6', 'Lớp 10'];

export function formatGradeLabel(value?: string) {
  return (value || '')
    .replace(/Lá»›p/g, 'Lớp')
    .replace(/LÃ¡Â»â€ºp/g, 'Lớp')
    .replace(/^L\?p(?=\s|$)/i, 'Lớp');
}

export function normalizeHomeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function expandHomeSearchTerms(query: string) {
  const normalized = normalizeHomeSearchText(query);
  if (!normalized) return [];

  const aliases: Record<string, string[]> = {
    'so dem': ['number', 'numbers', 'counting', 'cardinal', 'cardinal numbers', 'so'],
    number: ['so dem', 'so', 'numbers', 'counting', 'cardinal'],
    numbers: ['so dem', 'so', 'number', 'counting', 'cardinal'],
    counting: ['so dem', 'number', 'numbers', 'dem so'],
    'so thu tu': ['ordinal', 'ordinal numbers', 'order', 'sequence'],
    ordinal: ['so thu tu', 'ordinal numbers', 'order'],
    color: ['mau sac', 'colors', 'colour', 'colours'],
    colors: ['mau sac', 'color', 'colour', 'colours'],
    'mau sac': ['color', 'colors', 'colour', 'colours'],
    animal: ['dong vat', 'animals'],
    animals: ['dong vat', 'animal'],
    'dong vat': ['animal', 'animals'],
  };

  return Array.from(new Set([
    normalized,
    ...(aliases[normalized] || []),
  ].map(normalizeHomeSearchText)));
}

export function getVocabSetSearchCorpus(set: VocabSet) {
  const itemText = set.items
    .map(item => [
      item.term,
      item.meaning,
      item.ipa,
      item.pos,
      item.example,
      item.exampleMeaning,
      item.notes,
    ].filter(Boolean).join(' '))
    .join(' ');

  return normalizeHomeSearchText([
    set.title,
    set.description,
    set.subject,
    set.gradeLevel,
    set.creatorName,
    ...(set.tags || []),
    itemText,
  ].filter(Boolean).join(' '));
}

export function filterPublicVocabSets(sets: VocabSet[], query: string, grade: string) {
  const searchTerms = expandHomeSearchTerms(query);
  return sets.filter(set => {
    const searchableText = getVocabSetSearchCorpus(set);
    const matchSearch = searchTerms.length === 0 || searchTerms.some(term => searchableText.includes(term));
    const matchGrade = grade ? set.gradeLevel === grade : true;
    const visibility = set.visibility || (set.status === 'private' ? 'assignment' : set.status);
    return visibility === 'public' && matchSearch && matchGrade;
  });
}

export function filterPublicGrammarSets(sets: GrammarSet[], query: string, grade: string) {
  const searchTerms = expandHomeSearchTerms(query);
  return sets.filter(set => {
    const searchableText = normalizeHomeSearchText([
      set.title,
      set.description,
      set.subject,
      set.topic,
      set.gradeLevel,
      ...(set.tags || []),
    ].filter(Boolean).join(' '));
    const matchSearch = searchTerms.length === 0 || searchTerms.some(term => searchableText.includes(term));
    const matchGrade = grade ? set.gradeLevel === grade : true;
    return set.visibility === 'public' && matchSearch && matchGrade;
  });
}

export function getHomeGradeOptions(
  classes: Class[],
  vocabSets: VocabSet[],
  listeningSets: Array<{ level?: string }>,
) {
  return Array.from(new Set([
    ...DEFAULT_HOME_GRADE_OPTIONS,
    ...classes.map(cls => cls.name).filter(Boolean),
    ...vocabSets.map(set => set.gradeLevel).filter(Boolean),
    ...listeningSets.map(set => set.level).filter((value): value is string => Boolean(value)),
  ]));
}
