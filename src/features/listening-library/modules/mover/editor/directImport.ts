import type {
  ListeningPart1,
  ListeningPart2,
  ListeningPart3,
  ListeningPart3ConnectImage,
  ListeningPart4,
  ListeningPart5,
  ListeningPart5Action,
  ListeningPart5SceneColourDraw,
} from '../../../../listening/types';
import type { ListeningSmartImportData } from '../../../../listening-editor/smart-import/types';
import { MOVER_COLOUR_CATALOG } from './colourCatalog';
import { createMoverDefaultRegion, createMoverEditorId } from './editorUtilities';

type Part1ImportData = Extract<ListeningSmartImportData, { part: 1 }>;
type Part2ImportData = Extract<ListeningSmartImportData, { part: 2 }>;
type Part3ImportData = Extract<ListeningSmartImportData, { part: 3 }>;
type Part4ImportData = Extract<ListeningSmartImportData, { part: 4 }>;
type Part5ImportData = Extract<ListeningSmartImportData, { part: 5 }>;

const comparable = (value: unknown) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');

export function importPart1Analysis(part: ListeningPart1, data: Part1ImportData, sourceImageAssetId?: string): ListeningPart1 {
  const choices = [...part.choices];
  while (choices.length < 6) choices.push({ id: createMoverEditorId('p1-choice'), label: '' });
  const usedChoiceIds = new Set<string>();
  const nextChoices = choices.slice(0, 6).map((choice, index) => {
    const label = data.choices[index]?.trim();
    const labelMatches = label ? choices.filter(item => comparable(item.label) === comparable(label) && !usedChoiceIds.has(item.id)) : [];
    const matching = labelMatches.length === 1
      ? labelMatches[0]
      : !usedChoiceIds.has(choice.id) ? choice : choices.find(item => !usedChoiceIds.has(item.id)) || choice;
    usedChoiceIds.add(matching.id);
    return { ...matching, label: label || matching.label };
  });
  const targets = [...part.targets];
  while (targets.length < 5) targets.push({ id: createMoverEditorId('p1-target'), choiceId: nextChoices[targets.length]?.id || nextChoices[0]?.id || '', region: createMoverDefaultRegion(targets.length) });
  const nextTargets = targets.slice(0, 5).map((target, index) => {
    const label = data.targetChoiceLabels[index];
    const matches = nextChoices.filter(choice => comparable(choice.label) === comparable(label));
    const anchor = data.anchors.find(item => item.targetNumber === index + 1)
      || (data.anchors.every(item => item.targetNumber === undefined) ? data.anchors[index] : undefined);
    return {
      ...target,
      choiceId: matches.length === 1 ? matches[0].id : target.choiceId,
      region: anchor?.region || target.region,
    };
  });
  return {
    ...part,
    sceneAssetId: sourceImageAssetId || part.sceneAssetId,
    choices: nextChoices,
    targets: nextTargets,
    ...(data.example ? { example: { id: part.example?.id || createMoverEditorId('p1-example'), choiceId: part.example?.choiceId || '', label: data.example.label, region: data.example.region } } : {}),
  };
}

export function importPart2Analysis(part: ListeningPart2, data: Part2ImportData): ListeningPart2 {
  const questions = [...part.questions];
  while (questions.length < 5) questions.push({
    id: createMoverEditorId('p2-question'),
    prompt: `{{${createMoverEditorId('p2-blank')}}}`,
    blanks: [],
  });
  return {
    ...part,
    heading: data.heading?.trim() || part.heading,
    instruction: data.instruction?.trim() || part.instruction,
    exampleText: data.exampleText?.trim() || part.exampleText,
    questions: questions.slice(0, 5).map((question, index) => {
      const suggestion = data.questions.find(item => item.questionNumber === index + 1);
      if (!suggestion) return question;
      const existingBlank = question.blanks[0];
      const blank = existingBlank || { id: createMoverEditorId('p2-blank'), acceptedAnswers: [] };
      const placeholder = `{{${blank.id}}}`;
      const rawPrompt = suggestion.prompt?.trim();
      const prompt = rawPrompt
        ? rawPrompt.includes('{{blank}}')
          ? rawPrompt.replace(/\{\{blank\}\}/g, placeholder)
          : rawPrompt.includes(placeholder) ? rawPrompt : `${rawPrompt} ${placeholder}`.trim()
        : question.prompt;
      return {
        ...question,
        prompt,
        blanks: [{
          ...blank,
          acceptedAnswers: suggestion.acceptedAnswers?.length ? suggestion.acceptedAnswers : blank.acceptedAnswers,
        }],
      };
    }),
  };
}

