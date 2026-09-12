export async function convertToWebP(
  file: File,
  quality = 0.82
): Promise<File> {
  const image = new Image();

  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not load image.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not create image canvas.');
    }

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    ctx.drawImage(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', quality);
    });

    if (!blob) {
      throw new Error('Could not convert image to WebP.');
    }

    const fileName =
      file.name.replace(/\.[^/.]+$/, '') + '.webp';

    return new File([blob], fileName, {
      type: 'image/webp',
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}