import type { MoverReadingWritingPart } from '../types';

export type MoverReadingWritingSmartImportPartId = 1 | 2 | 3 | 4 | 5 | 6;

export type MoverReadingWritingSmartImportSourceRole =
  | 'word_bank'
  | 'scene'
  | 'questions'
  | 'story'
  | 'scene_1'
  | 'scene_2'
  | 'scene_3'
  | 'passage'
  | 'options'
  | 'answer_key';

export type MoverReadingWritingSmartImportProviderPreference =
  | 'stali:gpt-5.6-sol'
  | 'devquota:gpt-5.6-sol'
  | (string & {});

export interface MoverReadingWritingSmartImportProviderDefinition {
  id: string;
  label: string;
  enabled: boolean;
  model?: string;
  visionEnabled?: boolean;
  reason?: string;
}

export interface MoverReadingWritingSmartImportRoleDefinition {
  role: MoverReadingWritingSmartImportSourceRole;
  label: string;
  required: boolean;
  source: 'asset' | 'transient';
  help: string;
}

export function getMoverReadingWritingSmartImportRoleDefinitions(
  part: MoverReadingWritingSmartImportPartId,
): MoverReadingWritingSmartImportRoleDefinition[] {
  if (part === 1) return [
    { role: 'word_bank', label: 'Ảnh ngân hàng từ', required: true, source: 'asset', help: 'Ảnh học sinh sẽ nhìn thấy ở bên trái.' },
    { role: 'questions', label: 'Ảnh 6 câu hỏi', required: true, source: 'transient', help: 'Trang chứa sáu câu cần nhập.' },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true, source: 'transient', help: 'Nguồn đáp án chính thức, không dùng AI tự giải.' },
  ];
  if (part === 2) return [
    { role: 'scene', label: 'Ảnh tình huống/ví dụ', required: true, source: 'asset', help: 'Ảnh học sinh sẽ nhìn thấy ở bên trái.' },
    { role: 'questions', label: 'Ảnh 6 nhận định', required: true, source: 'transient', help: 'Trang chứa sáu nhận định Yes/No.' },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true, source: 'transient', help: 'Nguồn đáp án Yes/No chính thức.' },
  ];
  if (part === 3) return [
    { role: 'scene', label: 'Ảnh hội thoại/ví dụ', required: true, source: 'asset', help: 'Ảnh học sinh sẽ nhìn thấy ở bên trái.' },
    { role: 'questions', label: 'Ảnh các câu hội thoại', required: true, source: 'transient', help: 'Trang chứa đủ sáu câu và lựa chọn A/B/C.' },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true, source: 'transient', help: 'Nguồn đáp án A/B/C chính thức.' },
  ];
  if (part === 4) return [
    { role: 'word_bank', label: 'Ảnh ngân hàng từ', required: true, source: 'asset', help: 'Ảnh học sinh sẽ nhìn thấy ở bên trái.' },
    { role: 'story', label: 'Ảnh bài đọc và câu 7', required: true, source: 'transient', help: 'Trang chứa truyện, sáu chỗ trống và câu chọn tiêu đề.' },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true, source: 'transient', help: 'Nguồn đáp án sáu chỗ trống và câu 7.' },
  ];
  if (part === 5) return [
    { role: 'scene_1', label: 'Trang/tranh 1', required: true, source: 'asset', help: 'Dùng trực tiếp làm ảnh học sinh nhìn thấy và làm nguồn OCR.' },
    { role: 'scene_2', label: 'Trang/tranh 2', required: true, source: 'asset', help: 'Dùng trực tiếp làm ảnh học sinh nhìn thấy và làm nguồn OCR.' },
    { role: 'scene_3', label: 'Trang/tranh 3', required: true, source: 'asset', help: 'Dùng trực tiếp làm ảnh học sinh nhìn thấy và làm nguồn OCR.' },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true, source: 'transient', help: 'Nguồn đáp án chính thức cho đủ mười câu.' },
  ];
  return [
    { role: 'passage', label: 'Ảnh nguồn bài đọc', required: true, source: 'asset', help: 'Nguồn OCR và nguồn để crop ảnh bài đọc hiển thị cho học sinh.' },
    { role: 'options', label: 'Ảnh bảng lựa chọn', required: true, source: 'asset', help: 'Dùng trực tiếp làm ngân hàng từ để học sinh nhìn và tự viết vào chỗ trống.' },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true, source: 'transient', help: 'Đọc nguyên văn từ đúng theo số câu; không quy đổi sang A/B/C.' },
  ];
}

