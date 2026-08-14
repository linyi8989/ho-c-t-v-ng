import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListeningAnswers, ListeningRegion, ListeningSetContent } from '../../features/listening/types';
import { gradeListeningAttempt, normalizeListeningTextAnswer } from './listeningGrader';
import { buildListeningActivityAnswerDetails, buildListeningVisualReviewSnapshot } from './listeningActivity';
import { sanitizeListeningAnswers, sanitizeListeningContentForStudent, validateListeningSetContent } from './listeningValidation';
import { MOVER_COLOUR_CATALOG } from '../../features/listening-library/modules/mover/editor/colourCatalog';
import { isValidListeningRegion, pointInListeningRegion, transformListeningPoint } from '../../features/listening/geometry';

const region = (index: number): ListeningRegion => ({
  shape: 'rect',
  x: (index % 3) * 0.3,
  y: Math.floor(index / 3) * 0.4,
  width: 0.2,
  height: 0.2,
});

function validContent(): ListeningSetContent {
  const choices = Array.from({ length: 6 }, (_, index) => ({ id: `choice-${index}`, label: `Name ${index}` }));
  const locations = Array.from({ length: 6 }, (_, index) => ({
    id: `location-${index}`,
    label: String.fromCharCode(65 + index),
    imageAssetId: `image-location-${index}`,
  }));
  const colours = Array.from({ length: 6 }, (_, index) => ({
    id: `colour-${index}`,
    label: `Colour ${index}`,
    value: ['#ef4444', '#7c3aed', '#f97316', '#2563eb', '#16a34a', '#eab308'][index],
  }));
  return {
    schemaVersion: 1,
    title: 'Listening test',
    description: 'A complete five-part listening test.',
    level: 'Movers',
    parts: [
      {
        part: 1,
        title: 'Part 1',
        instruction: 'Listen and drag.',
        audioAssetId: 'audio-1',
        sceneAssetId: 'scene-1',
        choices,
        targets: choices.slice(0, 5).map((choice, index) => ({
          id: `p1-${index}`,
          choiceId: choice.id,
          region: region(index),
        })),
      },
      {
        part: 2,
        title: 'Part 2',
        instruction: 'Listen and write.',
        audioAssetId: 'audio-2',
        heading: 'Dance class',
        questions: Array.from({ length: 5 }, (_, index) => ({
          id: `p2-${index}`,
          prompt: `Question {{blank-${index}}}`,
          blanks: [{ id: `blank-${index}`, acceptedAnswers: index === 0 ? ["Jane's class", 'Jane’s class'] : [`answer ${index}`] }],
        })),
      },
      {
        part: 3,
        title: 'Part 3',
        instruction: 'Listen and choose a letter.',
        audioAssetId: 'audio-3',
        reuseMode: 'once',
        options: locations,
        items: Array.from({ length: 5 }, (_, index) => ({
          id: `p3-${index}`,
          label: `Item ${index}`,
          imageAssetId: `image-item-${index}`,
          correctOptionId: locations[index].id,
        })),
      },
      {
        part: 4,
        title: 'Part 4',
        instruction: 'Listen and tick.',
        audioAssetId: 'audio-4',
        questions: Array.from({ length: 5 }, (_, questionIndex) => {
          const options = Array.from({ length: 3 }, (_, optionIndex) => ({
            id: `p4-${questionIndex}-${optionIndex}`,
            imageAssetId: `image-p4-${questionIndex}-${optionIndex}`,
            alt: `Option ${optionIndex}`,
          }));
          return {
            id: `p4-${questionIndex}`,
            prompt: `Question ${questionIndex}`,
            options,
            correctOptionId: options[1].id,
          };
        }),
      },
      {
        part: 5,
        title: 'Part 5',
        instruction: 'Listen and colour.',
        audioAssetId: 'audio-5',
        sceneAssetId: 'scene-5',
        colours,
        targets: colours.slice(0, 5).map((colour, index) => ({
          id: `p5-${index}`,
          label: `Region ${index}`,
          correctColourId: colour.id,
          region: region(index),
        })),
      },
    ],
  };
}

function correctAnswers(content: ListeningSetContent): ListeningAnswers {
  const part3 = content.parts[2];
  const part5 = content.parts[4];
  if (part3.displayMode === 'connect-image' || part5.displayMode === 'scene-colour-draw') {
    throw new Error('Legacy fixture expected.');
  }
  return {
    part1: Object.fromEntries(content.parts[0].targets.map(target => [target.id, target.choiceId])),
    part2: Object.fromEntries(content.parts[1].questions.map(question => [
      question.id,
      Object.fromEntries(question.blanks.map(blank => [blank.id, blank.acceptedAnswers[0]])),
    ])),
    part3: Object.fromEntries(part3.items.map(item => [item.id, item.correctOptionId])),
    part4: Object.fromEntries(content.parts[3].questions.map(question => [question.id, question.correctOptionId])),
    part5: Object.fromEntries(part5.targets.map(target => [target.id, target.correctColourId])),
  };
}

