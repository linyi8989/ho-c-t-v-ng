import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardSource = readFileSync(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');

test('admin quick-import panels expose the three ChatGPT prompt labels', () => {
  for (const label of [
    'Sao chép prompt từ vựng',
    'Sao chép prompt trắc nghiệm',
    'Sao chép prompt tự luận',
  ]) assert.ok(dashboardSource.includes(label), `Missing prompt action: ${label}`);
  assert.match(dashboardSource, /grammarQuestionType === 'rewrite' \? 'grammar-rewrite' : 'grammar-multiple-choice'/);
  assert.match(dashboardSource, /handleCopyBulkImportPrompt\('vocabulary'\)/);
});

test('copy action has clipboard fallback and never changes quick-import text', () => {
  assert.match(dashboardSource, /navigator\.clipboard\?\.writeText/);
  assert.match(dashboardSource, /document\.execCommand\('copy'\)/);
  assert.match(dashboardSource, /window\.prompt\('Nhấn Ctrl\+C để sao chép prompt:'/);
  const handler = dashboardSource.match(/const handleCopyBulkImportPrompt[\s\S]*?const handleOpenNewGrammarEditor/)?.[0] || '';
  assert.ok(handler, 'Missing bulk prompt copy handler.');
  assert.doesNotMatch(handler, /setBatchVocabularyText|setGrammarBulkText|setEditorItems|setGrammarQuestions/);
});

test('prompt buttons are non-submit controls with accessible copied feedback', () => {
  assert.ok((dashboardSource.match(/aria-live="polite"/g) || []).length >= 2);
  assert.match(dashboardSource, /copiedBulkPrompt === 'vocabulary'/);
  assert.match(dashboardSource, /\? 'Đã sao chép'/);
  const promptButtonBlocks = dashboardSource.match(/<button[\s\S]*?Sao chép prompt[\s\S]*?<\/button>/g) || [];
  assert.equal(promptButtonBlocks.length, 2);
  promptButtonBlocks.forEach(block => assert.match(block, /type="button"/));
});
