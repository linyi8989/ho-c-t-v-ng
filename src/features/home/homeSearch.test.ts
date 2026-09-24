import assert from 'node:assert/strict';
import test from 'node:test';
import type { GrammarSet, VocabSet } from '../../types';
import {
  expandHomeSearchTerms,
  filterPublicGrammarSets,
  filterPublicVocabSets,
  getHomeGradeOptions,
  normalizeHomeSearchText,
} from './homeSearch';

function vocabSet(overrides: Partial<VocabSet> = {}): VocabSet {
  return {
    id: 'vocab-1',
    title: 'Everyday transport',
    description: 'A public lesson',
    subject: 'General English',
    tags: ['travel'],
    gradeLevel: 'Lớp 3',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'teacher-1',
    creatorName: 'Cô Diệu',
    status: 'public',
    visibility: 'public',
    items: [{
      id: 'word-1',
      term: 'apple',
      meaning: 'quả táo',
      ipa: '/ˈæp.əl/',
      pos: 'Noun',
      example: 'I eat an apple every day.',
      exampleMeaning: 'Tôi ăn một quả táo mỗi ngày.',
      notes: 'fruit vocabulary',
      displayOrder: 0,
    }],
    ...overrides,
  };
}

function grammarSet(overrides: Partial<GrammarSet> = {}): GrammarSet {
  return {
    id: 'grammar-1',
    title: 'Present simple',
    description: 'Daily routines',
    gradeLevel: 'Lớp 6',
    subject: 'Grammar',
    topic: 'Tenses',
    tags: ['routine'],
    visibility: 'public',
    timeLimitMinutes: 10,
    maxAttempts: 3,
    shuffleQuestions: false,
    shuffleOptions: false,
    showExplanationImmediately: true,
    showReviewAfterSubmit: true,
    createdBy: 'teacher-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    questions: [],
    ...overrides,
  };
}

test('home search stays accent-insensitive and preserves Vietnamese/English aliases', () => {
  assert.equal(normalizeHomeSearchText('  Số Đếm!  '), 'so dem');
  assert.deepEqual(expandHomeSearchTerms('số đếm'), [
    'so dem',
    'number',
    'numbers',
    'counting',
    'cardinal',
    'cardinal numbers',
    'so',
  ]);
  assert.ok(expandHomeSearchTerms('animals').includes('dong vat'));
});

test('vocabulary search still covers item term, meaning, IPA, example, notes and aliases', () => {
  const source = [vocabSet()];
  for (const query of ['apple', 'quả táo', 'æp əl', 'eat an apple', 'mỗi ngày', 'fruit vocabulary']) {
    assert.deepEqual(filterPublicVocabSets(source, query, ''), source, `missing query: ${query}`);
  }

  const numberSet = vocabSet({
    id: 'numbers',
    title: 'Cardinal numbers',
    items: [],
  });
  assert.deepEqual(filterPublicVocabSets([numberSet], 'số đếm', ''), [numberSet]);
  assert.deepEqual(filterPublicVocabSets([vocabSet({ visibility: 'assignment' })], '', ''), []);
  assert.deepEqual(filterPublicVocabSets(source, '', 'Lớp 10'), []);
});

test('grammar filters and grade options keep the existing public-home contract', () => {
  const grammar = grammarSet();
  assert.deepEqual(filterPublicGrammarSets([grammar], 'daily routines', ''), [grammar]);
  assert.deepEqual(filterPublicGrammarSets([grammar], '', 'Lớp 3'), []);
  assert.deepEqual(filterPublicGrammarSets([grammarSet({ visibility: 'draft' })], '', ''), []);

  assert.deepEqual(
    getHomeGradeOptions(
      [{ id: 'class-1', name: 'Lớp 8', code: '8A', teacherId: 'teacher-1' }],
      [vocabSet()],
      [{ level: 'Lớp 5' }],
    ),
    ['Lớp 3', 'Lớp 6', 'Lớp 10', 'Lớp 8', 'Lớp 5'],
  );
});
