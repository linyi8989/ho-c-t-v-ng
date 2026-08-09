import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListeningSmartImportSourceRole } from '../../features/listening-editor/smart-import/types';
import { createDefaultMoverListeningContent } from '../../features/listening-library/modules/mover/editor/moduleDefinition';
import { createListeningSmartImportCandidate, type SmartImportVisionAnalyzer } from './service';

const image = (role: ListeningSmartImportSourceRole, assetId = role) => ({ role, assetId, mimeType: 'image/png', data: Buffer.from(assetId) });
const sources = (...roles: ListeningSmartImportSourceRole[]) => roles.map(role => ({ role, assetId: role }));
const rect = (x = 0.1, y = 0.1) => ({ shape: 'rect', x, y, width: 0.1, height: 0.08 });
const part1Example = () => ({ label: 'Fred', labelPoint: { x: .12, y: .02 }, targetPoint: { x: .2, y: .2 }, confidence: .99 });
const part1ExampleVerification = () => ({ ...part1Example(), warnings: [] });
const part1GeometryExample = () => ({ label: 'Fred', lineEndpoints: [{ x: .12, y: .02 }, { x: .2, y: .2 }], confidence: .99 });
const part1QuestionVerification = (points = Array.from({ length: 5 }, (_, index) => ({ x: .2 + index * .12, y: .45 }))) => ({
  ...part1ExampleVerification(),
  targets: points.map((point, index) => ({
    targetNumber: index + 1,
    visualDescription: `subject-${index + 1}`,
    questionSubjectRegion: rect(point.x - .05, point.y - .04),
    questionActionRegion: { shape: 'rect', x: point.x - .02, y: point.y - .02, width: .04, height: .04 },
    confidence: .99,
  })),
});

const part3Labels = ['Saturday', 'Monday', 'Thursday', 'Sunday', 'Tuesday', 'Wednesday', 'Friday'];
const part3QuestionFixture = () => ({
  questionAnswers: part3Labels.map((label, index) => ({ label, region: rect(0.42, 0.05 + index * 0.12) })),
  questionPictures: Array.from({ length: 6 }, (_, index) => ({ side: index < 3 ? 'left' : 'right', row: index % 3 + 1, region: rect(index < 3 ? 0.05 : 0.75, 0.05 + index % 3 * 0.3) })),
  questionExample: {
    resolved: true,
    lineEvidence: 'printed-line',
    answerLabel: 'Thursday',
    pictureSide: 'left',
    pictureRow: 2,
    confidence: .98,
    renderOverlayLine: false,
  },
  warnings: [],
});
const part3AnswerKeyFixture = (includeExample = true) => ({
  layoutEvidence: 'three-rows-two-columns',
  answerKeyCells: [
    { answerLabel: 'Saturday', side: 'left', row: 1 },
    ...(includeExample ? [{ answerLabel: 'Thursday', side: 'left', row: 2 }] : []),
    { answerLabel: 'Tuesday', side: 'left', row: 3 },
    { answerLabel: 'Monday', side: 'right', row: 1 },
    { answerLabel: 'Sunday', side: 'right', row: 2 },
    { answerLabel: 'Wednesday', side: 'right', row: 3 },
  ],
  warnings: [],
});
const part3PassAnalyzer = (questionResult: any, answerKeyResult: any): SmartImportVisionAnalyzer => async (prompt, images, options) => {
  if (options.schemaName === 'listening_mover_part_3_question_example') {
    assert.deepEqual(images.map(image => image.role), ['question']);
    assert.match(prompt, /exactly one pre-drawn printed example line/);
    assert.match(prompt, /Find the example ONLY by visually tracing/);
    assert.match(prompt, /Do not return endpoints or line geometry/);
    assert.equal(Object.hasOwn((options.responseJsonSchema as any).properties.questionExample.properties, 'answerEndpoint'), false);
    assert.equal(Object.hasOwn((options.responseJsonSchema as any).properties.questionExample.properties, 'pictureEndpoint'), false);
    return { provider: 'openai', text: JSON.stringify(questionResult) };
  }
  assert.equal(options.schemaName, 'listening_mover_part_3_answer_key');
  assert.deepEqual(images.map(image => image.role), ['answer_key']);
  assert.match(prompt, /left column top\/middle\/bottom maps to left picture rows 1\/2\/3/);
  assert.match(prompt, /Do not select or change the example from this image/);
  return { provider: 'openai', text: JSON.stringify(answerKeyResult) };
};

