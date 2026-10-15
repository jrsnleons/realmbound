'use client';

import type { MonsterId } from '@realmbound/content';
import { renderMonster } from '@realmbound/pixel';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/feedback';
import { toCanvas } from '@/lib/sprites';

const cache = new Map<MonsterId, { canvas: HTMLCanvasElement; frames: { x: number; y: number; w: number; h: number }[]; fps: number; w: number; h: number }>();

function monster(id: MonsterId) {
  let m = cache.get(id);
  if (!m) {
    const r = renderMonster(id);
    m = { canvas: toCanvas(r.sheet.image), frames: r.sheet.frames, fps: r.fps, w: r.frameWidth, h: r.frameHeight };
    cache.set(id, m);
  }
  return m;
}

/** Animated pixel monster, scaled to fit `size` CSS pixels at an integer scale. */
export function MonsterArt({ id, size = 80, defeated }: { id: MonsterId; size?: number; defeated?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const m = monster(id);
  const scale = Math.max(1, Math.floor(size / Math.max(m.w, m.h)));
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    let i = 0;
    const draw = () => {
      const f = m.frames[i % m.frames.length]!;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(m.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    };
    draw();
    if (reducedMotion() || defeated || m.frames.length < 2) return;
    const t = setInterval(() => {
      i += 1;
      draw();
    }, 1000 / m.fps);
    return () => clearInterval(t);
  }, [m, defeated]);
  return (
    <canvas
      ref={ref}
      width={m.w}
      height={m.h}
      role="img"
      aria-label={id.replace('_', ' ')}
      className="pixelated"
      style={{ width: m.w * scale, height: m.h * scale, filter: defeated ? 'grayscale(1) opacity(0.6)' : undefined }}
    />
  );
}
