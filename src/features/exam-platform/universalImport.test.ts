import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import { examPartUnits, promoteExamPartToBlocks } from './examStructure';
import { starterMatchingResponseKey } from './starterMatching';
import { importUniversalExamBundle, importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';
import { groupKetListeningPart1OptionCrops } from './ketListeningCrops';
import type { ExamAnswers } from './types';
import { gradeExamAttempt } from '../../server/exam-platform/examGrader';
import { sanitizeExamAnswers, sanitizeExamContentForStudent, validateExamPaperContent } from '../../server/exam-platform/examValidation';

const interaction = (family: string, subtype: string, variant: string) => ({ family, subtype, variant, schemaVersion: 1 });

test('KET Listening prompt, flexible JSON and private Part 1 crop source follow the five-Part contract', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('ket', 'listening')!);
  current.parts.forEach(part => { part.audioAssetId = `audio-${part.part}`; });
  current.parts[0].imageAssetId = 'ket-p1-private-source';
  current.parts[0].imageUrl = '/media/ket-p1-private-source.png';
  current.parts[0].questions[2].imageAssetId = 'ket-p1-q3-shared';
  current.parts[0].questions[2].imageUrl = '/media/ket-p1-q3-shared.png';
  current.parts[0].questions.forEach((question, questionIndex) => question.options.forEach((option, optionIndex) => {
    option.imageAssetId = `ket-p1-q${questionIndex + 1}-${optionIndex + 1}`;
    option.imageUrl = `/media/ket-p1-q${questionIndex + 1}-${optionIndex + 1}.png`;
  }));
  current.parts[1].imageAssetId = 'ket-p2-left';
  current.parts[1].readingScenes![0].imageAssetId = 'ket-p2-middle';

  const threeChoices = (count: number) => Array.from({ length: count }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `Question ${index + 1}`,
    options: ['A', 'B', 'C'].map(label => ({ label, text: `Option ${label}` })),
    answerSource: 'official-answer-key',
    answerKey: { correctOptionLabels: ['B'] },
  }));
  const shortRows = (count: number, letters = false) => Array.from({ length: count }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `Field ${index + 1}`,
    type: 'short-answer',
    maxWords: letters ? 1 : 5,
    answerSource: 'official-answer-key',
    answerKey: { acceptedAnswers: [letters ? String.fromCharCode(65 + index % 8) : `answer ${index + 1}`] },
  }));
  const parts = [
    { partNumber: 1, title: 'Pictures', instruction: 'Listen and choose.', blocks: [{ blockNumber: 1, title: 'Pictures', interaction: interaction('choice', 'single', 'image-options'), content: { examples: [{ prompt: 'Example', answer: 'A' }], questions: threeChoices(4) } }] },
    { partNumber: 2, title: 'Letters', instruction: 'Write a letter.', blocks: [{ blockNumber: 1, title: 'Letters', interaction: interaction('text-entry', 'letter-matching', 'two-image-letter-input'), content: { examples: [{ prompt: 'Example person', answer: 'H' }], questions: shortRows(6, true) } }] },
    { partNumber: 3, title: 'Dialogues', instruction: 'Choose the reply.', blocks: [{ blockNumber: 1, title: 'Dialogues', interaction: interaction('choice', 'dialogue', 'dialogue-choice'), content: { passage: 'Listen to each conversation and choose the best answer.', examples: [{ prompt: 'How are you?', answer: 'C' }], questions: threeChoices(3) } }] },
    { partNumber: 4, title: 'Notes', instruction: 'Complete the notes.', blocks: [{ blockNumber: 1, title: 'Notes', interaction: interaction('text-entry', 'form-completion', 'image-form-fields'), content: { passage: 'Part 4 instructions and printed example.', questions: shortRows(4) } }] },
    { partNumber: 5, title: 'Notes', instruction: 'Complete the notes.', blocks: [{ blockNumber: 1, title: 'Notes', interaction: interaction('text-entry', 'form-completion', 'image-form-fields'), content: { passage: 'Part 5 instructions and printed example.', questions: shortRows(7).map((question, index) => index === 0 ? { ...question, questionNumber: 21, prompt: 'New address', answerPrefix: '98', answerSuffix: 'Road', answerKey: { acceptedAnswers: ['Warnock'] } } : question) } }] },
  ];
  const source = JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'ket', title: 'KET Listening' }, papers: [{ paperId: 'listening', parts }] });
  const imported = importUniversalExamBundle(current, source).content;
  assert.equal(imported.templateVersion, 'ket-listening-5-v1');
  assert.deepEqual(imported.parts.map(part => part.questions.length), [4, 6, 3, 4, 7]);
  assert.equal(imported.parts[0].questions[2].imageAssetId, 'ket-p1-q3-shared');
  assert.equal(imported.parts[0].questions[2].options[1].imageAssetId, undefined);
  assert.equal(imported.parts[1].imageAssetId, 'ket-p2-left');
  assert.equal(imported.parts[1].readingScenes?.[0].imageAssetId, 'ket-p2-middle');
  assert.equal(imported.parts[4].questions[0].answerPrefix, '98');
  assert.equal(imported.parts[4].questions[0].answerSuffix, 'Road');
  assert.deepEqual(imported.parts[4].questions[0].acceptedAnswers, ['Warnock']);
  assert.deepEqual(validateExamPaperContent(imported), []);
  const safe = sanitizeExamContentForStudent(imported);
  assert.equal(safe.parts[0].imageAssetId, undefined);
  assert.equal(safe.parts[0].imageUrl, undefined);
  assert.equal(safe.parts[0].questions[2].imageAssetId, 'ket-p1-q3-shared');
  assert.equal(safe.parts[0].questions[2].options[1].imageAssetId, undefined);

  const prompt = buildUniversalExamImportPrompt(current);
  assert.match(prompt, /KET\) Listening/);
  assert.match(prompt, /1, 2, 4, 5/);
  assert.match(prompt, /Câu in số 3/);
  assert.match(prompt, /answerSuffix/);
  assert.match(prompt, /98 ___ Road/);
  assert.match(prompt, /số câu KHÔNG bị khóa/);
  assert.match(prompt, /Part 2: dùng đúng một ảnh đặt bên trái/);
  assert.match(prompt, /Part 4 listening - Question 16–20\./);
  assert.match(prompt, /content\.passage CHỈ chứa nội dung biểu mẫu/);
});

