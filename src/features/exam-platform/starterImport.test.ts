import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import { importStarterExamBundle, importStarterSinglePart, parseStarterImportJson } from './starterImport';
import { sanitizeExamAnswers, sanitizeExamContentForStudent, validateExamPaperContent } from '../../server/exam-platform/examValidation';
import { gradeExamAttempt } from '../../server/exam-platform/examGrader';
import { starterMatchingResponseKey } from './starterMatching';
import { groupStarterPart3OptionCrops } from './starterPart3Crops';
import { buildStarterListeningBundlePrompt } from './starterImportPrompt';
import type { Part4DetectedFrame } from '../listening-editor/smart-import/part4FrameDetection';

const definition = getExamPaperDefinition('starter', 'listening')!;

test('Starter whole-import prompt describes the exact four-Part three-layer contract', () => {
  const prompt = buildStarterListeningBundlePrompt({ title: '  Starter\nTest 2 ', description: '  Unit   test  ' });
  assert.match(prompt, /Tiêu đề gợi ý: Starter Test 2/);
  assert.match(prompt, /format "exam-bundle-import-v1"/);
  for (const contract of [
    'matching / image-image / draw-line',
    'text-entry / short-answer / single-input',
    'choice / single / image-options',
    'scene / colour-object / paint',
    '"slot": "part-1"',
    '"slot": "part-2"',
    '"slot": "part-3"',
    '"slot": "part-4"',
    '"sourceNodes"',
    '"correctConnections"',
    '"targets": []',
  ]) assert.ok(prompt.includes(contract), `Whole-import prompt is missing: ${contract}`);
  assert.match(prompt, /Không tạo bất kỳ ID kỹ thuật nào/);
  assert.match(prompt, /Không đưa URL, đường dẫn tệp, base64, data URI, tọa độ, crop, hitbox, anchor, mask hoặc polygon/);
  assert.match(prompt, /Chỉ trả về một JSON object hợp lệ/);
});

function starterBundle() {
  const matchingLabels = ['elephant', 'spider', 'crocodile', 'duck', 'frog'];
  const rightLabels = ['boat', 'bicycle', 'car', 'helicopter', 'train'];
  return {
    format: 'exam-bundle-import-v1',
    formatVersion: 1,
    exam: { moduleId: 'starter', title: 'Starter Test 1', description: 'Imported description', confidence: .99 },
    papers: [{
      paperId: 'listening',
      title: 'Listening',
      sections: [
        {
          slot: 'part-1', instruction: 'Listen and draw lines.',
          interaction: { family: 'matching', subtype: 'image-image', variant: 'draw-line', schemaVersion: 1 },
          payload: {
            leftItems: [...matchingLabels, 'cat', 'monkey'].map(label => ({ label, assetRole: 'scene-image' })),
            rightItems: [...rightLabels, 'lorry', 'plane'].map(label => ({ label, assetRole: 'scene-image' })),
            exampleMappings: [{ leftLabel: 'cat', rightLabel: 'lorry' }],
            mappings: matchingLabels.map((leftLabel, index) => ({ questionNumber: index + 1, leftLabel, rightLabel: rightLabels[index], source: 'official-answer-key' })),
            distractors: ['monkey', 'plane'],
          },
          validation: { extractedQuestionCount: 5, status: 'complete', warnings: [] },
        },
        {
          slot: 'part-2', instruction: 'Listen and write.',
          interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1 },
          payload: {
            questions: Array.from({ length: 5 }, (_, index) => ({
              number: index + 1, prompt: `Prompt ${index + 1}`, template: `Prompt ${index + 1} ____`,
              gaps: [{ gapNumber: 1, acceptedAnswers: [`answer ${index + 1}`], maxWords: 1, source: 'official-answer-key' }],
            })),
          },
          validation: { extractedQuestionCount: 5, status: 'complete', warnings: [] },
        },
        {
          slot: 'part-3', instruction: 'Listen and tick.',
          interaction: { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1 },
          payload: {
            questions: Array.from({ length: 5 }, (_, index) => ({
              number: index + 1, prompt: `Picture question ${index + 1}`,
              options: ['A', 'B', 'C'].map(label => ({ label, text: '', assetRole: 'options-image' })),
              answer: { type: 'option-labels', value: [index % 2 ? 'B' : 'A'], source: 'official-answer-key' },
            })),
          },
          validation: { extractedQuestionCount: 5, status: 'complete', warnings: [] },
        },
        {
          slot: 'part-4', instruction: 'Listen and colour.',
          interaction: { family: 'scene', subtype: 'colour-object', variant: 'paint', schemaVersion: 1 },
          payload: {
            coordinateSpace: 'unknown', imageSize: { width: 0, height: 0 },
            choices: ['green', 'blue', 'red', 'black'].map(label => ({ label, type: 'colour' })),
            targets: [],
            questions: Array.from({ length: 5 }, (_, index) => ({
              number: index + 1, prompt: '',
              actions: [{ type: 'colour-object', targetLabel: `flower ${index + 1}`, colour: ['green', 'blue', 'red', 'black', 'blue'][index], source: 'official-answer-key' }],
            })),
          },
          validation: { extractedQuestionCount: 5, status: 'complete', warnings: ['No target coordinates were assigned.'] },
        },
      ],
      validation: { extractedSectionCount: 4, extractedQuestionCount: 20, status: 'complete', warnings: [] },
    }],
    warnings: [],
  };
}

