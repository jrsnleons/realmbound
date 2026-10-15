import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type PixelImage, scaleImage, createImage, blit, fillRect } from '../src/image';

export function savePng(img: PixelImage, path: string, scale = 4, bg?: number): void {
  let src = img;
  if (bg !== undefined) {
    src = createImage(img.width, img.height);
    fillRect(src, 0, 0, img.width, img.height, bg);
    blit(src, img, 0, 0);
  }
  const s = scale === 1 ? src : scaleImage(src, scale);
  const png = new PNG({ width: s.width, height: s.height });
  png.data = Buffer.from(s.data.buffer, s.data.byteOffset, s.data.byteLength);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

/** Lays images out in a grid with padding on a background colour. */
export function grid(rows: PixelImage[][], pad = 2, bg = 0x8fbf6a): PixelImage {
  const cw = Math.max(...rows.flat().map((i) => i.width));
  const ch = Math.max(...rows.flat().map((i) => i.height));
  const cols = Math.max(...rows.map((r) => r.length));
  const out = createImage(cols * (cw + pad) + pad, rows.length * (ch + pad) + pad);
  fillRect(out, 0, 0, out.width, out.height, bg);
  rows.forEach((r, ri) =>
    r.forEach((img, ci) => blit(out, img, pad + ci * (cw + pad) + Math.floor((cw - img.width) / 2), pad + ri * (ch + pad) + (ch - img.height))),
  );
  return out;
}
