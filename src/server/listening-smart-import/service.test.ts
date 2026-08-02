import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverListeningContent } from '../../features/listening-library/modules/mover/editor/moduleDefinition';
import { createListeningSmartImportCandidate } from './service';

test('Part 1 vision extracts names/anchors but code creates a unique provisional mapping', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const abortController = new AbortController();
  let receivedImageKinds: string[] = [];
  const candidate = await createListeningSmartImportCandidate({
    part: 1,
    currentPart: part,
    basePartHash: 'hash',
    sourceImageAssetIds: ['image-1'],
    pastedText: '',
    images: [{ assetId: 'image-1', mimeType: 'image/png', data: Buffer.from('image') }],
    signal: abortController.signal,
    analyzeVision: async (prompt, images, signal) => {
      assert.match(prompt, /Do NOT decide which name belongs/);
      assert.equal(signal, abortController.signal);
      receivedImageKinds = images.map(image => image.mimeType);
      return {
        provider: 'gemini',
        text: JSON.stringify({
          choices: ['Paul', 'John', 'Jill', 'Sally', 'Jane', 'Daisy'],
          anchors: Array.from({ length: 5 }, (_, index) => ({
            label: `person ${index + 1}`,
            centerX: 0.1 + index * 0.15,
            centerY: 0.2 + index * 0.1,
            confidence: 0.9,
          })),
        }),
      };
    },
  });
  assert.deepEqual(receivedImageKinds, ['image/png']);
  assert.equal(candidate.data.part, 1);
  if (candidate.data.part !== 1) return;
  assert.equal(candidate.data.choices.length, 6);
  assert.equal(candidate.data.anchors.length, 5);
  assert.equal(new Set(candidate.data.provisionalChoiceIndexes).size, 5);
  assert.equal(candidate.data.anchors.every(anchor => anchor.region.width === 0.12 && anchor.region.height === 0.055), true);
});

test('Part 2 can use pasted text locally with selected images and never requires vision/audio analysis', async () => {
  const part = createDefaultMoverListeningContent().parts[1];
  const candidate = await createListeningSmartImportCandidate({
    part: 2,
    currentPart: part,
    basePartHash: 'hash',
    sourceImageAssetIds: ['optional-page'],
    pastedText: 'ABC\n1. Lives at ____ | 7\n2. Class number ____ | four | 4b\n3. Sport ____ | hockey\n4. Reading ____ | comics\n5. Pet ____ | snake',
    images: [{ assetId: 'optional-page', mimeType: 'image/png', data: Buffer.from('image') }],
    analyzeVision: undefined,
  });
  assert.equal(candidate.provider, 'local');
  assert.equal(candidate.data.part, 2);
  if (candidate.data.part !== 2) return;
  assert.equal(candidate.data.questions.length, 5);
  assert.deepEqual(candidate.data.questions[1].acceptedAnswers, ['four', '4b']);
  assert.match(candidate.data.questions[0].prompt, /\{\{blank\}\}/);
});

test('Part 3 keeps the first source as one composite board and allows missing labels', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const candidate = await createListeningSmartImportCandidate({
    part: 3,
    currentPart: part,
    basePartHash: 'hash',
    sourceImageAssetIds: ['board', 'labels'],
    pastedText: '',
    images: [
      { assetId: 'board', mimeType: 'image/png', data: Buffer.from('board') },
      { assetId: 'labels', mimeType: 'image/png', data: Buffer.from('labels') },
    ],
    analyzeVision: async (prompt, images) => {
      assert.match(prompt, /board is deliberately not sent to AI/);
      assert.deepEqual(images.map(image => image.assetId), ['labels']);
      return { provider: 'openai', text: JSON.stringify({ labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] }) };
    },
  });
  assert.equal(candidate.data.part, 3);
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.boardAssetId, 'board');
  assert.equal(candidate.data.labels.length, 4);
  assert.match(candidate.warnings.join(' '), /Chưa nhận đủ 5 nhãn/);
});

test('Part 3 board-only input creates a manual-label candidate instead of failing', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  let analyzerCalled = false;
  const candidate = await createListeningSmartImportCandidate({
    part: 3,
    currentPart: part,
    basePartHash: 'hash',
    sourceImageAssetIds: ['board'],
    pastedText: '',
    images: [{ assetId: 'board', mimeType: 'image/png', data: Buffer.from('board') }],
    analyzeVision: async () => {
      analyzerCalled = true;
      return { provider: 'openai', text: JSON.stringify({ labels: ['unexpected'] }) };
    },
  });

  assert.equal(analyzerCalled, false);
  assert.equal(candidate.provider, 'local');
  assert.equal(candidate.data.part, 3);
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.boardAssetId, 'board');
  assert.deepEqual(candidate.data.labels, []);
  assert.match(candidate.warnings.join(' '), /Chỉ có ảnh bảng A–F/);
  assert.match(candidate.warnings.join(' '), /Chưa nhận đủ 5 nhãn/);
});

test('malformed provider output is rejected instead of being merged as plausible data', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  await assert.rejects(() => createListeningSmartImportCandidate({
    part: 4,
    currentPart: part,
    basePartHash: 'hash',
    sourceImageAssetIds: ['page'],
    pastedText: '',
    images: [{ assetId: 'page', mimeType: 'image/png', data: Buffer.from('page') }],
    analyzeVision: async () => ({ provider: 'gemini', text: 'not-json' }),
  }), /JSON hợp lệ/);
});

test('Part 5 fills missing anchors with fixed manual-placement regions and never chooses colours via AI', async () => {
  const part = createDefaultMoverListeningContent().parts[4];
  const candidate = await createListeningSmartImportCandidate({
    part: 5,
    currentPart: part,
    basePartHash: 'hash',
    sourceImageAssetIds: ['scene'],
    pastedText: '',
    images: [{ assetId: 'scene', mimeType: 'image/png', data: Buffer.from('scene') }],
    analyzeVision: async prompt => {
      assert.match(prompt, /Do NOT select colours/);
      return { provider: 'openai', text: JSON.stringify({ anchors: [{ label: 'tree', centerX: 0.5, centerY: 0.3 }] }) };
    },
  });
  assert.equal(candidate.data.part, 5);
  if (candidate.data.part !== 5) return;
  assert.equal(candidate.data.anchors.length, 5);
  assert.equal(candidate.data.anchors[1].confidence, 0);
  assert.equal(new Set(candidate.data.provisionalColourIndexes).size, 5);
  assert.match(candidate.warnings.join(' '), /vùng mặc định/);
});
