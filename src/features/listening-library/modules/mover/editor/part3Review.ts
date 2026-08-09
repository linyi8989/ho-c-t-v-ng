import { isValidListeningRegion } from '../../../../listening/geometry';
import type { ListeningSmartImportData } from '../../../../listening-editor/smart-import/types';

export type Part3ImportData = Extract<ListeningSmartImportData, { part: 3 }>;
export type Part3PictureSlot = { pictureSide: 'left' | 'right'; pictureRow: 1 | 2 | 3 };

const comparable = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en');
const slotKey = (side: 'left' | 'right', row: 1 | 2 | 3) => `${side}:${row}`;

export function part3PicturePositionLabel(side: 'left' | 'right', row: 1 | 2 | 3) {
  const vertical = row === 1 ? 'Trên' : row === 2 ? 'Giữa' : 'Dưới';
  return `${vertical} bên ${side === 'left' ? 'trái' : 'phải'}`;
}

export function comparePart3PictureSlots(first: Part3PictureSlot, second: Part3PictureSlot) {
  if (first.pictureRow !== second.pictureRow) return first.pictureRow - second.pictureRow;
  return first.pictureSide === second.pictureSide ? 0 : first.pictureSide === 'left' ? -1 : 1;
}

export function validatePart3ImportData(data: Part3ImportData) {
  const issues: string[] = [];
  const answerLabels = data.answers.map(answer => comparable(answer.label)).filter(Boolean);
  const pictureSlots = data.pictures.map(picture => slotKey(picture.side, picture.row));
  const expectedSlots = new Set(['left:1', 'right:1', 'left:2', 'right:2', 'left:3', 'right:3']);

  if (data.answers.length !== 7 || answerLabels.length !== 7 || new Set(answerLabels).size !== 7) {
    issues.push('Cần đúng 7 đáp án có nhãn duy nhất.');
  }
  if (data.answers.some(answer => !isValidListeningRegion(answer.region))) {
    issues.push('Có vùng đáp án chưa hợp lệ.');
  }
  if (data.pictures.length !== 6 || new Set(pictureSlots).size !== 6 || pictureSlots.some(slot => !expectedSlots.has(slot))) {
    issues.push('Cần đủ 6 hình ở ba hàng bên trái và ba hàng bên phải.');
  }
  if (data.pictures.some(picture => !isValidListeningRegion(picture.region))) {
    issues.push('Có vùng hình chưa hợp lệ.');
  }

  const exampleLabel = comparable(data.example?.answerLabel || '');
  const exampleSlot = data.example ? slotKey(data.example.pictureSide, data.example.pictureRow) : '';
  if (!data.example || !answerLabels.includes(exampleLabel) || !pictureSlots.includes(exampleSlot)) {
    issues.push('Example chưa tham chiếu đúng một đáp án và một hình.');
  }

  const connectionLabels = data.connections.map(connection => comparable(connection.answerLabel));
  const connectionSlots = data.connections.map(connection => slotKey(connection.pictureSide, connection.pictureRow));
  if (
    data.connections.length !== 5
    || new Set(connectionLabels).size !== 5
    || new Set(connectionSlots).size !== 5
    || connectionLabels.some(label => !answerLabels.includes(label))
    || connectionSlots.some(slot => !pictureSlots.includes(slot))
    || connectionLabels.includes(exampleLabel)
    || connectionSlots.includes(exampleSlot)
  ) {
    issues.push('Cần đúng 5 mapping duy nhất và không được dùng lại example.');
  }

  const usedLabels = new Set([exampleLabel, ...connectionLabels]);
  const unusedLabels = answerLabels.filter(label => !usedLabels.has(label));
  const distractorLabel = comparable(data.distractorLabel || '');
  if (unusedLabels.length !== 1 || unusedLabels[0] !== distractorLabel) {
    issues.push('Cần đúng một đáp án nhiễu được suy ra từ phần còn lại.');
  }
  return issues;
}
