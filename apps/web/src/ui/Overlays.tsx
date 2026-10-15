'use client';

import { ACHIEVEMENTS, BOSSES, ITEM_BY_ID, STAT_INFO, TIER_COLOR } from '@realmbound/content';
import type { FeedItem } from '@realmbound/game-engine';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic, reducedMotion, sfx } from '@/lib/feedback';
import { conditionOf, pixelAppearance } from '@/lib/sprites';
import { useGame } from '@/state/game';
import { Icon } from './icons';
import { ItemIcon } from './ItemIcon';
import { Button, cx } from './primitives';
import { HeroSprite } from './Sprite';

export function Toasts() {
  const { toasts } = useGame();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx('animate-pop flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-subhead font-medium shadow-lg material', t.tone === 'error' && 'text-ired')}
        >
          {t.tone === 'success' && <Icon.Check size={16} strokeWidth={3} className="text-igreen" />}
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

const MODAL_KINDS = new Set<FeedItem['kind']>(['levelUp', 'loot', 'bossDefeated', 'graduation']);

/** Plays queued feed items: big moments as modals, the rest as notification banners. */
export function Celebrations() {
  const { notices, dismissNotice } = useGame();
  const current = notices[0];
  if (!current) return null;
  return MODAL_KINDS.has(current.kind) ? <Moment key={JSON.stringify(current)} item={current} onDone={dismissNotice} /> : <Banner key={JSON.stringify(current)} item={current} onDone={dismissNotice} />;
}

function bannerContent(item: FeedItem): { icon: React.ReactNode; title: string; body: string; color: string } | null {
  switch (item.kind) {
    case 'questComplete':
      return { icon: <Icon.Scroll size={18} />, title: 'Quest complete', body: item.title, color: 'var(--orange)' };
    case 'achievement': {
      const a = ACHIEVEMENTS.find((x) => x.id === item.id);
      return { icon: <Icon.Trophy size={18} />, title: 'Achievement unlocked', body: a ? `${a.name} · ${a.description}` : item.id, color: 'var(--yellow)' };
    }
    case 'skillUp':
      return { icon: <Icon.Sparkles size={18} />, title: `${STAT_INFO[item.stat].name} ${item.level}`, body: `Your ${STAT_INFO[item.stat].name.toLowerCase()} grew stronger.`, color: STAT_INFO[item.stat].color };
    case 'observation':
      return { icon: <Icon.Eye size={18} />, title: 'Seer Liora noticed', body: item.text, color: 'var(--purple)' };
    case 'condition': {
      const names = { fatigue: 'Fatigue', tempted: 'Tempted', fallen: 'Fallen' } as const;
      return item.on
        ? { icon: <Icon.Moon size={18} />, title: names[item.condition], body: item.condition === 'fallen' ? 'A Recovery quest is waiting. One small win lifts it.' : 'Take it easy. A small win today helps.', color: 'var(--gray)' }
        : { icon: <Icon.Heart size={18} />, title: `${names[item.condition]} lifted`, body: 'You feel like yourself again.', color: 'var(--green)' };
    }
    case 'world':
      return {
        icon: <Icon.Map size={18} />,
        title: item.state === 'thriving' ? 'Riverstone is thriving' : item.state === 'struggling' ? 'Clouds over Riverstone' : 'Riverstone settles',
        body: item.state === 'thriving' ? 'Your momentum lit up the town.' : item.state === 'struggling' ? 'The town follows your rhythm. It will brighten again.' : 'Things are calm in town.',
        color: item.state === 'thriving' ? 'var(--green)' : item.state === 'struggling' ? 'var(--indigo)' : 'var(--teal)',
      };
    case 'chronicle':
      return { icon: <Icon.Book size={18} />, title: 'Chronicle updated', body: item.label, color: 'var(--brown)' };
    default:
      return null;
  }
}