test('Part 1 keeps three explicit image roles, separates example, and maps labels without AI IDs', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const calls: Array<{ roles: ListeningSmartImportSourceRole[]; schemaName: string }> = [];
  const candidate = await createListeningSmartImportCandidate({
    part: 1,
    currentPart: part,
    basePartHash: 'hash',
    sources: roles,
    pastedText: '',
    images: roles.map(source => image(source.role)),
    analyzeVision: async (prompt, images, options) => {
      assert.match(prompt, /Never return UUIDs/);
      calls.push({ roles: images.map(entry => entry.role), schemaName: options.schemaName });
      if (options.schemaName.endsWith('_content')) {
        assert.match(prompt, /ROLE question/);
        return { provider: 'gemini', text: JSON.stringify({
          id: 'provider-must-not-survive',
          questionScene: { shape: 'rect', x: 0.1, y: 0.1, width: 0.8, height: 0.8, points: [] },
          printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'],
          example: part1Example(),
          answerMappings: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'].map((printedName, index) => {
            const point = { x: 0.2 + index * 0.12, y: 0.45 };
            return { targetNumber: index + 1, printedName, visualDescription: `subject-${index + 1}`, questionSubjectRegion: rect(point.x - 0.04, point.y - 0.04), questionTargetPoint: point, questionId: 'forbidden' };
          }),
          warnings: [],
        }) };
      }
      if (options.schemaName.endsWith('_question_verification')) {
        assert.deepEqual(images.map(entry => entry.role), ['question']);
        return { provider: 'gemini', text: JSON.stringify(part1QuestionVerification()) };
      }
      assert.match(prompt, /ROLE question, ROLE answer_key and ROLE position_key/);
      assert.match(prompt, /not always the lower endpoint/);
      assert.match(prompt, /"targetNumber":1,"printedName":"Paul"/);
      return { provider: 'gemini', text: JSON.stringify({
        positionScene: { shape: 'rect', x: 0.1, y: 0.1, width: 0.8, height: 0.8, points: [] },
        example: part1GeometryExample(),
        resolvedTargets: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'].map((printedName, index) => {
          const point = { x: 0.2 + index * 0.12, y: 0.45 };
          return { targetNumber: index + 1, printedName, lineEndpoints: [{ x: 0.15 + index * 0.1, y: index < 3 ? 0.02 : 0.98 }, point], questionTargetPoint: point, confidence: 0.9, choiceId: 'forbidden' };
        }),
        unresolvedTargetNumbers: [],
        warnings: [],
      }) };
    },
  });
  assert.deepEqual(calls, [
    { roles: ['question', 'answer_key'], schemaName: 'listening_mover_part_1_content' },
    { roles: ['question'], schemaName: 'listening_mover_part_1_question_verification' },
    { roles: ['question', 'answer_key', 'position_key'], schemaName: 'listening_mover_part_1_geometry' },
  ]);
  assert.deepEqual(candidate.sources, roles);
  assert.equal(candidate.data.part, 1);
  if (candidate.data.part !== 1) return;
  assert.deepEqual(candidate.data.choices, ['Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane']);
  assert.equal(candidate.data.example?.label, 'Fred');
  assert.deepEqual(candidate.data.targetChoiceLabels, ['Paul', 'John', 'Jill', 'Sally', 'Daisy']);
  assert.equal(candidate.data.anchors.length, 5);
  assert.doesNotMatch(JSON.stringify(candidate.data), /provider-must-not-survive|choiceId|questionId/);
});

test('Part 1 Sol uses all three images with a short direct-coordinate prompt and keeps content mappings unchanged', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const labels = ['Paul', 'John', 'Jill', 'Sally', 'Daisy'];
  const points = labels.map((_, index) => ({ x: .25 + index * .12, y: .5 }));
  const calls: Array<{ roles: ListeningSmartImportSourceRole[]; schemaName: string }> = [];
  const candidate = await createListeningSmartImportCandidate({
    part: 1,
    currentPart: part,
    basePartHash: 'hash',
    sources: roles,
    pastedText: '',
    images: roles.map(source => image(source.role)),
    preferredProvider: 'stali:gpt-5.6-sol',
    analyzeVision: async (prompt, images, options) => {
      calls.push({ roles: images.map(entry => entry.role), schemaName: options.schemaName });
      assert.equal(options.preferredProvider, 'stali:gpt-5.6-sol');
      if (options.schemaName.endsWith('_content')) {
        return { provider: 'stali:gpt-5.6-sol', text: JSON.stringify({
          questionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
          printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'],
          example: part1Example(),
          answerMappings: labels.map((printedName, index) => ({
            targetNumber: index + 1,
            printedName,
            visualDescription: `subject-${index + 1}`,
          })),
          warnings: [],
        }) };
      }
      if (options.schemaName.endsWith('_question_verification')) {
        assert.deepEqual(images.map(entry => entry.role), ['question']);
        assert.match(prompt, /Do not inspect the five scored targets/);
        assert.equal((options.responseJsonSchema as any).properties.targets, undefined);
        return { provider: 'stali:gpt-5.6-sol', text: JSON.stringify(part1ExampleVerification()) };
      }
      assert.deepEqual(images.map(entry => entry.role), ['question', 'answer_key', 'position_key']);
      assert.match(prompt, /Use IMAGES 2 and 3/);
      assert.match(prompt, /equivalent point on IMAGE 1/);
      assert.doesNotMatch(prompt, /questionActionRegion|lineEndpoints|positionScene/);
      assert.ok((options.responseJsonSchema as any).properties.resolvedTargets.items.properties.questionTargetPoint);
      assert.equal((options.responseJsonSchema as any).properties.positionScene, undefined);
      return { provider: 'stali:gpt-5.6-sol', text: JSON.stringify({
        resolvedTargets: labels.map((printedName, index) => ({
          targetNumber: index + 1,
          printedName,
          questionTargetPoint: points[index],
          confidence: .95,
        })),
        unresolvedTargetNumbers: [],
        warnings: [],
      }) };
    },
  });

  assert.deepEqual(calls, [
    { roles: ['question', 'answer_key'], schemaName: 'listening_mover_part_1_content' },
    { roles: ['question'], schemaName: 'listening_mover_part_1_question_verification' },
    { roles: ['question', 'answer_key', 'position_key'], schemaName: 'listening_mover_part_1_geometry' },
  ]);
  assert.equal(candidate.provider, 'stali:gpt-5.6-sol');
  if (candidate.data.part !== 1) return;
  assert.deepEqual(candidate.data.choices, ['Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane']);
  assert.deepEqual(candidate.data.targetChoiceLabels, labels);
  assert.deepEqual(candidate.data.anchors.map(anchor => anchor.targetNumber), [1, 2, 3, 4, 5]);
  assert.equal(candidate.data.anchors[0].region.x, .19);
  assert.equal(candidate.data.example?.label, 'Fred');
});