test('KET Listening Part 1 crop grouping ignores the single combined frame for printed question 3', () => {
  const row = (y: number) => [0.08, 0.38, 0.68].map((x, index) => ({ crop: { x, y, width: .2, height: .08 }, score: .99 - index * .01 }));
  const detected = [
    ...row(.04), // printed example
    ...row(.20), // question 1
    ...row(.36), // question 2
    { crop: { x: .18, y: .52, width: .64, height: .08 }, score: .995 }, // combined question 3
    ...row(.68), // question 4
    ...row(.84), // question 5
  ];
  const grouped = groupKetListeningPart1OptionCrops(detected);
  assert.equal(grouped.detectedPrintedExample, true);
  assert.equal(grouped.questionGroups.length, 4);
  assert.deepEqual(grouped.questionGroups.map(group => group.map(crop => crop.y)), [
    [.2, .2, .2],
    [.36, .36, .36],
    [.68, .68, .68],
    [.84, .84, .84],
  ]);
});

test('KET text-only Parts preserve imported source text and the Part 2 example', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('ket', 'reading-writing')!);
  const part2 = importUniversalExamPart(current, 1, JSON.stringify({
    partNumber: 2,
    title: 'Choose A, B or C',
    instruction: 'Choose the correct answer.',
    blocks: [{
      blockNumber: 1,
      title: 'Text questions',
      interaction: interaction('choice', 'cloze', 'multiple-choice-cloze'),
      content: {
        examples: [{ prompt: 'Nina ____ early.', answer: 'B' }],
        questions: [{ questionNumber: 6, prompt: 'Nina felt ____.', options: [{ label: 'A', text: 'sad' }, { label: 'B', text: 'happy' }, { label: 'C', text: 'tired' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['B'] } }],
      },
    }],
  })).part;
  assert.deepEqual(part2.examples, [{ prompt: 'Nina ____ early.', answer: 'B' }]);
  assert.equal(part2.imageAssetId, undefined);

  const part6 = importUniversalExamPart(current, 5, JSON.stringify({
    partNumber: 6,
    title: 'Complete the spelling',
    instruction: 'Write the remaining letters.',
    blocks: [{
      blockNumber: 1,
      title: 'Spelling',
      interaction: interaction('text-entry', 'spelling', 'initial-letter-spelling'),
      content: {
        passage: 'Read the descriptions. Example: camera.',
        questions: [{ questionNumber: 36, prompt: 'You need this to travel abroad.', answerPrefix: 'p', answerLength: 8, type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['assport'] } }],
      },
    }],
  })).part;
  assert.equal(part6.passage, 'Read the descriptions. Example: camera.');
  assert.deepEqual(part6.questions[0].acceptedAnswers, ['assport']);
  assert.equal(part6.imageAssetId, undefined);

  const part5 = importUniversalExamPart(current, 4, JSON.stringify({
    partNumber: 5,
    title: 'Choose A, B or C',
    instruction: 'Choose the correct answer.',
    blocks: [{
      blockNumber: 1,
      title: 'Image, example and answer rows',
      interaction: interaction('choice', 'cloze', 'multiple-choice-cloze'),
      content: {
        examples: [{ prompt: 'There are ___ sizes of Schnauzer dogs.', answer: 'C' }],
        questions: [{ questionNumber: 28, prompt: 'Gap 28', options: [{ label: 'A', text: 'came' }, { label: 'B', text: 'come' }, { label: 'C', text: 'comes' }], answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['A'] } }],
      },
    }],
  })).part;
  assert.deepEqual(part5.examples, [{ prompt: 'There are ___ sizes of Schnauzer dogs.', answer: 'C' }]);

  current.parts[7].imageAssetId = 'ket-part8-teacher-image';
  current.parts[7].imageUrl = '/media/ket-part8-teacher-image.png';
  const part8 = importUniversalExamPart(current, 7, JSON.stringify({
    partNumber: 8,
    title: 'Complete the notes',
    instruction: 'Complete each field.',
    blocks: [{
      blockNumber: 1,
      title: 'Form fields',
      interaction: interaction('text-entry', 'form-completion', 'image-form-fields'),
      content: { passage: 'Printed source and example.', questions: [{ questionNumber: 51, prompt: 'Date', type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['Tuesday'] } }] },
    }],
  })).part;
  assert.equal(part8.imageAssetId, 'ket-part8-teacher-image');
  assert.equal(part8.imageUrl, '/media/ket-part8-teacher-image.png');

  const prompt = buildUniversalExamImportPrompt(current);
  assert.match(prompt, /Part 1: đúng một ảnh đặt bên trái/);
  assert.match(prompt, /Part 5: ảnh hiển thị phía trên; trả đúng một example/);
  assert.match(prompt, /Part 8: giáo viên tải\/dán một ảnh riêng/);
});

