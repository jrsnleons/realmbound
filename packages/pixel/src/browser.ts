/**
 * Thin DOM helpers. Only call these in a browser (they touch `document`);
 * everything else in the package is DOM-free.
 */
import { type PixelImage, scaleImage } from './image';

/** Creates a canvas holding the image (optionally upscaled, nearest-neighbour). */
export function toCanvas(img: PixelImage, scale = 1): HTMLCanvasElement {
  const src = scale === 1 ? img : scaleImage(img, scale);
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  const data = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** PNG data URL for an image (e.g. for <img src> or CSS backgrounds). */
export function toDataURL(img: PixelImage, scale = 1): string {
  return toCanvas(img, scale).toDataURL('image/png');
}

/** Converts to an ImageBitmap (fast to draw on canvases / WebGL textures). */
export function toImageBitmap(img: PixelImage): Promise<ImageBitmap> {
  return createImageBitmap(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height));
}

/** Converts to an ImageData object. */
export function toImageData(img: PixelImage): ImageData {
  return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
}
