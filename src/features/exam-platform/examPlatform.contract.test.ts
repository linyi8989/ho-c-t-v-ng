import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EXAM_IMAGE_PROFILES } from '../exam-media/imageProfiles';
import { normalizeStarterPart2PromptForMover } from './student/StarterInteractions';
import { resolveExamImageProfile, resolveExamTaskLayout } from './student/examPresentation';

const adminSource = readFileSync(new URL('../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../listening-library/clientRegistry.ts', import.meta.url), 'utf8');
const listeningRouterSource = readFileSync(new URL('../../server/listening/listeningRouter.ts', import.meta.url), 'utf8');
const examRouterSource = readFileSync(new URL('../../server/exam-platform/examRouter.ts', import.meta.url), 'utf8');
const genericAdminSource = readFileSync(new URL('./admin/GenericExamAdmin.tsx', import.meta.url), 'utf8');
const starterAuthoringSource = readFileSync(new URL('./admin/StarterAuthoring.tsx', import.meta.url), 'utf8');
const universalAuthoringSource = readFileSync(new URL('./admin/UniversalAuthoring.tsx', import.meta.url), 'utf8');
const universalImporterSource = readFileSync(new URL('./universalImport.ts', import.meta.url), 'utf8');
const universalPromptSource = readFileSync(new URL('./universalImportPrompt.ts', import.meta.url), 'utf8');
const starterPlayerSource = readFileSync(new URL('./student/StarterInteractions.tsx', import.meta.url), 'utf8');
const genericPlayerSource = readFileSync(new URL('./student/GenericExamLearningArea.tsx', import.meta.url), 'utf8');
const moverListeningPlayerSource = readFileSync(new URL('../listening/student/ListeningLearningArea.tsx', import.meta.url), 'utf8');
const moverReadingLearningSource = readFileSync(new URL('../mover-reading-writing/student/MoverReadingWritingLearningArea.tsx', import.meta.url), 'utf8');
const starterResultSource = readFileSync(new URL('./student/StarterListeningResult.tsx', import.meta.url), 'utf8');
const starterReadingAuthoringSource = readFileSync(new URL('./admin/StarterReadingWritingAuthoring.tsx', import.meta.url), 'utf8');
const starterReadingPlayerSource = readFileSync(new URL('./student/StarterReadingWritingViews.tsx', import.meta.url), 'utf8');
const starterReadingResultSource = readFileSync(new URL('./student/StarterReadingWritingResult.tsx', import.meta.url), 'utf8');
const flyerAuthoringSource = readFileSync(new URL('./admin/FlyerListeningAuthoring.tsx', import.meta.url), 'utf8');
const flyerPlayerSource = readFileSync(new URL('./student/FlyerListeningViews.tsx', import.meta.url), 'utf8');
const flyerReadingAuthoringSource = readFileSync(new URL('./admin/FlyerReadingWritingAuthoring.tsx', import.meta.url), 'utf8');
const flyerReadingPlayerSource = readFileSync(new URL('./student/FlyerReadingWritingViews.tsx', import.meta.url), 'utf8');
const flyerReadingResultSource = readFileSync(new URL('./student/FlyerReadingWritingResult.tsx', import.meta.url), 'utf8');
const ketReadingAuthoringSource = readFileSync(new URL('./admin/KetReadingWritingAuthoring.tsx', import.meta.url), 'utf8');
const ketReadingPlayerSource = readFileSync(new URL('./student/KetReadingWritingViews.tsx', import.meta.url), 'utf8');
const ketReadingResultSource = readFileSync(new URL('./student/KetReadingWritingResult.tsx', import.meta.url), 'utf8');
const ketReadingMigrationSource = readFileSync(new URL('./ketReadingWritingMigration.ts', import.meta.url), 'utf8');
const ketListeningAuthoringSource = readFileSync(new URL('./admin/KetListeningAuthoring.tsx', import.meta.url), 'utf8');
const ketListeningPlayerSource = readFileSync(new URL('./student/KetListeningViews.tsx', import.meta.url), 'utf8');
const ketListeningMigrationSource = readFileSync(new URL('./ketListeningMigration.ts', import.meta.url), 'utf8');
const ketListeningCropSource = readFileSync(new URL('./ketListeningCrops.ts', import.meta.url), 'utf8');
const writingGradingProviderSource = readFileSync(new URL('../../server/exam-platform/writingGradingProvider.ts', import.meta.url), 'utf8');
const imageViewerSource = readFileSync(new URL('../exam-media/ExamImageViewer.tsx', import.meta.url), 'utf8');
const imageProfileSource = readFileSync(new URL('../exam-media/imageProfiles.ts', import.meta.url), 'utf8');
const splitLayoutSource = readFileSync(new URL('../exam-media/ExamSplitTaskLayout.tsx', import.meta.url), 'utf8');
const moverReadingPlayerSource = readFileSync(new URL('../mover-reading-writing/student/MoverReadingWritingPartViews.tsx', import.meta.url), 'utf8');
const listeningPartViewsSource = readFileSync(new URL('../listening/student/ListeningPartViews.tsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../../server/exam-platform/examValidation.ts', import.meta.url), 'utf8');
const globalCssSource = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
const listeningAssetPickerSource = readFileSync(new URL('../listening/admin/ListeningAssetPicker.tsx', import.meta.url), 'utf8');

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const luminance = (hex: string) => hexToRgb(hex)
  .map(channel => channel / 255)
  .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrastRatio = (foreground: string, background: string) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

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