export function applyPart3ConnectAnalysis(part: ListeningPart3, data: Part3ImportData, boardAssetId: string): ListeningPart3ConnectImage {
  const current = part.displayMode === 'connect-image' ? part : undefined;
  const answers = data.answers.map(answer => {
    const matches = current?.answers.filter(item => comparable(item.label) === comparable(answer.label)) || [];
    return { id: matches.length === 1 ? matches[0].id : createMoverEditorId('p3-answer'), ...answer };
  });
  const pictures = data.pictures.map(picture => {
    const existing = current?.pictures.find(item => item.side === picture.side && item.row === picture.row);
    return { id: existing?.id || createMoverEditorId('p3-picture'), ...picture };
  });
  const answerId = (label: string) => answers.find(answer => comparable(answer.label) === comparable(label))?.id || '';
  const pictureId = (side: 'left' | 'right', row: 1 | 2 | 3) => pictures.find(picture => picture.side === side && picture.row === row)?.id || '';
  const exampleConnection = data.example ? {
    answerId: answerId(data.example.answerLabel),
    pictureId: pictureId(data.example.pictureSide, data.example.pictureRow),
    renderOverlayLine: data.example.renderOverlayLine,
  } : current?.exampleConnection || { answerId: '', pictureId: '', renderOverlayLine: false };
  const proposedConnections = data.connections.map(connection => ({
    answerId: answerId(connection.answerLabel),
    pictureId: pictureId(connection.pictureSide, connection.pictureRow),
  })).filter(connection => connection.answerId && connection.pictureId);
  const correctConnections = [...proposedConnections];
  (current?.correctConnections || []).forEach(connection => {
    if (
      correctConnections.length < 5
      && answers.some(answer => answer.id === connection.answerId)
      && pictures.some(picture => picture.id === connection.pictureId)
      && !correctConnections.some(item => item.answerId === connection.answerId || item.pictureId === connection.pictureId)
    ) correctConnections.push(connection);
  });
  return {
    schemaVersion: part.schemaVersion,
    part: 3,
    title: part.title,
    instruction: part.instruction,
    audioAssetId: part.audioAssetId,
    audioUrl: part.audioUrl,
    displayMode: 'connect-image',
    connectionSchemaVersion: 1,
    boardAssetId: boardAssetId || (part.displayMode === 'connect-image' ? part.boardAssetId : ''),
    boardUrl: part.displayMode === 'connect-image' ? part.boardUrl : undefined,
    answers,
    pictures,
    exampleConnection,
    correctConnections,
    distractorAnswerId: data.distractorLabel ? answerId(data.distractorLabel) : current?.distractorAnswerId || '',
  };
}

export function applyPart4Analysis(
  part: ListeningPart4,
  data: Part4ImportData,
  questionOptionAssetIds: string[][],
  exampleOptionAssetIds?: string[],
): ListeningPart4 {
  const questions = part.questions.map((question, index) => {
    const suggestion = data.questions.find(item => item.questionNumber === index + 1);
    if (!suggestion) return question;
    return {
      ...question,
      prompt: suggestion.prompt || question.prompt,
      options: question.options.map((option, optionIndex) => ({
        ...option,
        imageAssetId: questionOptionAssetIds[index]?.[optionIndex] || option.imageAssetId,
      })),
      correctOptionId: suggestion.correctOptionIndex === undefined
        ? question.correctOptionId
        : question.options[suggestion.correctOptionIndex]?.id || question.correctOptionId,
    };
  });
  let example = part.example;
  if (data.example) {
    const options = part.example?.options.length === 3
      ? part.example.options
      : Array.from({ length: 3 }, (_, index) => ({
          id: createMoverEditorId('p4-option'),
          imageAssetId: '',
          alt: `Lựa chọn ${String.fromCharCode(65 + index)}`,
        }));
    example = {
      id: part.example?.id || createMoverEditorId('p4-example'),
      prompt: data.example.prompt || part.example?.prompt || 'Example',
      options: options.map((option, index) => ({ ...option, imageAssetId: exampleOptionAssetIds?.[index] || option.imageAssetId })),
      correctOptionId: data.example.correctOptionIndex === undefined
        ? part.example?.correctOptionId || ''
        : options[data.example.correctOptionIndex]?.id || part.example?.correctOptionId || '',
    };
  }
  return { ...part, questions, ...(example ? { example } : {}) };
}

