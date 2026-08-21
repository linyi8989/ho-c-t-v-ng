import crypto from 'node:crypto';
import type {
  ListeningPdfManifest,
  ListeningPdfManifestPartPages,
  ListeningPdfManifestTest,
} from '../../features/listening-pdf-import/types.js';
import type {
  ListeningSmartImportProviderPreference,
} from '../../features/listening-editor/smart-import/types.js';
import type {
  SmartImportImageInput,
  SmartImportVisionAnalyzer,
} from '../listening-smart-import/service.js';

interface CreateManifestInput {
  bookPageCount: number;
  keyPageCount: number;
  images: SmartImportImageInput[];
  preferredProvider: ListeningSmartImportProviderPreference;
  analyzeVision?: SmartImportVisionAnalyzer;
  signal?: AbortSignal;
}

const manifestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tests: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          testNumber: { type: 'integer', minimum: 1, maximum: 100 },
          title: { type: 'string', maxLength: 160 },
          part1Pages: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1, maxItems: 1 },
          part2Pages: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1, maxItems: 1 },
          part3Pages: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1, maxItems: 1 },
          part4Pages: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 2, maxItems: 2 },
          part5Pages: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1, maxItems: 1 },
          keySummaryPage: { type: 'integer', minimum: 1 },
        },
        required: [
          'testNumber',
          'title',
          'part1Pages',
          'part2Pages',
          'part3Pages',
          'part4Pages',
          'part5Pages',
          'keySummaryPage',
        ],
      },
    },
    warnings: { type: 'array', items: { type: 'string', maxLength: 500 }, maxItems: 30 },
  },
  required: ['tests', 'warnings'],
} satisfies Record<string, unknown>;

const manifestPrompt = (bookPageCount: number, keyPageCount: number) => `
You are mapping a scanned Cambridge Movers listening book to its answer booklet.

The images labelled IMAGE ROLE: question are BOOK header-index sheets. The images labelled
IMAGE ROLE: answer_key are ANSWER-BOOKLET header-index sheets. Every cell visibly includes
its one-based PDF page number. The book has ${bookPageCount} PDF pages and the key has
${keyPageCount} PDF pages.

Return each complete Movers Listening Test that is visibly supported. For every test:
- Part 1, Part 2, Part 3 and Part 5 each use exactly one book PDF page.
- Part 4 uses exactly two consecutive book PDF pages; its continuation page may omit the Part 4 title.
- keySummaryPage is the FIRST answer-booklet PDF page headed "Test N Answers" that contains
  the compact Listening answers/annotated diagrams. Do not include transcript continuation,
  Reading and Writing, Speaking, or vocabulary-list pages.
- Use PDF page labels printed in the contact-sheet cells, never the book's printed footer page.
- Do not infer a missing test or page. If the visible evidence is ambiguous, omit that test and add a warning.
- Keep tests ordered by testNumber and pages in reading order.

Return JSON only using the supplied schema.`.trim();

function parseJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('AI không trả về dữ liệu manifest.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const object = fenced?.[1] || trimmed.match(/(\{[\s\S]*\})/)?.[1];
    if (!object) throw new Error('AI không trả về JSON manifest hợp lệ.');
    return JSON.parse(object.trim());
  }
}

const pageTuple = <TLength extends number>(
  value: unknown,
  length: TLength,
  maximum: number,
  label: string,
) => {
  const pages = Array.isArray(value) ? value.map(Number) : [];
  if (
    pages.length !== length
    || pages.some(page => !Number.isInteger(page) || page < 1 || page > maximum)
    || new Set(pages).size !== pages.length
  ) throw new Error(`${label} không có đúng ${length} trang PDF hợp lệ.`);
  return pages;
};

