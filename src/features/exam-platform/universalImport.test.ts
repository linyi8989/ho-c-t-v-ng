import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import { examPartUnits, promoteExamPartToBlocks } from './examStructure';
import { starterMatchingResponseKey } from './starterMatching';
import { importUniversalExamBundle, importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';
import { gradeExamAttempt } from '../../server/exam-platform/examGrader';
import { sanitizeExamAnswers, sanitizeExamContentForStudent, validateExamPaperContent } from '../../server/exam-platform/examValidation';

const interaction = (family: string, subtype: string, variant: string) => ({ family, subtype, variant, schemaVersion: 1 });

test('Universal JSON v2 owns a flexible six-Part structure and supports several blocks in one Part outside fixed Starters papers', () => {
  const definition = getExamPaperDefinition('flyer', 'reading-writing')!;
  const current = createDefaultExamContent(definition);
  const parts = Array.from({ length: 6 }, (_, index) => ({
    partNumber: index + 1,
    title: `Part ${index + 1}`,
    instruction: 'Do the task.',
    blocks: index === 0 ? [
      {
        blockNumber: 1,
        title: 'Fill on the picture',
        instruction: 'Write one word.',
        interaction: interaction('text-entry', 'short-answer', 'image-regions'),
        content: { questions: [{ prompt: 'Name: ____', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['Sam'] } }] },
        geometryHints: { coordinateSpace: 'pixel', imageSize: { width: 1000, height: 500 }, regions: [{ role: 'answer-region', ref: 'Câu 1', questionNumber: 1, shape: 'rect', x: 600, y: 200, width: 200, height: 50, confidence: .9 }] },
      },
      {
        blockNumber: 2,
        title: 'Choose',
        instruction: 'Choose A or B.',
        interaction: interaction('choice', 'single', 'text-options'),
        questions: [{ prompt: 'Pick B', options: [{ label: 'A', text: 'A' }, { label: 'B', text: 'B' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['B'] } }],
      },
    ] : [{
      blockNumber: 1,
      title: 'Write',
      instruction: 'Write.',
      interaction: interaction('text-entry', 'short-answer', 'single-input'),
      questions: [{ prompt: `Answer ${index + 1}`, answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [`ok-${index + 1}`] } }],
    }],
  }));
  const source = JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer' }, papers: [{ paperId: 'reading-writing', title: 'Flexible paper', parts }] });
  const result = importUniversalExamBundle(current, source);
  assert.equal(result.content.schemaVersion, 2);
  assert.equal(result.content.structureMode, 'dynamic');
  assert.equal(result.content.parts.length, 6);
  assert.equal(result.content.parts[0].blocks?.length, 2);
  assert.equal(result.content.parts.reduce((sum, part) => sum + part.questions.length, 0), 7);
  const firstBlock = result.content.parts[0].blocks![0];
  assert.equal(firstBlock.geometryHints?.[0].region.x, .6);
  assert.equal(firstBlock.geometryHints?.[0].status, 'suggested');
  assert.equal(firstBlock.interactionLayout?.kind, 'image-text-entry-v1');
  if (firstBlock.interactionLayout?.kind !== 'image-text-entry-v1') assert.fail('Expected image text-entry layout');
  firstBlock.imageAssetId = 'teacher-image';
  firstBlock.imageUrl = '/media/teacher-image';
  firstBlock.interactionLayout.targets.forEach(target => { target.geometryConfirmedByTeacher = true; });
  assert.deepEqual(validateExamPaperContent(result.content), []);

  const safe = sanitizeExamContentForStudent(result.content);
  assert.equal(safe.parts[0].blocks?.[0].geometryHints, undefined);
  assert.equal((safe.parts[0].questions[0] as any).acceptedAnswers, undefined);
  const answers = Object.fromEntries(result.content.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0] || question.acceptedAnswers[0]])));
  const grade = gradeExamAttempt(result.content, sanitizeExamAnswers(answers, result.content));
  assert.equal(grade.totalCount, 7);
  assert.equal(grade.correctCount, 7);
});