test('whole Starter JSON imports four independent Parts and preserves app-owned IDs', () => {
  const current = createDefaultExamContent(definition);
  const originalIds = current.parts.flatMap(part => part.questions.map(question => question.id));
  const result = importStarterExamBundle(current, JSON.stringify(starterBundle()), definition);
  assert.deepEqual(result.appliedParts, [1, 2, 3, 4]);
  assert.deepEqual(result.content.parts.map(part => part.questions.length), [5, 5, 5, 5]);
  assert.equal(result.content.title, 'Starter Test 1');
  assert.equal(result.content.description, 'Imported description');
  assert.equal(result.content.parts[0].interactionLayout?.kind, 'starter-image-matching-v2');
  assert.equal(result.content.parts[3].interactionLayout?.kind, 'starter-scene-colour-v1');
  assert.deepEqual(result.content.parts.flatMap(part => part.questions.map(question => question.id)), originalIds);
  assert.equal(result.content.parts[0].questions[0].correctOptionIds.length, 1);
  assert.deepEqual(result.content.parts[1].questions[0].acceptedAnswers, ['answer 1']);
  assert.equal(result.content.parts[2].questions[1].correctOptionIds[0], result.content.parts[2].questions[1].options[1].id);
  assert.equal(result.content.parts[3].questions[0].options.find(option => result.content.parts[3].questions[0].correctOptionIds.includes(option.id))?.text, 'green');
});

test('Starter Listening Part 2 is fixed to five short-answer questions without per-question choices', () => {
  assert.deepEqual(definition.parts[1].allowedQuestionTypes, ['short-answer']);
  const content = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(starterBundle()), definition).content;
  const part = content.parts[1];
  assert.equal(part.questions.length, 5);
  assert.ok(part.questions.every(question => question.type === 'short-answer'));
  assert.ok(part.questions.every(question => question.options.length === 0 && question.correctOptionIds.length === 0));
});

test('single-Part import changes only the selected Part', () => {
  const current = createDefaultExamContent(definition);
  const before = current.parts.map(part => JSON.stringify(part));
  const section = starterBundle().papers[0].sections[1];
  const imported = importStarterSinglePart(current, 1, JSON.stringify(section), definition);
  const next = current.parts.map((part, index) => index === 1 ? imported.part : part);
  assert.equal(JSON.stringify(next[0]), before[0]);
  assert.notEqual(JSON.stringify(next[1]), before[1]);
  assert.equal(JSON.stringify(next[2]), before[2]);
  assert.equal(JSON.stringify(next[3]), before[3]);
});

test('one invalid Part does not cancel other valid whole-exam sections', () => {
  const source = starterBundle();
  source.papers[0].sections[3].payload.questions = [];
  const result = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(source), definition);
  assert.deepEqual(result.appliedParts, [1, 2, 3]);
  assert.equal(result.reports[3].status, 'error');
  assert.equal(result.content.parts[3].questions[0].prompt, 'Đối tượng 1');
});

test('Part 1 rejects duplicate one-to-one mappings without cancelling sibling Parts', () => {
  const source = starterBundle();
  source.papers[0].sections[0].payload.mappings[1].rightLabel = source.papers[0].sections[0].payload.mappings[0].rightLabel;
  const result = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(source), definition);
  assert.deepEqual(result.appliedParts, [2, 3, 4]);
  assert.equal(result.reports[0].status, 'error');
  assert.match(result.reports[0].errors.join(' '), /ánh xạ một-một/);
});

