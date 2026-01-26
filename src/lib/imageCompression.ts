export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  let image: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      image = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = objectUrl!;
      });
    }

    const originalWidth = image instanceof ImageBitmap ? image.width : image.naturalWidth;
    const originalHeight = image instanceof ImageBitmap ? image.height : image.naturalHeight;
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
    const targetWidth = Math.round(originalWidth * ratio);
    const targetHeight = Math.round(originalHeight * ratio);

    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(targetWidth, targetHeight)
        : document.createElement('canvas');

    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Erro ao processar imagem');
    }

    ctx.drawImage(image as CanvasImageSource, 0, 0, targetWidth, targetHeight);

    let blob: Blob | null = null;
    if ('convertToBlob' in canvas) {
      blob = await (canvas as OffscreenCanvas).convertToBlob({
        type: 'image/jpeg',
        quality
      });
    } else {
      blob = await new Promise<Blob | null>((resolve) =>
        (canvas as HTMLCanvasElement).toBlob(resolve, 'image/jpeg', quality)
      );
    }

    if (!blob) {
      throw new Error('Erro ao processar imagem');
    }

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: blob.type, lastModified: Date.now() });
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    if (image && 'close' in image) {
      image.close();
    }
  }
}
