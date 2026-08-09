import type { ListeningSetContent } from '../../../../listening/types';
import type {
  ListeningEditorModuleDefinition,
  ListeningEditorValidationIssue,
} from '../../../../listening-editor/contracts';
import MoverPart1Editor from './part1Handler';
import MoverPart2Editor from './part2Handler';
import MoverPart3Editor from './part3Handler';
import MoverPart4Editor from './part4Handler';
import MoverPart5Editor from './part5Handler';
import { createMoverDefaultRegion, createMoverEditorId } from './editorUtilities';
import { MOVER_COLOUR_CATALOG } from './colourCatalog';

export { createMoverDefaultRegion, createMoverEditorId } from './editorUtilities';

const issue = (path: string, message: string): ListeningEditorValidationIssue => ({
  path,
  message,
  severity: 'error',
});

export function createDefaultMoverListeningContent(): ListeningSetContent {
  const p1Choices = Array.from({ length: 6 }, (_, index) => ({
    id: createMoverEditorId('p1-choice'),
    label: `Tên ${index + 1}`,
  }));
  const colours = MOVER_COLOUR_CATALOG.map(colour => ({
    id: createMoverEditorId('p5-colour'),
    ...colour,
  }));
  return {
    moduleId: 'mover',
    schemaVersion: 1,
    title: 'Bộ đề nghe 5 Part mới',
    description: 'Bài luyện nghe gồm 5 Part và 25 câu hỏi.',
    level: 'Movers',
    parts: [
      {
        schemaVersion: 1,
        part: 1,
        title: 'Part 1',
        instruction: 'Listen. Drag the name and drop onto the correct person in the picture.',
        audioAssetId: '',
        sceneAssetId: '',
        choices: p1Choices,
        targets: p1Choices.slice(0, 5).map((choice, index) => ({
          id: createMoverEditorId('p1-target'),
          choiceId: choice.id,
          region: createMoverDefaultRegion(index),
        })),
      },
      {
        schemaVersion: 1,
        part: 2,
        title: 'Part 2',
        instruction: 'Listen and write. There is one example.',
        audioAssetId: '',
        heading: 'Listening notes',
        exampleText: '',
        questions: Array.from({ length: 5 }, (_, index) => {
          const blankId = createMoverEditorId('blank');
          return {
            id: createMoverEditorId('p2-question'),
            prompt: `${index + 1}. Nội dung câu hỏi {{${blankId}}}`,
            blanks: [{ id: blankId, acceptedAnswers: [''] }],
          };
        }),
      },
      {
        schemaVersion: 1,
        part: 3,
        displayMode: 'connect-image',
        connectionSchemaVersion: 1,
        boardAssetId: '',
        title: 'Part 3',
        instruction: 'Listen and draw lines.',
        audioAssetId: '',
        answers: Array.from({ length: 7 }, (_, index) => ({
          id: createMoverEditorId('p3-answer'),
          label: `Answer ${index + 1}`,
          region: { shape: 'rect' as const, x: 0.42, y: 0.08 + index * 0.12, width: 0.16, height: 0.065 },
          leftAnchorOffset: 0.5,
          rightAnchorOffset: 0.5,
        })),
        pictures: Array.from({ length: 6 }, (_, index) => ({
          id: createMoverEditorId('p3-picture'),
          label: `Picture ${index + 1}`,
          side: index < 3 ? 'left' as const : 'right' as const,
          row: (index % 3 + 1) as 1 | 2 | 3,
          region: { shape: 'rect' as const, x: index < 3 ? 0.05 : 0.72, y: 0.08 + (index % 3) * 0.3, width: 0.23, height: 0.22 },
          anchorOffset: 0.5,
        })),
        exampleConnection: { answerId: '', pictureId: '', renderOverlayLine: false },
        correctConnections: [],
        distractorAnswerId: '',
      },
      {
        schemaVersion: 1,
        part: 4,
        title: 'Part 4',
        instruction: 'Listen and tick the box. There is one example.',
        audioAssetId: '',
        questions: Array.from({ length: 5 }, (_, questionIndex) => {
          const options = Array.from({ length: 3 }, (_, optionIndex) => ({
            id: createMoverEditorId('p4-option'),
            imageAssetId: '',
            alt: `Lựa chọn ${String.fromCharCode(65 + optionIndex)}`,
          }));
          return {
            id: createMoverEditorId('p4-question'),
            prompt: `${questionIndex + 1}. Câu hỏi`,
            options,
            correctOptionId: options[0].id,
          };
        }),
      },
      {
        schemaVersion: 1,
        part: 5,
        displayMode: 'scene-colour-draw',
        interactionSchemaVersion: 2,
        title: 'Part 5',
        instruction: 'Listen and colour and draw. There is one example.',
        audioAssetId: '',
        sceneAssetId: '',
        colours,
        colourPaletteIds: colours.slice(0, 6).map(colour => colour.id),
        interactiveObjects: [],
        objectPalette: Array.from({ length: 3 }, (_, index) => ({
          id: createMoverEditorId('p5-token'),
          objectType: `draw-object-${index + 1}`,
          label: index === 2 ? 'Vật nhiễu' : `Vật ${index + 1}`,
        })),
        questions: Array.from({ length: 5 }, (_, index) => ({
          id: createMoverEditorId('p5-question'),
          questionNumber: (index + 1) as 1 | 2 | 3 | 4 | 5,
          staffPrompt: `Question ${index + 1}`,
          actions: [],
        })),
      },
    ],
  };
}

export const moverListeningEditorDefinition: ListeningEditorModuleDefinition = {
  moduleId: 'mover',
  schemaVersion: 1,
  createDefaultDraft: createDefaultMoverListeningContent,
  partHandlers: [
    {
      part: 1,
      label: 'Part 1',
      EditorComponent: MoverPart1Editor,
      validateLocal: part => part.choices.length === 6 && part.targets.length === 5
        ? []
        : [issue('part1', 'Part 1 cần đúng 6 tên và 5 vùng.')],
    },
    {
      part: 2,
      label: 'Part 2',
      EditorComponent: MoverPart2Editor,
      validateLocal: part => part.questions.length === 5
        ? []
        : [issue('part2.questions', 'Part 2 cần đúng 5 câu.')],
    },
    {
      part: 3,
      label: 'Part 3',
      EditorComponent: MoverPart3Editor,
      validateLocal: part => part.displayMode === 'connect-image'
        ? part.answers.length === 7 && part.pictures.length === 6
          ? []
          : [issue('part3', 'Part 3 cần 7 answer và 6 picture.')]
        : part.items.length === 5 && part.options.length >= 5
          ? []
          : [issue('part3', 'Part 3 cần 5 câu và ít nhất 5 lựa chọn.')],
    },
    {
      part: 4,
      label: 'Part 4',
      EditorComponent: MoverPart4Editor,
      validateLocal: part => part.questions.length === 5
        ? []
        : [issue('part4.questions', 'Part 4 cần đúng 5 câu.')],
    },
    {
      part: 5,
      label: 'Part 5',
      EditorComponent: MoverPart5Editor,
      validateLocal: part => part.displayMode === 'scene-colour-draw'
        ? part.colours.length === 20
          && part.questions.length === 5
          && (part.interactionSchemaVersion === 1
            || (part.colourPaletteIds?.length === 6 && part.objectPalette.length === 3))
          ? []
          : [issue('part5', 'Part 5 cần palette 20 màu và đúng 5 câu.')]
        : part.colours.length === 6 && part.targets.length === 5
          ? []
          : [issue('part5', 'Part 5 cần đúng 6 màu và 5 vùng.')],
    },
  ],
};
