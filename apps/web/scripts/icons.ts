// Generates the PWA icons from the procedural hero sprite (no image files to maintain).
import { writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { DEFAULT_APPEARANCE, renderAvatarPortrait, type Appearance } from '@realmbound/pixel';

const look: Appearance = { ...DEFAULT_APPEARANCE, equipment: { head: 'forest_scout_head', chest: 'forest_scout_chest', weapon: 'forest_scout_weapon' } };
const hero = renderAvatarPortrait(look, 'energized');
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

function icon(size: number, file: string, padding: number) {
  const png = new PNG({ width: size, height: size });
  const top = [94, 92, 230];
  const bottom = [175, 82, 222];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = y / size;
      const i = (y * size + x) * 4;
      png.data[i] = Math.round(top[0]! + (bottom[0]! - top[0]!) * t);
      png.data[i + 1] = Math.round(top[1]! + (bottom[1]! - top[1]!) * t);
      png.data[i + 2] = Math.round(top[2]! + (bottom[2]! - top[2]!) * t);
      png.data[i + 3] = 255;
    }
  // Soft ground ellipse.
  const cx = size / 2;
  const gy = size * (0.5 + (1 - padding * 2) * 0.38);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = ((x - cx) / (size * 0.22)) ** 2 + ((y - gy) / (size * 0.05)) ** 2;
      if (d < 1) {
        const i = (y * size + x) * 4;
        for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(png.data[i + c]! * 0.75);
      }
    }
  const scale = Math.floor((size * (1 - padding * 2)) / hero.height);
  const ox = Math.round((size - hero.width * scale) / 2);
  const oy = Math.round((size - hero.height * scale) / 2);
  for (let y = 0; y < hero.height; y++)
    for (let x = 0; x < hero.width; x++) {
      const si = (y * hero.width + x) * 4;
      const a = hero.data[si + 3]! / 255;
      if (!a) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const di = ((oy + y * scale + dy) * size + ox + x * scale + dx) * 4;
          for (let c = 0; c < 3; c++) png.data[di + c] = Math.round(hero.data[si + c]! * a + png.data[di + c]! * (1 - a));
        }
    }
  writeFileSync(new URL(file, out), PNG.sync.write(png));
}

icon(192, 'icon-192.png', 0.12);
icon(512, 'icon-512.png', 0.12);
icon(512, 'icon-maskable-512.png', 0.2);
icon(180, 'apple-touch-icon.png', 0.12);
console.log('icons written');
