'use client';

import { ITEM_BY_ID, TIER_COLOR } from '@realmbound/content';
import { renderIcon, renderItemIcon, toDataURL, type EquipVisual, type IconName } from '@realmbound/pixel';
import { cx } from './primitives';

const urls = new Map<string, string>();

function artFor(itemId: string): string {
  let url = urls.get(itemId);
  if (url) return url;
  const item = ITEM_BY_ID[itemId];
  let img;
  try {
    if (item?.visual) img = renderItemIcon(item.visual as EquipVisual);
    else {
      const icon: IconName = item?.slot === 'consumable' ? 'potion' : item?.slot === 'trinket' ? 'xp_star' : 'chest';
      img = renderIcon(icon);
    }
  } catch {
    img = renderIcon('chest');
  }
  url = toDataURL(img);
  urls.set(itemId, url);
  return url;
}

/** Item tile: tier-tinted rounded square with the item's pixel art. */
export function ItemIcon({ itemId, size = 44, className }: { itemId: string; size?: number; className?: string }) {
  const item = ITEM_BY_ID[itemId];
  const color = item ? TIER_COLOR[item.tier] : 'var(--gray)';
  return (
    <span
      className={cx('relative inline-flex shrink-0 items-center justify-center rounded-[10px]', className)}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 16%, var(--card))`, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 55%, transparent)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={item?.name ?? ''} src={artFor(itemId)} className="pixelated" style={{ width: size * 0.72, height: size * 0.72 }} />
    </span>
  );
}