test('normalizes NFKC, whitespace, case and apostrophe variants', () => {
  assert.equal(normalizeListeningTextAnswer('  JANE’S   CLASS  '), "jane's class");
  assert.equal(normalizeListeningTextAnswer('ＡＢＣ'), 'abc');
});

test('grades exactly 25 questions and returns a 0-100 score', () => {
  const content = validContent();
  const result = gradeListeningAttempt(content, correctAnswers(content));
  assert.equal(result.totalCount, 25);
  assert.equal(result.correctCount, 25);
  assert.equal(result.score, 100);
});

test('part 2 requires every blank in the question to be correct', () => {
  const content = validContent();
  content.parts[1].questions[0].prompt = 'First {{blank-0}} second {{blank-extra}}';
  content.parts[1].questions[0].blanks.push({ id: 'blank-extra', acceptedAnswers: ['yes'] });
  const answers = correctAnswers(content);
  answers.part2['p2-0']['blank-extra'] = 'no';
  const result = gradeListeningAttempt(content, answers);
  assert.equal(result.correctCount, 24);
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.score, 96);
});

test('publish validation enforces five scored items and six Part 1/5 choices', () => {
  const content = validContent();
  assert.deepEqual(validateListeningSetContent(content), []);
  content.parts[0].choices.pop();
  if (content.parts[4].displayMode !== 'scene-colour-draw') content.parts[4].targets.pop();
  const errors = validateListeningSetContent(content).join(' ');
  assert.match(errors, /Part 1/);
  assert.match(errors, /Part 5/);
});

test('Part 4 validates an optional example as a complete unscored A/B/C row', () => {
  const content = validContent();
  const exampleOptions = Array.from({ length: 3 }, (_, index) => ({
    id: `part4-example-${index}`,
    imageAssetId: `part4-example-image-${index}`,
    alt: `Example ${index}`,
  }));
  content.parts[3].example = {
    id: 'part4-example',
    prompt: 'Where is Pat\'s dad going?',
    options: exampleOptions,
    correctOptionId: exampleOptions[0].id,
  };
  assert.deepEqual(validateListeningSetContent(content), []);
  content.parts[3].example.correctOptionId = 'provider-injected-option-id';
  assert.match(validateListeningSetContent(content).join(' '), /Part 4 example/);
});