test('a matching block and a text block in the same Part are both sanitized and graded', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('flyer', 'reading-writing')!);
  const source = JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer' }, papers: [{ paperId: 'reading-writing', parts: [{
      partNumber: 1, title: 'Mixed', instruction: 'Complete both tasks.', blocks: [
        {
          blockNumber: 1, title: 'Connect', instruction: 'Draw a line.', interaction: interaction('matching', 'image-image', 'draw-line'), answerSource: 'official-answer-key',
          content: { sourceNodes: [{ label: 'cat' }, { label: 'dog' }], targetNodes: [{ label: 'ball' }, { label: 'tree' }], questions: [{ prompt: 'cat', sourceLabel: 'cat', answerKey: { source: 'official-answer-key', targetLabel: 'ball' } }] },
          geometryHints: { coordinateSpace: 'normalized', regions: [
            { role: 'source-node', ref: 'cat', shape: 'rect', x: .1, y: .1, width: .1, height: .1 },
            { role: 'source-node', ref: 'dog', shape: 'rect', x: .3, y: .1, width: .1, height: .1 },
            { role: 'target-node', ref: 'ball', shape: 'rect', x: .1, y: .7, width: .1, height: .1 },
            { role: 'target-node', ref: 'tree', shape: 'rect', x: .3, y: .7, width: .1, height: .1 },
          ] },
        },
        { blockNumber: 2, title: 'Write', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'inline-gap'), questions: [{ prompt: 'Say yes', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['yes'] } }] },
      ],
    }] }],
  });
  const content = importUniversalExamBundle(current, source).content;
  const [matching, text] = examPartUnits(content.parts[0]);
  matching.imageAssetId = 'scene';
  matching.imageUrl = '/media/scene';
  if (matching.interactionLayout?.kind !== 'starter-image-matching-v2') assert.fail('Expected matching layout');
  matching.interactionLayout.sourceNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
  matching.interactionLayout.targetNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
  const block = content.parts[0].blocks![0];
  block.imageAssetId = matching.imageAssetId;
  block.imageUrl = matching.imageUrl;
  block.interactionLayout = matching.interactionLayout;
  assert.deepEqual(validateExamPaperContent(content), []);
  const matchingQuestion = matching.questions[0];
  const textQuestion = text.questions[0];
  const rawAnswers = {
    [starterMatchingResponseKey(matching.id)]: [{ sourceNodeId: matchingQuestion.interactionSourceNodeId!, targetNodeId: matchingQuestion.correctOptionIds[0] }],
    [textQuestion.id]: 'yes',
  };
  const sanitized = sanitizeExamAnswers(rawAnswers, content);
  const grade = gradeExamAttempt(content, sanitized);
  assert.equal(grade.totalCount, 2);
  assert.equal(grade.correctCount, 2);
});

test('the copied prompt describes dynamic Parts, blocks and optional geometry instead of a fixed Starter template', () => {
  const content = createDefaultExamContent(getExamPaperDefinition('flyer', 'listening')!);
  const prompt = buildUniversalExamImportPrompt(content);
  assert.match(prompt, /exam-bundle-import-v2/);
  assert.match(prompt, /không áp đặt số Part/);
  assert.match(prompt, /blocks\[\]/);
  assert.match(prompt, /geometryHints/);
  assert.doesNotMatch(prompt, /4 Part.*20/i);
});

test('the Part prompt keeps the full v2 envelope and teaches AI to split colour from draw', () => {
  const content = createDefaultExamContent(getExamPaperDefinition('starter', 'listening')!);
  const prompt = buildUniversalExamPartImportPrompt(content, 3);
  assert.match(prompt, /CHỈ phân tích Part 4/);
  assert.match(prompt, /papers\[0\]\.parts chỉ có Part 4/);
  assert.match(prompt, /exam-bundle-import-v2/);
  assert.match(prompt, /drawObject "flower"/);
  assert.match(prompt, /"subtype":\s*"draw-object"/);
  assert.match(prompt, /"role":\s*"draw-region"/);
  const focusedEnvelope = JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'starter' }, papers: [{ paperId: 'listening', parts: [{
      partNumber: 4, title: 'Part 4', instruction: 'Draw.', blocks: [{ blockNumber: 1, title: 'Draw', instruction: 'Draw.', interaction: interaction('scene', 'draw-object', 'draw'), questions: [{ prompt: 'Draw a flower.', drawObject: 'flower', targetDescription: 'on the dog', answerSource: 'official-answer-key', answerKey: {} }] }],
    }] }],
  });
  const imported = importUniversalExamPart(content, 3, focusedEnvelope);
  assert.equal(imported.part.part, 4);
  assert.equal(imported.part.interactionLayout, undefined);
  assert.equal(imported.part.blocks?.[0].interactionLayout?.kind, 'scene-draw-v1');
  const dynamic = {
    ...content,
    schemaVersion: 2,
    structureMode: 'dynamic' as const,
    parts: content.parts.map((part, index) => index === 3 ? imported.part : promoteExamPartToBlocks(part)),
  };
  const validationErrors = validateExamPaperContent(dynamic);
  assert.equal(validationErrors.some(error => error === 'Schema đề thi không được hỗ trợ.'), false);
  assert.equal(validationErrors.some(error => error.includes('dạng câu hỏi không phù hợp Part này')), false);
});