test('Part 1 preserves numbered answer mappings when position geometry cannot be transformed', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  let calls = 0;
  const candidate = await createListeningSmartImportCandidate({
    part: 1, currentPart: part, basePartHash: 'hash', sources: roles, pastedText: '', images: roles.map(source => image(source.role)),
    analyzeVision: async (_prompt, _images, options) => {
      calls += 1;
      if (options.schemaName.endsWith('_content')) return { provider: 'gemini', text: JSON.stringify({
        questionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
        printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'],
        example: part1Example(),
        answerMappings: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'].map((printedName, index) => ({ targetNumber: index + 1, printedName, visualDescription: `subject-${index + 1}` })),
        warnings: [],
      }) };
      if (options.schemaName.endsWith('_question_verification')) return { provider: 'gemini', text: JSON.stringify(part1QuestionVerification()) };
      throw new Error('geometry provider failed');
    },
  });
  assert.equal(calls, 4);
  if (candidate.data.part !== 1) return;
  assert.equal(candidate.data.anchors.length, 5);
  assert.deepEqual(candidate.data.targetChoiceLabels, ['Paul', 'John', 'Jill', 'Sally', 'Daisy']);
  assert.match(candidate.warnings.join(' '), /không hoàn tất lượt xác định vị trí/);
});

test('Part 1 retries and rejects direct-only geometry without required scene evidence', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 1, currentPart: part, basePartHash: 'hash', sources: roles, pastedText: '', images: roles.map(source => image(source.role)),
    analyzeVision: async (_prompt, _images, options) => ({ provider: 'openai', text: JSON.stringify(options.schemaName.endsWith('_content') ? {
      questionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
      printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'], example: part1Example(),
      answerMappings: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'].map((printedName, index) => ({ targetNumber: index + 1, printedName, visualDescription: `subject-${index + 1}` })), warnings: [],
    } : options.schemaName.endsWith('_question_verification') ? part1QuestionVerification() : {
      example: part1GeometryExample(),
      resolvedTargets: Array.from({ length: 5 }, (_, index) => ({ targetNumber: index + 1, printedName: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'][index], questionTargetPoint: { x: .2 + index * .12, y: .5 } })),
      unresolvedTargetNumbers: [], warnings: [],
    }) }),
  });
  if (candidate.data.part !== 1) return;
  assert.equal(candidate.data.anchors.length, 5);
  assert.equal(candidate.data.example?.label, 'Fred');
  assert.match(candidate.warnings.join(' '), /không hoàn tất lượt xác định vị trí/);
});

