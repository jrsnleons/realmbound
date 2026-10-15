/**
 * Sprite sheet packing. Frames are laid out on a uniform grid (cell size =
 * largest frame), row-major. Frame `i` lives at column `i % columns`, row
 * `floor(i / columns)`. Smaller frames are bottom-centred in their cell so
 * feet-anchored sprites line up.
 */
import { type PixelImage, blit, createImage } from './image';

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
}

export interface SpriteSheet {
  image: PixelImage;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  /** Rect of each frame in `image`, in frame-index order. */
  frames: FrameRect[];
}

export interface PackOptions {
  columns?: number;
  names?: string[];
  /** Pixels of transparent padding between cells (default 0). */
  padding?: number;
}

export function packSheet(images: readonly PixelImage[], opts: PackOptions = {}): SpriteSheet {
  const n = images.length;
  const columns = Math.max(1, Math.min(opts.columns ?? n, n || 1));
  const rows = Math.max(1, Math.ceil(n / columns));
  const pad = opts.padding ?? 0;
  const fw = Math.max(1, ...images.map((i) => i.width));
  const fh = Math.max(1, ...images.map((i) => i.height));
  const image = createImage(columns * (fw + pad), rows * (fh + pad));
  const frames: FrameRect[] = images.map((img, i) => {
    const cx = (i % columns) * (fw + pad);
    const cy = Math.floor(i / columns) * (fh + pad);
    const x = cx + Math.floor((fw - img.width) / 2);
    const y = cy + (fh - img.height);
    blit(image, img, x, y);
    const r: FrameRect = { x, y, w: img.width, h: img.height };
    const name = opts.names?.[i];
    if (name !== undefined) r.name = name;
    return r;
  });
  return { image, frameWidth: fw, frameHeight: fh, columns, rows, frames };
}

/** Index of a frame on a uniform grid sheet. */
export function gridFrameIndex(columns: number, row: number, col: number): number {
  return row * columns + col;
}