function currentSchemaContent() {
  const content = validContent();
  const answers = Array.from({ length: 7 }, (_, index) => ({
    id: `connect-answer-${index}`,
    label: ['Saturday', 'Monday', 'Thursday', 'Sunday', 'Tuesday', 'Wednesday', 'Friday'][index],
    region: { shape: 'rect' as const, x: 0.43, y: 0.04 + index * 0.13, width: 0.14, height: 0.06 },
    leftAnchorOffset: 0.5,
    rightAnchorOffset: 0.5,
  }));
  const pictures = Array.from({ length: 6 }, (_, index) => ({
    id: `connect-picture-${index}`,
    label: `Picture ${index + 1}`,
    side: index < 3 ? 'left' as const : 'right' as const,
    row: (index % 3 + 1) as 1 | 2 | 3,
    region: { shape: 'rect' as const, x: index < 3 ? 0.04 : 0.76, y: 0.04 + index % 3 * 0.31, width: 0.2, height: 0.2 },
    anchorOffset: 0.5,
  }));
  content.parts[2] = {
    part: 3, displayMode: 'connect-image', connectionSchemaVersion: 1, title: 'Part 3', instruction: 'Listen and draw lines.', audioAssetId: 'audio-3', boardAssetId: 'board-3', answers, pictures,
    exampleConnection: { answerId: answers[2].id, pictureId: pictures[1].id, renderOverlayLine: false },
    correctConnections: [
      { answerId: answers[0].id, pictureId: pictures[0].id }, { answerId: answers[1].id, pictureId: pictures[3].id },
      { answerId: answers[4].id, pictureId: pictures[2].id }, { answerId: answers[5].id, pictureId: pictures[5].id },
      { answerId: answers[3].id, pictureId: pictures[4].id },
    ],
    distractorAnswerId: answers[6].id,
  };
  const colours = MOVER_COLOUR_CATALOG.map((colour, index) => ({ id: `catalog-${index}`, ...colour }));
  const objects = Array.from({ length: 5 }, (_, index) => ({ id: `object-${index}`, label: `Object ${index}`, geometry: region(index), interactionKinds: ['colour'] as ['colour'], geometryConfirmedByTeacher: true }));
  const palette = [
    { id: 'star-yellow', objectType: 'star', label: 'Yellow star', colourId: colours[3].id, tokenAssetId: 'token-yellow-png' },
    { id: 'star-red', objectType: 'star', label: 'Red star', colourId: colours[0].id, tokenAssetId: 'token-red-png' },
    { id: 'lamp-blue', objectType: 'lamp', label: 'Blue lamp', colourId: colours[1].id, tokenAssetId: 'token-lamp-png' },
  ];
  content.parts[4] = {
    part: 5, displayMode: 'scene-colour-draw', interactionSchemaVersion: 2, title: 'Part 5', instruction: 'Listen, colour and draw.', audioAssetId: 'audio-5', sceneAssetId: 'scene-5', colours, colourPaletteIds: colours.slice(0, 6).map(colour => colour.id), interactiveObjects: objects, objectPalette: palette,
    questions: ([1, 2, 3, 4, 5] as const).map((questionNumber, index) => ({
      id: `scene-question-${index}`,
      questionNumber,
      staffPrompt: `Question ${questionNumber}`,
      actions: index === 0 ? [
        { id: 'colour-action-0', type: 'colour_object' as const, correctObjectId: objects[0].id, correctColourId: colours[0].id },
        { id: 'place-action-0', type: 'place_object' as const, correctPaletteItemId: palette[0].id, targetRegion: { shape: 'rect' as const, x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, geometryConfirmedByTeacher: true },
      ] : [{ id: `colour-action-${index}`, type: 'colour_object' as const, correctObjectId: objects[index].id, correctColourId: colours[index].id }],
    })),
  };
  return content;
}

test('current Part 3 and variable-action Part 5 validate and grade five questions each', () => {
  const content = currentSchemaContent();
  assert.deepEqual(validateListeningSetContent(content), []);
  const part3 = content.parts[2];
  const part5 = content.parts[4];
  if (part3.displayMode !== 'connect-image' || part5.displayMode !== 'scene-colour-draw') return;
  const base = correctAnswers(validContent());
  const answers: ListeningAnswers = {
    ...base,
    part3: Object.fromEntries(part3.correctConnections.map(connection => [connection.answerId, connection.pictureId])),
    part5: {
      'colour-action-0': { type: 'colour_object', objectId: 'object-0', colourId: 'catalog-0' },
      'place-action-0': { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.5, y: 0.5 } },
      'colour-action-1': { type: 'colour_object', objectId: 'object-1', colourId: 'catalog-1' },
      'colour-action-2': { type: 'colour_object', objectId: 'object-2', colourId: 'catalog-2' },
      'colour-action-3': { type: 'colour_object', objectId: 'object-3', colourId: 'catalog-3' },
      'colour-action-4': { type: 'colour_object', objectId: 'object-4', colourId: 'catalog-4' },
    },
  };
  const result = gradeListeningAttempt(content, answers);
  assert.equal(result.correctCount, 25);
  const naturalInteractionAnswers: ListeningAnswers = {
    ...answers,
    part5: {
      'object-0': { type: 'colour_object', objectId: 'object-0', colourId: 'catalog-0' },
      'star-yellow': { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.5, y: 0.5 } },
      'object-1': { type: 'colour_object', objectId: 'object-1', colourId: 'catalog-1' },
      'object-2': { type: 'colour_object', objectId: 'object-2', colourId: 'catalog-2' },
      'object-3': { type: 'colour_object', objectId: 'object-3', colourId: 'catalog-3' },
      'object-4': { type: 'colour_object', objectId: 'object-4', colourId: 'catalog-4' },
    },
  };
  assert.equal(gradeListeningAttempt(content, naturalInteractionAnswers).correctCount, 25);
  naturalInteractionAnswers.part5['object-0'] = { type: 'colour_object', objectId: 'object-0', colourId: 'catalog-5' };
  assert.equal(gradeListeningAttempt(content, naturalInteractionAnswers).correctCount, 24);
  naturalInteractionAnswers.part5['object-0'] = { type: 'colour_object', objectId: 'object-0', colourId: 'catalog-0' };
  delete naturalInteractionAnswers.part5['star-yellow'];
  naturalInteractionAnswers.part5['star-red'] = { type: 'place_object', paletteItemId: 'star-red', anchor: { x: 0.5, y: 0.35 } };
  const wrongDrawGrade = gradeListeningAttempt(content, naturalInteractionAnswers);
  const wrongDrawQuestion = wrongDrawGrade.questions.find(question => question.questionId === 'scene-question-0');
  assert.equal(wrongDrawQuestion?.correct, false);
  assert.equal(wrongDrawQuestion?.unanswered, false, 'A placed distractor is assigned to the nearest Draw target instead of becoming blank');
  const wrongDrawDetails = buildListeningActivityAnswerDetails(content, naturalInteractionAnswers, wrongDrawGrade.questions);
  assert.match(String(wrongDrawDetails[20].userAnswer), /Red star/);
  const wrongDrawReview = buildListeningVisualReviewSnapshot(content, naturalInteractionAnswers, wrongDrawGrade.questions, wrongDrawDetails);
  const reviewPart5 = wrongDrawReview.parts[4];
  assert.equal(reviewPart5.mode, 'scene-colour-draw');
  assert.equal(reviewPart5.items[0].state, 'incorrect');
  assert.match(reviewPart5.items[0].userAnswer, /Red star/);
  assert.equal(reviewPart5.items[0].actions[1]?.state, 'incorrect');
  answers.part5['place-action-0'] = { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.41, y: 0.41 } };
  assert.equal(gradeListeningAttempt(content, answers).correctCount, 25);
  answers.part5['place-action-0'] = { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.59, y: 0.59 } };
  assert.equal(gradeListeningAttempt(content, answers).correctCount, 25);
  answers.part5['place-action-0'] = { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.1, y: 0.1 } };
  assert.equal(gradeListeningAttempt(content, answers).correctCount, 24);
});