test('Part 3 preserves app IDs but clears stale option crops when imported content changes', () => {
  const first = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(starterBundle()), definition).content;
  const originalOption = first.parts[2].questions[0].options[0];
  originalOption.imageAssetId = 'teacher-crop';
  originalOption.imageUrl = '/media/teacher-crop.png';
  const changedSource = starterBundle();
  changedSource.papers[0].sections[2].payload.questions[0].prompt = 'A different picture question';
  const second = importStarterExamBundle(first, JSON.stringify(changedSource), definition).content;
  const nextOption = second.parts[2].questions[0].options[0];
  assert.equal(nextOption.id, originalOption.id);
  assert.equal(nextOption.imageAssetId, undefined);
  assert.equal(nextOption.imageUrl, undefined);
});

test('Starter importer rejects external technical IDs and media URLs', () => {
  const source = starterBundle() as any;
  source.papers[0].sections[0].payload.leftItems[0].id = 'external-id';
  assert.throws(() => parseStarterImportJson(JSON.stringify(source)), /trường kỹ thuật "id"/);
  delete source.papers[0].sections[0].payload.leftItems[0].id;
  source.papers[0].sections[0].imageUrl = 'https://example.com/private.png';
  assert.throws(() => parseStarterImportJson(JSON.stringify(source)), /trường kỹ thuật "imageUrl"/);
});

test('geometry remains a publish blocker while student sanitization removes official answers', () => {
  const result = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(starterBundle()), definition);
  const errors = validateExamPaperContent(result.content);
  assert.equal(errors.some(error => error.includes('hitbox/điểm neo matching')), true);
  assert.equal(errors.some(error => error.includes('mask tô màu')), true);
  assert.equal(errors.some(error => error.includes('crop ảnh')), true);
  const safe = sanitizeExamContentForStudent(result.content);
  safe.parts.forEach(part => part.questions.forEach(question => {
    assert.equal(Object.prototype.hasOwnProperty.call(question, 'correctOptionIds'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(question, 'acceptedAnswers'), false);
  }));
  assert.equal(safe.parts[0].interactionLayout?.kind, 'starter-image-matching-v2');
  assert.equal('interactionSourceNodeId' in safe.parts[0].questions[0], false);
  assert.equal(safe.parts[0].questions[0].prompt, 'Đường nối 1');
});

test('publish validation enforces unique Part 1 answers and reserves the example target', () => {
  const content = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(starterBundle()), definition).content;
  content.parts.forEach(part => { part.audioAssetId = `audio-${part.part}`; });
  const part1 = content.parts[0];
  part1.imageAssetId = 'part-1-scene';
  if (part1.interactionLayout?.kind === 'starter-image-matching-v2') {
    part1.interactionLayout.sourceNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
    part1.interactionLayout.targetNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
    part1.questions[1].correctOptionIds = [...part1.questions[0].correctOptionIds];
  }
  const part3 = content.parts[2];
  part3.questions.forEach(question => question.options.forEach(option => { option.imageAssetId = `crop-${option.id}`; }));
  const part4 = content.parts[3];
  part4.imageAssetId = 'part-4-scene';
  if (part4.interactionLayout?.kind === 'starter-scene-colour-v1') part4.interactionLayout.targets.forEach(target => { target.geometryConfirmedByTeacher = true; });
  assert.equal(validateExamPaperContent(content).some(error => error.includes('ánh xạ một-một')), true);
});

test('Part 1 v2 JSON and legacy left/right JSON normalize to the same node model', () => {
  const source = starterBundle() as any;
  const legacy = source.papers[0].sections[0].payload;
  source.papers[0].sections[0].interaction.schemaVersion = 2;
  source.papers[0].sections[0].payload = {
    sourceNodes: legacy.leftItems,
    targetNodes: legacy.rightItems,
    exampleConnection: { sourceLabel: legacy.exampleMappings[0].leftLabel, targetLabel: legacy.exampleMappings[0].rightLabel },
    correctConnections: legacy.mappings.map((mapping: any) => ({
      questionNumber: mapping.questionNumber,
      sourceLabel: mapping.leftLabel,
      targetLabel: mapping.rightLabel,
      source: mapping.source,
    })),
    unusedNodes: { sourceLabels: ['monkey'], targetLabels: ['plane'] },
  };
  const content = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(source), definition).content;
  const part = content.parts[0];
  assert.equal(part.interaction?.schemaVersion, 2);
  assert.equal(part.interactionLayout?.kind, 'starter-image-matching-v2');
  assert.ok(part.questions.every(question => question.interactionSourceNodeId));
});