function Banner({ item, onDone }: { item: FeedItem; onDone: () => void }) {
  const [shown, setShown] = useState(false);
  const content = bannerContent(item);
  useEffect(() => {
    if (!content) {
      onDone();
      return;
    }
    sfx.soft();
    const a = requestAnimationFrame(() => setShown(true));
    const b = setTimeout(() => setShown(false), 3200);
    const c = setTimeout(onDone, 3550);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(b);
      clearTimeout(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!content || typeof document === 'undefined') return null;
  return createPortal(
    <button
      onClick={() => {
        setShown(false);
        setTimeout(onDone, 300);
      }}
      className="fixed inset-x-2 z-[65] mx-auto flex max-w-md items-center gap-3 rounded-[22px] p-3 pr-4 text-left shadow-xl material"
      style={{
        top: 'calc(env(safe-area-inset-top) + 8px)',
        transform: shown ? 'translateY(0)' : 'translateY(-140%)',
        transition: 'transform 450ms var(--ease-spring)',
      }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-white" style={{ background: content.color }}>
        {content.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-subhead font-semibold">{content.title}</span>
        <span className="block line-clamp-2 text-footnote text-label2">{content.body}</span>
      </span>
    </button>,
    document.body,
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: reducedMotion() ? 0 : 42 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.4,
        dx: (Math.random() - 0.5) * 160,
        color: ['var(--yellow)', 'var(--pink)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--orange)'][i % 6],
        w: 6 + Math.random() * 5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 0.6,
            background: p.color,
            borderRadius: 2,
            animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.2,.6,.4,1) both`,
            ['--dx' as string]: `${p.dx}px`,
          }}
        />
      ))}
    </div>
  );
}

function Moment({ item, onDone }: { item: FeedItem; onDone: () => void }) {
  const { view, call } = useGame();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    haptic('success');
    if (item.kind === 'loot') sfx.loot();
    else sfx.levelUp();
  }, [item.kind]);
  if (!view || typeof document === 'undefined') return null;
  const look = pixelAppearance(view.state.appearance, view.state.equipment);

  let title = '';
  let body = '';
  let art: React.ReactNode = <HeroSprite appearance={look} anim="celebrate" scale={5} condition={conditionOf(view.state)} />;
  let accent = 'var(--tint)';
  let action: React.ReactNode = null;

  if (item.kind === 'levelUp') {
    title = `Level ${item.level}`;
    body = 'You grew stronger. Your hero feels it too.';
    accent = 'var(--xp)';
  } else if (item.kind === 'graduation') {
    title = 'Initiation complete';
    body = 'The Guild welcomes you as a true Adventurer. Your quests now fit your real rhythm.';
    accent = 'var(--orange)';
  } else if (item.kind === 'bossDefeated') {
    const boss = BOSSES.find((b) => b.id === item.id);
    title = `${boss?.name ?? 'Boss'} defeated`;
    body = 'Your week of real effort won the fight. Spoils are in your bag.';
    accent = 'var(--red)';
  } else if (item.kind === 'loot') {
    const def = ITEM_BY_ID[item.itemId];
    accent = def && def.tier !== 'common' ? TIER_COLOR[def.tier] : 'var(--tint)';
    title = def?.name ?? 'Loot';
    body = def ? `${def.tier[0]!.toUpperCase()}${def.tier.slice(1)} · ${def.description}` : '';
    art = (
      <div className="animate-float" style={{ filter: `drop-shadow(0 0 18px ${accent})` }}>
        <ItemIcon itemId={item.itemId} size={96} />
      </div>
    );
    if (def && def.slot !== 'consumable' && view.state.equipment[def.slot] !== def.id) {
      action = (
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await call('equip', { itemId: def.id }, { idempotent: true });
            setBusy(false);
            onDone();
          }}
          className="w-full"
          color={accent}
        >
          Equip now
        </Button>
      );
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-6" role="dialog" aria-modal="true" aria-label={title}>
      <Confetti />
      <div className="animate-pop relative w-full max-w-sm overflow-hidden rounded-[28px] bg-elevated p-6 text-center shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-40 opacity-25" style={{ background: `radial-gradient(circle at 50% 0%, ${accent}, transparent 70%)` }} />
        <div className="relative mx-auto mb-4 flex h-44 items-end justify-center">{art}</div>
        <div className="relative font-rounded text-caption font-bold uppercase tracking-widest" style={{ color: accent }}>
          {item.kind === 'loot' ? 'New loot' : item.kind === 'levelUp' ? 'Level up' : item.kind === 'graduation' ? 'Day 15' : 'Victory'}
        </div>
        <div className="relative mt-1 font-rounded text-title1">{title}</div>
        <p className="relative mt-2 text-subhead text-label2">{body}</p>
        <div className="relative mt-6 flex flex-col gap-2">
          {action}
          <Button variant={action ? 'plain' : 'filled'} onClick={onDone} className="w-full" color={action ? undefined : accent}>
            {action ? 'Later' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
