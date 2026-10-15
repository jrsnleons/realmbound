/**
 * Minimal RGBA raster toolkit. Everything in this package draws into
 * `PixelImage` buffers so it runs identically in Node and the browser.
 *
 * Colours are packed `0xRRGGBB` numbers (always opaque); alpha is passed
 * separately where translucency is needed.
 */

export interface PixelImage {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel (same layout as ImageData). */
  data: Uint8ClampedArray;
}

/** Packed 0xRRGGBB colour. */
export type Color = number;

export function createImage(width: number, height: number): PixelImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneImage(img: PixelImage): PixelImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

export function clearImage(img: PixelImage): void {
  img.data.fill(0);
}

export function inBounds(img: PixelImage, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < img.width && y < img.height;
}

/** Overwrites a pixel (no blending). */
export function setPixel(img: PixelImage, x: number, y: number, color: Color, alpha = 255): void {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const d = img.data;
  d[i] = (color >> 16) & 255;
  d[i + 1] = (color >> 8) & 255;
  d[i + 2] = color & 255;
  d[i + 3] = alpha;
}

/** Source-over blends a colour onto a pixel. */
export function blendPixel(img: PixelImage, x: number, y: number, color: Color, alpha: number): void {
  x |= 0;
  y |= 0;
  if (alpha <= 0 || x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  if (alpha >= 255) {
    setPixel(img, x, y, color, 255);
    return;
  }
  const i = (y * img.width + x) * 4;
  const d = img.data;
  const sa = alpha / 255;
  const da = (d[i + 3] ?? 0) / 255;
  const oa = sa + da * (1 - sa);
  const sr = (color >> 16) & 255;
  const sg = (color >> 8) & 255;
  const sb = color & 255;
  d[i] = Math.round((sr * sa + (d[i] ?? 0) * da * (1 - sa)) / oa);
  d[i + 1] = Math.round((sg * sa + (d[i + 1] ?? 0) * da * (1 - sa)) / oa);
  d[i + 2] = Math.round((sb * sa + (d[i + 2] ?? 0) * da * (1 - sa)) / oa);
  d[i + 3] = Math.round(oa * 255);
}

export function getAlpha(img: PixelImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  return img.data[(y * img.width + x) * 4 + 3] ?? 0;
}

export function getColor(img: PixelImage, x: number, y: number): Color {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return ((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0);
}

export function fillRect(img: PixelImage, x: number, y: number, w: number, h: number, color: Color, alpha = 255): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (alpha >= 255) setPixel(img, xx, yy, color);
      else blendPixel(img, xx, yy, color, alpha);
    }
  }
}

export function hline(img: PixelImage, x0: number, x1: number, y: number, color: Color, alpha = 255): void {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  fillRect(img, a, y, b - a + 1, 1, color, alpha);
}

export function vline(img: PixelImage, x: number, y0: number, y1: number, color: Color, alpha = 255): void {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  fillRect(img, x, a, 1, b - a + 1, color, alpha);
}

/** Bresenham line; `plot` defaults to setPixel. */
export function drawLine(
  img: PixelImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Color,
  alpha = 255,
): void {
  forLine(x0, y0, x1, y1, (x, y) => (alpha >= 255 ? setPixel(img, x, y, color) : blendPixel(img, x, y, color, alpha)));
}

export function forLine(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, i: number) => void): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let i = 0;
  for (;;) {
    fn(x0, y0, i++);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/**
 * Fills an axis-aligned ellipse covering the box [x, x+w) × [y, y+h).
 * Using a box (rather than centre+radius) keeps even sizes symmetric.
 */
export function fillEllipse(img: PixelImage, x: number, y: number, w: number, h: number, color: Color, alpha = 255): void {
  forEllipse(x, y, w, h, (px, py) => (alpha >= 255 ? setPixel(img, px, py, color) : blendPixel(img, px, py, color, alpha)));
}

export function forEllipse(x: number, y: number, w: number, h: number, fn: (x: number, y: number, nx: number, ny: number) => void): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const nx = (px + 0.5 - cx) / rx;
      const ny = (py + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1.0) fn(px, py, nx, ny);
    }
  }
}

export interface BlitOptions {
  flipX?: boolean;
  /** Global opacity multiplier 0..255. */
  alpha?: number;
  /** Source rectangle (defaults to entire source). */
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
}

