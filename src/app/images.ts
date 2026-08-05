/**
 * Фото уменьшаются до data URL: прототип хранит состояние в localStorage,
 * куда оригинал с телефона не поместится.
 */
const MAX_SIDE = 1024;
const QUALITY = 0.7;

export const MAX_PHOTOS = 3;

export async function readPhotoAsDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось получить canvas 2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALITY);
}