test('timed practice attempts remain submittable and automatic timeout submission runs once', () => {
  assert.doesNotMatch(examRouterSource, /Thời gian làm bài đã kết thúc/);
  assert.match(examRouterSource, /const timedOut = Boolean\(ticket\.deadlineAt/);
  assert.match(examRouterSource, /timedOut,/);
  for (const source of [genericPlayerSource, moverListeningPlayerSource, moverReadingLearningSource]) {
    assert.match(source, /automaticSubmitStarted/);
    assert.match(source, /remaining === 0 && !automaticSubmitStarted\.current/);
  }
});

test('expired generic exam tickets use one bounded authenticated recovery before retrying submission', () => {
  assert.match(examRouterSource, /EXAM_TICKET_RENEWAL_GRACE_MS = 7 \* 24 \* 60 \* 60_000/);
  assert.match(examRouterSource, /attempts\/renew/);
  assert.match(examRouterSource, /allowExpired: true/);
  assert.match(examRouterSource, /ticketRecoveryEndsAt/);
  assert.match(genericPlayerSource, /examPlatformApi\.renewAttempt/);
  assert.match(genericPlayerSource, /Number\(reason\?\.status\) !== 410/);
  assert.match(genericPlayerSource, /submissionPending: retryable/);
  assert.doesNotMatch(genericPlayerSource, /reason\.message\} Bạn có thể nộp lại với cùng lượt làm bài/);
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

test('student exam images use shared viewport-aware profiles and overflow-safe split layouts', () => {
  assert.deepEqual(Object.keys(EXAM_IMAGE_PROFILES), [
    'default',
    'cover',
    'split-page',
    'illustration',
    'page-scan',
    'story-scene',
    'word-bank',
    'interactive-scene',
    'option',
  ]);
  assert.equal(EXAM_IMAGE_PROFILES['split-page'].maxWidth, '540px');
  assert.equal(EXAM_IMAGE_PROFILES['interactive-scene'].maxWidth, '760px');
  assert.match(EXAM_IMAGE_PROFILES['interactive-scene'].maxHeight, /100dvh - 390px/);
  assert.equal(EXAM_IMAGE_PROFILES.option.maxWidth, '112px');
  assert.match(imageProfileSource, /100dvh/);
  assert.match(imageViewerSource, /data-exam-image-profile/);
  assert.match(imageViewerSource, /data-exam-image-stage/);
  assert.match(imageViewerSource, /resolvedMaxWidth/);
  assert.match(imageViewerSource, /naturalSize\.width \* scale/);
  assert.match(imageViewerSource, /setScale\('fit'\)/);
  assert.match(imageViewerSource, /setScale\(1\)/);
  assert.doesNotMatch(imageViewerSource, /Math\.min\(3|Math\.max\(\.5/);
  assert.match(listeningPartViewsSource, /ExamImageViewer/);
  assert.match(listeningPartViewsSource, /profile="interactive-scene"/);
  assert.match(listeningPartViewsSource, /frameRef=\{boardRef\}/);
  assert.match(listeningPartViewsSource, /maxWidth="100%"/);
  assert.match(listeningPartViewsSource, /maxHeight="max\(220px, calc\(100dvh - 390px\)\)"/);
  assert.match(listeningPartViewsSource, /stageProps=\{\{/);
  assert.match(splitLayoutSource, /47fr/);
  assert.match(splitLayoutSource, /53fr/);
  assert.doesNotMatch(splitLayoutSource, /grid-cols-\[minmax\(0,44%\)|grid-cols-\[minmax\(0,56%\)/);
  assert.match(starterReadingPlayerSource, /ExamSplitTaskLayout/);
  assert.match(starterReadingResultSource, /ExamSplitTaskLayout/);
  assert.match(moverReadingPlayerSource, /ExamSplitTaskLayout/);
  assert.doesNotMatch(moverReadingPlayerSource, /grid-cols-\[minmax\(0,44%\)|grid-cols-\[minmax\(0,56%\)/);
  assert.match(listeningPartViewsSource, /listening-image-option/);
  assert.match(globalCssSource, /data-starter-interaction="image-options"/);
  assert.equal(resolveExamTaskLayout({ moduleId: 'flyer', paperId: 'reading-writing', partNumber: 3 }), 'split-task');
  assert.equal(resolveExamTaskLayout({ moduleId: 'starter', paperId: 'reading-writing', partNumber: 3 }), 'stack');
  assert.equal(resolveExamImageProfile({ moduleId: 'flyer', paperId: 'reading-writing', partNumber: 3, mediaRole: 'part' }), 'split-page');
  assert.equal(resolveExamImageProfile({ moduleId: 'starter', paperId: 'listening', partNumber: 1, mediaRole: 'part', interaction: { family: 'matching', subtype: 'image-to-image', variant: 'lines', schemaVersion: 1 } }), 'interactive-scene');
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
  assert.match(genericAdminSource, /const fixedListeningPart2 = \(starterListening \|\| flyerListening\) && part\.part === 2/);
  assert.match(genericAdminSource, /!starterListening && !fixedListeningPart2 && !fixedReadingWritingAuthoring && !ketListening && <label[^>]*>Đoạn đọc\/nội dung chung của Part/);
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

test('Flyers Listening keeps five fixed Movers-style authoring, player and review layouts', () => {
  assert.match(genericAdminSource, /FlyerListeningAuthoring/);
  assert.match(genericPlayerSource, /FlyerListeningPartView/);
  for (const contract of ['name-placement', 'two-image-letter-input', 'StarterSpecialPartEditor', 'StarterListeningPart4Editor', 'Tải\/dán ảnh người và tên', 'Tải\/dán ảnh hiển thị']) assert.match(flyerAuthoringSource, new RegExp(contract));
  assert.match(flyerAuthoringSource, /FixedRegionEditor/);
  assert.match(flyerAuthoringSource, /width=\{FLYER_NAME_REGION_WIDTH\} height=\{FLYER_NAME_REGION_HEIGHT\}/);
  assert.doesNotMatch(flyerAuthoringSource, /Xác nhận năm vùng hiện tại/);
  assert.match(flyerAuthoringSource, /pasteDrawTokens/);
  assert.match(starterAuthoringSource, /uploadLabel="Tải\/dán PNG"/);
  assert.match(genericAdminSource, /normalizeFixedFlyerListeningContent/);
  for (const contract of ['ListeningPart1View', 'StarterTextEntryView', 'data-flyer-part3-fixed-frames', 'fillFrame', 'data-flyer-listening-part="4"', 'StarterImageOptionsView', 'StarterListeningPart4View']) assert.match(flyerPlayerSource, new RegExp(contract));
  assert.match(starterResultSource, /FlyerNameResults/);
  assert.match(starterResultSource, /FlyerLetterResults/);
  assert.match(starterResultSource, /data-flyer-part3-review-fixed-frames/);
  assert.match(starterResultSource, /displayImageUrl/);
});

test('Flyers Reading & Writing keeps seven fixed Part types with flexible scored counts', () => {
  assert.match(genericAdminSource, /FlyerReadingWritingAuthoring/);
  assert.match(genericAdminSource, /normalizeFixedFlyerReadingWritingContent/);
  assert.match(genericPlayerSource, /FlyerReadingWritingPartView/);
  assert.match(genericPlayerSource, /FlyerReadingWritingResult/);
  for (const contract of [
    'data-flyer-reading-writing-editor',
    'FlyerPart3Editor',
    'Ảnh lựa chọn A-H hiển thị bên trái',
    'Số câu chấm điểm lấy theo đề gốc hoặc JSON',
    'StoryCompletionEditor',
    'ChoiceClozeEditor',
    'OpenClozeEditor',
    'CountControls',
  ]) assert.ok(flyerReadingAuthoringSource.includes(contract), `Flyers Reading authoring is missing: ${contract}`);
  assert.match(flyerReadingPlayerSource, /part\.part === 7/);
  assert.match(flyerReadingPlayerSource, /optionalImage/);
  assert.match(flyerReadingPlayerSource, /FlyerLetterMatchingView/);
  assert.match(flyerReadingPlayerSource, /MarkerPassage/);
  assert.match(flyerReadingPlayerSource, /ImageChoiceRows/);
  assert.match(flyerReadingPlayerSource, /data-flyer-reading-part1-rows/);
  assert.match(flyerReadingPlayerSource, /grid-cols-\[minmax\(0,1fr\)_9rem\]/);
  assert.match(flyerReadingPlayerSource, /data-flyer-reading-part2-rows/);
  assert.match(flyerReadingPlayerSource, /grid-cols-\[minmax\(0,1fr\)_4\.5rem_4\.5rem\]/);
  assert.match(flyerReadingPlayerSource, /sm:grid-cols-\[42px_repeat\(3,minmax\(0,1fr\)\)\]/);
  assert.match(flyerReadingPlayerSource, /ExamImageViewer/);
  assert.match(flyerReadingAuthoringSource, /Ảnh bài đọc duy nhất · học sinh nhìn bên trái/);
  assert.match(flyerReadingAuthoringSource, /Bên phải học sinh chỉ thấy các hàng đáp án A\/B\/C như Movers Reading & Writing Part 6/);
  assert.match(flyerPlayerSource, /flex items-center gap-2 rounded-xl/);
  assert.match(flyerReadingResultSource, /playable\.content\.parts\.map/);
  assert.match(flyerReadingResultSource, /ImageChoicePart/);
  assert.match(flyerReadingResultSource, /starter-reading-review-part-tab/);
  assert.match(flyerReadingResultSource, /Quay lại tổng kết/);
  assert.match(flyerReadingResultSource, /showPrompt=\{false\}/);
  assert.match(globalCssSource, /#flyer-reading-result-screen button\.starter-reading-primary-action/);
  assert.match(globalCssSource, /#flyer-reading-review-screen button\.starter-reading-review-part-tab/);
  assert.match(globalCssSource, /#flyer-reading-review-screen button\.starter-reading-secondary-action/);
});

test('KET Reading & Writing keeps nine fixed Part types with flexible rows and safe Writing grading', () => {
  assert.match(genericAdminSource, /KetReadingWritingAuthoring/);
  assert.match(genericAdminSource, /normalizeFixedKetReadingWritingContent/);
  assert.match(genericAdminSource, /legacyKetReadingWriting/);
  assert.match(genericPlayerSource, /KetReadingWritingPartView/);
  assert.match(genericPlayerSource, /KetReadingWritingResult/);
  for (const contract of [
    'KET_READING_WRITING_TEMPLATE_VERSION',
    'KET_READING_WRITING_DEFAULT_COUNTS = [5, 5, 10, 7, 8, 5, 10, 5, 1]',
    "'compound-choice-and-letter'",
    "'initial-letter-spelling'",
    "'image-form-fields'",
    "'ai-guided-writing'",
    'Released seven-Part papers stay untouched',
  ]) assert.ok(ketReadingMigrationSource.includes(contract), `KET migration is missing: ${contract}`);
  for (const contract of [
    'data-ket-reading-writing-part',
    'data-ket-part-three-blocks',
    'Part 3A',
    'Part 3B',
    'answerLength',
    'data-ket-count-controls',
    'providerId',
    'writingGradingProviders',
    'scoreScale: 10',
  ]) assert.ok(ketReadingAuthoringSource.includes(contract), `KET authoring is missing: ${contract}`);
  for (const contract of [
    'id="ket-reading-writing-player"',
    'FlyerLetterMatchingView',
    'SpellingCells',
    'data-ket-image-top',
    'stackPrompt',
    'data-ket-two-column',
    'data-ket-text-source',
    'data-active-group',
    'data-ket-writing-page',
    'data-ket-numbered-gap-rows',
  ]) assert.ok(ketReadingPlayerSource.includes(contract), `KET player is missing: ${contract}`);
  assert.match(ketReadingMigrationSource, /characters\.slice\(prefix\.length\)\.join/);
  assert.match(ketReadingMigrationSource, /answerSuffix: _answerSuffix/);
  assert.match(universalPromptSource, /accepted\(\['assport'\]\)/);
  assert.match(universalPromptSource, /Part 2: không dùng ảnh/);
  assert.match(universalPromptSource, /content\.passage phải chứa toàn bộ hướng dẫn, bài đọc và example/);
  assert.match(universalPromptSource, /Part 9: không dùng ảnh/);
  assert.match(universalPromptSource, /questions: choices\(5, true, 11\)/);
  assert.match(universalPromptSource, /questions: letters\(5, 16\)/);
  assert.match(universalPromptSource, /không đánh lại thành 1\.\.5/);
  assert.match(universalPromptSource, /Không sinh answerSuffix/);
  assert.match(ketReadingAuthoringSource, /<ChoiceRows unit=\{first\} showPrompt onChange=\{commit\} \/>/);
  assert.doesNotMatch(ketReadingAuthoringSource, /<ExampleEditor examples=\{first\.examples \|\| \[\]\}/);
  assert.match(ketReadingPlayerSource, /showPrompt imageTop hideExamples stackPrompt/);
  assert.match(ketReadingPlayerSource, /withoutImage stackPrompt/);
  assert.match(ketReadingResultSource, /<CompoundReview units=\{units\} results=\{results\} \/>/);
  assert.match(flyerPlayerSource, /question\.displayNumber \|\| index \+ 1/);
  assert.match(validationSource, /Part \$\{partNumber\}.*mỗi câu phải có nội dung câu hỏi hiển thị phía trên ba đáp án A\/B\/C/s);
  for (const contract of [
    'id="ket-reading-writing-result-screen"',
    'id="ket-reading-writing-review-screen"',
    'writingScore',
    'grammarErrors',
    'vocabularyErrors',
    'aiFeedback',
  ]) assert.ok(ketReadingResultSource.includes(contract), `KET result is missing: ${contract}`);
  assert.match(examRouterSource, /retry-writing-grade/);
  assert.match(examRouterSource, /aiGradingStatus: 'queued'/);
  assert.match(examRouterSource, /aiGradingStatus: 'processing'/);
  assert.match(examRouterSource, /aiGradingStatus: 'failed'/);
  assert.match(examRouterSource, /describeWritingGradingFailure\(error/);
  assert.match(examRouterSource, /aiGradingMessage: `\$\{failureReason\} Giáo viên có thể thử lại hoặc chấm tay\.`/);
  assert.match(writingGradingProviderSource, /Uses only the explicitly selected provider/);
  assert.match(writingGradingProviderSource, /UNTRUSTED STUDENT ESSAY/);
  assert.match(writingGradingProviderSource, /Number\.isInteger\(score\)/);
  assert.match(writingGradingProviderSource, /describeWritingGradingFailure/);
  assert.match(ketReadingAuthoringSource, /provider\.enabled \? ' · đã cấu hình' : ' · chưa cấu hình'/);
  assert.match(globalCssSource, /#ket-reading-writing-authoring/);
  assert.match(globalCssSource, /#ket-reading-writing-player/);
  assert.match(globalCssSource, /#ket-reading-writing-result-screen/);
  assert.match(globalCssSource, /#ket-reading-writing-review-screen/);
  for (const hook of ['ket-part-three-tab', 'ket-part-three-page-nav']) {
    assert.ok(ketReadingPlayerSource.includes(hook), `KET Part 3 player contrast hook is missing: ${hook}`);
    assert.ok(ketReadingResultSource.includes(hook), `KET Part 3 review contrast hook is missing: ${hook}`);
    assert.ok(globalCssSource.includes(hook), `KET Part 3 contrast CSS is missing: ${hook}`);
  }
  for (const hook of ['ket-reading-result-home', 'ket-reading-result-retry']) {
    assert.ok(ketReadingResultSource.includes(hook), `KET result action contrast hook is missing: ${hook}`);
    assert.ok(globalCssSource.includes(hook), `KET result action contrast CSS is missing: ${hook}`);
  }
  assert.match(ketReadingPlayerSource, /aria-pressed=\{activeGroup === index\}/);
  assert.match(ketReadingPlayerSource, /data-active=\{activeGroup === index\}/);
  assert.match(globalCssSource, /#ket-reading-writing-player button\.ket-part-three-page-nav:disabled/);
  assert.match(globalCssSource, /#ket-reading-writing-result-screen button\.ket-reading-result-home:not\(:disabled\)/);
  assert.match(globalCssSource, /#ket-reading-writing-result-screen button\.ket-reading-result-retry:not\(:disabled\)/);
  assert.match(listeningAssetPickerSource, /onChange\(asset\.id, asset\)/);
  assert.match(flyerReadingAuthoringSource, /uploadedAsset \|\|/);
  assert.match(ketReadingAuthoringSource, /uploadedAsset \|\|/);
  assert.match(starterAuthoringSource, /uploadedAsset \|\| assets\.find/);
});

test('KET Reading & Writing Part 3 and result controls meet WCAG AA text contrast', () => {
  const colourPairs = [
    ['#1e40af', '#ffffff'], // inactive tab and previous page
    ['#ffffff', '#1d4ed8'], // active tab, next page and home
    ['#ffffff', '#047857'], // retry
    ['#475569', '#e2e8f0'], // disabled page navigation
  ] as const;

  for (const [foreground, background] of colourPairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet a 4.5:1 contrast ratio`,
    );
  }
});

test('KET Listening keeps five flexible Part types, special Part 1 crops and the shared listening review shell', () => {
  for (const contract of [
    "KET_LISTENING_TEMPLATE_VERSION = 'ket-listening-5-v1'",
    'KET_LISTENING_DEFAULT_COUNTS = [5, 5, 5, 5, 5]',
    "'image-options'",
    "'two-image-letter-input'",
    "'dialogue-choice'",
    "'image-form-fields'",
    'Legacy papers stay untouched',
  ]) assert.ok(ketListeningMigrationSource.includes(contract), `KET Listening migration is missing: ${contract}`);
  for (const contract of [
    'id="ket-listening-authoring"',
    'crop-part1-1245',
    'KET_LISTENING_AUTOCROP_DISPLAY_NUMBERS',
    'KET_LISTENING_MANUAL_DISPLAY_NUMBER',
    'groupKetListeningPart1OptionCrops',
    'FlyerPart3Editor',
    'pasteImages',
    'data-ket-listening-count-controls',
    'Ảnh chung của câu 3',
  ]) assert.ok(ketListeningAuthoringSource.includes(contract), `KET Listening authoring is missing: ${contract}`);
  assert.match(ketListeningCropSource, /filter\(row => row\.frames\.length === 3\)/);
  for (const contract of [
    'id="ket-listening-player"',
    'StarterImageOptionsView',
    'FlyerLetterMatchingView',
    'data-ket-listening-part1-shared-image',
    'data-ket-listening-part3-prompt',
    'data-ket-listening-dialogue-choices',
    'data-ket-listening-form-rows',
  ]) assert.ok(ketListeningPlayerSource.includes(contract), `KET Listening player is missing: ${contract}`);
  assert.match(genericPlayerSource, /isFixedKetListeningContent\(playable\.content\)/);
  assert.match(genericPlayerSource, /ketListening=\{ketListening\}/);
  assert.match(starterResultSource, /ket-listening-5-v1/);
  assert.match(starterResultSource, /KetFormResults/);
  assert.match(validationSource, /validateKetListeningPart/);
  assert.match(validationSource, /Part 1's page image is authoring-only crop material/);
  assert.match(universalPromptSource, /function ketListeningPrompt/);
  assert.match(universalPromptSource, /answerSuffix "Road"/);
  assert.match(globalCssSource, /#ket-listening-authoring/);
  assert.match(globalCssSource, /#ket-listening-player/);
});
