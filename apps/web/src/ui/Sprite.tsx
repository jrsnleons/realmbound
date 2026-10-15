'use client';

import type { AnimationName, Appearance as PixelAppearance, Condition, Direction } from '@realmbound/pixel';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/feedback';
import { characterSheet } from '@/lib/sprites';

/** Animated pixel hero drawn from the procedural sheet. `scale` is integer pixels per art pixel. */
export function HeroSprite({
  appearance,
  anim = 'idle',
  dir = 'down',
  scale = 4,
  condition = 'normal',
  className,
  once,
  onDone,
}: {
  appearance: PixelAppearance;
  anim?: AnimationName;
  dir?: Direction;
  scale?: number;
  condition?: Condition;
  className?: string;
  /** Play a non-looping animation once, then fall back to idle. */
  once?: boolean;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const key = JSON.stringify(appearance);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const { sheet, canvas: src } = characterSheet(JSON.parse(key) as PixelAppearance, condition);
    const still = reducedMotion();
    let current: AnimationName = anim;
    let frame = 0;
    let last = performance.now();
    let raf = 0;
    const draw = () => {
      const r = sheet.frameRect(current, dir, frame);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    };
    const tick = (t: number) => {
      const info = sheet.animations[current];
      if (t - last >= 1000 / info.fps) {
        last = t;
        frame += 1;
        if (frame >= info.frames) {
          if (once && current !== 'idle') {
            current = 'idle';
            doneRef.current?.();
          }
          frame = 0;
        }
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    draw();
    if (!still) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, anim, dir, condition, once]);

  return <canvas ref={ref} width={24} height={32} className={`pixelated ${className ?? ''}`} style={{ width: 24 * scale, height: 32 * scale }} />;
}
