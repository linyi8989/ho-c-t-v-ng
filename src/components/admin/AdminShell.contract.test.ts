import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardSource = readFileSync(new URL('./AdminDashboard.tsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('./AdminShell.tsx', import.meta.url), 'utf8');
const librarySource = readFileSync(new URL('./vocabulary/VocabularyLibraryPanel.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('./vocabulary/VocabularyEditorPanel.tsx', import.meta.url), 'utf8');
const resultsSource = readFileSync(new URL('./vocabulary/VocabularyResultsPanel.tsx', import.meta.url), 'utf8');
const dashboardOverviewSource = readFileSync(new URL('./dashboard/DashboardOverviewPanel.tsx', import.meta.url), 'utf8');
const grammarLibrarySource = readFileSync(new URL('./grammar/GrammarLibraryPanel.tsx', import.meta.url), 'utf8');
const grammarEditorSource = readFileSync(new URL('./grammar/GrammarEditorPanel.tsx', import.meta.url), 'utf8');
const classesSource = readFileSync(new URL('./classes/ClassManagementPanel.tsx', import.meta.url), 'utf8');
const assignmentsSource = readFileSync(new URL('./assignments/AssignmentManagementPanel.tsx', import.meta.url), 'utf8');
const adminResultsSource = readFileSync(new URL('./results/AdminResultsPanel.tsx', import.meta.url), 'utf8');
const accountsSource = readFileSync(new URL('./accounts/AccountManagementPanel.tsx', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('./audit/AuditLogPanel.tsx', import.meta.url), 'utf8');

const presentationSources = [
  shellSource,
  librarySource,
  editorSource,
  resultsSource,
  dashboardOverviewSource,
  grammarLibrarySource,
  grammarEditorSource,
  classesSource,
  assignmentsSource,
  adminResultsSource,
  accountsSource,
  auditSource,
];

test('AdminDashboard remains the compatibility controller while AdminShell owns the unchanged frame hooks', () => {
  assert.match(dashboardSource, /<AdminShell/);
  assert.match(dashboardSource, /<VocabularyLibraryPanel/);
  assert.match(dashboardSource, /<VocabularyEditorPanel/);
  assert.match(dashboardSource, /<VocabularyResultsPanel/);
  for (const boundary of [
    'DashboardOverviewPanel',
    'GrammarLibraryPanel',
    'GrammarEditorPanel',
    'ClassManagementPanel',
    'AssignmentManagementPanel',
    'AdminResultsPanel',
    'AccountManagementPanel',
    'AuditLogPanel',
  ]) {
    assert.match(dashboardSource, new RegExp(`<${boundary}`), `Missing ${boundary} orchestration boundary.`);
  }

  for (const hook of [
    'admin-dashboard-container',
    'admin-sidebar',
    'admin-main-panel',
    'tab-dashboard',
    'tab-sets',
    'tab-editor',
    'tab-grammar-sets',
    'tab-grammar-editor',
    'tab-grammar-rewrite-editor',
    'tab-listening-library',
    'tab-writing-library',
    'tab-classes',
    'tab-results',
    'tab-users',
    'tab-audit-logs'
  ]) {
    assert.ok(shellSource.includes(`id="${hook}"`), `Missing preserved Admin DOM hook: ${hook}`);
  }
  assert.match(shellSource, /user\?\.role === 'super_admin'/);
  assert.match(shellSource, /user\?\.role === 'super_admin' \? 'Quản lý Tài khoản' : 'Quản lý Học sinh'/);
});

test('Admin presentation boundaries never own data fetching or effects', () => {
  for (const source of presentationSources) {
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /authFetchJson/);
    assert.doesNotMatch(source, /useEffect\s*\(/);
  }
});

test('domain presentation files own the preserved semantic DOM hooks', () => {
  const hooksBySource = new Map<string, string[]>([
    [dashboardOverviewSource, ['dashboard-tab-content', 'dashboard-activity-expanded', 'dashboard-leaderboard-expanded']],
    [grammarLibrarySource, ['grammar-sets-tab-content', 'grammar-sets-list', 'grammar-results-panel']],
    [grammarEditorSource, ['grammar-editor-tab-content']],
    [classesSource, ['classes-tab-content', 'classes-grid', 'create-class-btn']],
    [assignmentsSource, ['assignments-tab-content', 'assignment-creation-box', 'assignments-scheduled-grid', 'schedule-assignment-btn']],
    [adminResultsSource, ['results-tab-content', 'activity-results-sheet', 'leaderboard-sheet', 'leaderboard-table']],
    [accountsSource, ['users-tab-content']],
    [auditSource, ['audit-logs-tab-content']],
  ]);
  for (const [source, hooks] of hooksBySource) {
    for (const hook of hooks) {
      assert.ok(source.includes(`id="${hook}"`), `Missing moved Admin DOM hook: ${hook}`);
    }
  }
});

test('Grammar draft state remains mounted in the controller across library/editor tab switches', () => {
  const shellRender = dashboardSource.indexOf('return (\n    <AdminShell');
  assert.ok(shellRender > 0, 'Missing AdminShell render boundary.');
  for (const state of [
    'editingGrammarSetId',
    'grammarQuestionType',
    'grammarTitle',
    'grammarDescription',
    'grammarBulkText',
    'grammarQuestions',
  ]) {
    const declaration = dashboardSource.indexOf(`const [${state},`);
    assert.ok(declaration > 0 && declaration < shellRender, `${state} must remain in the mounted controller.`);
  }
  assert.doesNotMatch(grammarEditorSource, /useState\s*\(/);
});

test('unsaved Vocabulary draft state stays mounted in AdminDashboard across tab switches', () => {
  const shellRender = dashboardSource.indexOf('return (\n    <AdminShell');
  assert.ok(shellRender > 0, 'Missing AdminShell render boundary.');
  for (const state of [
    'editorTitle',
    'editorDescription',
    'editorSubject',
    'editorGrade',
    'editorStatus',
    'editorTags',
    'editorItems',
    'batchVocabularyText',
    'ttsSettings'
  ]) {
    const declaration = dashboardSource.indexOf(`const [${state},`);
    assert.ok(declaration > 0 && declaration < shellRender, `${state} must remain in the mounted controller.`);
  }
  assert.match(dashboardSource, /activeTab === 'editor'[\s\S]*?<VocabularyEditorPanel/);
  assert.doesNotMatch(editorSource, /useState\s*\(/);
});

test('Vocabulary sidebar returns to the mounted editor without resetting its draft', () => {
  const editorTabEnd = shellSource.indexOf('id="tab-editor"');
  const editorTabStart = shellSource.lastIndexOf('<button', editorTabEnd);
  const editorTab = shellSource.slice(editorTabStart, editorTabEnd);
  assert.match(editorTab, /onClick=\{\(\) => onSelectTab\('editor'\)\}/);
  assert.doesNotMatch(shellSource, /onOpenNewVocabulary/);
});

test('Vocabulary save navigates once and does not eagerly refresh the same list twice', () => {
  const saveStart = dashboardSource.indexOf('const handleSaveSet = () => {');
  const saveEnd = dashboardSource.indexOf('// --- CRUD VOCAB LIST ACTIONS ---', saveStart);
  const saveHandler = dashboardSource.slice(saveStart, saveEnd);
  assert.match(saveHandler, /setActiveTab\('vocab-sets'\)/);
  assert.match(saveHandler, /refreshDashboard\(\)/);
  assert.doesNotMatch(saveHandler, /refreshData\(\)/);
});

test('Vocabulary UI source contains no known double-encoded Vietnamese strings', () => {
  for (const source of [dashboardSource, editorSource]) {
    assert.doesNotMatch(source, /HÃ£y|lÆ°u|bá»™|CÃ i|Ä‘áº·t|phÃ¡t|Ã¢m|Nghe thá»­|Äang táº¡o/);
  }
});

test('Lần 2 starts Admin with one summary request and lazy domain loaders', () => {
  const initialEffect = dashboardSource.slice(
    dashboardSource.indexOf('setDashboardSummary(EMPTY_DASHBOARD_SUMMARY)'),
    dashboardSource.indexOf("if (activeTab !== 'vocab-sets')")
  );
  assert.ok(initialEffect.includes('refreshDashboard(controller.signal)'));
  assert.doesNotMatch(initialEffect, /refresh(Vocab|Grammar|Classes|Assignments|Results|Accounts|Audit)Data/);

  for (const endpoint of [
    '/api/admin/dashboard-summary',
    '/api/admin/vocab-sets?',
    '/api/admin/grammar-sets?',
    '/api/admin/classes?',
    '/api/admin/class-members?',
    '/api/admin/assignments?',
    '/api/results?view=summary&limit=500',
    '/api/leaderboard-results',
    '/api/admin/accounts-page?',
    '/api/admin/audit-logs-page?'
  ]) {
    assert.ok(dashboardSource.includes(endpoint), `Missing lazy Admin request: ${endpoint}`);
  }
  assert.match(dashboardSource, /activeTab !== 'vocab-sets'/);
  assert.match(dashboardSource, /activeTab !== 'grammar-sets'/);
  assert.match(dashboardSource, /const refreshData = \(\) => \{[\s\S]*activeTab === 'editor'[\s\S]*activeTab === 'grammar-editor'/);
  assert.doesNotMatch(dashboardSource, /const refreshData = \(signal\?: AbortSignal\)/);
});

test('Vocabulary library keeps semantic hooks and action order', () => {
  for (const hook of [
    'sets-tab-content',
    'sets-list',
    'vocab-results-panel',
    'vocab-results-name-filter',
    'vocab-results-game-filter-btn',
    'vocab-results-game-filter-options',
    'vocab-editor-table'
  ]) {
    assert.ok(`${librarySource}\n${resultsSource}\n${editorSource}`.includes(`id="${hook}"`), `Missing Vocabulary hook: ${hook}`);
  }
  const play = librarySource.indexOf('<LibraryPlayAction');
  const edit = librarySource.indexOf('>Sửa</button>', play);
  const clone = librarySource.indexOf('>Sao chép</button>', edit);
  const results = librarySource.indexOf('>Kết quả</button>', clone);
  const remove = librarySource.indexOf('>Xóa</button>', results);
  assert.ok(play > 0 && play < edit && edit < clone && clone < results && results < remove);
});
