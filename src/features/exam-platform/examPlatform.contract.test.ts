import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeStarterPart2PromptForMover } from './student/StarterInteractions';

const adminSource = readFileSync(new URL('../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../listening-library/clientRegistry.ts', import.meta.url), 'utf8');
const listeningRouterSource = readFileSync(new URL('../../server/listening/listeningRouter.ts', import.meta.url), 'utf8');
const examRouterSource = readFileSync(new URL('../../server/exam-platform/examRouter.ts', import.meta.url), 'utf8');
const genericAdminSource = readFileSync(new URL('./admin/GenericExamAdmin.tsx', import.meta.url), 'utf8');
const starterAuthoringSource = readFileSync(new URL('./admin/StarterAuthoring.tsx', import.meta.url), 'utf8');
const universalAuthoringSource = readFileSync(new URL('./admin/UniversalAuthoring.tsx', import.meta.url), 'utf8');
const universalImporterSource = readFileSync(new URL('./universalImport.ts', import.meta.url), 'utf8');
const starterPlayerSource = readFileSync(new URL('./student/StarterInteractions.tsx', import.meta.url), 'utf8');
const genericPlayerSource = readFileSync(new URL('./student/GenericExamLearningArea.tsx', import.meta.url), 'utf8');
const starterResultSource = readFileSync(new URL('./student/StarterListeningResult.tsx', import.meta.url), 'utf8');
const starterReadingAuthoringSource = readFileSync(new URL('./admin/StarterReadingWritingAuthoring.tsx', import.meta.url), 'utf8');
const starterReadingPlayerSource = readFileSync(new URL('./student/StarterReadingWritingViews.tsx', import.meta.url), 'utf8');
const starterReadingResultSource = readFileSync(new URL('./student/StarterReadingWritingResult.tsx', import.meta.url), 'utf8');
const imageViewerSource = readFileSync(new URL('./student/ExamImageViewer.tsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../../server/exam-platform/examValidation.ts', import.meta.url), 'utf8');
const globalCssSource = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

test('all new modules use the shared client platform and IELTS remains Academic-only', () => {
  for (const moduleName of ['starter', 'flyer', 'ket', 'pet', 'fce', 'ielts']) {
    assert.match(registrySource, new RegExp(`${moduleName}ClientModule`));
  }
  assert.doesNotMatch(registrySource, /generalTraining|general-reading|general-writing/i);
});

test('assignment scheduler, server and canonical route share the generic exam contract', () => {
  for (const contract of [
    "resourceType === 'exam'",
    '/api/exam-platform/admin/sets',
    'examSetId',
    'examModuleId',
    'examPaperId',
    'examPaperExamPath(assignment.examModuleId, assignment.examPaperId',
  ]) {
    assert.ok(adminSource.includes(contract), `Admin exam assignment contract is missing: ${contract}`);
  }
  for (const contract of [
    'payload.resourceType === "exam"',
    'collection("exam_sets")',
    'examSetId: resource.id',
    'examModuleId: resource.moduleId',
    'examPaperId: resource.paperId',
  ]) {
    assert.ok(serverSource.includes(contract), `Server exam assignment contract is missing: ${contract}`);
  }
});

test('published exam media is usage-tracked and answer keys are sanitized server-side', () => {
  assert.match(examRouterSource, /collection\('exam_asset_usages'\)/);
  assert.match(listeningRouterSource, /collection\('exam_asset_usages'\)/);
  assert.match(examRouterSource, /sanitizeExamContentForStudent/);
  assert.match(examRouterSource, /exam_set_versions/);
  assert.match(examRouterSource, /pending_review/);
  assert.match(examRouterSource, /block-image/);
  assert.match(examRouterSource, /block-audio/);
});

test('generic exam start actions keep explicit contrast without touching Movers players', () => {
  assert.match(genericPlayerSource, /id="generic-exam-player"/);
  assert.match(genericPlayerSource, /exam-platform-primary-action/);
  assert.match(genericPlayerSource, /exam-platform-secondary-action/);
  assert.doesNotMatch(genericPlayerSource, /mover-reading-primary-action/);
});

