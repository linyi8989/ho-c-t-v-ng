import type { ListeningPart1, ListeningPart2, ListeningPart3 } from '../../../../listening/types';
import type { ListeningSmartImportData } from '../../../../listening-editor/smart-import/types';
import { createMoverEditorId } from './editorUtilities';

type Part1ImportData = Extract<ListeningSmartImportData, { part: 1 }>;
type Part2ImportData = Extract<ListeningSmartImportData, { part: 2 }>;
type Part3ImportData = Extract<ListeningSmartImportData, { part: 3 }>;

export function importPart1Analysis(
  part: ListeningPart1,
  data: Part1ImportData,
  sourceImageAssetId?: string
): ListeningPart1 {
  return {
    ...part,
    sceneAssetId: sourceImageAssetId || part.sceneAssetId,
    choices: part.choices.map((choice, index) => ({
      ...choice,
      label: data.choices[index]?.trim() || choice.label,
    })),
    targets: part.targets.map((target, index) => {
      const proposedChoiceIndex = data.provisionalChoiceIndexes[index];
      const proposedChoice = Number.isInteger(proposedChoiceIndex)
        ? part.choices[proposedChoiceIndex]
        : undefined;
      return {
        ...target,
        choiceId: proposedChoice?.id || target.choiceId,
        region: data.anchors[index]?.region || target.region,
      };
    }),
  };
}

export function importPart2Analysis(
  part: ListeningPart2,
  data: Part2ImportData
): ListeningPart2 {
  return {
    ...part,
    heading: data.heading.trim() || part.heading,
    exampleText: data.exampleText?.trim() || part.exampleText,
    questions: part.questions.map((question, index) => {
      const suggestion = data.questions[index];
      const blank = question.blanks[0];
      if (!suggestion || !blank) return question;
      const placeholder = `{{${blank.id}}}`;
      const prompt = suggestion.prompt.trim();
      const normalizedPrompt = prompt.includes('{{blank}}')
        ? prompt.replace(/\{\{blank\}\}/g, placeholder)
        : prompt.includes(placeholder)
          ? prompt
          : `${prompt} ${placeholder}`.trim();
      const acceptedAnswers = suggestion.acceptedAnswers
        .map(answer => answer.trim())
        .filter(Boolean);
      return {
        ...question,
        prompt: normalizedPrompt || question.prompt,
        blanks: [{
          ...blank,
          acceptedAnswers: acceptedAnswers.length ? acceptedAnswers : blank.acceptedAnswers,
        }],
      };
    }),
  };
}

export function importPart3Analysis(
  part: ListeningPart3,
  data: Part3ImportData
): ListeningPart3 {
  const options = [...part.options];
  while (options.length < 6) {
    options.push({
      id: createMoverEditorId('p3-option'),
      label: String.fromCharCode(65 + options.length),
      imageAssetId: '',
    });
  }
  return {
    ...part,
    displayMode: 'composite',
    boardAssetId: data.boardAssetId || part.boardAssetId,
    reuseMode: 'once',
    options: options.slice(0, 6).map((option, index) => ({
      ...option,
      label: String.fromCharCode(65 + index),
    })),
    items: part.items.map((item, index) => ({
      ...item,
      label: data.labels[index]?.trim() || item.label,
    })),
  };
}
