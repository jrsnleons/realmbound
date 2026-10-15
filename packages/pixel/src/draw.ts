/**
 * Shaded drawing primitives shared by props, monsters, icons and vfx.
 * Light comes from the top-left.
 */
import { type Color, type PixelImage, blendPixel, createImage, forEllipse, setPixel, getAlpha } from './image';
import { compositeOutlined, type Ramp } from './palette';

/** Picks a ramp tone from a surface normal (nx, ny in -1..1). */
export function litTone(r: Ramp, nx: number, ny: number, bias = 0): Color {
  const l = -(nx * 0.65 + ny * 0.75) + bias;
  if (l > 0.75) return r.hi;
  if (l > 0.3) return r.light;
  if (l > -0.35) return r.base;
  if (l > -0.8) return r.shadow;
  return r.deep;
}

/** Ellipse filled with lit shading. */
export function ball(img: PixelImage, x: number, y: number, w: number, h: number, r: Ramp, bias = 0): void {
  forEllipse(x, y, w, h, (px, py, nx, ny) => setPixel(img, px, py, litTone(r, nx, ny, bias)));
}

/** Box with a lit top-left edge and shaded bottom-right edge. */
export function box(img: PixelImage, x: number, y: number, w: number, h: number, r: Ramp, opts: { top?: Color; edges?: boolean } = {}): void {
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      let c = r.base;
      if (opts.edges !== false) {
        if (xx === 0 || yy === 0) c = r.light;
        if (xx === w - 1 || yy === h - 1) c = r.shadow;
      }
      setPixel(img, x + xx, y + yy, c);
    }
  if (opts.top !== undefined) for (let xx = 0; xx < w; xx++) setPixel(img, x + xx, y, opts.top);
}

export function rect(img: PixelImage, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setPixel(img, x + xx, y + yy, c);
}

/** Soft elliptical ground shadow. */
export function groundShadow(img: PixelImage, cx: number, cy: number, w: number, h: number, alpha = 70): void {
  forEllipse(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h, (px, py) => blendPixel(img, px, py, 0x1f1a2b, alpha));
}

/** Additive-looking glow: blends a colour with radial falloff, skipping opaque pixels unless `over`. */
export function glow(img: PixelImage, cx: number, cy: number, radius: number, c: Color, strength = 120, over = false): void {
  const r = Math.ceil(radius);
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / radius;
      if (d > 1) continue;
      const px = Math.round(cx + x);
      const py = Math.round(cy + y);
      if (!over && getAlpha(img, px, py) > 200) continue;
      // dithered bands keep it pixel-crisp
      const a = Math.round(strength * (1 - d) * (1 - d));
      if (a < 12) continue;
      if (d > 0.6 && (px + py) % 2 === 0) continue;
      blendPixel(img, px, py, c, a);
    }
}

/**
 * Layer helper: draw into a scratch image, then composite it with an
 * automatic dark outline onto `target`.
 */
export function layer(target: PixelImage, draw: (l: PixelImage) => void, soft = 0.5): void {
  const l = createImage(target.width, target.height);
  draw(l);
  compositeOutlined(target, l, soft);
}

/** Plots a thick line of `w` pixels (square brush). */
export function thickLine(img: PixelImage, x0: number, y0: number, x1: number, y1: number, w: number, col: (t: number, i: number) => Color): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) setPixel(img, x + i, y + j, col(t, i));
  }
}