test('scene colour gets an editable 10-colour catalog while draw stays a private-region placement action', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('flyer', 'reading-writing')!);
  const source = JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer' }, papers: [{ paperId: 'reading-writing', parts: [{
      partNumber: 1, title: 'Colour and draw', instruction: 'Listen, colour and draw.', blocks: [
        {
          blockNumber: 1, title: 'Colour', instruction: 'Colour the objects.', interaction: interaction('scene', 'colour-object', 'paint'),
          questions: [
            { prompt: 'Colour the flower in the tree.', answerSource: 'official-answer-key', answerKey: { colour: 'red' } },
            { prompt: 'Colour the flower behind the tree.', answerSource: 'official-answer-key', answerKey: { colour: 'blue' } },
          ],
        },
        {
          blockNumber: 2, title: 'Draw', instruction: 'Draw on the picture.', interaction: interaction('scene', 'draw-object', 'draw'),
          questions: [{ prompt: "Draw a flower on the dog's head.", type: 'scene-draw', drawObject: 'flower', targetDescription: "on the dog's head", answerSource: 'official-answer-key', answerKey: {} }],
          geometryHints: { coordinateSpace: 'normalized', regions: [{ role: 'draw-region', ref: 'Câu 3', questionNumber: 3, shape: 'rect', x: .6, y: .2, width: .15, height: .15, confidence: .8 }] },
        },
      ],
    }] }],
  });
  const content = importUniversalExamBundle(current, source).content;
  const [colour, draw] = examPartUnits(content.parts[0]);
  assert.equal(colour.interactionLayout?.kind, 'starter-scene-colour-v1');
  assert.equal(colour.questions[0].options.length, 10);
  assert.deepEqual(colour.questions[0].options.map(option => option.text), ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white']);
  assert.equal(colour.questions[0].options.find(option => option.id === colour.questions[0].correctOptionIds[0])?.text, 'red');
  assert.equal(draw.interactionLayout?.kind, 'scene-draw-v1');
  assert.equal(draw.questions[0].type, 'scene-draw');
  if (colour.interactionLayout?.kind !== 'starter-scene-colour-v1' || draw.interactionLayout?.kind !== 'scene-draw-v1') assert.fail('Expected colour and draw layouts');
  for (const unit of [colour, draw]) {
    const block = content.parts[0].blocks!.find(item => item.id === unit.id)!;
    block.imageAssetId = 'scene';
    block.imageUrl = '/media/scene';
  }
  colour.interactionLayout.targets.forEach(target => { target.geometryConfirmedByTeacher = true; });
  draw.interactionLayout.targets.forEach(target => {
    target.geometryConfirmedByTeacher = true;
    target.tokenAssetId = 'flower-token';
    target.tokenUrl = '/media/flower-token.png';
  });
  content.parts[0].blocks![0].interactionLayout = colour.interactionLayout;
  content.parts[0].blocks![1].interactionLayout = draw.interactionLayout;
  assert.deepEqual(validateExamPaperContent(content), []);

  const safe = sanitizeExamContentForStudent(content);
  assert.deepEqual((safe.parts[0].blocks![0].interactionLayout as any).studentPalette, ['red', 'blue', 'green']);
  assert.equal((safe.parts[0].blocks![1].interactionLayout as any).targets[0].targetRegion, undefined);
  assert.equal((safe.parts[0].blocks![1].interactionLayout as any).targets[0].tokenUrl, '/media/flower-token.png');
  const drawQuestion = draw.questions[0];
  const drawTarget = draw.interactionLayout.targets[0];
  const rawAnswers = {
    [colour.questions[0].id]: colour.questions[0].correctOptionIds[0],
    [colour.questions[1].id]: colour.questions[1].correctOptionIds[0],
    [drawQuestion.id]: { actionId: drawTarget.id, object: 'flower', x: .65, y: .25 },
  };
  const sanitized = sanitizeExamAnswers(rawAnswers, content);
  assert.deepEqual(sanitized[drawQuestion.id], rawAnswers[drawQuestion.id]);
  const grade = gradeExamAttempt(content, sanitized);
  assert.equal(grade.totalCount, 3);
  assert.equal(grade.correctCount, 3);

  const wrong = gradeExamAttempt(content, sanitizeExamAnswers({ ...rawAnswers, [drawQuestion.id]: { actionId: drawTarget.id, object: 'flower', x: .1, y: .1 } }, content));
  assert.equal(wrong.incorrectCount, 1);
});