test('Part 1 selects the unique line endpoint inside the illustrated scene and rejects contradictory geometry', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 1, currentPart: part, basePartHash: 'hash', sources: roles, pastedText: '', images: roles.map(source => image(source.role)),
    analyzeVision: async (_prompt, _images, options) => ({ provider: 'openai', text: JSON.stringify(options.schemaName.endsWith('_content') ? {
      questionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
      printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'], example: part1Example(),
      answerMappings: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'].map((printedName, index) => {
        const point = index === 0 ? { x: .5, y: .5 } : index === 1 ? { x: .85, y: .85 } : { x: .25 + index * .1, y: .65 };
        return { targetNumber: index + 1, printedName, visualDescription: `subject-${index + 1}`, questionSubjectRegion: rect(point.x - .05, point.y - .04), questionTargetPoint: point };
      }), warnings: [],
    } : options.schemaName.endsWith('_question_verification') ? part1QuestionVerification([
      { x: .5, y: .5 }, { x: .85, y: .85 }, { x: .45, y: .65 }, { x: .55, y: .65 }, { x: .65, y: .65 },
    ]) : {
      positionScene: { shape: 'rect', x: .2, y: .1, width: .6, height: .8 },
      example: part1GeometryExample(),
      resolvedTargets: [
        { targetNumber: 1, printedName: 'Paul', lineEndpoints: [{ x: .1, y: .95 }, { x: .5, y: .5 }], questionTargetPoint: { x: .5, y: .5 } },
        { targetNumber: 2, printedName: 'John', lineEndpoints: [{ x: .5, y: .02 }, { x: .5, y: .4 }], questionTargetPoint: { x: .85, y: .85 } },
      ],
      unresolvedTargetNumbers: [3, 4, 5], warnings: [],
    }) }),
  });
  if (candidate.data.part !== 1) return;
  assert.equal(candidate.data.anchors.length, 5);
  assert.equal(candidate.data.anchors[0].targetNumber, 1);
  assert.equal(candidate.data.anchors[0].region.x, .44);
  assert.match(candidate.warnings.join(' '), /line\/scene evidence mâu thuẫn/);
});

test('Part 1 keeps a high-confidence clean-question localization when one traced line conflicts', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const labels = ['Paul', 'John', 'Jill', 'Sally', 'Daisy'];
  const candidate = await createListeningSmartImportCandidate({
    part: 1, currentPart: part, basePartHash: 'hash', sources: roles, pastedText: '', images: roles.map(source => image(source.role)),
    analyzeVision: async (_prompt, _images, options) => ({ provider: 'openai', text: JSON.stringify(options.schemaName.endsWith('_content') ? {
      questionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
      printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'], example: part1Example(),
      answerMappings: labels.map((printedName, index) => {
        const point = index === 0 ? { x: .8, y: .8 } : index === 1 ? { x: .5, y: .5 } : undefined;
        return {
          targetNumber: index + 1,
          printedName,
          visualDescription: `subject-${index + 1}`,
          ...(point ? { questionSubjectRegion: rect(point.x - .05, point.y - .04), questionTargetPoint: point, confidence: .99 } : {}),
        };
      }),
      warnings: [],
    } : options.schemaName.endsWith('_question_verification') ? part1QuestionVerification([
      { x: .8, y: .8 }, { x: .5, y: .5 }, { x: .45, y: .65 }, { x: .55, y: .65 }, { x: .65, y: .65 },
    ]) : {
      positionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
      example: part1GeometryExample(),
      resolvedTargets: [
        { targetNumber: 1, printedName: 'Paul', lineEndpoints: [{ x: .05, y: .95 }, { x: .2, y: .2 }], questionTargetPoint: { x: .2, y: .2 }, confidence: .9 },
        { targetNumber: 2, printedName: 'John', lineEndpoints: [{ x: .5, y: .02 }, { x: .5, y: .5 }], questionTargetPoint: { x: .5, y: .5 }, confidence: .9 },
      ],
      unresolvedTargetNumbers: [3, 4, 5], warnings: [],
    }) }),
  });
  if (candidate.data.part !== 1) return;
  assert.deepEqual(candidate.data.anchors.map(anchor => anchor.targetNumber), [1, 2, 3, 4, 5]);
  assert.equal(candidate.data.anchors[0].region.x, .74);
  assert.match(candidate.warnings.join(' '), /localization độc lập confidence cao/);
});

test('Part 1 keeps an action contact point immediately beside the primary subject', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const labels = ['Paul', 'John', 'Jill', 'Sally', 'Jane'];
  const candidate = await createListeningSmartImportCandidate({
    part: 1, currentPart: part, basePartHash: 'hash', sources: roles, pastedText: '', images: roles.map(source => image(source.role)),
    analyzeVision: async (_prompt, _images, options) => ({ provider: 'openai', text: JSON.stringify(options.schemaName.endsWith('_content') ? {
      questionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
      printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'],
      example: { ...part1Example(), label: 'Daisy' },
      answerMappings: labels.map((printedName, index) => ({
        targetNumber: index + 1,
        printedName,
        visualDescription: `subject-${index + 1}`,
        ...(index === 0 ? {
          questionSubjectRegion: rect(.4, .4),
          questionActionRegion: { shape: 'rect', x: .55, y: .42, width: .06, height: .06 },
          questionTargetPoint: { x: .45, y: .45 },
          confidence: .99,
        } : {}),
      })),
      warnings: [],
    } : options.schemaName.endsWith('_question_verification') ? part1QuestionVerification([
      { x: .58, y: .45 }, { x: .32, y: .45 }, { x: .44, y: .45 }, { x: .56, y: .45 }, { x: .68, y: .45 },
    ]) : {
      positionScene: { shape: 'rect', x: .1, y: .1, width: .8, height: .8 },
      example: part1GeometryExample(),
      resolvedTargets: [],
      unresolvedTargetNumbers: [1, 2, 3, 4, 5],
      warnings: [],
    }) }),
  });
  if (candidate.data.part !== 1) return;
  assert.deepEqual(candidate.data.anchors.map(anchor => anchor.targetNumber), [1, 2, 3, 4, 5]);
  assert.equal(candidate.data.anchors[0].region.x, .52);
  assert.equal(candidate.data.example?.label, 'Fred');
  assert.deepEqual(candidate.data.choices, ['Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane']);
});