test('Universal JSON v2 owns a flexible six-Part structure and supports several blocks outside fixed Cambridge young-learner papers', () => {
  const definition = getExamPaperDefinition('pet', 'reading')!;
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
  const source = JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'pet' }, papers: [{ paperId: 'reading', title: 'Flexible paper', parts }] });
  const result = importUniversalExamBundle(current, source);
  assert.equal(result.content.schemaVersion, 3);
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
  const current = createDefaultExamContent(getExamPaperDefinition('pet', 'reading')!);
  const source = JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'pet' }, papers: [{ paperId: 'reading', parts: [{
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

test('the Flyers Listening prompt locks five reviewed Movers-style Parts and teacher-owned geometry', () => {
  const content = createDefaultExamContent(getExamPaperDefinition('flyer', 'listening')!);
  const prompt = buildUniversalExamImportPrompt(content);
  assert.match(prompt, /exam-bundle-import-v2/);
  assert.match(prompt, /Trả đúng 5 Part/);
  assert.match(prompt, /Part 1 dùng đúng giao diện Movers Listening Part 1/);
  assert.match(prompt, /Part 2 dùng đúng giao diện Movers Listening Part 2/);
  assert.match(prompt, /đúng năm target-node đánh số Vùng 1\.\.5/);
  assert.match(prompt, /width 0\.12, height 0\.055/);
  assert.match(prompt, /hai ảnh giáo viên tải riêng/);
  assert.match(prompt, /Part 5 giống Movers Listening Part 5/);
  assert.match(prompt, /geometryHints/);
  assert.doesNotMatch(prompt, /không áp đặt số Part/);
});

test('Flyers Listening whole JSON normalizes the fixed five-Part player contract and private answers', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('flyer', 'listening')!);
  const names = ['Alex', 'Ben', 'Katy', 'Mary', 'Robert', 'Sally'];
  const namePart = (partNumber: number) => ({
    partNumber, title: `Part ${partNumber}`, instruction: 'Listen and put the names.', blocks: [{
      blockNumber: 1, title: 'Names', interaction: interaction('matching', 'name-scene', 'drag-name-to-region'),
      content: { examples: [{ prompt: 'Example', answer: 'Sally' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Person ${index + 1}`, options: names.map((name, optionIndex) => ({ label: String.fromCharCode(65 + optionIndex), text: name })), answerSource: 'official-answer-key', answerKey: { correctOptionLabels: [String.fromCharCode(65 + index)] } })) },
      geometryHints: { coordinateSpace: 'normalized', regions: Array.from({ length: 5 }, (_, index) => ({ role: 'target-node', ref: `Person ${index + 1}`, questionNumber: index + 1, shape: 'rect', x: .1, y: .1 + index * .15, width: .2, height: .08 })) },
    }],
  });
  const imageQuestions = Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Picture question ${index + 1}`, options: ['A', 'B', 'C'].map(label => ({ label, text: `picture ${label}` })), answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['B'] } }));
  const textQuestions = Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Detail ${index + 1}: ____`, type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [`answer ${index + 1}`] } }));
  const colourQuestions = Array.from({ length: 4 }, (_, index) => ({ questionNumber: index + 1, prompt: `Colour object ${index + 1}`, answerSource: 'official-answer-key', answerKey: { colour: ['red', 'blue', 'green', 'yellow'][index] } }));
  const payload = JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer', title: 'Flyers test' }, papers: [{ paperId: 'listening', parts: [
    namePart(1),
    { partNumber: 2, title: 'Listen and write', instruction: 'Write a word or number.', blocks: [{ blockNumber: 1, title: 'Listen and write', interaction: interaction('text-entry', 'short-answer', 'single-input'), content: { passage: 'Example: name — Ann', questions: textQuestions } }] },
    { partNumber: 3, title: 'Letters', instruction: 'Write a letter.', blocks: [{ blockNumber: 1, title: 'Letters', interaction: interaction('text-entry', 'letter-matching', 'two-image-letter-input'), content: { examples: [{ prompt: 'Bill', answer: 'D' }], questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: `Person ${index + 1}`, type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: [String.fromCharCode(65 + index)] } })) } }] },
    { partNumber: 4, title: 'Pictures', instruction: 'Tick the box.', blocks: [{ blockNumber: 1, title: 'Pictures', interaction: interaction('choice', 'single', 'image-options'), content: { questions: imageQuestions } }] },
    { partNumber: 5, title: 'Colour and draw', instruction: 'Colour and draw.', blocks: [{ blockNumber: 1, title: 'Colour', interaction: interaction('scene', 'colour-object', 'paint'), content: { questions: colourQuestions } }, { blockNumber: 2, title: 'Draw', interaction: interaction('scene', 'draw-object', 'draw'), content: { questions: [{ questionNumber: 5, prompt: 'Draw a star on the bag.', type: 'scene-draw', drawObject: 'star', targetDescription: 'on the bag', answerSource: 'official-answer-key', answerKey: {} }] } }] },
  ] }] });
  const imported = importUniversalExamBundle(current, payload).content;
  assert.equal(imported.structureMode, 'definition');
  assert.deepEqual(imported.parts.map(part => part.questions.length), [5, 5, 5, 5, 5]);
  assert.equal(examPartUnits(imported.parts[0])[0].interactionLayout?.kind, 'flyer-name-placement-v1');
  const part1Layout = examPartUnits(imported.parts[0])[0].interactionLayout;
  assert.ok(part1Layout?.kind === 'flyer-name-placement-v1');
  assert.deepEqual(part1Layout.targets.map(target => [target.region.shape, target.region.width, target.region.height, target.geometryConfirmedByTeacher]), Array.from({ length: 5 }, () => ['rect', .12, .055, true]));
  assert.equal(imported.parts[0].questions[0].options.length, 6);
  assert.equal(imported.parts[0].questions[4].correctOptionIds[0], imported.parts[0].questions[4].options[4].id);
  assert.equal(examPartUnits(imported.parts[1])[0].interaction?.variant, 'single-input');
  assert.equal(imported.parts[1].questions[0].type, 'short-answer');
  assert.equal(imported.parts[1].questions[0].options.length, 0);
  assert.equal(imported.parts[1].questions[0].acceptedAnswers[0], 'answer 1');
  assert.equal(imported.parts[2].examples?.length, 1);
  assert.deepEqual(imported.parts[2].questions.map(question => question.acceptedAnswers[0]), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(imported.parts[4].questions.map(question => question.id), current.parts[4].questions.map(question => question.id));
  assert.equal(examPartUnits(imported.parts[4])[1].interactionLayout?.kind, 'scene-draw-v1');
  const safe = sanitizeExamContentForStudent(imported);
  assert.equal(JSON.stringify(safe).includes('correctOptionIds'), false);
  assert.equal(JSON.stringify(safe).includes('acceptedAnswers'), false);
  const answers: ExamAnswers = Object.fromEntries(imported.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0] || question.acceptedAnswers[0]])));
  const drawUnit = examPartUnits(imported.parts[4]).find(unit => unit.interactionLayout?.kind === 'scene-draw-v1')!;
  const drawTarget = drawUnit.interactionLayout?.kind === 'scene-draw-v1' ? drawUnit.interactionLayout.targets[0] : undefined;
  if (drawTarget) answers[drawTarget.questionId] = { actionId: drawTarget.id, object: drawTarget.object, x: drawTarget.targetRegion.x + drawTarget.targetRegion.width / 2, y: drawTarget.targetRegion.y + drawTarget.targetRegion.height / 2 };
  assert.equal(gradeExamAttempt(imported, sanitizeExamAnswers(answers, imported)).correctCount, 25);
});

test('Flyers Reading & Writing keeps seven Part while preserving the scored count printed in each source', () => {
  const current = createDefaultExamContent(getExamPaperDefinition('flyer', 'reading-writing')!);
  const prompt = buildUniversalExamImportPrompt(current);
  assert.match(prompt, /số câu KHÔNG được cố định/);
  assert.match(prompt, /10–7–5–6–7–10–5/);
  assert.match(prompt, /Example không tính là câu chấm điểm/);
  assert.match(prompt, /Part 7.*ảnh hiển thị có thể có hoặc không/i);
  assert.match(prompt, /Part 5: không trả content\.passage/);
  assert.match(prompt, /Part 6: không trả content\.passage hay marker/);

  const shortQuestions = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `${prefix} ${index + 1}: ____`,
    type: 'short-answer',
    answerSource: 'official-answer-key',
    answerKey: { acceptedAnswers: [`answer-${index + 1}`] },
  }));
  const definitionPart = (partNumber: number, count: number) => ({
    partNumber,
    title: `Part ${partNumber}`,
    instruction: 'Write the answer.',
    blocks: [{
      blockNumber: 1,
      title: 'Definitions',
      interaction: interaction('text-entry', 'short-answer', 'inline-definitions'),
      content: { examples: [{ prompt: 'Printed example', answer: 'example' }], questions: shortQuestions(count, 'Definition') },
    }],
  });
  const yesNoQuestions = (count: number) => Array.from({ length: count }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `Statement ${index + 1}`,
    type: 'true-false',
    options: [{ label: 'YES', text: 'Yes' }, { label: 'NO', text: 'No' }],
    answerSource: 'official-answer-key',
    answerKey: { correctOptionLabels: [index % 2 ? 'NO' : 'YES'] },
  }));
  const letters = Array.from({ length: 5 }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `Row ${index + 1}`,
    type: 'short-answer',
    answerSource: 'official-answer-key',
    answerKey: { acceptedAnswers: [String.fromCharCode(65 + index)] },
  }));
  const choices = (count: number) => Array.from({ length: count }, (_, index) => ({
    questionNumber: index + 1,
    prompt: `Choice ${index + 1}`,
    type: 'single-choice',
    options: ['A', 'B', 'C'].map(label => ({ label, text: `Option ${label}` })),
    answerSource: 'official-answer-key',
    answerKey: { correctOptionLabels: ['B'] },
  }));
  const part4Questions = [
    ...shortQuestions(5, 'Gap'),
    { ...choices(1)[0], questionNumber: 6, prompt: 'Choose the best title.' },
  ];
  const yesNoPart = (count: number) => ({ partNumber: 2, title: 'Part 2', instruction: 'Write yes or no.', blocks: [{ blockNumber: 1, title: 'Yes or no', interaction: interaction('choice', 'single', 'yes-no'), content: { examples: [{ prompt: 'Example yes', answer: 'Yes' }, { prompt: 'Example no', answer: 'No' }], questions: yesNoQuestions(count) } }] });
  const parts = [
    definitionPart(1, 10),
    yesNoPart(7),
    { partNumber: 3, title: 'Part 3', instruction: 'Write a letter.', blocks: [{ blockNumber: 1, title: 'Letters', interaction: interaction('text-entry', 'letter-matching', 'two-image-letter-input'), content: { examples: [{ prompt: 'Printed example', answer: 'H' }], questions: letters } }] },
    { partNumber: 4, title: 'Part 4', instruction: 'Complete the text.', blocks: [{ blockNumber: 1, title: 'Story', interaction: interaction('text-entry', 'short-answer-and-title', 'story-gaps-title'), content: { examples: [{ prompt: 'Printed example', answer: 'example' }], passage: Array.from({ length: 5 }, (_, index) => `Text [[${index + 1}]].`).join(' '), questions: part4Questions } }] },
    { partNumber: 5, title: 'Part 5', instruction: 'Complete the sentences.', blocks: [{ blockNumber: 1, title: 'Story completion', interaction: interaction('text-entry', 'story-sentence-completion', 'story-sentence-completion'), content: { examples: [{ prompt: 'Example one', answer: 'one' }, { prompt: 'Example two', answer: 'two' }], questions: shortQuestions(7, 'Sentence').map(question => ({ ...question, maxWords: 4 })) } }] },
    { partNumber: 6, title: 'Part 6', instruction: 'Choose A, B or C.', blocks: [{ blockNumber: 1, title: 'Multiple-choice cloze', interaction: interaction('choice', 'cloze', 'multiple-choice-cloze'), content: { examples: [{ prompt: 'Printed example', answer: 'took' }], questions: choices(10) } }] },
    { partNumber: 7, title: 'Part 7', instruction: 'Write one word.', blocks: [{ blockNumber: 1, title: 'Open cloze', interaction: interaction('text-entry', 'open-cloze', 'open-cloze'), content: { examples: [{ prompt: 'Printed example', answer: 'his' }], passage: Array.from({ length: 5 }, (_, index) => `Text [[${index + 1}]].`).join(' '), questions: shortQuestions(5, 'Gap').map(question => ({ ...question, maxWords: 1 })) } }] },
  ];
  const imported = importUniversalExamBundle(current, JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer' }, papers: [{ paperId: 'reading-writing', parts }],
  })).content;
  assert.equal(imported.structureMode, 'definition');
  assert.deepEqual(imported.parts.map(part => part.questions.length), [10, 7, 5, 6, 7, 10, 5]);
  assert.deepEqual(imported.parts.map(part => part.interaction?.variant), ['inline-definitions', 'yes-no', 'two-image-letter-input', 'story-gaps-title', 'story-sentence-completion', 'multiple-choice-cloze', 'open-cloze']);
  assert.equal(imported.parts[1].examples?.length, 2);
  assert.equal(imported.parts[2].examples?.length, 1);
  assert.deepEqual(imported.parts[2].questions.map(question => question.acceptedAnswers[0]), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(imported.parts[3].questions[5].type, 'single-choice');
  assert.equal(imported.parts[4].examples?.length, 2);
  assert.equal(imported.parts[5].questions[0].options.length, 3);
  assert.equal(imported.parts[4].passage, undefined);
  assert.equal(imported.parts[5].passage, undefined);
  assert.equal(imported.parts[6].imageAssetId, undefined);

  const unchangedFirstPart = JSON.stringify(imported.parts[0]);
  const partPrompt = buildUniversalExamPartImportPrompt(imported, 1);
  assert.match(partPrompt, /CHỈ trả Part 2/);
  const replacement = importUniversalExamPart(imported, 1, JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'flyer' }, papers: [{ paperId: 'reading-writing', parts: [yesNoPart(3)] }],
  }));
  assert.equal(replacement.part.questions.length, 3);
  assert.equal(JSON.stringify(imported.parts[0]), unchangedFirstPart);
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
  const current = createDefaultExamContent(getExamPaperDefinition('pet', 'reading')!);
  const source = JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'pet' }, papers: [{ paperId: 'reading', parts: [{
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
    { partNumber: 1, title: 'Part 1', instruction: 'Choose yes or no.', blocks: [{ blockNumber: 1, title: 'Part 1', instruction: 'Choose.', interaction: interaction('choice', 'single', 'yes-no'), content: { examples: [{ prompt: 'Example 1', answer: 'Yes' }, { prompt: 'Example 2', answer: 'No' }], questions: yesNoQuestions('Object') } }] },
    { partNumber: 2, title: 'Part 2', instruction: 'Choose yes or no.', blocks: [{ blockNumber: 1, title: 'Part 2', instruction: 'Choose.', interaction: interaction('choice', 'single', 'yes-no'), content: { examples: [{ prompt: 'Example 1', answer: 'Yes' }, { prompt: 'Example 2', answer: 'No' }], questions: yesNoQuestions('Statement') } }] },
    { partNumber: 3, title: 'Part 3', instruction: 'Write the words.', blocks: [{ blockNumber: 1, title: 'Part 3', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'image-spelling'), content: { examples: [{ prompt: 'Example', answer: 'ear' }], questions: shortQuestions('Picture').map(question => ({ ...question, answerLength: question.answerKey.acceptedAnswers[0].replace(/\s+/g, '').length })) } }] },
    { partNumber: 4, title: 'Part 4', instruction: 'Complete the story.', blocks: [{ blockNumber: 1, title: 'Part 4', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'story-gaps'), content: { examples: [{ prompt: 'Example', answer: 'word' }], passage: 'One [[1]], two [[2]], three [[3]], four [[4]], five [[5]].', questions: shortQuestions('Gap') } }] },
    { partNumber: 5, title: 'Part 5', instruction: 'Answer the questions.', blocks: [{ blockNumber: 1, title: 'Part 5', instruction: 'Write.', interaction: interaction('text-entry', 'short-answer', 'scene-story'), content: { examples: [{ prompt: 'Example 1', answer: 'answer 1' }, { prompt: 'Example 2', answer: 'answer 2' }], scenes: [
      { sceneNumber: 1, passage: 'Scene one.', questions: shortQuestions('Scene one', 3).slice(0, 1) },
      { sceneNumber: 2, passage: 'Scene two.', questions: shortQuestions('Scene two', 3).slice(1, 3) },
      { sceneNumber: 3, passage: 'Scene three.', questions: shortQuestions('Scene three', 3).slice(3, 5) },
    ] } }] },
  ];
  const source = JSON.stringify({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'starter' }, papers: [{ paperId: 'reading-writing', parts }] });
  const content = importUniversalExamBundle(current, source).content;
  assert.equal(content.structureMode, 'definition');
  content.parts.forEach((part, partIndex) => {
    const block = part.blocks![0];
    if (partIndex < 4) {
      block.imageAssetId = `student-image-${partIndex + 1}`;
      block.imageUrl = `/media/student-image-${partIndex + 1}`;
    }
    if (partIndex === 0) {
      block.examples!.forEach((example, index) => {
        example.imageAssetId = `example-image-${index + 1}`;
        example.imageUrl = `/media/example-image-${index + 1}`;
      });
      content.parts[partIndex].questions.forEach((question, index) => {
        question.imageAssetId = `question-image-${index + 1}`;
        question.imageUrl = `/media/question-image-${index + 1}`;
      });
    }
    if (partIndex === 2) {
      const example = block.examples![0];
      example.imageAssetId = 'part-3-example-left';
      example.imageUrl = '/media/part-3-example-left';
      example.secondaryImageAssetId = 'part-3-example-right';
      example.secondaryImageUrl = '/media/part-3-example-right';
      content.parts[partIndex].questions.forEach((question, index) => {
        question.imageAssetId = `part-3-question-${index + 1}-left`;
        question.imageUrl = `/media/part-3-question-${index + 1}-left`;
        question.secondaryImageAssetId = `part-3-question-${index + 1}-right`;
        question.secondaryImageUrl = `/media/part-3-question-${index + 1}-right`;
      });
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

  const reimportedPartThree = importUniversalExamPart(content, 2, JSON.stringify(parts[2])).part;
  const reimportedPartThreeUnit = examPartUnits(reimportedPartThree)[0];
  assert.equal(reimportedPartThreeUnit.examples?.[0].imageUrl, '/media/part-3-example-left');
  assert.equal(reimportedPartThreeUnit.examples?.[0].secondaryImageUrl, '/media/part-3-example-right');
  assert.equal(reimportedPartThree.questions[0].imageUrl, '/media/part-3-question-1-left');
  assert.equal(reimportedPartThree.questions[0].secondaryImageUrl, '/media/part-3-question-1-right');

  const wrongDashCount = structuredClone(content);
  wrongDashCount.parts[2].questions[0].answerLength = 1;
  assert.ok(validateExamPaperContent(wrongDashCount).some(error => error.includes('số chữ cái phải khớp')));

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
  assert.equal(safe.parts[0].blocks?.[0].imageUrl, undefined);
  assert.deepEqual(safe.parts[0].blocks?.[0].examples?.map(example => example.imageUrl), ['/media/example-image-1', '/media/example-image-2']);
  assert.equal(safe.parts[2].blocks?.[0].imageUrl, undefined);
  assert.equal(safe.parts[2].blocks?.[0].examples?.[0].secondaryImageUrl, '/media/part-3-example-right');
  assert.equal(safe.parts[2].questions[0].secondaryImageUrl, '/media/part-3-question-1-right');
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
  assert.match(prompt, /crop 7 hình/);
  assert.match(prompt, /crop 12 hình/);
  assert.match(prompt, /answerLength/);
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
