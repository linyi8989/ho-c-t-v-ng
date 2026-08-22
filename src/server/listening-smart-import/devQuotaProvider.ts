import type { ListeningSmartImportProviderDefinition } from '../../features/listening-editor/smart-import/types.js';
import type {
  SmartImportImageInput,
  SmartImportVisionOptions,
} from './service.js';

export const DEVQUOTA_PROVIDER_ID = 'devquota:gpt-5.6-sol';
export const DEVQUOTA_MODEL = 'gpt-5.6-sol';
export const DEVQUOTA_DEFAULT_BASE_URL = 'https://sv.devquote.shop/v1';
export const DEVQUOTA_MAX_REQUEST_BYTES = 42 * 1024 * 1024;

export function getDevQuotaSmartImportProviders(apiKey: string | undefined): ListeningSmartImportProviderDefinition[] {
  const enabled = Boolean(apiKey?.trim());
  return [{
    id: DEVQUOTA_PROVIDER_ID,
    label: 'DevQuota · ChatGPT 5.6 Sol',
    model: DEVQUOTA_MODEL,
    visionEnabled: true,
    enabled,
    ...(!enabled ? { reason: 'DevQuota · ChatGPT 5.6 Sol chưa được cấu hình DEVQUOTA_API_KEY trên máy chủ.' } : {}),
  }];
}

export function isDevQuotaProviderId(providerId: string) {
  return providerId === DEVQUOTA_PROVIDER_ID;
}

function normalizeDevQuotaBaseUrl(value: string | undefined) {
  const candidate = String(value || DEVQUOTA_DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('DEVQUOTA_BASE_URL không phải URL hợp lệ.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('DEVQUOTA_BASE_URL phải dùng HTTPS.');
  }
  return candidate;
}

export function extractDevQuotaResponseText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

export function buildDevQuotaVisionRequest(
  prompt: string,
  images: SmartImportImageInput<string>[],
  options: SmartImportVisionOptions,
) {
  return {
    model: DEVQUOTA_MODEL,
    instructions: 'Return only one valid JSON value matching the supplied schema. Do not return markdown, prose, UUIDs, database IDs, question IDs, choice IDs, or any invented value.',
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `${prompt}\n\nREQUIRED JSON SCHEMA (${options.schemaName}):\n${JSON.stringify(options.responseJsonSchema)}`,
        },
        ...images.flatMap(image => ([
          { type: 'input_text' as const, text: `IMAGE ROLE: ${image.role}` },
          {
            type: 'input_image' as const,
            image_url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
            detail: 'high' as const,
          },
        ])),
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: options.schemaName,
        schema: options.responseJsonSchema,
        strict: false,
      },
    },
    max_output_tokens: 16_384,
  };
}

interface GenerateDevQuotaVisionInput {
  providerId: string;
  prompt: string;
  images: SmartImportImageInput<string>[];
  options: SmartImportVisionOptions;
  signal?: AbortSignal;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function generateWithDevQuotaVision(input: GenerateDevQuotaVisionInput) {
  if (!isDevQuotaProviderId(input.providerId)) {
    const error: any = new Error(`Model DevQuota "${input.providerId}" không hỗ trợ Smart Import bằng ảnh.`);
    error.status = 400;
    throw error;
  }
  const apiKey = input.apiKey?.trim();
  if (!apiKey) return null;

  const requestBody = JSON.stringify(buildDevQuotaVisionRequest(input.prompt, input.images, input.options));
  if (Buffer.byteLength(requestBody, 'utf8') > DEVQUOTA_MAX_REQUEST_BYTES) {
    const error: any = new Error('Tổng ảnh và prompt vượt giới hạn request an toàn 42 MB của adapter DevQuota. Hãy nén hoặc cắt gọn ảnh nguồn rồi phân tích lại.');
    error.status = 413;
    throw error;
  }

  const fetchImpl = input.fetchImpl || fetch;
  const response = await fetchImpl(`${normalizeDevQuotaBaseUrl(input.baseUrl)}/responses`, {
    method: 'POST',
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: requestBody,
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error: any = new Error(errorText.slice(0, 1_000) || `DevQuota request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const text = extractDevQuotaResponseText(data);
  if (!text) throw new Error('DevQuota response did not include text output.');
  return {
    text,
    provider: DEVQUOTA_PROVIDER_ID,
    model: DEVQUOTA_MODEL,
  };
}
