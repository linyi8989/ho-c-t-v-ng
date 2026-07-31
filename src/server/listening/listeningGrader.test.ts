import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListeningAnswers, ListeningRegion, ListeningSetContent } from '../../features/listening/types';
import { gradeListeningAttempt, normalizeListeningTextAnswer } from './listeningGrader';
import { validateListeningSetContent } from './listeningValidation';

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
  return {
    part1: Object.fromEntries(content.parts[0].targets.map(target => [target.id, target.choiceId])),
    part2: Object.fromEntries(content.parts[1].questions.map(question => [
      question.id,
      Object.fromEntries(question.blanks.map(blank => [blank.id, blank.acceptedAnswers[0]])),
    ])),
    part3: Object.fromEntries(content.parts[2].items.map(item => [item.id, item.correctOptionId])),
    part4: Object.fromEntries(content.parts[3].questions.map(question => [question.id, question.correctOptionId])),
    part5: Object.fromEntries(content.parts[4].targets.map(target => [target.id, target.correctColourId])),
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
  content.parts[4].targets.pop();
  const errors = validateListeningSetContent(content).join(' ');
  assert.match(errors, /Part 1/);
  assert.match(errors, /Part 5/);
});
