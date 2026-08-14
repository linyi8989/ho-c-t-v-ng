export type ListeningVisibility = 'draft' | 'public' | 'assignment';
export type ListeningSetStatus = 'draft' | 'published' | 'archived';
export type ListeningAssetKind = 'image' | 'audio';
export type ListeningRegionShape = 'rect' | 'ellipse' | 'polygon';

export interface ListeningAsset {
  id: string;
  ownerId: string;
  kind: ListeningAssetKind;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  derivedFromAssetId?: string;
  crop?: { x: number; y: number; width: number; height: number };
  storageKey: string;
  url: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ListeningRegion {
  shape: ListeningRegionShape;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Array<{ x: number; y: number }>;
}

export interface ListeningPartBase {
  schemaVersion?: 1;
  part: 1 | 2 | 3 | 4 | 5;
  title: string;
  instruction: string;
  audioAssetId: string;
  audioUrl?: string;
}

export interface ListeningChoice {
  id: string;
  label: string;
}

export interface ListeningPart1Target {
  id: string;
  choiceId: string;
  region: ListeningRegion;
}

export interface ListeningPart1 extends ListeningPartBase {
  part: 1;
  sceneAssetId: string;
  sceneUrl?: string;
  choices: ListeningChoice[];
  targets: ListeningPart1Target[];
  example?: ListeningPart1Target & { label?: string };
}

export interface ListeningTextBlank {
  id: string;
  acceptedAnswers: string[];
}

export interface ListeningPart2Question {
  id: string;
  prompt: string;
  blanks: ListeningTextBlank[];
}

export interface ListeningPart2 extends ListeningPartBase {
  part: 2;
  heading: string;
  illustrationAssetId?: string;
  illustrationUrl?: string;
  exampleText?: string;
  questions: ListeningPart2Question[];
}

export interface ListeningImageOption {
  id: string;
  label: string;
  imageAssetId: string;
  imageUrl?: string;
}

export interface ListeningPart3Item {
  id: string;
  label: string;
  imageAssetId: string;
  imageUrl?: string;
  correctOptionId: string;
}

export interface ListeningPart3Legacy extends ListeningPartBase {
  part: 3;
  displayMode?: 'split' | 'composite';
  boardAssetId?: string;
  boardUrl?: string;
  reuseMode: 'once' | 'multiple';
  options: ListeningImageOption[];
  items: ListeningPart3Item[];
  example?: { item: Omit<ListeningPart3Item, 'correctOptionId'>; correctOptionId: string };
}

export type ListeningConnectionSide = 'left' | 'right';

export interface ListeningPart3ConnectAnswer {
  id: string;
  label: string;
  region: ListeningRegion;
  leftAnchorOffset: number;
  rightAnchorOffset: number;
}

export interface ListeningPart3ConnectPicture {
  id: string;
  label: string;
  side: ListeningConnectionSide;
  row: 1 | 2 | 3;
  region: ListeningRegion;
  anchorOffset: number;
}

export interface ListeningPart3Connection {
  answerId: string;
  pictureId: string;
}

export interface ListeningPart3ConnectImage extends ListeningPartBase {
  part: 3;
  displayMode: 'connect-image';
  connectionSchemaVersion: 1;
  boardAssetId: string;
  boardUrl?: string;
  answers: ListeningPart3ConnectAnswer[];
  pictures: ListeningPart3ConnectPicture[];
  exampleConnection: ListeningPart3Connection & { renderOverlayLine: boolean };
  correctConnections: ListeningPart3Connection[];
  distractorAnswerId: string;
}

export type ListeningPart3 = ListeningPart3Legacy | ListeningPart3ConnectImage;

export interface ListeningPart4Option {
  id: string;
  imageAssetId: string;
  imageUrl?: string;
  alt: string;
}

export interface ListeningPart4Question {
  id: string;
  prompt: string;
  options: ListeningPart4Option[];
  correctOptionId: string;
}

export interface ListeningPart4 extends ListeningPartBase {
  part: 4;
  questions: ListeningPart4Question[];
  example?: ListeningPart4Question;
}

export interface ListeningColour {
  id: string;
  label: string;
  value: string;
}

export interface ListeningPart5Target {
  id: string;
  label: string;
  correctColourId: string;
  region: ListeningRegion;
}

export interface ListeningPart5Legacy extends ListeningPartBase {
  part: 5;
  displayMode?: 'legacy-colour-regions';
  sceneAssetId: string;
  sceneUrl?: string;
  colours: ListeningColour[];
  targets: ListeningPart5Target[];
  example?: ListeningPart5Target;
}

export interface ListeningPart5InteractiveObject {
  id: string;
  label: string;
  geometry: ListeningRegion;
  interactionKinds: ['colour'];
  /** Required by schema v2 before publish; AI/import placeholders are never trusted geometry. */
  geometryConfirmedByTeacher?: boolean;
}

export interface ListeningPart5PaletteItem {
  id: string;
  objectType: string;
  label: string;
  colourId?: string;
  tokenAssetId?: string;
  tokenUrl?: string;
}

export interface ListeningPart5ColourAction {
  id: string;
  type: 'colour_object';
  correctObjectId: string;
  correctColourId: string;
}

export interface ListeningPart5PlaceAction {
  id: string;
  type: 'place_object';
  correctPaletteItemId: string;
  targetRegion: ListeningRegion;
  relationLabel?: string;
  /** Required by schema v2 before publish; the private drop-zone is teacher-authored. */
  geometryConfirmedByTeacher?: boolean;
}

export type ListeningPart5Action = ListeningPart5ColourAction | ListeningPart5PlaceAction;

export interface ListeningPart5Question {
  id: string;
  questionNumber: 1 | 2 | 3 | 4 | 5;
  staffPrompt: string;
  actions: ListeningPart5Action[];
}

export interface ListeningPart5SceneColourDraw extends ListeningPartBase {
  part: 5;
  displayMode: 'scene-colour-draw';
  interactionSchemaVersion: 1 | 2;
  sceneAssetId: string;
  sceneUrl?: string;
  colours: ListeningColour[];
  /** Schema v2 student palette: five working colours plus one distractor. */
  colourPaletteIds?: string[];
  interactiveObjects: ListeningPart5InteractiveObject[];
  objectPalette: ListeningPart5PaletteItem[];
  questions: ListeningPart5Question[];
}

export type ListeningPart5 = ListeningPart5Legacy | ListeningPart5SceneColourDraw;

export type ListeningPart =
  | ListeningPart1
  | ListeningPart2
  | ListeningPart3
  | ListeningPart4
  | ListeningPart5;

export interface ListeningSetContent {
  moduleId?: 'mover';
  schemaVersion: 1;
  title: string;
  description: string;
  level: string;
  coverAssetId?: string;
  coverUrl?: string;
  backgroundAssetId?: string;
  backgroundUrl?: string;
  timeLimitMinutes?: number;
  parts: [ListeningPart1, ListeningPart2, ListeningPart3, ListeningPart4, ListeningPart5];
}

export interface ListeningSetSummary {
  id: string;
  moduleId?: 'mover';
  schemaVersion?: 1;
  moduleSchemaVersion?: 1;
  ownerId: string;
  title: string;
  description: string;
  level: string;
  status: ListeningSetStatus;
  visibility: ListeningVisibility;
  shareToken?: string;
  publishedVersionId?: string;
  publishedVersionNumber?: number;
  coverUrl?: string;
  backgroundUrl?: string;
  timeLimitMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListeningSetVersion {
  id: string;
  moduleId?: 'mover';
  schemaVersion?: 1;
  setId: string;
  versionNumber: number;
  status: 'draft' | 'published' | 'superseded';
  content: ListeningSetContent;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ListeningPlayableSet extends ListeningSetSummary {
  versionId: string;
  versionNumber: number;
  content: ListeningSetContent;
}

export interface ListeningAnswers {
  part1: Record<string, string>;
  part2: Record<string, Record<string, string>>;
  part3: Record<string, string>;
  part4: Record<string, string>;
  part5: Record<string, ListeningPart5Answer>;
}

export interface ListeningPart5ColourAnswer {
  type: 'colour_object';
  objectId: string;
  colourId: string;
}

export interface ListeningPart5PlaceAnswer {
  type: 'place_object';
  paletteItemId: string;
  anchor: { x: number; y: number };
}

export type ListeningPart5Answer = string | ListeningPart5ColourAnswer | ListeningPart5PlaceAnswer;

export interface ListeningAttemptTicket {
  ticket: string;
  moduleId?: 'mover';
  schemaVersion?: 1;
  setId: string;
  versionId: string;
  ownerKey: string;
  assignmentId?: string;
  startedAt: string;
  expiresAt?: string;
  clientRunId: string;
}

export interface ListeningQuestionResult {
  part: 1 | 2 | 3 | 4 | 5;
  questionId: string;
  correct: boolean;
  unanswered: boolean;
}

export interface ListeningGradeResult {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: 25;
  questions: ListeningQuestionResult[];
}

export interface ListeningCompletedAttempt {
  id: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: number;
  completedAt?: string;
  idempotentReplay?: boolean;
}

export interface ListeningAttemptReviewAnswer {
  questionIndex: number;
  part: 1 | 2 | 3 | 4 | 5;
  questionText: string;
  selectedAnswer: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  unanswered: boolean;
  options: string[];
}

export type ListeningVisualReviewState = 'correct' | 'incorrect' | 'unanswered';

export interface ListeningVisualReviewBaseItem {
  questionIndex: number;
  state: ListeningVisualReviewState;
  userAnswer: string;
  correctAnswer: string;
}

export interface ListeningVisualReviewPicture {
  label: string;
  side: ListeningConnectionSide;
  row: 1 | 2 | 3;
  region: ListeningRegion;
  anchorOffset: number;
}

export interface ListeningVisualReviewOption {
  label: string;
  alt: string;
  imageUrl?: string;
}

export interface ListeningVisualReviewColour {
  label: string;
  value: string;
}

export interface ListeningVisualReviewPaletteItem {
  label: string;
  tokenUrl?: string;
}

export type ListeningVisualReviewPart =
  | {
      part: 1;
      mode: 'scene-targets';
      imageUrl?: string;
      items: Array<ListeningVisualReviewBaseItem & { region: ListeningRegion }>;
    }
  | {
      part: 2;
      mode: 'text-questions';
      imageUrl?: string;
      heading: string;
      exampleText?: string;
      items: Array<ListeningVisualReviewBaseItem & { prompt: string }>;
    }
  | {
      part: 3;
      mode: 'connect-image';
      imageUrl?: string;
      items: Array<ListeningVisualReviewBaseItem & {
        answerLabel: string;
        answerRegion: ListeningRegion;
        leftAnchorOffset: number;
        rightAnchorOffset: number;
        userPicture?: ListeningVisualReviewPicture;
        correctPicture: ListeningVisualReviewPicture;
      }>;
    }
  | {
      part: 3;
      mode: 'image-options';
      imageUrl?: string;
      items: Array<ListeningVisualReviewBaseItem & {
        prompt: string;
        options: ListeningVisualReviewOption[];
        selectedOptionIndex: number;
        correctOptionIndex: number;
      }>;
    }
  | {
      part: 4;
      mode: 'image-options';
      items: Array<ListeningVisualReviewBaseItem & {
        prompt: string;
        options: ListeningVisualReviewOption[];
        selectedOptionIndex: number;
        correctOptionIndex: number;
      }>;
    }
  | {
      part: 5;
      mode: 'scene-colour';
      imageUrl?: string;
      items: Array<ListeningVisualReviewBaseItem & {
        region: ListeningRegion;
        userColour?: ListeningVisualReviewColour;
        correctColour: ListeningVisualReviewColour;
      }>;
    }
  | {
      part: 5;
      mode: 'scene-colour-draw';
      imageUrl?: string;
      items: Array<ListeningVisualReviewBaseItem & {
        prompt: string;
        actions: Array<
          | {
              type: 'colour';
              state: ListeningVisualReviewState;
              region: ListeningRegion;
              userColour?: ListeningVisualReviewColour;
              correctColour: ListeningVisualReviewColour;
            }
          | {
              type: 'place';
              state: ListeningVisualReviewState;
              userAnchor?: { x: number; y: number };
              correctAnchor: { x: number; y: number };
              userItem?: ListeningVisualReviewPaletteItem;
              correctItem: ListeningVisualReviewPaletteItem;
            }
        >;
      }>;
    };

export interface ListeningVisualReviewSnapshot {
  schemaVersion: 2;
  parts: ListeningVisualReviewPart[];
}

export interface ListeningAttemptReview {
  attemptId: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: number;
  answerDetails: ListeningAttemptReviewAnswer[];
  visualReview?: ListeningVisualReviewSnapshot;
}

export const createEmptyListeningAnswers = (): ListeningAnswers => ({
  part1: {},
  part2: {},
  part3: {},
  part4: {},
  part5: {},
});
