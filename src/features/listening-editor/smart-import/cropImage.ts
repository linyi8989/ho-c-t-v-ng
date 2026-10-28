import type { SmartImportCrop } from './types';

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Không thể đọc ảnh nguồn để crop.'));
  image.src = url;
});

/** Decode the source once for a batch; crops keep original image resolution. */
export async function createListeningImageCropper(imageUrl: string) {
  const image = await loadImage(imageUrl);
  return async (crop: SmartImportCrop, fileName: string) => {
    const sourceX = Math.round(crop.x * image.naturalWidth);
    const sourceY = Math.round(crop.y * image.naturalHeight);
    const sourceWidth = Math.max(1, Math.round(crop.width * image.naturalWidth));
    const sourceHeight = Math.max(1, Math.round(crop.height * image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ crop ảnh.');
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('Không thể tạo ảnh crop.')),
      'image/png'
    ));
    return new File([blob], fileName, { type: 'image/png' });
  };
}

export async function cropListeningImage(imageUrl: string, crop: SmartImportCrop, fileName: string) {
  return (await createListeningImageCropper(imageUrl))(crop, fileName);
}