test('Part 2 maps numbered answer key to five prompts, preserving 4b and variants', async () => {
  const part = createDefaultMoverListeningContent().parts[1];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 2,
    currentPart: part,
    basePartHash: 'hash',
    sources: roleSources,
    pastedText: '',
    images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({
      heading: 'Pat',
      exampleText: 'Name: Jill Walker',
      questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `${number}. Prompt ____` })),
      answers: [
        { questionNumber: 5, correctAnswer: 'snake' },
        { questionNumber: 2, correctAnswer: '4b' },
        { questionNumber: 1, correctAnswer: 'Main' },
        { questionNumber: 4, answerVariants: ['comics', 'comic books'] },
        { questionNumber: 3, correctAnswer: 'hockey' },
      ],
    }) }),
  });
  assert.equal(candidate.data.part, 2);
  if (candidate.data.part !== 2) return;
  assert.equal(candidate.data.exampleText, 'Name: Jill Walker');
  assert.deepEqual(candidate.data.questions.find(question => question.questionNumber === 2)?.acceptedAnswers, ['4b']);
  assert.deepEqual(candidate.data.questions.find(question => question.questionNumber === 4)?.acceptedAnswers, ['comics', 'comic books']);
});

test('Part 2 malformed or duplicate answer remains unresolved and never shifts later numbers', async () => {
  const part = createDefaultMoverListeningContent().parts[1];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 2, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({
      questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `${number}. Prompt` })),
      answers: [{ questionNumber: 1, answer: 'one' }, { questionNumber: 2, answer: '' }, { questionNumber: 3, answer: 'three' }, { questionNumber: 3, answer: 'conflict' }, { questionNumber: 5, answer: 'five' }],
    }) }),
  });
  if (candidate.data.part !== 2) return;
  assert.equal(candidate.data.questions.find(question => question.questionNumber === 2)?.acceptedAnswers, undefined);
  assert.equal(candidate.data.questions.find(question => question.questionNumber === 3)?.acceptedAnswers, undefined);
  assert.deepEqual(candidate.data.questions.find(question => question.questionNumber === 5)?.acceptedAnswers, ['five']);
  assert.match(candidate.warnings.join(' '), /3/);
});

test('Part 3 uses the 3-left/3-right answer layout and excludes Thursday example from five scored connections', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: part3PassAnalyzer(part3QuestionFixture(), part3AnswerKeyFixture()),
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.answers.length, 7);
  assert.deepEqual(candidate.data.pictures.map(picture => `${picture.side}:${picture.row}`), ['left:1', 'left:2', 'left:3', 'right:1', 'right:2', 'right:3']);
  assert.equal(candidate.data.example?.answerLabel, 'Thursday');
  assert.equal(candidate.data.connections.length, 5);
  assert.equal(candidate.data.connections.some(connection => connection.answerLabel === 'Thursday'), false);
  assert.equal(candidate.data.distractorLabel, 'Friday');
  assert.equal(candidate.data.answers.every(answer => answer.source === 'ai'), true);
  assert.equal(candidate.data.pictures.every(picture => picture.source === 'ai'), true);
  assert.equal(candidate.data.example?.source, 'ai');
  assert.equal(candidate.data.connections.every(connection => connection.source === 'ai'), true);
  assert.equal(candidate.data.distractorSource, 'derived');
});

test('Part 3 accepts an answer key containing only the five scored rows when the example comes from the question image', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: part3PassAnalyzer(part3QuestionFixture(), part3AnswerKeyFixture(false)),
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.connections.length, 5);
  assert.equal(candidate.data.connections.some(connection => connection.answerLabel === 'Thursday'), false);
  assert.equal(candidate.data.distractorLabel, 'Friday');
});