test('new exam modules keep readable navigation, protected transcripts and responsive image controls', () => {
  for (const contract of [
    'exam-platform-result-review',
    'exam-platform-result-home',
    'exam-platform-result-retry',
    'exam-platform-part-tab',
    'exam-platform-part-nav',
  ]) assert.ok(genericPlayerSource.includes(contract), `Generic student navigation is missing: ${contract}`);
  for (const contract of [
    'listening-primary-action',
    'listening-review-action',
    'listening-retry-action',
    'listening-secondary-action',
  ]) {
    assert.ok(starterResultSource.includes(contract), `Starter result navigation is missing: ${contract}`);
    assert.ok(globalCssSource.includes(contract), `High-contrast CSS is missing: ${contract}`);
  }
  assert.doesNotMatch(starterResultSource, /key: 'example'/, 'the printed matching example must not be redrawn in review');
  assert.match(starterResultSource, /strokeWidth=\{\.003\}/);
  assert.match(starterResultSource, /moverLayout/);
  assert.match(starterResultSource, /sceneDrawTargets/);
  assert.match(genericAdminSource, /Nội dung bài nghe \/ hội thoại/);
  assert.match(genericAdminSource, /Chỉ hiển thị sau khi học sinh hoàn thành bài và được phép xem kết quả/);
  assert.match(validationSource, /delete safePart\.audioTranscript/);
  assert.match(examRouterSource, /transcripts: version\.content\.parts\.flatMap/);
  for (const contract of ['maxHeight', 'ZoomIn', 'ZoomOut', 'requestFullscreen', "event.key === 'Escape'"]) {
    assert.ok(imageViewerSource.includes(contract), `Responsive image viewer is missing: ${contract}`);
  }
  assert.match(genericPlayerSource, /ExamImageViewer/);
  assert.match(starterPlayerSource, /ExamImageViewer/);
});