test('scene-colour-draw v1 remains valid for published legacy content', () => {
  const content = currentSchemaContent();
  const part5 = content.parts[4];
  if (part5.displayMode !== 'scene-colour-draw') return;
  part5.interactionSchemaVersion = 1;
  delete part5.colourPaletteIds;
  part5.objectPalette = part5.objectPalette.slice(0, 2);
  part5.interactiveObjects.forEach(object => { delete object.geometryConfirmedByTeacher; });
  part5.questions.forEach(question => question.actions.forEach(action => {
    if (action.type === 'place_object') delete action.geometryConfirmedByTeacher;
  }));
  assert.deepEqual(validateListeningSetContent(content), []);
});

test('student sanitizer strips private mappings/targetRegion and preserves structured submissions', () => {
  const content = currentSchemaContent();
  const student = sanitizeListeningContentForStudent(content) as any;
  assert.equal(student.parts[2].correctConnections, undefined);
  assert.equal(student.parts[2].distractorAnswerId, undefined);
  assert.ok(student.parts[2].exampleConnection);
  assert.ok(student.parts[4].interactiveObjects[0].geometry);
  assert.equal(student.parts[4].interactiveObjects[0].geometryConfirmedByTeacher, undefined);
  assert.equal(student.parts[4].colours.length, 6);
  assert.equal(student.parts[4].questions[0].staffPrompt, undefined);
  assert.equal(student.parts[4].questions[0].actions[0].correctObjectId, undefined);
  assert.equal(student.parts[4].questions[0].actions[1].targetRegion, undefined);
  assert.equal(student.parts[4].questions[0].actions[1].correctPaletteItemId, undefined);
  assert.equal(student.parts[4].questions[0].actions[1].relationLabel, undefined);

  const sanitized = sanitizeListeningAnswers({ part5: {
    action1: { type: 'colour_object', objectId: 'object-1', colourId: 'catalog-1' },
    action2: { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.25, y: 0.75 } },
    bad: { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 2, y: 0 } },
  } });
  assert.deepEqual(sanitized.part5.action1, { type: 'colour_object', objectId: 'object-1', colourId: 'catalog-1' });
  assert.deepEqual(sanitized.part5.action2, { type: 'place_object', paletteItemId: 'star-yellow', anchor: { x: 0.25, y: 0.75 } });
  assert.equal(sanitized.part5.bad, undefined);
  assert.doesNotMatch(JSON.stringify(sanitized.part5), /\[object Object\]/);
});

test('normalized geometry supports transforms and safe rect/ellipse/polygon containment', () => {
  const polygon = { shape: 'polygon' as const, x: 0.2, y: 0.2, width: 0.4, height: 0.4, points: [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 }, { x: 0.4, y: 0.6 }] };
  assert.equal(isValidListeningRegion(polygon), true);
  assert.equal(pointInListeningRegion({ x: 0.4, y: 0.35 }, polygon), true);
  assert.equal(pointInListeningRegion({ x: 0.21, y: 0.58 }, polygon), false);
  assert.equal(pointInListeningRegion({ x: 0.5, y: 0.5 }, { shape: 'ellipse', x: 0.3, y: 0.4, width: 0.4, height: 0.2 }), true);
  assert.equal(isValidListeningRegion({ shape: 'polygon', x: 0.1, y: 0.1, width: 0.8, height: 0.8, points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }, { x: 0.9, y: 0.1 }] }), false);
  assert.deepEqual(transformListeningPoint({ x: 0.5, y: 0.5 }, { shape: 'rect', x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, { shape: 'rect', x: 0.1, y: 0.2, width: 0.8, height: 0.6 }), { x: 0.5, y: 0.5 });
});