test('Part 3 normalizes Gemini box_2d geometry instead of dropping readable labels and slots', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const boxQuestion = {
    questionAnswers: part3Labels.map((label, index) => ({ label, box_2d: [50 + index * 100, 420, 100 + index * 100, 580] })),
    questionPictures: Array.from({ length: 6 }, (_, index) => ({ side: index < 3 ? 'left' : 'right', row: index % 3 + 1, box_2d: [50 + index % 3 * 300, index < 3 ? 40 : 720, 250 + index % 3 * 300, index < 3 ? 280 : 960] })),
    questionExample: {
      resolved: true, lineEvidence: 'printed-line', answerLabel: 'Thursday', pictureSide: 'left', pictureRow: 2,
      confidence: .96, renderOverlayLine: false,
    },
    warnings: [],
  };
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: part3PassAnalyzer(boxQuestion, part3AnswerKeyFixture()),
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.answers.length, 7);
  assert.equal(candidate.data.pictures.length, 6);
  assert.equal(candidate.data.answers[0].region.x, .42);
  assert.equal(candidate.data.pictures[0].side, 'left');
});

test('Part 3 rejects analysis when the printed example line cannot be proven', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const before = JSON.stringify(part);
  await assert.rejects(
    () => createListeningSmartImportCandidate({
      part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
      analyzeVision: async () => ({ provider: 'gemini', text: JSON.stringify({
        ...part3QuestionFixture(),
        questionExample: { resolved: false },
        warnings: ['printed line uncertain'],
      }) }),
    }),
    (error: any) => {
      assert.equal(error.code, 'LISTENING_SMART_IMPORT_INVALID_JSON');
      assert.match(error.details.join(' '), /printed line/);
      return true;
    },
  );
  assert.equal(JSON.stringify(part), before);
});

test('Part 3 accepts a semantic printed-line example without endpoint geometry', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: part3PassAnalyzer(part3QuestionFixture(), part3AnswerKeyFixture()),
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.example?.answerLabel, 'Thursday');
  assert.equal(candidate.data.example?.pictureSide, 'left');
  assert.equal(candidate.data.example?.pictureRow, 2);
});

test('Part 3 reconciles a one-to-one answer-key swap while preserving the printed-line example', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const conflictingKey = part3AnswerKeyFixture();
  conflictingKey.answerKeyCells = conflictingKey.answerKeyCells.map(cell => {
    if (cell.side === 'left' && cell.row === 2) return { ...cell, answerLabel: 'Monday' };
    if (cell.side === 'right' && cell.row === 1) return { ...cell, answerLabel: 'Thursday' };
    return cell;
  });
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: part3PassAnalyzer(part3QuestionFixture(), conflictingKey),
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.example?.answerLabel, 'Thursday');
  assert.equal(candidate.data.connections.length, 5);
  assert.equal(candidate.data.connections.some(connection => connection.answerLabel === 'Thursday'), false);
  assert.deepEqual(candidate.data.connections.find(connection => connection.answerLabel === 'Monday'), {
    answerLabel: 'Monday', pictureSide: 'right', pictureRow: 1, source: 'ai',
  });
  assert.match(candidate.warnings.join(' '), /hoán đổi cell example/);
});

test('Part 3 text fallback preserves explicit three-row two-column layout and excludes the existing example', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  if (part.displayMode !== 'connect-image') return;
  ['Saturday', 'Monday', 'Thursday', 'Sunday', 'Tuesday', 'Wednesday', 'Friday'].forEach((label, index) => { part.answers[index].label = label; });
  part.exampleConnection = { answerId: part.answers[2].id, pictureId: part.pictures[1].id, renderOverlayLine: false };
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: [], images: [],
    pastedText: 'Saturday  Monday\nThursday  Sunday\nTuesday  Wednesday',
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.connections.length, 5);
  assert.equal(candidate.data.connections.some(connection => connection.answerLabel === 'Thursday'), false);
  assert.equal(candidate.data.distractorLabel, 'Friday');
});

test('Part 4 maps numbered A/B/C answers and rejects duplicate/out-of-range values without index collapse', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 4, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'gemini', text: JSON.stringify({
      example: { prompt: "Where is Pat's dad going?", answer: 'A', crops: [rect(), rect(0.3), rect(0.6)] },
      questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `Question ${number}`, crops: [rect(), rect(0.3), rect(0.6)] })),
      answers: [{ questionNumber: 1, answer: 'A' }, { questionNumber: 2, answer: 'C' }, { questionNumber: 3, answer: 'C' }, { questionNumber: 4, answer: 'B' }, { questionNumber: 5, answer: 'C' }],
    }) }),
  });
  if (candidate.data.part !== 4) return;
  assert.equal(candidate.data.example?.correctOptionIndex, 0);
  assert.deepEqual(candidate.data.questions.map(question => question.correctOptionIndex), [0, 2, 2, 1, 2]);

  const duplicate = await createListeningSmartImportCandidate({
    part: 4, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'gemini', text: JSON.stringify({ questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `Q${number}`, crops: [rect(), rect(.3), rect(.6)] })), answers: [{ questionNumber: 1, answer: 'A' }, { questionNumber: 2, answer: 'D' }, { questionNumber: 3, answer: 'B' }, { questionNumber: 3, answer: 'C' }, { questionNumber: 5, answer: 'A' }] }) }),
  });
  if (duplicate.data.part !== 4) return;
  assert.equal(duplicate.data.questions.find(question => question.questionNumber === 2)?.correctOptionIndex, undefined);
  assert.equal(duplicate.data.questions.find(question => question.questionNumber === 3)?.correctOptionIndex, undefined);
  assert.equal(duplicate.data.questions.find(question => question.questionNumber === 5)?.correctOptionIndex, 0);
});

