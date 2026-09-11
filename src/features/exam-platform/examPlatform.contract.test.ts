import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  containedExamImageRect,
  examImageContentRectInStage,
  normalizedExamImagePoint,
} from '../exam-media/imageCoordinates';
import { EXAM_IMAGE_PROFILES } from '../exam-media/imageProfiles';
import {
  normalizeStarterPart2PromptForMover,
  splitStarterPart2ExampleLines,
  STARTER_LISTENING_LARGE_IMAGE_SCALE,
  STARTER_LISTENING_LARGE_IMAGE_MAX_HEIGHT,
  STARTER_LISTENING_LARGE_IMAGE_MAX_WIDTH,
} from './student/StarterInteractions';
import { starterPart2ExampleEditorLines } from './starterListeningPart2';
import { resolveExamImageProfile, resolveExamTaskLayout } from './student/examPresentation';
import { starterSpellingCharacters, updateStarterSpellingValue } from './student/StarterReadingWritingViews';

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
const imageCoordinatesSource = readFileSync(new URL('../exam-media/imageCoordinates.ts', import.meta.url), 'utf8');
const imageProfileSource = readFileSync(new URL('../exam-media/imageProfiles.ts', import.meta.url), 'utf8');
const splitLayoutSource = readFileSync(new URL('../exam-media/ExamSplitTaskLayout.tsx', import.meta.url), 'utf8');
const moverReadingPlayerSource = readFileSync(new URL('../mover-reading-writing/student/MoverReadingWritingPartViews.tsx', import.meta.url), 'utf8');
const listeningPartViewsSource = readFileSync(new URL('../listening/student/ListeningPartViews.tsx', import.meta.url), 'utf8');
const listeningRegionEditorSource = readFileSync(new URL('../listening/admin/ListeningRegionEditor.tsx', import.meta.url), 'utf8');
const fixedRegionEditorSource = readFileSync(new URL('../listening-editor/regions/FixedRegionEditor.tsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../../server/exam-platform/examValidation.ts', import.meta.url), 'utf8');
const globalCssSource = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
const listeningAssetPickerSource = readFileSync(new URL('../listening/admin/ListeningAssetPicker.tsx', import.meta.url), 'utf8');
const standaloneWritingAuthoringSource = readFileSync(new URL('../writing-library/admin/StandaloneWritingAuthoring.tsx', import.meta.url), 'utf8');
const standaloneWritingPlayerSource = readFileSync(new URL('../writing-library/student/StandaloneWritingViews.tsx', import.meta.url), 'utf8');
const writingWordPolicySource = readFileSync(new URL('../writing-library/writingWordPolicy.ts', import.meta.url), 'utf8');
const historyRepositorySource = readFileSync(new URL('../../server/learning-history/learningHistoryRepository.ts', import.meta.url), 'utf8');
const historyRowSource = readFileSync(new URL('../../components/history/HistoryRow.tsx', import.meta.url), 'utf8');
const historyDetailSource = readFileSync(new URL('../../components/history/HistoryDetailModal.tsx', import.meta.url), 'utf8');
const modulePageSource = readFileSync(new URL('../listening-library/student/ListeningModulePage.tsx', import.meta.url), 'utf8');
const examPageSource = readFileSync(new URL('../listening-library/student/ListeningExamPage.tsx', import.meta.url), 'utf8');

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
  assert.match(imageViewerSource, /data-exam-image-double-click/);
  assert.match(imageViewerSource, /showExpandButton = false/);
  assert.match(imageViewerSource, /expandOnDoubleClick = true/);
  assert.match(imageViewerSource, /interactionMode = 'view'/);
  assert.match(imageViewerSource, /expandFromStage = expandable && expandOnDoubleClick && !answerSurface/);
  assert.match(imageViewerSource, /showSeparateExpandControl/);
  assert.match(imageViewerSource, /fillInlineFrame = fillFrame && !answerSurface/);
  assert.match(imageViewerSource, /data-exam-image-actions/);
  assert.match(imageViewerSource, /data-exam-image-inline/);
  assert.match(imageViewerSource, /onDoubleClick=/);
  assert.match(imageViewerSource, /\['Enter', ' '\]\.includes\(event\.key\)/);
  assert.match(imageViewerSource, /resolvedMaxWidth/);
  assert.match(imageViewerSource, /naturalSize\.width \* scale/);
  assert.match(imageViewerSource, /setScale\('fit'\)/);
  assert.match(imageViewerSource, /setScale\(1\)/);
  assert.doesNotMatch(imageViewerSource, /Math\.min\(3|Math\.max\(\.5/);
  assert.match(imageViewerSource, /exam-platform-image-toolbar/);
  assert.match(imageViewerSource, /exam-platform-image-scale/);
  assert.match(imageViewerSource, /id="exam-platform-image-dialog"/);
  assert.doesNotMatch(globalCssSource, /:not\(\.exam-platform-image-tool\)/);
  assert.match(globalCssSource, /#exam-platform-image-dialog \.exam-platform-image-toolbar/);
  assert.match(globalCssSource, /#exam-platform-image-dialog \.exam-platform-image-scale/);
  assert.match(globalCssSource, /#exam-platform-image-dialog button\.exam-platform-image-tool:not\(:disabled\)/);
  assert.match(listeningPartViewsSource, /ExamImageViewer/);
  assert.match(listeningPartViewsSource, /profile="interactive-scene"/);
  assert.match(listeningPartViewsSource, /frameRef=\{boardRef\}/);
  assert.match(listeningPartViewsSource, /maxWidth="100%"/);
  assert.match(listeningPartViewsSource, /maxHeight="max\(220px, calc\(100dvh - 390px\)\)"/);
  assert.match(listeningPartViewsSource, /stageProps=\{\{/);
  assert.equal(listeningPartViewsSource.match(/interactionMode="answer-surface"/g)?.length, 4);
  assert.equal(starterPlayerSource.match(/interactionMode="answer-surface"/g)?.length, 4);
  assert.match(listeningPartViewsSource, /normalizedPointFromExamImage/);
  assert.match(starterPlayerSource, /normalizedPointFromExamImage/);
  assert.match(listeningRegionEditorSource, /normalizedPointFromExamImage/);
  assert.match(fixedRegionEditorSource, /normalizedPointFromExamImage/);
  assert.doesNotMatch(listeningPartViewsSource, /event\.detail > 1/);
  assert.doesNotMatch(starterPlayerSource, /event\.detail > 1/);
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
  assert.match(starterAuthoringSource, /data-starter-part2-example-editor/);
  assert.match(starterAuthoringSource, /Hai example không chấm điểm/);
  assert.match(starterPlayerSource, /data-starter-interaction="text-entry"/);
  assert.match(starterPlayerSource, /ListeningPart2View/);
  assert.match(starterPlayerSource, /const moverPart: ListeningPart2/);
  assert.match(starterPlayerSource, /starterPart2Blank/);
  assert.match(genericPlayerSource, /starterListening && part\.part === 2 && unit\.interaction\.variant === 'inline-gap'/);
  assert.match(starterPlayerSource, /props\.part\.part === 2 && props\.part\.interaction\.variant === 'inline-gap'/);
  assert.equal(normalizeStarterPart2PromptForMover('Which class is Sam in?'), 'Which class is Sam in? {{answer}}');
  assert.equal(normalizeStarterPart2PromptForMover("What's the name? {{answer}}"), "What's the name? {{answer}}");
  assert.equal(normalizeStarterPart2PromptForMover('Teacher: ____ / duplicate {{blank}}'), 'Teacher: {{answer}} / duplicate ');
  assert.deepEqual(splitStarterPart2ExampleLines("What's the boy's name? — Sam.\nHow old is he? — 10."), ["What's the boy's name? — Sam.", 'How old is he? — 10.']);
  assert.deepEqual(splitStarterPart2ExampleLines("What's the boy's name? — Sam. How old is he? — 10."), ["What's the boy's name? — Sam.", 'How old is he? — 10.']);
  assert.deepEqual(starterPart2ExampleEditorLines('\nHow old is he? — 10.'), ['', 'How old is he? — 10.']);
  assert.match(genericPlayerSource, /hideStarterPart2DuplicateExample = starterListening && part\.part === 2 && special/);
  assert.match(listeningPartViewsSource, /data-starter-part2-example-lines/);
  assert.match(listeningPartViewsSource, /Example \{index \+ 1\}/);
});

test('answer coordinates follow the rendered image pixels instead of letterboxed frame space', () => {
  const rendered = containedExamImageRect(
    { left: 100, top: 40, width: 600, height: 400 },
    1200,
    600,
  );
  assert.deepEqual(rendered, { left: 100, top: 90, width: 600, height: 300 });
  assert.deepEqual(
    normalizedExamImagePoint(400, 240, { left: 100, top: 40, width: 600, height: 400 }, 1200, 600),
    { x: 0.5, y: 0.5 },
  );
  assert.equal(
    normalizedExamImagePoint(400, 60, { left: 100, top: 40, width: 600, height: 400 }, 1200, 600),
    undefined,
  );
  assert.deepEqual(
    normalizedExamImagePoint(400, 60, { left: 100, top: 40, width: 600, height: 400 }, 1200, 600, { clamp: true }),
    { x: 0.5, y: 0 },
  );

  const oldStoredPoint = { x: 0.187, y: 0.41 };
  const portraitElement = { left: 50, top: 20, width: 900, height: 744 };
  const portraitLayer = examImageContentRectInStage(
    portraitElement,
    portraitElement,
    416,
    526,
  );
  assert.ok(portraitLayer);
  assert.ok(portraitLayer.left > 150, 'portrait object-contain image should have horizontal letterboxing');
  assert.equal(portraitLayer.top, 0);
  const portraitClientPoint = {
    x: portraitElement.left + portraitLayer.left + portraitLayer.width * oldStoredPoint.x,
    y: portraitElement.top + portraitLayer.top + portraitLayer.height * oldStoredPoint.y,
  };
  const portraitRoundTrip = normalizedExamImagePoint(
    portraitClientPoint.x,
    portraitClientPoint.y,
    portraitElement,
    416,
    526,
  );
  assert.ok(portraitRoundTrip);
  assert.ok(Math.abs(portraitRoundTrip.x - oldStoredPoint.x) < 1e-12);
  assert.ok(Math.abs(portraitRoundTrip.y - oldStoredPoint.y) < 1e-12);

  const landscapeElement = { left: 80, top: 30, width: 600, height: 500 };
  const landscapeLayer = examImageContentRectInStage(
    landscapeElement,
    landscapeElement,
    1200,
    600,
  );
  assert.deepEqual(landscapeLayer, { left: 0, top: 100, width: 600, height: 300 });
  const landscapeClientPoint = {
    x: landscapeElement.left + landscapeLayer.left + landscapeLayer.width * oldStoredPoint.x,
    y: landscapeElement.top + landscapeLayer.top + landscapeLayer.height * oldStoredPoint.y,
  };
  const landscapeRoundTrip = normalizedExamImagePoint(
    landscapeClientPoint.x,
    landscapeClientPoint.y,
    landscapeElement,
    1200,
    600,
  );
  assert.ok(landscapeRoundTrip);
  assert.ok(Math.abs(landscapeRoundTrip.x - oldStoredPoint.x) < 1e-12);
  assert.ok(Math.abs(landscapeRoundTrip.y - oldStoredPoint.y) < 1e-12);

  assert.match(imageCoordinatesSource, /image\.getBoundingClientRect\(\)/);
  assert.match(imageCoordinatesSource, /image\.naturalWidth/);
  assert.match(imageCoordinatesSource, /image\.naturalHeight/);
  assert.match(imageViewerSource, /data-exam-image-content-layer/);
  assert.match(imageViewerSource, /examImageContentRectInStage/);
  assert.match(imageViewerSource, /new ResizeObserver\(updateContentRect\)/);
});

test('standalone Writing is a separate admin library with flexible AI grading and 0–10 history', () => {
  assert.ok(adminSource.indexOf('tab-writing-library') > adminSource.indexOf('tab-listening-library'));
  for (const contract of ['WritingLibraryAdmin', 'Kho đề Writing', "activeTab === 'writing-library'"]) {
    assert.ok(adminSource.includes(contract), `Standalone Writing menu is missing: ${contract}`);
  }
  for (const column of ['STT', 'Bộ đề Writing', 'Lớp', 'Chủ đề', 'Số lượng', 'Trạng thái', 'Ngày tạo', 'Link', 'Thao tác']) {
    assert.ok(genericAdminSource.includes(column), `Standalone Writing column is missing: ${column}`);
  }
  for (const contract of ['writingSearchQuery', 'writingGradeFilter', 'writingGradeSort', 'LibraryRowActions', '1 bài viết']) {
    assert.ok(genericAdminSource.includes(contract), `Standalone Writing directory is missing: ${contract}`);
  }
  for (const contract of ['data-writing-single-task', 'AI chấm 0–10', 'Quy tắc chấm cho AI', 'data-writing-word-policy']) {
    assert.ok(standaloneWritingAuthoringSource.includes(contract), `Standalone Writing authoring is missing: ${contract}`);
  }
  for (const contract of ['data-no-hard-word-limit="true"', 'data-typed-only-answer="true"', 'hệ thống không khóa số từ', 'writingScore', '/10', 'aiFeedback', 'grammarErrors', 'vocabularyErrors', 'Xem Nhận Xét']) {
    assert.ok(standaloneWritingPlayerSource.includes(contract), `Standalone Writing player/result is missing: ${contract}`);
  }
  assert.match(standaloneWritingPlayerSource, /onPaste=\{blockExternalInsertion\}/);
  assert.match(standaloneWritingPlayerSource, /onDrop=\{blockExternalInsertion\}/);
  assert.match(standaloneWritingPlayerSource, /onBeforeInput=\{guardBeforeInput\}/);
  for (const inputType of ['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']) {
    assert.ok(standaloneWritingPlayerSource.includes(inputType), `Standalone Writing must reject ${inputType}`);
  }
  assert.match(standaloneWritingPlayerSource, /event\.preventDefault\(\)/);
  assert.match(standaloneWritingPlayerSource, /Không thể dán hoặc kéo thả nội dung/);
  assert.match(standaloneWritingPlayerSource, /role="alert"/);
  assert.match(standaloneWritingPlayerSource, /Nhận Xét Chung/);
  assert.match(standaloneWritingPlayerSource, /Chấm lại sau/);
  assert.match(standaloneWritingPlayerSource, /Đang gửi bài đến dịch vụ chấm, rất nhanh thôi, em đợi chút nhé!!/);
  assert.match(standaloneWritingPlayerSource, /!grading && result\.aiGradingMessage/);
  assert.doesNotMatch(standaloneWritingPlayerSource, /Lần \{Math\.max/);
  assert.match(standaloneWritingPlayerSource, /writing-grade-retry/);
  assert.match(standaloneWritingPlayerSource, /aiGradingNextRetryAt/);
  assert.match(genericPlayerSource, /examPlatformApi\.gradingStatus/);
  assert.match(genericPlayerSource, /examPlatformApi\.retryWritingGradeAsLearner/);
  assert.match(genericPlayerSource, /submittedAttempt/);
  assert.doesNotMatch(standaloneWritingPlayerSource, /Nhận xét của AI/);
  assert.doesNotMatch(standaloneWritingPlayerSource, /Xem nhận xét AI/);
  assert.doesNotMatch(standaloneWritingPlayerSource, /maxLength=/);
  assert.match(writingWordPolicySource, /Math\.floor\(recommendedMin \/ 4\)/);
  assert.match(writingWordPolicySource, /Math\.ceil\(recommendedMax \* 7 \/ 3\)/);
  assert.match(writingGradingProviderSource, /word count alone must never determine the score/);
  assert.match(writingGradingProviderSource, /If a longer response is relevant, coherent/);
  assert.match(writingGradingProviderSource, /If it is long but repetitive, off-topic/);
  assert.match(writingGradingProviderSource, /OUTPUT LANGUAGE \(MANDATORY\)/);
  assert.match(writingGradingProviderSource, /assertVietnameseExplanation/);
  assert.match(historyRepositorySource, /Writing · AI chấm/);
  assert.match(historyRepositorySource, /writingScore/);
  assert.match(historyRowSource, /exam:writing:writing/);
  assert.match(historyRowSource, /\/10/);
  assert.match(historyDetailSource, /exam:writing:writing/);
  assert.match(historyDetailSource, /1 bài Writing/);
  assert.match(globalCssSource, /data-standalone-writing-player/);
  assert.match(globalCssSource, /writing-lined-textarea/);
  assert.match(globalCssSource, /background-position: 0 10px/);
  assert.match(globalCssSource, /button\.writing-result-review:not\(:disabled\)/);
  assert.match(globalCssSource, /button\.writing-result-retry:not\(:disabled\)/);
  assert.match(globalCssSource, /button\.writing-result-home:not\(:disabled\)/);
  assert.match(globalCssSource, /button\.writing-grade-retry:not\(:disabled\)/);
  assert.match(globalCssSource, /button\.writing-grade-retry:not\(:disabled\):hover/);
  assert.match(globalCssSource, /button\.writing-grade-retry:disabled/);
  assert.match(modulePageSource, /manifest\?\.status === 'active' \|\| standaloneWriting/);
  assert.match(modulePageSource, /writingExamPath\(exam\.examId\)/);
  assert.match(examPageSource, /manifest\.status !== 'active' && !standaloneWriting/);
  assert.match(genericAdminSource, /absoluteExamUrl\(previewUrl\(set\), window\.location\.origin\)/);
  assert.match(genericAdminSource, /navigator\.clipboard\.writeText\(shareUrl\(set\)\)/);
  assert.match(genericAdminSource, /playHref=\{shareUrl\(set\)\}/);
  assert.match(genericPlayerSource, /authTokenForExamRun\(pending\.ticket, token\)/);
  assert.match(genericPlayerSource, /authTokenForExamRun\(activePending\.ticket, token\)/);
  assert.match(genericPlayerSource, /examPlatformApi\.review\(moduleId, paperId, setId, result\.id, reviewActorType === 'guest' \? null : token/);
  assert.match(genericPlayerSource, /Hãy giữ nguyên trang, đăng nhập lại đúng tài khoản/);
  assert.doesNotMatch(genericPlayerSource, /Vui lòng bắt đầu lượt mới khi cần/);
});

test('standalone Writing retry states meet WCAG AA text contrast', () => {
  for (const [foreground, background] of [
    ['#ffffff', '#b45309'], // enabled retry
    ['#ffffff', '#92400e'], // enabled retry hover
    ['#78350f', '#fef3c7'], // cooldown/loading
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet a 4.5:1 contrast ratio`,
    );
  }
});

test('Starter Listening Parts 1, 3 and 4 use compact task frames while interactive scenes grow as one stage', () => {
  assert.equal(STARTER_LISTENING_LARGE_IMAGE_MAX_WIDTH, '912px');
  assert.equal(STARTER_LISTENING_LARGE_IMAGE_SCALE, 1.2);
  assert.match(STARTER_LISTENING_LARGE_IMAGE_MAX_HEIGHT, /74\.4dvh/);
  assert.match(STARTER_LISTENING_LARGE_IMAGE_MAX_HEIGHT, /744px/);
  assert.match(genericPlayerSource, /\[1, 3, 4\]\.includes\(activePart\.part\)/);
  assert.match(genericPlayerSource, /data-starter-listening-frame/);
  assert.match(genericPlayerSource, /data-starter-listening-work-area/);
  assert.match(genericPlayerSource, /sm:h-\[calc\(90dvh-261px\)\]/);
  assert.match(genericPlayerSource, /sm:w-\[90%\]/);
  assert.match(genericPlayerSource, /sm:max-w-\[1350px\]/);
  assert.match(starterPlayerSource, /maxWidth=\{STARTER_LISTENING_LARGE_IMAGE_MAX_WIDTH\}/);
  assert.match(starterPlayerSource, /imageMaxWidth=\{STARTER_LISTENING_LARGE_IMAGE_MAX_WIDTH\}/);
  assert.match(starterPlayerSource, /preferredScale=\{STARTER_LISTENING_LARGE_IMAGE_SCALE\}/);
  assert.match(starterPlayerSource, /imageScale=\{STARTER_LISTENING_LARGE_IMAGE_SCALE\}/);
  assert.match(listeningPartViewsSource, /maxWidth=\{imageMaxWidth\}/);
  assert.match(starterPlayerSource, /normalizedPointFromExamImage\(clientX, clientY, boardImageRef\.current\)/);
  assert.match(listeningPartViewsSource, /normalizedPointFromExamImage\(clientX, clientY, boardImageRef\.current\)/);
  assert.doesNotMatch(starterPlayerSource, /\(event\.clientX - bounds\.left\) \/ Math\.max\(bounds\.width/);
  assert.doesNotMatch(listeningPartViewsSource, /\(event\.clientX - bounds\.left\) \/ bounds\.width/);
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
    'crop 7 hình',
    'crop 12 hình',
    'data-starter-rw-crop-slots',
    'data-starter-rw-auto-detect',
    'data-starter-rw-auto-crop-review',
    'data-starter-rw-crop-grid',
    'starter-rw-crop-thumbnail',
    'data-starter-rw-part1-pastel-detector',
    'data-starter-rw-part3-paired-detector',
    'detectStarterReadingPart1Crops',
    'detectStarterReadingPart3Crops',
    'Ảnh nguồn đã thay đổi',
    'secondaryImageAssetId',
    'Ảnh tình huống ở cột bên trái',
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
  assert.match(starterReadingPlayerSource, /data-starter-rw-part1-cropped-rows/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-part3-paired-rows/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-part3-row/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-part3-image/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-part3-answer/);
  assert.doesNotMatch(starterReadingPlayerSource, /text-\[10px\] font-black uppercase text-indigo-700">Example/);
  assert.doesNotMatch(starterReadingPlayerSource, /mb-2 text-center text-xs font-black text-blue-700">\{index \+ 1\}/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-spelling-cells/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-spelling-example/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-yes-no-row/);
  assert.match(starterReadingPlayerSource, /data-starter-rw-large-image-frame/);
  assert.match(starterReadingAuthoringSource, /id="starter-reading-writing-authoring"/);
  assert.match(starterReadingAuthoringSource, /starter-rw-crop-action/);
  assert.match(starterReadingAuthoringSource, /starter-rw-crop-confirm/);
  assert.match(universalAuthoringSource, /content\.moduleId === 'starter' && content\.paperId === 'reading-writing'/);
  assert.match(universalImporterSource, /fixedStarterReadingWriting/);
  assert.match(globalCssSource, /#starter-reading-writing-authoring button\.starter-rw-crop-action/);
  assert.match(globalCssSource, /#starter-reading-writing-authoring \.starter-rw-crop-thumbnail/);
  assert.match(globalCssSource, /max-width: 128px/);
  assert.match(globalCssSource, /#generic-exam-player \.starter-rw-inline-choice\[data-selected="true"\]/);
  assert.match(globalCssSource, /#generic-exam-player \[data-starter-rw-spelling-cells\] input\.starter-rw-spelling-cell/);
  assert.match(globalCssSource, /#generic-exam-player \[data-starter-rw-part3-paired-rows\] \[data-starter-rw-part3-row\]/);
  assert.match(globalCssSource, /border-radius: 5px 5px 3px 3px !important/);
  assert.match(starterReadingResultSource, /data-starter-rw-part1-cropped-review/);
  assert.match(starterReadingResultSource, /data-starter-rw-part3-paired-review/);
  assert.match(starterReadingResultSource, /starter-reading-review-part-tab/);
  assert.match(starterReadingResultSource, /Quay lại tổng kết/);
  assert.match(starterReadingResultSource, /Xem kết quả/);
  for (const cssHook of ['starter-reading-primary-action', 'starter-reading-review-action', 'starter-reading-review-part-tab', 'starter-reading-review-part-nav']) {
    assert.ok(globalCssSource.includes(cssHook), `Starters Reading contrast CSS is missing: ${cssHook}`);
  }
});

test('Starters Reading Part 3 stores separate letter cells as one gradable word', () => {
  assert.deepEqual(starterSpellingCharacters('f a!c-e', 5), ['f', 'a', 'c', '-', 'e']);
  assert.equal(updateStarterSpellingValue('', 4, 0, 'face'), 'face');
  assert.equal(updateStarterSpellingValue('fa', 4, 2, 'c'), 'fac');
  assert.equal(updateStarterSpellingValue('face', 4, 2, ''), 'fae');
  assert.equal(updateStarterSpellingValue('', 4, 3, 'n'), 'n');
});

test('Starters Reading & Writing crop and inline answer controls meet WCAG AA text contrast', () => {
  for (const [foreground, background] of [
    ['#ffffff', '#4338ca'], // crop
    ['#ffffff', '#047857'], // confirm
    ['#1e40af', '#ffffff'], // secondary
    ['#475569', '#e2e8f0'], // disabled/loading
    ['#1e293b', '#f8fafc'], // unselected Yes/No
    ['#ffffff', '#1d4ed8'], // selected Yes/No
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet a 4.5:1 contrast ratio`,
    );
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
  assert.match(flyerReadingPlayerSource, /data-flyer-reading-part4-stacked/);
  assert.match(flyerReadingPlayerSource, /data-flyer-reading-part4-content/);
  assert.match(flyerReadingPlayerSource, /alt="Ảnh minh họa Flyers Reading & Writing Part 4"/);
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
    'singleImage',
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
  assert.match(ketReadingPlayerSource, /data-ket-part8-image-top/);
  assert.match(ketReadingPlayerSource, /part=\{unit\} answers=\{answers\} onAnswer=\{onAnswer\} singleImage/);
  assert.match(ketReadingAuthoringSource, /Part 8 · hiển thị phía trên khu vực làm bài/);
  assert.match(ketReadingAuthoringSource, /part\.part === 5 \? <ChoicePart \{\.\.\.props\} \/>/);
  assert.match(ketReadingMigrationSource, /\[1, 2, 5\]\.includes\(part\)/);
  assert.match(ketReadingResultSource, /<CompoundReview units=\{units\} results=\{results\} \/>/);
  assert.match(flyerPlayerSource, /const personName = question\.prompt\.trim\(\) \|\| `Người \$\{index \+ 1\}`/);
  assert.match(flyerPlayerSource, /data-flyer-part3-answer-name=\{personName\}/);
  assert.match(flyerPlayerSource, /aria-label=\{`Chữ cái đáp án cho \$\{personName\}`\}/);
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
  assert.match(examRouterSource, /providerAttempt > 1 \? 'retrying' : 'processing'/);
  assert.match(examRouterSource, /aiGradingStatus: 'failed'/);
  assert.match(examRouterSource, /describeWritingGradingFailure\(error/);
  assert.match(examRouterSource, /Dịch vụ chấm đang quá tải hoặc phản hồi chậm/);
  assert.match(examRouterSource, /WRITING_GRADING_COOLDOWN/);
  assert.match(writingGradingProviderSource, /never exceeds two provider requests/);
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
  for (const hook of ['ket-reading-result-home', 'ket-reading-result-review', 'ket-reading-result-retry', 'ket-reading-review-part-tab', 'ket-reading-review-back']) {
    assert.ok(ketReadingResultSource.includes(hook), `KET result action contrast hook is missing: ${hook}`);
    assert.ok(globalCssSource.includes(hook), `KET result action contrast CSS is missing: ${hook}`);
  }
  assert.match(ketReadingPlayerSource, /aria-pressed=\{activeGroup === index\}/);
  assert.match(ketReadingPlayerSource, /data-active=\{activeGroup === index\}/);
  assert.match(globalCssSource, /#ket-reading-writing-player button\.ket-part-three-page-nav:disabled/);
  assert.match(globalCssSource, /#ket-reading-writing-result-screen button\.ket-reading-result-home:not\(:disabled\)/);
  assert.match(globalCssSource, /#ket-reading-writing-result-screen button\.ket-reading-result-review:not\(:disabled\)/);
  assert.match(globalCssSource, /#ket-reading-writing-result-screen button\.ket-reading-result-review:disabled/);
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
    ['#1e40af', '#ffffff'], // view result
    ['#ffffff', '#047857'], // retry
    ['#334155', '#e2e8f0'], // loading result
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
    'singleImage',
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
    'data-ket-listening-dialogue-choices',
    'data-ket-listening-form-rows',
    'ketListeningFormBodyPassage',
  ]) assert.ok(ketListeningPlayerSource.includes(contract), `KET Listening player is missing: ${contract}`);
  assert.doesNotMatch(ketListeningPlayerSource, /data-ket-listening-part3-prompt/);
  assert.match(universalPromptSource, /Part 4 listening - Question 16–20\./);
  assert.match(universalPromptSource, /content\.passage CHỈ chứa nội dung biểu mẫu/);
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
