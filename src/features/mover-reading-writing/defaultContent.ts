import type {
  MoverReadingWritingChoiceQuestion,
  MoverReadingWritingContent,
  MoverReadingWritingTextQuestion,
} from './types';
import { MOVER_READING_WRITING_SCHEMA_VERSION } from './types';

const newId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const textQuestions = (prefix: string, count: number): MoverReadingWritingTextQuestion[] => (
  Array.from({ length: count }, (_, index) => {
    const id = newId(`${prefix}-q${index + 1}`);
    return {
      id,
      prompt: `{{${id}}}`,
      acceptedAnswers: [''],
    };
  })
);

const choiceQuestion = (prefix: string): MoverReadingWritingChoiceQuestion => {
  const options = Array.from({ length: 3 }, (_, index) => ({
    id: newId(`${prefix}-option-${index + 1}`),
    text: '',
  })) as MoverReadingWritingChoiceQuestion['options'];
  return { id: newId(`${prefix}-question`), prompt: '', options, correctOptionId: options[0].id };
};

export function createDefaultMoverReadingWritingContent(): MoverReadingWritingContent {
  const part4Gaps = Array.from({ length: 6 }, (_, index) => ({
    id: newId(`rw-p4-gap-${index + 1}`),
    acceptedAnswers: [''],
  }));
  const part6Gaps = Array.from({ length: 5 }, (_, index) => ({
    id: newId(`rw-p6-gap-${index + 1}`),
    acceptedAnswers: [''],
  }));
  return {
    moduleId: 'mover',
    paperId: 'reading-writing',
    schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
    title: 'Mover Reading & Writing',
    description: '',
    level: 'Movers',
    showReviewAfterSubmit: true,
    parts: [
      {
        part: 1,
        title: 'Part 1',
        instruction: 'Look and read. Choose the correct words and write them on the lines.',
        wordBankAssetId: '',
        example: { prompt: '', answer: '' },
        questions: textQuestions('rw-p1', 6),
      },
      {
        part: 2,
        title: 'Part 2',
        instruction: 'Look and read. Choose yes or no.',
        sceneAssetId: '',
        examples: [],
        questions: Array.from({ length: 6 }, (_, index) => ({
          id: newId(`rw-p2-q${index + 1}`),
          statement: '',
          correctAnswer: 'yes' as const,
        })),
      },
      {
        part: 3,
        title: 'Part 3',
        instruction: 'Read the text and choose the best answer.',
        sceneAssetId: '',
        questions: Array.from({ length: 6 }, (_, index) => choiceQuestion(`rw-p3-q${index + 1}`)),
      },
      {
        part: 4,
        title: 'Part 4',
        instruction: 'Read the story. Choose a word from the box and write it in each gap.',
        wordBankAssetId: '',
        storyTemplate: part4Gaps.map((gap, index) => `(${index + 1}) {{${gap.id}}}`).join(' '),
        gaps: part4Gaps,
        titleQuestion: choiceQuestion('rw-p4-title'),
      },
      {
        part: 5,
        title: 'Part 5',
        instruction: 'Look at the pictures and read the story. Write one, two or three words.',
        scenes: [
          { id: newId('rw-p5-scene-1'), imageAssetId: '', passage: '', questions: textQuestions('rw-p5-s1', 3) },
          { id: newId('rw-p5-scene-2'), imageAssetId: '', passage: '', questions: textQuestions('rw-p5-s2', 4) },
          { id: newId('rw-p5-scene-3'), imageAssetId: '', passage: '', questions: textQuestions('rw-p5-s3', 3) },
        ],
      },
      {
        part: 6,
        title: 'Part 6',
        instruction: 'Read the text. Choose the right words and write them on the lines.',
        passageSourceAssetId: '',
        illustrationAssetId: '',
        optionsAssetId: '',
        passageTitle: '',
        passageTemplate: part6Gaps.map((gap, index) => `(${index + 1}) {{${gap.id}}}`).join(' '),
        gaps: part6Gaps,
      },
    ],
  };
}