test('Part 4 ordered fallback is used only with exactly five answers and explicit layout evidence', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 4, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({ orderedFallbackEvidence: 'single-row', questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `Q${number}`, crops: [rect(), rect(.3), rect(.6)] })), answers: ['A', 'C', 'C', 'B', 'C'] }) }),
  });
  if (candidate.data.part !== 4) return;
  assert.deepEqual(candidate.data.questions.map(question => question.correctOptionIndex), [0, 2, 2, 1, 2]);
  assert.match(candidate.warnings.join(' '), /ordered fallback/i);
});

test('Part 5 Sol receives three roles, maps Draw positions to question coordinates, and preserves variable action counts', async () => {
  const part = createDefaultMoverListeningContent().parts[4];
  const roleSources = sources('question', 'answer_key', 'position_key');
  const passRoles: string[][] = [];
  const candidate = await createListeningSmartImportCandidate({
    part: 5, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)), preferredProvider: 'stali:gpt-5.6-sol',
    analyzeVision: async (prompt, images, options) => {
      passRoles.push(images.map(entry => entry.role));
      assert.match(prompt, /ROLE question is the clean image shown to students/);
      assert.match(prompt, /normalized rectangular targetRegion in complete ROLE question coordinates/);
      assert.equal(options.schemaName, 'listening_mover_part_5_content');
      assert.equal(options.preferredProvider, 'stali:gpt-5.6-sol');
      assert.equal(JSON.stringify(options.responseJsonSchema).includes('targetRegion'), true);
      return { provider: 'stali:gpt-5.6-sol', text: JSON.stringify({
      paletteItems: [{ objectType: 'star', label: 'yellow star', color: 'Yellow' }],
      questions: [
        { questionNumber: 1, prompt: 'Q1', actions: [{ type: 'colour_object', objectLabel: 'hat', correctColor: 'Red' }, { type: 'place_object', objectType: 'star', color: 'Yellow', targetRegion: rect(.5), relationLabel: 'on the tree' }] },
        { questionNumber: 2, prompt: 'Q2', actions: [{ type: 'colour_object', objectLabel: 'tree', correctColor: 'Green' }] },
        { questionNumber: 3, prompt: 'Q3', actions: [{ type: 'colour_object', objectLabel: 'sock', correctColor: 'Yellow' }] }, { questionNumber: 4, prompt: 'Q4', actions: [{ type: 'place_object', objectType: 'circle' }] }, { questionNumber: 5, prompt: 'Q5', actions: [{ type: 'colour_object', objectLabel: 'hat', correctColor: 'Blue' }] },
      ], warnings: [],
      }), model: options.schemaName };
    },
  });
  if (candidate.data.part !== 5) return;
  assert.deepEqual(passRoles, [['question', 'answer_key', 'position_key']]);
  assert.deepEqual(candidate.data.questions.map(question => question.actions.length), [2, 1, 1, 1, 1]);
  assert.equal(candidate.data.questions[3].actions[0].type, 'place_object');
  const draw = candidate.data.questions[0].actions[1];
  assert.deepEqual(draw.type === 'place_object' ? draw.targetRegion : undefined, rect(.5));
  assert.match(candidate.warnings.join(' '), /Sol|giáo viên|distractor|palette/i);
});

test('Part 5 retries incomplete content then recovers explicit Draw instructions without inventing geometry', async () => {
  const part = createDefaultMoverListeningContent().parts[4];
  const roleSources = sources('question', 'answer_key', 'position_key');
  let attempts = 0;
  const candidate = await createListeningSmartImportCandidate({
    part: 5, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)), preferredProvider: 'stali:gpt-5.6-sol',
    analyzeVision: async () => {
      attempts += 1;
      return { provider: 'stali:gpt-5.6-sol', text: JSON.stringify({
        paletteItems: [],
        questions: [
          { questionNumber: 1, prompt: 'Colour the cupboard – green', actions: [{ type: 'colour_object', objectLabel: 'cupboard', correctColor: 'Green' }] },
          { questionNumber: 2, prompt: 'Draw a lamp on the table by the bed', actions: [] },
          { questionNumber: 3, prompt: 'Colour the T-shirt – red', actions: [{ type: 'colour_object', objectLabel: 'T-shirt', correctColor: 'Red' }] },
          { questionNumber: 4, prompt: 'Colour the mat – brown', actions: [{ type: 'colour_object', objectLabel: 'mat', correctColor: 'Brown' }] },
          { questionNumber: 5, prompt: 'Draw a red toy plane between the boys', actions: [] },
        ],
        warnings: [],
      }) };
    },
  });
  assert.equal(attempts, 2);
  if (candidate.data.part !== 5) return;
  const second = candidate.data.questions[1].actions[0];
  const fifth = candidate.data.questions[4].actions[0];
  assert.deepEqual(second, { type: 'place_object', objectType: 'lamp', relationLabel: 'on the table by the bed', confidence: 0.5 });
  assert.deepEqual(fifth, { type: 'place_object', objectType: 'toy plane', colourLabel: 'Red', relationLabel: 'between the boys', confidence: 0.5 });
  assert.match(candidate.warnings.join(' '), /phục hồi action Draw|xác định chắc vị trí Draw/i);
});

