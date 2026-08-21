import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfModulePromise: Promise<typeof import('pdfjs-dist')> | undefined;

const getPdfModule = async () => {
  pdfModulePromise ||= import('pdfjs-dist').then(module => {
    module.GlobalWorkerOptions.workerSrc = workerUrl;
    return module;
  });
  return pdfModulePromise;
};

const canvasBlob = (canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9) => (
  new Promise<Blob>((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Không thể tạo ảnh từ trang PDF.')),
    type,
    quality,
  ))
);

async function renderPageCanvas(document: PDFDocumentProxy, pageNumber: number, targetWidth: number) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) {
    throw new Error(`Trang PDF ${pageNumber} không tồn tại.`);
  }
  const page = await document.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Trình duyệt không hỗ trợ render PDF.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

export async function openListeningPdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error(`"${file.name}" không phải file PDF.`);
  }
  const module = await getPdfModule();
  return module.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

export async function renderListeningPdfPages(
  document: PDFDocumentProxy,
  pageNumbers: number[],
  fileName: string,
  targetWidth = 1240,
) {
  if (!pageNumbers.length) throw new Error('Chưa chọn trang PDF để xử lý.');
  const pages: HTMLCanvasElement[] = [];
  try {
    for (const pageNumber of pageNumbers) pages.push(await renderPageCanvas(document, pageNumber, targetWidth));
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.max(...pages.map(page => page.width));
    canvas.height = pages.reduce((height, page) => height + page.height, 0);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Trình duyệt không hỗ trợ ghép trang PDF.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let y = 0;
    pages.forEach(page => {
      context.drawImage(page, 0, y);
      y += page.height;
    });
    const blob = await canvasBlob(canvas);
    canvas.width = 1;
    canvas.height = 1;
    return new File([blob], fileName, { type: 'image/jpeg' });
  } finally {
    pages.forEach(page => {
      page.width = 1;
      page.height = 1;
    });
  }
}

export async function createListeningPdfHeaderSheets(
  document: PDFDocumentProxy,
  prefix: 'book' | 'key',
) {
  const chunkSize = 20;
  const columns = 4;
  const cellWidth = 340;
  const cellHeight = 194;
  const headerHeight = 34;
  const files: File[] = [];
  for (let start = 1; start <= document.numPages; start += chunkSize) {
    const end = Math.min(document.numPages, start + chunkSize - 1);
    const pageNumbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const rows = Math.ceil(pageNumbers.length / columns);
    const sheet = window.document.createElement('canvas');
    sheet.width = columns * cellWidth;
    sheet.height = headerHeight + rows * cellHeight;
    const context = sheet.getContext('2d', { alpha: false });
    if (!context) throw new Error('Trình duyệt không hỗ trợ tạo ảnh mục lục PDF.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, sheet.width, sheet.height);
    context.fillStyle = '#0f172a';
    context.font = 'bold 20px sans-serif';
    context.fillText(`${prefix === 'book' ? 'BOOK' : 'ANSWER KEY'} · PDF pages ${start}–${end}`, 12, 24);
    for (let index = 0; index < pageNumbers.length; index += 1) {
      const pageNumber = pageNumbers[index];
      const thumbnail = await renderPageCanvas(document, pageNumber, 320);
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * cellWidth + 10;
      const y = headerHeight + row * cellHeight;
      context.strokeStyle = '#94a3b8';
      context.strokeRect(x - 1, y + 2, 322, cellHeight - 8);
      context.fillStyle = '#1d4ed8';
      context.fillRect(x, y + 3, 320, 25);
      context.fillStyle = '#ffffff';
      context.font = 'bold 16px sans-serif';
      context.fillText(`PDF page ${pageNumber}`, x + 8, y + 21);
      const visibleHeight = Math.min(thumbnail.height, cellHeight - 38);
      context.drawImage(thumbnail, 0, 0, thumbnail.width, visibleHeight, x, y + 30, 320, visibleHeight);
      thumbnail.width = 1;
      thumbnail.height = 1;
    }
    const blob = await canvasBlob(sheet, 'image/jpeg', 0.84);
    files.push(new File([blob], `${prefix}-pages-${start}-${end}.jpg`, { type: 'image/jpeg' }));
    sheet.width = 1;
    sheet.height = 1;
  }
  return files;
}

export function assignListeningPdfFiles(files: File[]) {
  if (files.length !== 2) throw new Error('Vui lòng chọn đúng 2 file PDF: đề bài và đáp án.');
  const keyMatch = files.find(file => /(?:^|[\s_.-])(key|answer|answers|đáp.?án)(?:[\s_.-]|$)/i.test(file.name));
  const book = keyMatch ? files.find(file => file !== keyMatch)! : files[0];
  const key = keyMatch || files[1];
  return { book, key };
}

export type ListeningPdfDocument = PDFDocumentProxy;