test('Universal JSON owns dynamic Parts/blocks while Starter keeps teacher-owned visual tools', () => {
  for (const contract of [
    'Nhập JSON tổng',
    'Nhập lại JSON Part',
    'FileDropPasteInput',
    'VisualCropEditor',
    'cropListeningImage',
    'FixedRegionEditor',
    'detectPart4Frames',
    'groupStarterPart3OptionCrops',
    'geometryConfirmedByTeacher',
  ]) assert.ok(starterAuthoringSource.includes(contract), `Starter authoring contract is missing: ${contract}`);
  for (const contract of ['UniversalWholeImportPanel', 'UniversalPartImportPanel', 'copy-universal-json-prompt', 'copy-part-json-prompt', 'importUniversalExamBundle']) assert.ok(universalAuthoringSource.includes(contract), `Universal authoring contract is missing: ${contract}`);
  for (const contract of ['exam-bundle-import-v2', 'structureMode: \'dynamic\'', 'blocks', 'geometryHints']) assert.ok(universalImporterSource.includes(contract), `Universal importer contract is missing: ${contract}`);
  assert.match(genericAdminSource, /content\.parts\.map\(\(part, index\) => `Part/);
  assert.match(genericAdminSource, /examPartUnits\(part\)/);
  assert.match(genericAdminSource, /pasteImages=\{starter\}/);
  assert.match(genericAdminSource, /pasteImages=\{moduleId === 'starter'\}/);
  assert.match(starterPlayerSource, /starter-image-matching-v1/);
  assert.match(starterPlayerSource, /starter-image-matching-v2/);
  assert.match(starterPlayerSource, /starter-scene-colour-v1/);
  assert.match(starterPlayerSource, /scene-draw-v1/);
  assert.match(starterPlayerSource, /data-exam-interaction="scene-draw"/);
  assert.match(starterPlayerSource, /text\/exam-scene-draw/);
  assert.match(starterPlayerSource, /target\.tokenUrl/);
  assert.match(starterAuthoringSource, /STARTER_BASIC_COLOURS/);
  assert.match(starterAuthoringSource, /scene-colour-draw-unified/);
  assert.match(starterAuthoringSource, /activeRegion/);
  assert.match(starterAuthoringSource, /Chọn vùng để tô/);
  assert.match(starterAuthoringSource, /Chọn vùng đặt vật/);
  assert.doesNotMatch(starterAuthoringSource, /Mask các vùng Colour trên ảnh chung/);
  assert.doesNotMatch(starterAuthoringSource, /Vùng đích Draw trên ảnh chung/);
  assert.match(starterAuthoringSource, /10 màu cơ bản/);
  assert.match(starterAuthoringSource, /Ảnh PNG kéo thả/);
  assert.match(validationSource, /delete safeTarget\.targetRegion/);
  assert.match(starterPlayerSource, /starterMatchingResponseKey/);
  assert.match(starterPlayerSource, /starter-matching-lines/);
  assert.match(starterPlayerSource, /focusable="false"/);
  assert.match(starterPlayerSource, /onPointerDown=\{event => event\.preventDefault\(\)\}/);
  assert.match(starterPlayerSource, /data-connected=\{connected/);
  assert.doesNotMatch(starterPlayerSource, /correctOptionIds/);
  assert.match(universalAuthoringSource, /data-exam-action="copy-universal-json-prompt"/);
  assert.match(universalAuthoringSource, /Sao chép prompt gửi ChatGPT/);
});

test('Starter Listening Part 2 uses the fixed Movers-style short-answer editor and player', () => {
  assert.match(genericAdminSource, /const starterListening = starter && content\.paperId === 'listening'/);
  assert.match(genericAdminSource, /const starterPart2 = starterListening && part\.part === 2/);
  assert.match(genericAdminSource, /!starterListening && !starterPart2 && !starterReadingWriting && <label[^>]*>Đoạn đọc\/nội dung chung của Part/);
  assert.match(starterAuthoringSource, /data-starter-special-editor="text-entry"/);
  assert.match(starterAuthoringSource, /Dạng câu được cố định là short-answer/);
  assert.match(starterPlayerSource, /data-starter-interaction="text-entry"/);
  assert.match(starterPlayerSource, /ListeningPart2View/);
  assert.match(starterPlayerSource, /const moverPart: ListeningPart2/);
  assert.match(starterPlayerSource, /starterPart2Blank/);
  assert.match(genericPlayerSource, /starterListening && part\.part === 2 && unit\.interaction\.variant === 'inline-gap'/);
  assert.match(starterPlayerSource, /props\.part\.part === 2 && props\.part\.interaction\.variant === 'inline-gap'/);
  assert.equal(normalizeStarterPart2PromptForMover('Which class is Sam in?'), 'Which class is Sam in? {{answer}}');
  assert.equal(normalizeStarterPart2PromptForMover("What's the name? {{answer}}"), "What's the name? {{answer}}");
  assert.equal(normalizeStarterPart2PromptForMover('Teacher: ____ / duplicate {{blank}}'), 'Teacher: {{answer}} / duplicate ');
});

test('Starter Listening Part 3 uses Movers image options and keeps manual crop collapsed', () => {
  assert.match(genericPlayerSource, /starterListening && part\.part === 3 && unit\.interaction\?\.variant === 'image-options'/);
  assert.match(starterPlayerSource, /ListeningPart4View/);
  assert.match(starterAuthoringSource, /useState<\{ questionIndex: number; optionIndex: number \} \| null>\(null\)/);
  assert.match(starterAuthoringSource, /Crop lại \/ thay ảnh/);
  assert.match(starterAuthoringSource, /selection && selectedOption &&/);
  assert.match(genericAdminSource, /Ảnh hiển thị chung cho học sinh/);
  assert.match(starterAuthoringSource, /Ảnh nguồn chỉ dùng để crop 15 đáp án/);
  assert.match(starterAuthoringSource, /không được gửi cho học sinh/);
  assert.match(starterPlayerSource, /data-starter-listening-part3/);
  assert.match(starterPlayerSource, /alt="Minh họa Part 3"/);
  assert.match(validationSource, /delete safeBlock\.imageAssetId/);
  assert.match(validationSource, /delete safeBlock\.imageUrl/);
});

test('Starters Reading & Writing keeps five fixed authoring, player and visual-review layouts', () => {
  assert.match(genericAdminSource, /fixedStarterPaper = moduleId === 'starter' && \(paperId === 'listening' \|\| paperId === 'reading-writing'\)/);
  assert.match(genericAdminSource, /StarterReadingWritingAuthoring/);
  assert.match(genericPlayerSource, /StarterReadingWritingPartView/);
  assert.match(genericPlayerSource, /StarterReadingWritingResult/);
  for (const contract of [
    'Ảnh example ở phía trên',
    'Ảnh bài làm ở cột bên trái',
    'Ảnh tình huống ở cột bên trái',
    'Ảnh nguyên trang hiển thị bên trái cho học sinh',
    'Ảnh ngân hàng từ/hình ở cột bên trái',
    'Tranh và câu chuyện',
    'const counts = [1, 2, 2]',
    '2 example +',
  ]) assert.ok(starterReadingAuthoringSource.includes(contract), `Starters Reading authoring is missing: ${contract}`);
  assert.match(starterReadingPlayerSource, /part\.part === 1/);
  assert.match(starterReadingPlayerSource, /part\.part === 2/);
  assert.match(starterReadingPlayerSource, /part\.part === 3/);
  assert.match(starterReadingPlayerSource, /part\.part === 4/);
  assert.match(starterReadingPlayerSource, /readingScenes/);
  assert.match(starterReadingPlayerSource, /ExamImageViewer/);
  assert.match(starterReadingResultSource, /starter-reading-review-part-tab/);
  assert.match(starterReadingResultSource, /Quay lại tổng kết/);
  assert.match(starterReadingResultSource, /Xem kết quả/);
  for (const cssHook of ['starter-reading-primary-action', 'starter-reading-review-action', 'starter-reading-review-part-tab', 'starter-reading-review-part-nav']) {
    assert.ok(globalCssSource.includes(cssHook), `Starters Reading contrast CSS is missing: ${cssHook}`);
  }
});
