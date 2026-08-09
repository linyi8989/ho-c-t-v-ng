import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getListeningSmartImportRoleDefinitions } from './types';

const panelSource = readFileSync(new URL('./SmartImportPanel.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../../listening/admin/ListeningAdminModule.tsx', import.meta.url), 'utf8');
const part2Source = readFileSync(new URL('../../listening-library/modules/mover/editor/part2Handler.tsx', import.meta.url), 'utf8');
const part3Source = readFileSync(new URL('../../listening-library/modules/mover/editor/part3Handler.tsx', import.meta.url), 'utf8');
const part4Source = readFileSync(new URL('../../listening-library/modules/mover/editor/part4Handler.tsx', import.meta.url), 'utf8');
const part1Source = readFileSync(new URL('../../listening-library/modules/mover/editor/part1Handler.tsx', import.meta.url), 'utf8');
const part5Source = readFileSync(new URL('../../listening-library/modules/mover/editor/part5Handler.tsx', import.meta.url), 'utf8');
const part5SceneSource = readFileSync(new URL('../../listening-library/modules/mover/editor/Part5SceneEditor.tsx', import.meta.url), 'utf8');

test('whole-exam Resource Tray stays hidden while per-Part Smart Import remains available', () => {
  assert.match(adminSource, /const SHOW_WHOLE_EXAM_RESOURCE_TRAY = false;/);
  assert.match(adminSource, /\{SHOW_WHOLE_EXAM_RESOURCE_TRAY && \(/);
  assert.match(panelSource, /Smart Import · Part \{part\.part\}/);
});

test('selected role source can be detached independently without archiving shared media', () => {
  assert.match(panelSource, /const setSource = \(role: ListeningSmartImportSourceRole, assetId\?: string\) =>/);
  assert.match(panelSource, /onClick=\{\(\) => setSource\(definition\.role\)\}/);
  assert.match(panelSource, /className="smart-import-remove-source/);
  assert.match(panelSource, /title="Bỏ khỏi lần phân tích này"/);
  assert.doesNotMatch(panelSource, /archiveAsset|deleteAsset/);
});

test('role slots are explicit, use FileDropPasteInput, and exclude assets selected by another role', () => {
  assert.match(typesSource, /role: 'question'/);
  assert.match(typesSource, /role: 'answer_key'/);
  assert.match(typesSource, /role: 'position_key'/);
  assert.match(panelSource, /data-smart-import-role=\{definition\.role\}/);
  assert.match(panelSource, /usedByAnotherRole/);
  assert.match(panelSource, /maxFiles=\{1\}/);
  assert.match(panelSource, /<FileDropPasteInput/);
});

test('Smart Import exposes an extensible provider selector with Gemini and ChatGPT labels supplied by capabilities', () => {
  assert.match(typesSource, /ListeningSmartImportProviderDefinition/);
  assert.match(typesSource, /providers\?: ListeningSmartImportProviderDefinition\[\]/);
  assert.match(panelSource, /aria-label="Chọn AI xử lý Smart Import"/);
  assert.match(panelSource, /value="auto">Tự động · Gemini → ChatGPT/);
  assert.match(panelSource, /providerDefinitions\.map/);
  assert.match(panelSource, /preferredProvider/);
  assert.match(panelSource, /provider\.reason \|\| 'chưa cấu hình'/);
});

test('Part 2 always keeps manual illustration cropping available after analysis even without an AI crop hint', () => {
  assert.match(part2Source, /candidate\.data\.illustrationCrop \|\| \{ x: 0, y: 0, width: 1, height: 1 \}/);
  assert.match(part2Source, /<VisualCropEditor/);
});

test('Part 1 region editor exposes only the five scored targets, never the printed example', () => {
  assert.match(part1Source, /const regionItems = part\.targets\.map/);
  assert.doesNotMatch(part1Source, /label: `Example:/);
  assert.doesNotMatch(part1Source, /items\.find\(item => item\.id === part\.example/);
});

test('Parts 1-5 import a validated analysis directly into their editable draft', () => {
  assert.match(part1Source, /onAnalyzed=\{importAnalysis\}/);
  assert.match(part2Source, /onAnalyzed=\{importAnalysis\}/);
  assert.match(part3Source, /onAnalyzed=\{importAnalysis\}/);
  assert.match(part4Source, /onAnalyzed=\{importAnalysis\}/);
  assert.match(part5Source, /onAnalyzed=\{importAnalysis\}/);
  assert.match(part4Source, /Phân tích, crop và nhập Part 4/);
  assert.match(part5Source, /GPT-5\.6 Sol đọc 3 ảnh và nhập Part 5/);
});

test('Part 3 keeps the two-image AI workflow compact and edits the imported result in the main form', () => {
  assert.match(part3Source, /pastedTextPlacement="advanced"/);
  assert.match(part3Source, /data-part3-mapping-summary/);
  assert.match(part3Source, /data-part3-advanced-editor/);
  assert.match(part3Source, /Đã nhập mapping Part 3 vào bài soạn/);
  assert.match(part3Source, /part3PicturePositionLabel/);
  assert.doesNotMatch(part3Source, /label="Ảnh đề bài Part 3"/);
  assert.match(panelSource, /pastedTextPlacement === 'advanced'/);
});

test('Part 5 uses Sol for three-image Draw placement and edge-snapped manual Colour masks', () => {
  assert.deepEqual(getListeningSmartImportRoleDefinitions(5).map(role => [role.role, role.required]), [['question', true], ['answer_key', true], ['position_key', true]]);
  assert.match(part5SceneSource, /Bảng đáp án AI · Part 5/);
  assert.match(part5SceneSource, /Vẽ để chọn vùng đáp án/);
  assert.match(part5SceneSource, /data-part5-distractor-row/);
  assert.match(part5SceneSource, /Màu nhiễu/);
  assert.match(part5SceneSource, /Tên vật nhiễu/);
  assert.match(part5SceneSource, /compact/);
  assert.match(part5SceneSource, /allowedMimeTypes=\{\['image\/png'\]\}/);
  assert.match(part5SceneSource, /geometryConfirmedByTeacher/);
  assert.match(part5SceneSource, /<ListeningRegionEditor\s+freehandOnly\s+edgeSnap/);
  assert.match(part5SceneSource, /<ListeningRegionEditor\s+rectangleOnly\s+imageUrl/);
  assert.match(part5SceneSource, /data-part5-draw-recovery-row/);
  assert.match(part5Source, /initialPreferredProvider="stali:gpt-5\.6-sol"/);
  assert.match(part5Source, /GPT-5\.6 Sol đọc 3 ảnh và nhập Part 5/);
});