export function applyPart5SceneAnalysis(part: ListeningPart5, data: Part5ImportData, sceneAssetId: string): ListeningPart5SceneColourDraw {
  const current = part.displayMode === 'scene-colour-draw' ? part : undefined;
  const colours = MOVER_COLOUR_CATALOG.map(catalog => {
    const existing = part.colours.find(colour => comparable(colour.label) === comparable(catalog.label));
    return { id: existing?.id || createMoverEditorId('p5-colour'), ...catalog };
  });
  const colourId = (label?: string) => colours.find(colour => comparable(colour.label) === comparable(label))?.id || '';

  const proposedObjects = [...data.interactiveObjects];
  data.questions.forEach(question => question.actions.forEach(action => {
    if (action.type === 'colour_object' && action.geometry && !proposedObjects.some(object => comparable(object.label) === comparable(action.objectLabel))) {
      proposedObjects.push({ label: action.objectLabel, geometry: action.geometry, confidence: action.confidence });
    }
  }));
  const interactiveObjects = proposedObjects.map(object => {
    const matches = current?.interactiveObjects.filter(item => comparable(item.label) === comparable(object.label)) || [];
    return {
      id: matches.length === 1 ? matches[0].id : createMoverEditorId('p5-object'),
      label: object.label,
      geometry: object.geometry,
      interactionKinds: ['colour'] as ['colour'],
    };
  });
  (current?.interactiveObjects || []).forEach(object => {
    if (!interactiveObjects.some(item => item.id === object.id)) interactiveObjects.push(object);
  });
  const objectId = (label: string) => interactiveObjects.find(object => comparable(object.label) === comparable(label))?.id || '';

  const objectPalette = data.paletteItems.map(item => {
    const matches = current?.objectPalette.filter(entry => comparable(entry.objectType) === comparable(item.objectType) && comparable(entry.label) === comparable(item.label)) || [];
    return {
      id: matches.length === 1 ? matches[0].id : createMoverEditorId('p5-token'),
      objectType: item.objectType,
      label: item.label,
      ...(item.colourLabel ? { colourId: colourId(item.colourLabel) } : {}),
      ...(matches.length === 1 && matches[0].tokenAssetId ? { tokenAssetId: matches[0].tokenAssetId } : {}),
    };
  });
  (current?.objectPalette || []).forEach(item => {
    if (!objectPalette.some(entry => entry.id === item.id)) objectPalette.push(item);
  });
  const paletteId = (objectType: string, colourLabel?: string) => {
    const expectedColourId = colourId(colourLabel);
    const matches = objectPalette.filter(item => comparable(item.objectType) === comparable(objectType)
      && (!expectedColourId || item.colourId === expectedColourId));
    return matches.length === 1 ? matches[0].id : '';
  };

  const questions = ([1, 2, 3, 4, 5] as const).map(number => {
    const oldQuestion = current?.questions.find(question => question.questionNumber === number);
    const suggestion = data.questions.find(question => question.questionNumber === number);
    if (!suggestion) return oldQuestion || { id: createMoverEditorId('p5-question'), questionNumber: number, staffPrompt: '', actions: [] };
    const usedOldIds = new Set<string>();
    const proposedActions = suggestion.actions.flatMap((action): ListeningPart5Action[] => {
      if (action.type === 'colour_object') {
        const nextObjectId = objectId(action.objectLabel);
        const nextColourId = colourId(action.correctColourLabel);
        if (!nextObjectId || !nextColourId) return [];
        const old = oldQuestion?.actions.find(item => item.type === 'colour_object'
          && !usedOldIds.has(item.id)
          && current?.interactiveObjects.find(object => object.id === item.correctObjectId && comparable(object.label) === comparable(action.objectLabel)));
        if (old) usedOldIds.add(old.id);
        return [{ id: old?.id || createMoverEditorId('p5-action'), type: 'colour_object', correctObjectId: nextObjectId, correctColourId: nextColourId }];
      }
      const nextPaletteId = paletteId(action.objectType, action.colourLabel);
      if (!nextPaletteId || !action.targetRegion) return [];
      const old = oldQuestion?.actions.find(item => item.type === 'place_object'
        && !usedOldIds.has(item.id)
        && current?.objectPalette.find(palette => palette.id === item.correctPaletteItemId && comparable(palette.objectType) === comparable(action.objectType)));
      if (old) usedOldIds.add(old.id);
      return [{ id: old?.id || createMoverEditorId('p5-action'), type: 'place_object', correctPaletteItemId: nextPaletteId, targetRegion: action.targetRegion, ...(action.relationLabel ? { relationLabel: action.relationLabel } : {}) }];
    });
    const unmatchedOld = oldQuestion?.actions.filter(action => !usedOldIds.has(action.id)) || [];
    return {
      id: oldQuestion?.id || createMoverEditorId('p5-question'),
      questionNumber: number,
      staffPrompt: suggestion.staffPrompt || oldQuestion?.staffPrompt || '',
      actions: [...proposedActions, ...unmatchedOld],
    };
  });
  return {
    schemaVersion: part.schemaVersion,
    part: 5,
    title: part.title,
    instruction: part.instruction,
    audioAssetId: part.audioAssetId,
    audioUrl: part.audioUrl,
    displayMode: 'scene-colour-draw',
    interactionSchemaVersion: 1,
    sceneAssetId: sceneAssetId || part.sceneAssetId,
    sceneUrl: part.sceneUrl,
    colours,
    interactiveObjects,
    objectPalette,
    questions,
  };
}