test('Part 1 submissions are sanitized and graded as arbitrary one-to-one connection sets', () => {
  const content = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(starterBundle()), definition).content;
  const part = content.parts[0];
  assert.equal(part.interactionLayout?.kind, 'starter-image-matching-v2');
  if (part.interactionLayout?.kind !== 'starter-image-matching-v2') return;
  const layout = part.interactionLayout;
  const responseKey = starterMatchingResponseKey(part.id);
  const expected = part.questions.map(question => ({ sourceNodeId: question.interactionSourceNodeId!, targetNodeId: question.correctOptionIds[0] }));
  const usedSources = new Set(expected.map(connection => connection.sourceNodeId));
  const unusedSource = layout.sourceNodes.find(node => !usedSources.has(node.id) && node.id !== layout.exampleConnection?.sourceNodeId)!;
  const raw = {
    [responseKey]: [
      expected[0],
      { sourceNodeId: unusedSource.id, targetNodeId: expected[1].targetNodeId },
      { sourceNodeId: expected[2].sourceNodeId, targetNodeId: expected[1].targetNodeId },
      { sourceNodeId: layout.exampleConnection!.sourceNodeId, targetNodeId: expected[3].targetNodeId },
    ],
  };
  const sanitized = sanitizeExamAnswers(raw, content);
  assert.deepEqual(sanitized[responseKey], [expected[0], { sourceNodeId: unusedSource.id, targetNodeId: expected[1].targetNodeId }]);
  const grade = gradeExamAttempt(content, sanitized);
  const part1Rows = grade.questions.filter(question => question.part === 1);
  assert.equal(part1Rows.filter(question => question.correct).length, 1);
  assert.equal(part1Rows.filter(question => !question.correct && !question.unanswered).length, 1);
  assert.equal(part1Rows.filter(question => question.unanswered).length, 3);
  assert.match(String(part1Rows.find(question => !question.correct && !question.unanswered)?.userAnswer), /→/);
});

test('released Part 1 v1 layouts and per-question answers remain gradeable', () => {
  const content = importStarterExamBundle(createDefaultExamContent(definition), JSON.stringify(starterBundle()), definition).content;
  const part = content.parts[0];
  assert.equal(part.interactionLayout?.kind, 'starter-image-matching-v2');
  if (part.interactionLayout?.kind !== 'starter-image-matching-v2') return;
  const layout = part.interactionLayout;
  const questionIdBySource = new Map(part.questions.map(question => [question.interactionSourceNodeId, question.id]));
  part.interactionLayout = {
    kind: 'starter-image-matching-v1',
    leftItems: layout.sourceNodes.map(node => ({
      id: node.id,
      label: node.label,
      region: node.hitRegion,
      geometryConfirmedByTeacher: node.geometryConfirmedByTeacher,
      questionId: questionIdBySource.get(node.id),
    })),
    rightItems: layout.targetNodes.map(node => ({
      id: node.id,
      label: node.label,
      region: node.hitRegion,
      geometryConfirmedByTeacher: node.geometryConfirmedByTeacher,
    })),
    exampleMapping: layout.exampleConnection ? {
      leftItemId: layout.exampleConnection.sourceNodeId,
      rightItemId: layout.exampleConnection.targetNodeId,
    } : undefined,
  };
  part.questions.forEach(question => { delete question.interactionSourceNodeId; });
  const rawAnswers = Object.fromEntries(part.questions.map(question => [question.id, question.correctOptionIds[0]]));
  const sanitized = sanitizeExamAnswers(rawAnswers, content);
  assert.deepEqual(sanitized[starterMatchingResponseKey(part.id)], []);
  const grade = gradeExamAttempt(content, sanitized);
  assert.equal(grade.questions.filter(question => question.part === 1 && question.correct).length, 5);
});

test('Starter Part 3 reuses framed-grid grouping for 15 pictures and skips a printed example in an 18-picture page', () => {
  const frames: Part4DetectedFrame[] = [];
  const addGroup = (group: number) => {
    const column = group % 2;
    const row = Math.floor(group / 2);
    for (let option = 0; option < 3; option += 1) frames.push({
      crop: { x: .04 + column * .5 + option * .09, y: .05 + row * .28, width: .07, height: .12 },
      score: .98,
    });
  };
  for (let group = 0; group < 6; group += 1) addGroup(group);
  const grouped = groupStarterPart3OptionCrops(frames.reverse());
  assert.equal(grouped.detectedPrintedExample, true);
  assert.equal(grouped.questionGroups.length, 5);
  assert.equal(grouped.questionGroups.flat().length, 15);
  assert.ok(grouped.questionGroups[0][0].x > .5);
});
