import type { ListeningSmartImportProviderDefinition } from '../../features/listening-editor/smart-import/types.js';
import type {
  SmartImportImageInput,
  SmartImportVisionOptions,
} from './service.js';

export const STALI_DEFAULT_BASE_URL = 'https://api.stali.vn/v1';
export const STALI_MAX_REQUEST_BYTES = 8 * 1024 * 1024;

interface StaliModelDefinition {
  id: string;
  label: string;
  model: string;
  visionEnabled: boolean;
}

const STALI_MODELS: readonly StaliModelDefinition[] = [
  {
    id: 'stali:gpt-5.6-sol',
    label: 'Stali · ChatGPT 5.6 Sol',
    model: 'gpt-5.6-sol',
    visionEnabled: true,
  },
] as const;

export function getStaliSmartImportProviders(apiKey: string | undefined): ListeningSmartImportProviderDefinition[] {
  const configured = Boolean(apiKey?.trim());
  return STALI_MODELS.map(definition => {
    const enabled = configured && definition.visionEnabled;
    const reason = !definition.visionEnabled
      ? `${definition.label} hiện không hỗ trợ ảnh (Vision) theo tài liệu Stali nên không thể dùng cho Smart Import.`
      : !configured
        ? `${definition.label} chưa được cấu hình STALI_API_KEY trên máy chủ.`
        : undefined;
    return {
      id: definition.id,
      label: definition.label,
      model: definition.model,
      visionEnabled: definition.visionEnabled,
      enabled,
      ...(reason ? { reason } : {}),
    };
  });
}

export function resolveStaliVisionModel(providerId: string): StaliModelDefinition | undefined {
  return STALI_MODELS.find(definition => definition.id === providerId && definition.visionEnabled);
}

export function isStaliProviderId(providerId: string) {
  return STALI_MODELS.some(definition => definition.id === providerId);
}

function normalizeStaliBaseUrl(value: string | undefined) {
  const candidate = String(value || STALI_DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('STALI_BASE_URL không phải URL hợp lệ.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('STALI_BASE_URL phải dùng HTTPS.');
  }
  return candidate;
}

export function extractStaliChatCompletionText(data: any) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(item => typeof item === 'string' ? item : typeof item?.text === 'string' ? item.text : '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

export function buildStaliVisionRequest(
  model: string,
  prompt: string,
  images: SmartImportImageInput[],
  options: SmartImportVisionOptions,
) {
  return {
    model,
    stream: false,
    max_tokens: 16_384,
    messages: [
      {
        role: 'system',
        content: 'Return only one valid JSON value matching the supplied schema. Do not return markdown, prose, UUIDs, database IDs, question IDs, choice IDs, or any invented value.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${prompt}\n\nREQUIRED JSON SCHEMA (${options.schemaName}):\n${JSON.stringify(options.responseJsonSchema)}`,
          },
          ...images.flatMap(image => ([
            { type: 'text' as const, text: `IMAGE ROLE: ${image.role}` },
            {
              type: 'image_url' as const,
              image_url: {
                url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
              },
            },
          ])),
        ],
      },
    ],
  };
}

interface GenerateStaliVisionInput {
  providerId: string;
  prompt: string;
  images: SmartImportImageInput[];
  options: SmartImportVisionOptions;
  signal?: AbortSignal;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function generateWithStaliVision(input: GenerateStaliVisionInput) {
  const definition = resolveStaliVisionModel(input.providerId);
  if (!definition) {
    const error: any = new Error(`Model Stali "${input.providerId}" không hỗ trợ Smart Import bằng ảnh.`);
    error.status = 400;
    throw error;
  }
  const apiKey = input.apiKey?.trim();
  if (!apiKey) return null;

  const requestBody = JSON.stringify(buildStaliVisionRequest(
    definition.model,
    input.prompt,
    input.images,
    input.options,
  ));
  if (Buffer.byteLength(requestBody, 'utf8') > STALI_MAX_REQUEST_BYTES) {
    const error: any = new Error('Tổng ảnh và prompt vượt giới hạn 8 MB của Stali. Hãy nén hoặc cắt gọn ảnh nguồn rồi phân tích lại.');
    error.status = 413;
    throw error;
  }

  const fetchImpl = input.fetchImpl || fetch;
  const response = await fetchImpl(`${normalizeStaliBaseUrl(input.baseUrl)}/chat/completions`, {
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
    const error: any = new Error(errorText.slice(0, 1_000) || `Stali request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const text = extractStaliChatCompletionText(data);
  if (!text) throw new Error('Stali response did not include text output.');
  return {
    text,
    provider: definition.id,
    model: definition.model,
  };
}
