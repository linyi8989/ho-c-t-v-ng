import type {
  MoverReadingWritingChoiceQuestion,
  MoverReadingWritingDialogueQuestion,
  MoverReadingWritingPart,
  MoverReadingWritingPart1,
  MoverReadingWritingPart2,
  MoverReadingWritingPart3,
  MoverReadingWritingPart4,
  MoverReadingWritingPart5,
  MoverReadingWritingPart6,
  MoverReadingWritingTextQuestion,
} from '../types';
import type {
  MoverReadingWritingImportChoiceQuestion,
  MoverReadingWritingSmartImportData,
} from './types';

const newId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const nonEmpty = (value: string | undefined, fallback: string) => value?.trim() || fallback;

function mergeChoiceQuestion(
  current: MoverReadingWritingChoiceQuestion,
  imported: Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'>,
): MoverReadingWritingChoiceQuestion {
  const options = current.options.map((option, index) => ({
    ...option,
    text: nonEmpty(imported.options[index], option.text),
  })) as MoverReadingWritingChoiceQuestion['options'];
  const correctIndex = imported.correctOption ? imported.correctOption.charCodeAt(0) - 65 : -1;
  return {
    ...current,
    prompt: nonEmpty(imported.prompt, current.prompt),
    options,
    correctOptionId: correctIndex >= 0 && correctIndex < options.length
      ? options[correctIndex].id
      : current.correctOptionId,
  };
}

function mergeDialogueQuestion(
  current: MoverReadingWritingDialogueQuestion,
  imported: Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'>,
): MoverReadingWritingDialogueQuestion {
  return {
    ...mergeChoiceQuestion(current, imported),
    promptSpeaker: nonEmpty(imported.promptSpeaker, current.promptSpeaker || '') || undefined,
    answerSpeaker: nonEmpty(imported.answerSpeaker, current.answerSpeaker || '') || undefined,
  };
}

function newTextQuestion(prefix: string): MoverReadingWritingTextQuestion {
  const id = newId(prefix);
  return { id, prompt: `{{${id}}}`, acceptedAnswers: [''] };
}

function importedQuestionTemplate(template: string, questionNumber: number, questionId: string) {
  return template.replace(`[[${questionNumber}]]`, `{{${questionId}}}`);
}