/** Alpha-composites `src` onto `dst` with its top-left at (dx, dy). */
export function blit(dst: PixelImage, src: PixelImage, dx: number, dy: number, opts: BlitOptions = {}): void {
  const sx0 = opts.sx ?? 0;
  const sy0 = opts.sy ?? 0;
  const sw = opts.sw ?? src.width;
  const sh = opts.sh ?? src.height;
  const ga = opts.alpha ?? 255;
  const s = src.data;
  for (let y = 0; y < sh; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < sw; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const srcX = opts.flipX ? sx0 + sw - 1 - x : sx0 + x;
      const i = ((sy0 + y) * src.width + srcX) * 4;
      const a = s[i + 3] ?? 0;
      if (a === 0) continue;
      const col = ((s[i] ?? 0) << 16) | ((s[i + 1] ?? 0) << 8) | (s[i + 2] ?? 0);
      const fa = ga >= 255 ? a : Math.round((a * ga) / 255);
      blendPixel(dst, tx, ty, col, fa);
    }
  }
}

export function flipX(img: PixelImage): PixelImage {
  const out = createImage(img.width, img.height);
  blit(out, img, 0, 0, { flipX: true });
  return out;
}

export function flipY(img: PixelImage): PixelImage {
  const out = createImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const srcRow = (img.height - 1 - y) * img.width * 4;
    out.data.set(img.data.subarray(srcRow, srcRow + img.width * 4), y * img.width * 4);
  }
  return out;
}

/** Rotates 90° clockwise. */
export function rotate90(img: PixelImage): PixelImage {
  const out = createImage(img.height, img.width);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const si = (y * img.width + x) * 4;
      const nx = img.height - 1 - y;
      const ny = x;
      const di = (ny * out.width + nx) * 4;
      out.data[di] = img.data[si] ?? 0;
      out.data[di + 1] = img.data[si + 1] ?? 0;
      out.data[di + 2] = img.data[si + 2] ?? 0;
      out.data[di + 3] = img.data[si + 3] ?? 0;
    }
  }
  return out;
}

/** Copies a rectangular region into a new image. */
export function crop(img: PixelImage, x: number, y: number, w: number, h: number): PixelImage {
  const out = createImage(w, h);
  blit(out, img, 0, 0, { sx: x, sy: y, sw: w, sh: h });
  return out;
}

/** Nearest-neighbour upscale. */
export function scaleImage(img: PixelImage, factor: number): PixelImage {
  const out = createImage(img.width * factor, img.height * factor);
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < out.width; x++) {
      const sx = Math.floor(x / factor);
      const si = (sy * img.width + sx) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = img.data[si] ?? 0;
      out.data[di + 1] = img.data[si + 1] ?? 0;
      out.data[di + 2] = img.data[si + 2] ?? 0;
      out.data[di + 3] = img.data[si + 3] ?? 0;
    }
  }
  return out;
}

export function isEmpty(img: PixelImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) if ((img.data[i] ?? 0) !== 0) return false;
  return true;
}

export function countOpaque(img: PixelImage): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if ((img.data[i] ?? 0) > 0) n++;
  return n;
}

/**
 * Draws an ASCII template. Each character is looked up in `key`; characters
 * not in the key (and '.' / ' ') are transparent.
 */
export function drawTemplate(
  img: PixelImage,
  rows: readonly string[],
  x: number,
  y: number,
  key: Readonly<Record<string, Color | undefined>>,
  opts: { flipX?: boolean; alpha?: number } = {},
): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? '';
    const w = row.length;
    for (let c = 0; c < w; c++) {
      const ch = row[c] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const col = key[ch];
      if (col === undefined) continue;
      const px = opts.flipX ? x + (w - 1 - c) : x + c;
      if (opts.alpha !== undefined && opts.alpha < 255) blendPixel(img, px, y + r, col, opts.alpha);
      else setPixel(img, px, y + r, col);
    }
  }
}

/** Scales the alpha of every pixel. */
export function multiplyAlpha(img: PixelImage, factor: number): void {
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.round((img.data[i] ?? 0) * factor);
}

/** Recolours every opaque pixel through `fn`. */
export function mapColors(img: PixelImage, fn: (c: Color, x: number, y: number) => Color): void {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if ((img.data[i + 3] ?? 0) === 0) continue;
      const c = fn(getColor(img, x, y), x, y);
      img.data[i] = (c >> 16) & 255;
      img.data[i + 1] = (c >> 8) & 255;
      img.data[i + 2] = c & 255;
    }
  }
}
