export type ExamImageProfile =
  | 'default'
  | 'cover'
  | 'split-page'
  | 'illustration'
  | 'page-scan'
  | 'story-scene'
  | 'word-bank'
  | 'interactive-scene'
  | 'option';

export interface ExamImageProfileConfig {
  maxWidth: string;
  maxHeight: string;
}

/**
 * Presentation-only image limits shared by the exam players. These values are
 * deliberately independent from uploaded pixel dimensions and are not stored
 * in an exam draft or immutable published version.
 */
export const EXAM_IMAGE_PROFILES = {
  default: {
    maxWidth: '100%',
    maxHeight: 'min(68dvh, 720px)',
  },
  cover: {
    maxWidth: '640px',
    maxHeight: 'min(38dvh, 320px)',
  },
  'split-page': {
    maxWidth: '540px',
    maxHeight: 'min(60dvh, 600px, max(180px, calc(100dvh - 330px)))',
  },
  illustration: {
    maxWidth: '520px',
    maxHeight: 'min(52dvh, 500px, max(160px, calc(100dvh - 330px)))',
  },
  'page-scan': {
    maxWidth: '540px',
    maxHeight: 'min(60dvh, 600px, max(180px, calc(100dvh - 330px)))',
  },
  'story-scene': {
    maxWidth: '520px',
    maxHeight: 'min(50dvh, 460px, max(160px, calc(100dvh - 330px)))',
  },
  'word-bank': {
    maxWidth: '520px',
    maxHeight: 'min(34dvh, 280px)',
  },
  'interactive-scene': {
    maxWidth: '760px',
    maxHeight: 'min(62dvh, 620px, max(220px, calc(100dvh - 390px)))',
  },
  option: {
    maxWidth: '112px',
    maxHeight: 'clamp(88px, 11dvh, 112px)',
  },
} as const satisfies Record<ExamImageProfile, ExamImageProfileConfig>;

export function getExamImageProfile(profile: ExamImageProfile = 'default'): ExamImageProfileConfig {
  return EXAM_IMAGE_PROFILES[profile];
}