test('Starters Reading & Writing imports the fixed five-Part contract, preserves teacher media and grades 25 questions', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('starter', 'reading-writing')!);
  const yesNoQuestions = (prefix: string) => Array.from({ length: 5 }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `${prefix} ${index + 1}`,
    type: 'true-false',
    options: [{ label: 'YES', text: 'Yes' }, { label: 'NO', text: 'No' }],
    answerSource: 'official-answer-key',
    answerKey: { correctOptionLabels: [index % 2 ? 'NO' : 'YES'] },
  }));
  const shortQuestions = (prefix: string, maxWords = 1) => Array.from({ length: 5 }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `${prefix} ${index + 1}: ____`,
    type: 'short-answer',
    maxWords,
    answerSource: 'official-answer-key',
    answerKey: { acceptedAnswers: [`answer-${index + 1}`] },
  }));
  const parts = [
    { partNumber: 1, title: 'Part 1', instruction: 'Choose yes or no.', blocks: [{ blockNumber: 1, title: 'Part 1', instruction: 'Choose.', interaction: interaction('choice', 'single', 'yes-no'), content: { examples: [{ prompt: 'Example', answer: 'Yes' }], questions: yesNoQuestions('Object') } }] },
    { partNumber: 2, title: 'Part 2', instruction: 'Choose yes or no.', blocks: [{ blockNumber: 1, title: 'Part 2', instruction: 'Choose.', interaction: interaction('choice', 'single', 'yes-no'), content: { examples: [{ prompt: 'Example 1', answer: 'Yes' }, { prompt: 'Example 2', answer: 'No' }], questions: yesNoQuestions('Statement') } }] },
    { partNumber: 3, title: 'Part 3', instruction: 'Write the words.', blocks: [{ blockNumber: 1, title: 'Part 3', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'image-spelling'), content: { questions: shortQuestions('Picture') } }] },
    { partNumber: 4, title: 'Part 4', instruction: 'Complete the story.', blocks: [{ blockNumber: 1, title: 'Part 4', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'story-gaps'), content: { examples: [{ prompt: 'Example', answer: 'word' }], passage: 'One [[1]], two [[2]], three [[3]], four [[4]], five [[5]].', questions: shortQuestions('Gap') } }] },
    { partNumber: 5, title: 'Part 5', instruction: 'Answer the questions.', blocks: [{ blockNumber: 1, title: 'Part 5', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'scene-story'), content: { examples: [{ prompt: 'Example 1', answer: 'answer 1' }, { prompt: 'Example 2', answer: 'answer 2' }], scenes: [
      { sceneNumber: 1, passage: 'Scene one.', questions: shortQuestions('Scene one', 3).slice(0, 1) },
      { sceneNumber: 2, passage: 'Scene two.', questions: shortQuestions('Scene two', 3).slice(1, 3) },
      { sceneNumber: 3, passage: 'Scene three.', questions: shortQuestions('Scene three', 3).slice(3, 5) },
    ] } }] },
  ];
  const source = JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'starter' }, papers: [{ paperId: 'reading-writing', parts }] });
  const content = importUniversalExamBundle(current, source).content;
  content.parts.forEach((part, partIndex) => {
    const block = part.blocks![0];
    if (partIndex < 4) {
      block.imageAssetId = `student-image-${partIndex + 1}`;
      block.imageUrl = `/media/student-image-${partIndex + 1}`;
    }
    if (partIndex === 0) {
      block.examples![0].imageAssetId = 'example-image-1';
      block.examples![0].imageUrl = '/media/example-image-1';
    }
    if (partIndex === 4) block.readingScenes!.forEach((scene, sceneIndex) => {
      scene.imageAssetId = `scene-image-${sceneIndex + 1}`;
      scene.imageUrl = `/media/scene-image-${sceneIndex + 1}`;
    });
  });
  assert.deepEqual(content.parts.map(part => part.questions.length), [5, 5, 5, 5, 5]);
  assert.deepEqual(examPartUnits(content.parts[4])[0].readingScenes?.map(scene => scene.questionIds.length), [1, 2, 2]);
  assert.equal(examPartUnits(content.parts[4])[0].examples?.length, 2);
  assert.deepEqual(validateExamPaperContent(content), []);

  const oldPartFiveShape = structuredClone(content);
  const oldPartFiveBlock = oldPartFiveShape.parts[4].blocks![0];
  const oldQuestionIds = oldPartFiveShape.parts[4].questions.map(question => question.id);
  oldPartFiveBlock.examples = oldPartFiveBlock.examples?.slice(0, 1);
  oldPartFiveBlock.readingScenes = oldPartFiveBlock.readingScenes?.map((scene, index) => ({
    ...scene,
    questionIds: index === 0 ? oldQuestionIds.slice(0, 2) : index === 1 ? oldQuestionIds.slice(2, 4) : oldQuestionIds.slice(4, 5),
  }));
  const oldShapeErrors = validateExamPaperContent(oldPartFiveShape);
  assert.ok(oldShapeErrors.some(error => error.includes('cảnh 1 phải có đúng 2 example không chấm điểm')));
  assert.ok(oldShapeErrors.some(error => error.includes('cảnh 1 phải có đúng 1 câu chấm điểm')));
  assert.ok(oldShapeErrors.some(error => error.includes('cảnh 3 phải có đúng 2 câu chấm điểm')));

  const safe = sanitizeExamContentForStudent(content);
  assert.equal(safe.parts[0].blocks?.[0].examples?.[0].imageUrl, '/media/example-image-1');
  assert.deepEqual(safe.parts[4].blocks?.[0].readingScenes?.map(scene => scene.imageUrl), ['/media/scene-image-1', '/media/scene-image-2', '/media/scene-image-3']);
  assert.equal(JSON.stringify(safe).includes('acceptedAnswers'), false);
  assert.equal(JSON.stringify(safe).includes('correctOptionIds'), false);

  const answers = Object.fromEntries(content.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0] || question.acceptedAnswers[0]])));
  const grade = gradeExamAttempt(content, sanitizeExamAnswers(answers, content));
  assert.equal(grade.totalCount, 25);
  assert.equal(grade.correctCount, 25);

  const prompt = buildUniversalExamImportPrompt(content);
  const partPrompt = buildUniversalExamPartImportPrompt(content, 4);
  assert.match(prompt, /CỐ ĐỊNH 5 Part/);
  assert.match(prompt, /1 \+ 2 \+ 2/);
  assert.equal(prompt.match(/"questionNumber"/g)?.length, 25);
  assert.match(partPrompt, /CHỈ phân tích Part 5/);
  assert.match(partPrompt, /ba cảnh/);
});

test('single-Part v2 import can promote untouched released Parts into implicit blocks', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('starter', 'reading-writing')!);
  const promoted = current.parts.map(promoteExamPartToBlocks);
  assert.equal(promoted.length, current.parts.length);
  promoted.forEach((part, index) => {
    assert.equal(part.blocks?.length, 1);
    assert.deepEqual(part.blocks?.[0].questionIds, current.parts[index].questions.map(question => question.id));
    assert.ok(part.blocks?.[0].interaction.family);
  });
});