export function normalizeListeningPdfManifest(
  raw: any,
  bookPageCount: number,
  keyPageCount: number,
): ListeningPdfManifest {
  if (!Number.isInteger(bookPageCount) || bookPageCount < 1 || bookPageCount > 1000) {
    throw new Error('Số trang PDF đề bài không hợp lệ.');
  }
  if (!Number.isInteger(keyPageCount) || keyPageCount < 1 || keyPageCount > 1000) {
    throw new Error('Số trang PDF đáp án không hợp lệ.');
  }
  const rows = Array.isArray(raw?.tests) ? raw.tests : [];
  if (!rows.length || rows.length > 20) throw new Error('Không tìm thấy Test Listening hoàn chỉnh.');
  const seenTests = new Set<number>();
  const tests: ListeningPdfManifestTest[] = rows.map((row: any, index: number) => {
    const testNumber = Number(row?.testNumber);
    if (!Number.isInteger(testNumber) || testNumber < 1 || testNumber > 100 || seenTests.has(testNumber)) {
      throw new Error(`Test tại vị trí ${index + 1} có số thứ tự thiếu hoặc bị trùng.`);
    }
    seenTests.add(testNumber);
    const bookPages: ListeningPdfManifestPartPages = {
      1: pageTuple(row?.part1Pages, 1, bookPageCount, `Test ${testNumber} Part 1`) as [number],
      2: pageTuple(row?.part2Pages, 1, bookPageCount, `Test ${testNumber} Part 2`) as [number],
      3: pageTuple(row?.part3Pages, 1, bookPageCount, `Test ${testNumber} Part 3`) as [number],
      4: pageTuple(row?.part4Pages, 2, bookPageCount, `Test ${testNumber} Part 4`) as [number, number],
      5: pageTuple(row?.part5Pages, 1, bookPageCount, `Test ${testNumber} Part 5`) as [number],
    };
    const orderedBookPages = [
      ...bookPages[1],
      ...bookPages[2],
      ...bookPages[3],
      ...bookPages[4],
      ...bookPages[5],
    ];
    if (bookPages[4][1] !== bookPages[4][0] + 1) {
      throw new Error(`Test ${testNumber} Part 4 phải gồm hai trang liên tiếp.`);
    }
    if (orderedBookPages.some((page, pageIndex) => pageIndex > 0 && page <= orderedBookPages[pageIndex - 1])) {
      throw new Error(`Test ${testNumber} có thứ tự trang Part không hợp lệ.`);
    }
    const keySummaryPage = Number(row?.keySummaryPage);
    if (!Number.isInteger(keySummaryPage) || keySummaryPage < 1 || keySummaryPage > keyPageCount) {
      throw new Error(`Test ${testNumber} có trang tổng hợp đáp án không hợp lệ.`);
    }
    return {
      testNumber,
      title: String(row?.title || `Test ${testNumber}`).normalize('NFKC').trim().slice(0, 160) || `Test ${testNumber}`,
      bookPages,
      keySummaryPage,
    };
  }).sort((left, right) => left.testNumber - right.testNumber);
  const usedBookPages = new Set<number>();
  let previousBookPage = 0;
  tests.forEach(test => {
    const pages = [
      ...test.bookPages[1],
      ...test.bookPages[2],
      ...test.bookPages[3],
      ...test.bookPages[4],
      ...test.bookPages[5],
    ];
    if (pages[0] <= previousBookPage || pages.some(page => usedBookPages.has(page))) {
      throw new Error(`Các trang đề bài của Test ${test.testNumber} bị trùng hoặc sai thứ tự.`);
    }
    pages.forEach(page => usedBookPages.add(page));
    previousBookPage = pages[pages.length - 1];
  });
  if (tests.some((test, index) => index > 0 && test.keySummaryPage <= tests[index - 1].keySummaryPage)) {
    throw new Error('Thứ tự trang tổng hợp đáp án giữa các Test không hợp lệ.');
  }
  return {
    schemaVersion: 1,
    moduleId: 'mover',
    bookPageCount,
    keyPageCount,
    tests,
    warnings: (Array.isArray(raw?.warnings) ? raw.warnings : [])
      .map((value: unknown) => String(value ?? '').normalize('NFKC').trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 30),
  };
}

export async function createListeningPdfManifest(input: CreateManifestInput): Promise<ListeningPdfManifest> {
  if (!input.analyzeVision) {
    const error: any = new Error('Cần cấu hình AI thị giác để nhận diện cấu trúc PDF.');
    error.status = 503;
    throw error;
  }
  const requestId = `lpdf-manifest-${crypto.randomUUID()}`;
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const retryInstruction = attempt === 1
        ? ''
        : `\nThe previous manifest was invalid: ${lastError}. Re-read the visible PDF page labels and return a corrected manifest without guessing.`;
      const result = await input.analyzeVision(
        manifestPrompt(input.bookPageCount, input.keyPageCount) + retryInstruction,
        input.images,
        {
          preferredProvider: input.preferredProvider,
          responseJsonSchema: manifestSchema,
          schemaName: 'listening_pdf_manifest_v1',
          requestId,
          attempt,
        },
        input.signal,
      );
      return normalizeListeningPdfManifest(parseJson(result.text), input.bookPageCount, input.keyPageCount);
    } catch (reason: any) {
      if (input.signal?.aborted || reason?.name === 'AbortError') throw reason;
      lastError = String(reason?.message || reason || 'Manifest không hợp lệ.').slice(0, 300);
      if (attempt === 2) {
        const error: any = new Error('Không thể nhận diện cấu trúc Listening trong hai PDF. Chưa tạo bản nháp.');
        error.status = Number(reason?.status) === 503 ? 503 : 422;
        error.code = 'LISTENING_PDF_MANIFEST_INVALID';
        const providerDetails = Array.isArray(reason?.details)
          ? reason.details.map((value: unknown) => String(value ?? '').trim().slice(0, 300)).filter(Boolean)
          : [];
        error.details = [...new Set([...providerDetails, lastError])];
        throw error;
      }
    }
  }
  throw new Error('Không thể tạo manifest PDF.');
}
