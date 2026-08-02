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

export interface ListeningPart3 extends ListeningPartBase {
  part: 3;
  displayMode?: 'split' | 'composite';
  boardAssetId?: string;
  boardUrl?: string;
  reuseMode: 'once' | 'multiple';
  options: ListeningImageOption[];
  items: ListeningPart3Item[];
  example?: { item: Omit<ListeningPart3Item, 'correctOptionId'>; correctOptionId: string };
}

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

export interface ListeningPart5 extends ListeningPartBase {
  part: 5;
  sceneAssetId: string;
  sceneUrl?: string;
  colours: ListeningColour[];
  targets: ListeningPart5Target[];
  example?: ListeningPart5Target;
}

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
  part5: Record<string, string>;
}

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

export const createEmptyListeningAnswers = (): ListeningAnswers => ({
  part1: {},
  part2: {},
  part3: {},
  part4: {},
  part5: {},
});