export interface MoverReadingWritingSmartImportRequestSource {
  role: MoverReadingWritingSmartImportSourceRole;
  assetId?: string;
  transientToken?: string;
}

export interface MoverReadingWritingSmartImportRequest {
  moduleId: 'mover';
  paperId: 'reading-writing';
  part: MoverReadingWritingSmartImportPartId;
  sources: MoverReadingWritingSmartImportRequestSource[];
  currentPart: MoverReadingWritingPart;
  basePartHash: string;
  preferredProvider: MoverReadingWritingSmartImportProviderPreference;
}

export interface MoverReadingWritingImportExample {
  prompt: string;
  answer: string;
}

export interface MoverReadingWritingImportTextQuestion {
  questionNumber: number;
  promptTemplate: string;
  acceptedAnswers: string[];
}

export interface MoverReadingWritingImportTextGap {
  gapNumber: number;
  acceptedAnswers: string[];
}

export interface MoverReadingWritingImportChoiceQuestion {
  questionNumber: number;
  prompt: string;
  promptSpeaker?: string;
  answerSpeaker?: string;
  options: [string, string, string];
  correctOption?: 'A' | 'B' | 'C';
}

export type MoverReadingWritingSmartImportData =
  | {
      part: 1;
      title?: string;
      instruction?: string;
      example?: MoverReadingWritingImportExample;
      questions: MoverReadingWritingImportTextQuestion[];
    }
  | {
      part: 2;
      title?: string;
      instruction?: string;
      examples: Array<{ prompt: string; answer?: 'yes' | 'no' }>;
      questions: Array<{ questionNumber: number; statement: string; correctAnswer?: 'yes' | 'no' }>;
    }
  | {
      part: 3;
      title?: string;
      instruction?: string;
      example?: Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'>;
      questions: MoverReadingWritingImportChoiceQuestion[];
    }
  | {
      part: 4;
      title?: string;
      instruction?: string;
      storyTemplate: string;
      example?: MoverReadingWritingImportExample;
      gaps: Array<{ gapNumber: number; acceptedAnswers: string[] }>;
      titleQuestion: Omit<MoverReadingWritingImportChoiceQuestion, 'questionNumber'>;
    }
  | {
      part: 5;
      title?: string;
      instruction?: string;
      example?: MoverReadingWritingImportExample;
      scenes: Array<{
        sceneNumber: number;
        passage: string;
        questions: MoverReadingWritingImportTextQuestion[];
      }>;
    }
  | {
      part: 6;
      title?: string;
      instruction?: string;
      passageTitle: string;
      passageTemplate: string;
      example?: MoverReadingWritingImportExample;
      gaps: MoverReadingWritingImportTextGap[];
    };

export interface MoverReadingWritingSmartImportCandidate {
  id: string;
  moduleId: 'mover';
  paperId: 'reading-writing';
  part: MoverReadingWritingSmartImportPartId;
  basePartHash: string;
  provider: string;
  warnings: string[];
  createdAt: string;
  data: MoverReadingWritingSmartImportData;
}

export interface MoverReadingWritingSmartImportCapability {
  enabled: boolean;
  visionEnabled: boolean;
  reason?: string;
  providers: MoverReadingWritingSmartImportProviderDefinition[];
}

export interface MoverReadingWritingTransientSource {
  token: string;
  expiresAt: number;
}
