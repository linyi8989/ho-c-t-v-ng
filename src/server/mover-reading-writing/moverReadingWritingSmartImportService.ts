import crypto from 'node:crypto';
import {
  moverReadingWritingExternalHelp,
  moverReadingWritingExternalTemplate,
  moverReadingWritingImportResponseSchema,
  moverReadingWritingImportSchemaName,
  validateAndNormalizeMoverReadingWritingImport,
} from '../../features/mover-reading-writing/smart-import/contracts.js';
import type {
  MoverReadingWritingSmartImportSourceRole,
  MoverReadingWritingSmartImportCandidate,
  MoverReadingWritingSmartImportPartId,
  MoverReadingWritingSmartImportProviderPreference,
} from '../../features/mover-reading-writing/smart-import/types.js';
import type {
  SmartImportImageInput,
  SmartImportVisionAnalyzer,
} from '../listening-smart-import/service.js';

interface CreateCandidateInput {
  part: MoverReadingWritingSmartImportPartId;
  basePartHash: string;
  images: SmartImportImageInput<MoverReadingWritingSmartImportSourceRole>[];
  preferredProvider: MoverReadingWritingSmartImportProviderPreference;
  analyzeVision: SmartImportVisionAnalyzer<MoverReadingWritingSmartImportSourceRole>;
  signal?: AbortSignal;
}

const parseJson = (source: string) => {
  const trimmed = source.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() || trimmed;
  return JSON.parse(fenced);
};

function promptForPart(part: MoverReadingWritingSmartImportPartId) {
  return [
    `Extract Cambridge Movers Reading & Writing Part ${part} from the role-labelled images.`,
    'The answer_key image is the only authority for correct answers. Never solve the exercise and never infer a missing answer.',
    'Read question/order/text from the question, scene, story, passage or options roles. Preserve spelling, punctuation and printed numbering.',
    'If text is unreadable use an empty string or empty acceptedAnswers array. If a correct answer is unreadable use "unknown".',
    'Do not output UUIDs, database IDs, question IDs, choice IDs, option IDs or gap IDs.',
    moverReadingWritingExternalHelp[part],
    'Return exactly one JSON value using this structural example:',
    moverReadingWritingExternalTemplate(part),
  ].join('\n\n');
}

function boundedProviderDetails(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || 'Provider response không hợp lệ.');
  return message.replace(/(?:sk|key|token)[-_a-z0-9]{8,}/gi, '[redacted]').slice(0, 500);
}

function providerRequestError(reason: any) {
  const status = Number(reason?.status);
  const details = (Array.isArray(reason?.details) ? reason.details : [])
    .map((detail: unknown) => boundedProviderDetails(detail))
    .filter(Boolean)
    .slice(0, 4);
  const error: any = new Error(boundedProviderDetails(reason));
  error.status = status >= 400 && status <= 599 ? status : 502;
  if (details.length) error.details = details;
  if (typeof reason?.code === 'string') error.code = reason.code.slice(0, 80);
  return error;
}

export async function createMoverReadingWritingSmartImportCandidate(
  input: CreateCandidateInput,
): Promise<MoverReadingWritingSmartImportCandidate> {
  const requestId = crypto.randomUUID();
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const correction = attempt === 1 ? '' : [
      '',
      'Your previous response failed runtime validation.',
      `Validation error: ${lastError}`,
      'Return a corrected complete JSON value only. Do not explain the correction.',
    ].join('\n');
    let result;
    try {
      result = await input.analyzeVision(
        `${promptForPart(input.part)}${correction}`,
        input.images,
        {
          preferredProvider: input.preferredProvider,
          responseJsonSchema: moverReadingWritingImportResponseSchema(input.part),
          schemaName: moverReadingWritingImportSchemaName(input.part),
          requestId,
          attempt,
        },
        input.signal,
      );
    } catch (reason: any) {
      if (reason?.name === 'AbortError' || input.signal?.aborted) throw reason;
      // Correction is useful only when returned text fails the runtime schema.
      // Transport/auth/quota/provider failures keep their real sanitized cause.
      throw providerRequestError(reason);
    }
    try {
      const normalized = validateAndNormalizeMoverReadingWritingImport(input.part, parseJson(result.text));
      const providerWarnings = Array.isArray(result.errors)
        ? result.errors.map(error => String(error).slice(0, 300)).filter(Boolean)
        : [];
      return {
        id: `mrw-import-${crypto.randomUUID()}`,
        moduleId: 'mover',
        paperId: 'reading-writing',
        part: input.part,
        basePartHash: input.basePartHash,
        provider: result.provider,
        warnings: [
          ...normalized.warnings,
          ...providerWarnings,
          ...(attempt > 1 ? ['Nhà cung cấp đã trả cấu trúc hợp lệ sau một lần sửa JSON tự động.'] : []),
        ],
        createdAt: new Date().toISOString(),
        data: normalized.data,
      };
    } catch (reason: any) {
      if (reason?.name === 'AbortError' || input.signal?.aborted) throw reason;
      lastError = boundedProviderDetails(reason);
      if (attempt === 2) {
        const error: any = new Error('AI chưa trả dữ liệu Reading & Writing đúng cấu trúc sau một lần sửa. Bản nháp chưa bị thay đổi.');
        error.status = 502;
        error.details = [lastError];
        throw error;
      }
    }
  }
  throw new Error('Không thể tạo dữ liệu Smart Import.');
}