export function mergeMoverReadingWritingSmartImport(
  part: MoverReadingWritingPart,
  data: MoverReadingWritingSmartImportData,
): MoverReadingWritingPart {
  if (part.part !== data.part) throw new Error(`Không thể nhập dữ liệu Part ${data.part} vào Part ${part.part}.`);

  if (part.part === 1 && data.part === 1) {
    const current = part as MoverReadingWritingPart1;
    return {
      ...current,
      title: nonEmpty(data.title, current.title),
      instruction: nonEmpty(data.instruction, current.instruction),
      example: data.example
        ? {
            prompt: nonEmpty(data.example.prompt, current.example?.prompt || ''),
            answer: nonEmpty(data.example.answer, current.example?.answer || ''),
          }
        : current.example,
      questions: current.questions.map((question, index) => {
        const imported = data.questions[index];
        return imported ? {
          ...question,
          prompt: nonEmpty(
            importedQuestionTemplate(imported.promptTemplate, imported.questionNumber, question.id),
            question.prompt,
          ),
          acceptedAnswers: imported.acceptedAnswers.length ? imported.acceptedAnswers : question.acceptedAnswers,
        } : question;
      }),
    };
  }

  if (part.part === 2 && data.part === 2) {
    const current = part as MoverReadingWritingPart2;
    const examples = data.examples.flatMap((example, index) => {
      const existing = current.examples[index];
      const prompt = nonEmpty(example.prompt, existing?.prompt || '');
      const answer = example.answer || existing?.answer;
      return prompt && answer ? [{ prompt, answer }] : [];
    });
    return {
      ...current,
      title: nonEmpty(data.title, current.title),
      instruction: nonEmpty(data.instruction, current.instruction),
      examples: examples.length ? examples : current.examples,
      questions: current.questions.map((question, index) => {
        const imported = data.questions[index];
        return imported ? {
          ...question,
          statement: nonEmpty(imported.statement, question.statement),
          correctAnswer: imported.correctAnswer || question.correctAnswer,
        } : question;
      }),
    };
  }

  if (part.part === 3 && data.part === 3) {
    const current = part as MoverReadingWritingPart3;
    return {
      ...current,
      title: nonEmpty(data.title, current.title),
      instruction: nonEmpty(data.instruction, current.instruction),
      example: data.example
        ? mergeDialogueQuestion(current.example || {
            id: newId('rw-p3-example'),
            prompt: '',
            options: [0, 1, 2].map(index => ({ id: newId(`rw-p3-example-option-${index + 1}`), text: '' })) as MoverReadingWritingChoiceQuestion['options'],
            correctOptionId: '',
          }, data.example)
        : current.example,
      questions: current.questions.map((question, index) => data.questions[index]
        ? mergeDialogueQuestion(question, data.questions[index])
        : question),
    };
  }

  if (part.part === 4 && data.part === 4) {
    const current = part as MoverReadingWritingPart4;
    const storyTemplate = data.storyTemplate.replace(/\[\[(\d+)\]\]/g, (_match, rawNumber) => {
      const gap = current.gaps[Number(rawNumber) - 1];
      return gap ? `{{${gap.id}}}` : _match;
    });
    return {
      ...current,
      title: nonEmpty(data.title, current.title),
      instruction: nonEmpty(data.instruction, current.instruction),
      storyTemplate: nonEmpty(storyTemplate, current.storyTemplate),
      example: data.example
        ? {
            prompt: nonEmpty(data.example.prompt, current.example?.prompt || ''),
            answer: nonEmpty(data.example.answer, current.example?.answer || ''),
          }
        : current.example,
      gaps: current.gaps.map((gap, index) => ({
        ...gap,
        acceptedAnswers: data.gaps[index]?.acceptedAnswers.length
          ? data.gaps[index].acceptedAnswers
          : gap.acceptedAnswers,
      })),
      titleQuestion: mergeChoiceQuestion(current.titleQuestion, data.titleQuestion),
    };
  }

  if (part.part === 5 && data.part === 5) {
    const current = part as MoverReadingWritingPart5;
    const existingQuestions = current.scenes.flatMap(scene => scene.questions);
    const scenes = data.scenes.map((scene, sceneIndex) => {
      const existingScene = current.scenes[sceneIndex];
      return {
        id: existingScene?.id || newId(`rw-p5-scene-${sceneIndex + 1}`),
        imageAssetId: existingScene?.imageAssetId || '',
        imageUrl: existingScene?.imageUrl,
        passage: nonEmpty(scene.passage, existingScene?.passage || ''),
        questions: scene.questions.map(imported => {
          const existing = existingQuestions[imported.questionNumber - 1] || newTextQuestion(`rw-p5-q${imported.questionNumber}`);
          return {
            ...existing,
            prompt: nonEmpty(
              importedQuestionTemplate(imported.promptTemplate, imported.questionNumber, existing.id),
              existing.prompt,
            ),
            acceptedAnswers: imported.acceptedAnswers.length ? imported.acceptedAnswers : existing.acceptedAnswers,
          };
        }),
      };
    }) as MoverReadingWritingPart5['scenes'];
    return {
      ...current,
      title: nonEmpty(data.title, current.title),
      instruction: nonEmpty(data.instruction, current.instruction),
      example: data.example
        ? {
            prompt: nonEmpty(data.example.prompt, current.example?.prompt || ''),
            answer: nonEmpty(data.example.answer, current.example?.answer || ''),
          }
        : current.example,
      scenes,
    };
  }

  const current = part as MoverReadingWritingPart6;
  const imported = data as Extract<MoverReadingWritingSmartImportData, { part: 6 }>;
  const passageTemplate = imported.passageTemplate.replace(/\[\[(\d+)\]\]/g, (_match, rawNumber) => {
    const gap = current.gaps[Number(rawNumber) - 1];
    return gap ? `{{${gap.id}}}` : _match;
  });
  return {
    ...current,
    title: nonEmpty(imported.title, current.title),
    instruction: nonEmpty(imported.instruction, current.instruction),
    passageTitle: nonEmpty(imported.passageTitle, current.passageTitle),
    passageTemplate: nonEmpty(passageTemplate, current.passageTemplate),
    example: imported.example
      ? {
          prompt: nonEmpty(imported.example.prompt, current.example?.prompt || ''),
          answer: nonEmpty(imported.example.answer, current.example?.answer || ''),
        }
      : current.example,
    gaps: current.gaps.map((gap, index) => ({
      ...gap,
      acceptedAnswers: imported.gaps[index]?.acceptedAnswers.length
        ? imported.gaps[index].acceptedAnswers
        : gap.acceptedAnswers,
    })),
  };
}