test('malformed provider output retries with schema then fails without creating a candidate', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  let attempts = 0;
  await assert.rejects(
    () => createListeningSmartImportCandidate({
      part: 4, currentPart: part, basePartHash: 'hash', sources: sources('question', 'answer_key'), pastedText: '', images: [image('question'), image('answer_key')], preferredProvider: 'openai',
      analyzeVision: async (_prompt, _images, options) => {
        attempts += 1;
        assert.equal(options.preferredProvider, 'openai');
        assert.equal(options.schemaName, 'listening_mover_part_4');
        assert.equal((options.responseJsonSchema as any).type, 'object');
        return { provider: 'openai', text: 'not-json' };
      },
    }),
    (error: any) => {
      assert.equal(error.status, 502);
      assert.equal(error.code, 'LISTENING_SMART_IMPORT_INVALID_JSON');
      assert.match(error.message, /Draft chưa được thay đổi/);
      return true;
    },
  );
  assert.equal(attempts, 2);
});

test('provider transport failure exposes safe details and never creates a misleading provider candidate', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  let attempts = 0;
  await assert.rejects(
    () => createListeningSmartImportCandidate({
      part: 1,
      currentPart: part,
      basePartHash: 'hash',
      sources: sources('question', 'answer_key', 'position_key'),
      pastedText: '',
      images: [image('question'), image('answer_key'), image('position_key')],
      preferredProvider: 'openai',
      analyzeVision: async () => {
        attempts += 1;
        const error: any = new Error('Không có nhà cung cấp AI thị giác khả dụng.');
        error.status = 503;
        error.details = ['OpenAI: fetch failed'];
        throw error;
      },
    }),
    (error: any) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'LISTENING_SMART_IMPORT_PROVIDER_FAILED');
      assert.deepEqual(error.details, ['OpenAI: fetch failed']);
      assert.match(error.message, /Draft chưa được thay đổi/);
      return true;
    },
  );
  assert.equal(attempts, 2);
});

test('aborted provider request is not retried and reports a timeout', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(
    () => createListeningSmartImportCandidate({
      part: 1,
      currentPart: part,
      basePartHash: 'hash',
      sources: sources('question', 'answer_key', 'position_key'),
      pastedText: '',
      images: [image('question'), image('answer_key'), image('position_key')],
      preferredProvider: 'openai',
      signal: controller.signal,
      analyzeVision: async () => {
        attempts += 1;
        controller.abort();
        const error: any = new Error('This operation was aborted');
        error.name = 'AbortError';
        throw error;
      },
    }),
    (error: any) => {
      assert.equal(error.status, 504);
      assert.equal(error.code, 'LISTENING_SMART_IMPORT_TIMEOUT');
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test('invalid JSON that succeeds on retry preserves the selected provider and recovered data', async () => {
  const part = createDefaultMoverListeningContent().parts[1];
  let attempts = 0;
  const candidate = await createListeningSmartImportCandidate({
    part: 2, currentPart: part, basePartHash: 'hash', sources: sources('question', 'answer_key'), pastedText: '', images: [image('question'), image('answer_key')], preferredProvider: 'gemini',
    analyzeVision: async (_prompt, _images, options) => {
      attempts += 1;
      if (options.attempt === 1) return { provider: 'gemini', text: '{bad' };
      return { provider: 'gemini', text: JSON.stringify({
        questions: [1, 2, 3, 4, 5].map(questionNumber => ({ questionNumber, prompt: `Q${questionNumber}` })),
        answers: [1, 2, 3, 4, 5].map(questionNumber => ({ questionNumber, correctAnswer: `A${questionNumber}` })),
        warnings: [],
      }) };
    },
  });
  assert.equal(attempts, 2);
  assert.equal(candidate.data.part === 2 ? candidate.data.questions.length : 0, 5);
  assert.match(candidate.warnings.join(' '), /sau lần retry/);
});
