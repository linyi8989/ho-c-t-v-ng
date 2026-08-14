import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getListeningSmartImportRoleDefinitions } from './types';

const panelSource = readFileSync(new URL('./SmartImportPanel.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
const externalPart1Source = readFileSync(new URL('./part1ExternalImport.ts', import.meta.url), 'utf8');
const externalParametersSource = readFileSync(new URL('./externalParametersImport.ts', import.meta.url), 'utf8');
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

test('Smart Import exposes exactly external parameters plus Stali and DevQuota ChatGPT 5.6 Sol', () => {
  assert.match(typesSource, /ListeningSmartImportProviderDefinition/);
  assert.match(typesSource, /providers\?: ListeningSmartImportProviderDefinition\[\]/);
  assert.match(panelSource, /aria-label="Chọn nguồn xử lý Smart Import"/);
  assert.match(panelSource, /const SMART_IMPORT_AI_PROVIDER_IDS = \[/);
  assert.match(panelSource, /'stali:gpt-5\.6-sol'/);
  assert.match(panelSource, /'devquota:gpt-5\.6-sol'/);
  assert.match(panelSource, /SMART_IMPORT_AI_PROVIDER_FALLBACKS/);
  assert.match(panelSource, /chưa được backend hiện tại công bố/);
  assert.doesNotMatch(panelSource, /value="auto"/);
  assert.doesNotMatch(panelSource, /'gemini'/);
  assert.doesNotMatch(panelSource, /'openai'/);
  assert.doesNotMatch(panelSource, /gpt-5\.6-(?:luna|terra)/);
  assert.doesNotMatch(panelSource, /deepseek-v4-pro/);
  assert.match(panelSource, /providerDefinitions\.map/);
  assert.match(panelSource, /preferredProvider/);
  assert.match(panelSource, /initialPreferredProvider = EXTERNAL_PARAMETERS_PROVIDER/);
  assert.match(panelSource, /provider\.reason \|\| 'chưa cấu hình'/);
});

test('Part 1 defaults to one-image external parameters and merges through the existing direct-import callback', () => {
  assert.match(part1Source, /initialPreferredProvider=\{PART1_EXTERNAL_PROVIDER\}/);
  assert.match(panelSource, /<option value=\{EXTERNAL_PARAMETERS_PROVIDER\}>Thông số bên ngoài<\/option>/);
  assert.match(panelSource, /allRoleDefinitions\.filter\(definition => definition\.role === 'question'\)/);
  assert.match(panelSource, /data-part-external-parameters=\{part\.part\}/);
  assert.match(panelSource, /parseExternalParametersImport\(part\.part, externalParameters/);
  assert.match(panelSource, /provider: EXTERNAL_PARAMETERS_PROVIDER/);
  assert.match(panelSource, /sources: \[\{ role: 'question', assetId: questionAssetId \}\]/);
  assert.match(panelSource, /latestOnAnalyzedRef\.current\(next\)/);
  assert.match(panelSource, /`Kiểm tra và ghép vào Part \$\{part\.part\}`/);
  assert.match(externalPart1Source, /coordinateSpace === 'pixel'.*rawX \/ imageWidth/);
  assert.doesNotMatch(externalPart1Source, /\/ 1000/);
});

test('external parameter editor copies the complete per-Part model guide without changing the draft', () => {
  assert.match(panelSource, /externalParametersModelInstructions/);
  assert.match(panelSource, /navigator\.clipboard\?\.writeText\) throw[\s\S]*navigator\.clipboard\.writeText\(instructions\)/);
  assert.match(panelSource, /document\.execCommand\('copy'\)/);
  assert.match(panelSource, /window\.prompt\('Trình duyệt không thể sao chép tự động/);
  assert.match(panelSource, /className="external-parameters-copy-button/);
  assert.match(panelSource, /Sao chép hướng dẫn cho AI/);
  assert.match(panelSource, /Đã sao chép/);
  assert.match(panelSource, /<Copy size=\{15\}/);
  assert.match(panelSource, /<Check size=\{15\}/);
  const copyHandlerStart = panelSource.indexOf('const copyExternalInstructions');
  const copyHandlerEnd = panelSource.indexOf('const externalParametersEditor');
  const copyHandler = panelSource.slice(copyHandlerStart, copyHandlerEnd);
  assert.doesNotMatch(copyHandler, /setExternalParameters|onCandidateChange|parseExternalParametersImport/);
});

test('Parts 2-5 external parameters use only the question image and dispatch to strict versioned parsers', () => {
  assert.match(externalParametersSource, /mover-part2-external-v1/);
  assert.match(externalParametersSource, /mover-part3-external-v1/);
  assert.match(externalParametersSource, /mover-part4-external-v1/);
  assert.match(externalParametersSource, /mover-part5-external-v1/);
  assert.match(externalParametersSource, /if \(part === 2\) return parsePart2/);
  assert.match(externalParametersSource, /if \(part === 3\) return parsePart3/);
  assert.match(externalParametersSource, /if \(part === 4\) return parsePart4/);
  assert.match(externalParametersSource, /return parsePart5/);
  assert.match(panelSource, /const externalMode = preferredProvider === EXTERNAL_PARAMETERS_PROVIDER/);
  assert.match(panelSource, /currentPart: part/);
  assert.doesNotMatch(panelSource, /part\.part === 1 && preferredProvider ===/);
  assert.match(part4Source, /invalidQuestionCropData && incoming\.provider === EXTERNAL_PARAMETERS_PROVIDER/);
  assert.match(part4Source, /alignedExample && !invalidExampleCropData/);
  assert.match(part4Source, /part\.questions\.map\(question => question\.options\.map\(option => option\.imageAssetId\)\)/);
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
  assert.match(part5Source, /Phân tích ảnh và nhập Part 5/);
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

test('Part 5 keeps the three-image AI fallback and edge-snapped manual Colour masks', () => {
  assert.deepEqual(getListeningSmartImportRoleDefinitions(5).map(role => [role.role, role.required]), [['question', true], ['answer_key', true], ['position_key', true]]);
  assert.match(part5SceneSource, /Bảng đáp án đã nhập · Part 5/);
  assert.match(part5SceneSource, /Thông số bên ngoài hoặc AI điền nội dung thô/);
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
  assert.doesNotMatch(part5Source, /initialPreferredProvider="stali:gpt-5\.6-sol"/);
  assert.match(part5Source, /analyzeLabel="Phân tích ảnh và nhập Part 5"/);
});
