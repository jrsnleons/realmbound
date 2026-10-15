'use client';

import { ACHIEVEMENTS, ITEM_BY_ID, ITEMS, MATERIAL_INFO, MATERIALS, RECIPES, STAT_INFO, STATS, TIER_COLOR, type ItemDef, type Slot } from '@realmbound/content';
import { archetypeOf, describeProfile, skillXpToNext } from '@realmbound/game-engine';
import { useMemo, useState } from 'react';
import { haptic, sfx } from '@/lib/feedback';
import { prettyDate } from '@/lib/game';
import { conditionOf, pixelAppearance, portraitUrl } from '@/lib/sprites';
import { useGame, useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { ItemIcon } from '@/ui/ItemIcon';
import { Button, Chip, cx, Empty, NavButton, ProgressBar, Row, Screen, Section, Segmented, Sheet } from '@/ui/primitives';
import { HeroSprite } from '@/ui/Sprite';
import { SettingsSheet } from './Settings';

type Pane = 'stats' | 'bag' | 'shop' | 'forge' | 'feats' | 'story';
const SLOTS: { slot: Slot; label: string }[] = [
  { slot: 'head', label: 'Head' },
  { slot: 'chest', label: 'Chest' },
  { slot: 'weapon', label: 'Weapon' },
  { slot: 'back', label: 'Back' },
  { slot: 'trinket', label: 'Trinket' },
];

function effectText(item: ItemDef): string {
  const e = item.effects;
  const parts: string[] = [];
  if (e.xpPct) parts.push(`+${e.xpPct}% XP`);
  if (e.goldPct) parts.push(`+${e.goldPct}% gold`);
  if (e.lootPct) parts.push(`+${e.lootPct}% loot`);
  if (e.materialBonus) parts.push(`+${e.materialBonus} material`);
  if (e.stat) parts.push(`+${e.stat.pct}% ${STAT_INFO[e.stat.stat].name}`);
  return parts.join(' · ') || 'Cosmetic';
}

export function HeroScreen() {
  const { state, player } = useView();
  const [pane, setPane] = useState<Pane>('stats');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [settings, setSettings] = useState(false);
  const [titles, setTitles] = useState(false);
  const look = useMemo(() => pixelAppearance(state.appearance, state.equipment), [state.appearance, state.equipment]);
  const archetype = archetypeOf(state);

  return (
    <Screen
      title="Hero"
      trailing={
        <NavButton label="Settings" onClick={() => setSettings(true)}>
          <Icon.Gear size={23} />
        </NavButton>
      }
    >
      <div className="mb-6 overflow-hidden rounded-[20px] bg-card" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="relative flex items-center justify-center gap-4 px-3 pb-3 pt-5" style={{ background: 'radial-gradient(circle at 50% 70%, color-mix(in srgb, var(--tint) 18%, transparent), transparent 65%)' }}>
          <div className="flex flex-col gap-2">
            {SLOTS.slice(0, 3).map((s) => (
              <SlotButton key={s.slot} slot={s.slot} label={s.label} onClick={() => setSlot(s.slot)} />
            ))}
          </div>
          <div className="relative flex h-52 w-36 items-end justify-center">
            <HeroSprite appearance={look} scale={6} condition={conditionOf(state)} />
          </div>
          <div className="flex flex-col gap-2">
            {SLOTS.slice(3).map((s) => (
              <SlotButton key={s.slot} slot={s.slot} label={s.label} onClick={() => setSlot(s.slot)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-4 text-center">
          <div className="font-rounded text-title2">{player.username}</div>
          <button onClick={() => setTitles(true)} className="pressable mt-0.5 inline-flex items-center gap-1 text-subhead text-tint">
            {state.activeTitle ?? 'Choose a title'}
            <Icon.ChevronDown size={14} strokeWidth={2.6} />
          </button>
          <div className="mt-1 text-footnote text-label2">
            Level {state.level}
            {archetype ? ` · ${archetype.name}` : ''} · {state.totalXp.toLocaleString()} XP total
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4">
        <Segmented
          className="min-w-[360px]"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'stats', label: 'Stats' },
            { value: 'bag', label: 'Bag' },
            { value: 'shop', label: 'Shop' },
            { value: 'forge', label: 'Forge' },
            { value: 'feats', label: 'Feats' },
            { value: 'story', label: 'Story' },
          ]}
        />
      </div>

      {pane === 'stats' && <StatsPane />}
      {pane === 'bag' && <BagPane />}
      {pane === 'shop' && <ShopPane />}
      {pane === 'forge' && <ForgePane />}
      {pane === 'feats' && <FeatsPane />}
      {pane === 'story' && <StoryPane />}

      <EquipSheet slot={slot} onClose={() => setSlot(null)} />
      <TitleSheet open={titles} onClose={() => setTitles(false)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </Screen>
  );
}

function SlotButton({ slot, label, onClick }: { slot: Slot; label: string; onClick: () => void }) {
  const { state } = useView();
  const id = state.equipment[slot];
  return (
    <button onClick={onClick} aria-label={`${label} slot`} className="pressable flex flex-col items-center gap-0.5">
      {id ? (
        <ItemIcon itemId={id} size={46} />
      ) : (
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-label3 text-label3">
          <Icon.Plus size={18} />
        </span>
      )}
      <span className="text-caption2 text-label2">{label}</span>
    </button>
  );
}

function EquipSheet({ slot, onClose }: { slot: Slot | null; onClose: () => void }) {
  const { call } = useGame();
  const { state } = useView();
  const [busy, setBusy] = useState<string | null>(null);
  const owned = slot ? ITEMS.filter((i) => i.slot === slot && state.inventory[i.id]) : [];
  const current = slot ? state.equipment[slot] : undefined;
  return (
    <Sheet open={slot !== null} onClose={onClose} title={slot ? `${slot[0]!.toUpperCase()}${slot.slice(1)}` : ''}>
      {owned.length === 0 ? (
        <Empty icon={<Icon.Bag size={40} strokeWidth={1.5} />} title="Nothing for this slot yet" message="Find gear as loot, buy it in the shop or craft it at the forge." />
      ) : (
        <Section className="mt-2">
          {owned.map((item) => (
            <Row
              key={item.id}
              icon={<ItemIcon itemId={item.id} size={30} />}
              iconBg="transparent"
              title={item.name}
              subtitle={effectText(item)}
              accessory={
                current === item.id ? (
                  <Button size="small" variant="gray" loading={busy === item.id} onClick={async () => {
                    setBusy(item.id);
                    await call('unequip', { slot }, { idempotent: true });
                    setBusy(null);
                  }}>
                    Remove
                  </Button>
                ) : (
                  <Button size="small" variant="tinted" loading={busy === item.id} onClick={async () => {
                    setBusy(item.id);
                    const r = await call('equip', { itemId: item.id }, { idempotent: true });
                    setBusy(null);
                    if (r.ok) {
                      sfx.check();
                      onClose();
                    }
                  }}>
                    Equip
                  </Button>
                )
              }
            />
          ))}
        </Section>
      )}
    </Sheet>
  );
}

function TitleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call } = useGame();
  const { state } = useView();
  return (
    <Sheet open={open} onClose={onClose} title="Titles">
      {state.titles.length === 0 ? (
        <Empty icon={<Icon.Trophy size={40} strokeWidth={1.5} />} title="No titles yet" message="Finish the 14-day Initiation and earn achievements to unlock titles." />
      ) : (
        <Section className="mt-2" footer="Your title shows under your name in town and in your party.">
          {state.titles.map((t) => (
            <Row
              key={t}
              title={t}
              onClick={async () => {
                haptic();
                const r = await call('setTitle', { title: t }, { idempotent: true });
                if (r.ok) onClose();
              }}
              accessory={state.activeTitle === t ? <Icon.Check size={20} strokeWidth={2.6} className="text-tint" /> : undefined}
            />
          ))}
        </Section>
      )}
    </Sheet>
  );
}

function StatsPane() {
  const { state } = useView();
  const profile = state.initiation.profile;
  return (
    <>
      <Section header="Skills" footer="Skills grow from the habits that train them.">
        {STATS.map((s) => {
          const sk = state.skills[s];
          const need = skillXpToNext(sk.level);
          return (
            <div key={s} className="group relative flex items-center gap-3 py-2.5 pl-4 pr-4">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] font-rounded text-subhead font-bold text-white" style={{ background: STAT_INFO[s].color }}>
                {sk.level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-subhead">
                  <span>{STAT_INFO[s].name}</span>
                  <span className="tabular text-footnote text-label2">
                    {sk.xp}/{need}
                  </span>
                </div>
                <ProgressBar value={sk.xp / need} color={STAT_INFO[s].color} height={4} className="mt-1.5" />
              </div>
              <span className="absolute bottom-0 left-[58px] right-0 h-px bg-sep group-last:hidden" />
            </div>
          );
        })}
      </Section>
      {profile && (
        <Section header="What the Guild learned">
          {describeProfile(profile).map((line) => (
            <Row key={line} title={<span className="whitespace-normal text-subhead">{line}</span>} />
          ))}
        </Section>
      )}
      <Section header="Journey">
        <Row title="Days active" detail={String(state.counters.distinctDays.any ?? 0)} />
        <Row title="Quests completed" detail={String(state.counters.questsCompleted)} />
        <Row title="Bosses defeated" detail={String(state.counters.bossesDefeated)} />
        <Row title="Temptations resisted" detail={String(state.counters.resistDays)} />
        <Row title="Sleep goals met" detail={String(state.counters.sleepGoalDays)} />
      </Section>
    </>
  );
}

function BagPane() {
  const { call } = useGame();
  const { state } = useView();
  const [busy, setBusy] = useState<string | null>(null);
  const items = Object.entries(state.inventory)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ def: ITEM_BY_ID[id], n }))
    .filter((x): x is { def: ItemDef; n: number } => Boolean(x.def));
  const consumables = items.filter((x) => x.def.slot === 'consumable');
  const gear = items.filter((x) => x.def.slot !== 'consumable');
  return (
    <>
      <Section header="Materials">
        <div className="grid grid-cols-4 gap-y-3 p-3">
          {MATERIALS.map((m) => (
            <div key={m} className="flex flex-col items-center text-center">
              <span className="tabular font-rounded text-title3">{state.materials[m] ?? 0}</span>
              <span className="text-caption2 text-label2">{MATERIAL_INFO[m].name}</span>
            </div>
          ))}
        </div>
      </Section>
      {consumables.length > 0 && (
        <Section header="Consumables">
          {consumables.map(({ def, n }) => (
            <Row
              key={def.id}
              icon={<ItemIcon itemId={def.id} size={30} />}
              iconBg="transparent"
              title={`${def.name}${n > 1 ? ` ×${n}` : ''}`}
              subtitle={def.description}
              accessory={
                <Button size="small" variant="tinted" loading={busy === def.id} onClick={async () => {
                  setBusy(def.id);
                  const r = await call('useItem', { itemId: def.id }, { idempotent: true });
                  setBusy(null);
                  if (r.ok) sfx.coin();
                }}>
                  Use
                </Button>
              }
            />
          ))}
        </Section>
      )}
      <Section header={`Gear · ${gear.length}`}>
        {gear.map(({ def }) => (
          <Row
            key={def.id}
            icon={<ItemIcon itemId={def.id} size={30} />}
            iconBg="transparent"
            title={def.name}
            subtitle={<span style={{ color: TIER_COLOR[def.tier] }}>{def.tier[0]!.toUpperCase() + def.tier.slice(1)} · <span className="text-label2">{effectText(def)}</span></span>}
            accessory={Object.values(state.equipment).includes(def.id) ? <Chip color="var(--green)">Equipped</Chip> : undefined}
          />
        ))}
      </Section>
    </>
  );
}

function ShopPane() {
  const { call } = useGame();
  const { state } = useView();
  const [busy, setBusy] = useState<string | null>(null);
  const stock = ITEMS.filter((i) => i.sources.includes('shop') && i.price);
  return (
    <Section header={<span className="flex justify-between"><span>Riverstone Market</span><span className="normal-case">🪙 {state.gold}</span></span>} footer="Gold comes from habits, quests and bosses. Prices never change.">
      {stock.map((item) => {
        const owned = item.slot !== 'consumable' && Boolean(state.inventory[item.id]);
        const afford = state.gold >= (item.price ?? 0);
        return (
          <Row
            key={item.id}
            icon={<ItemIcon itemId={item.id} size={30} />}
            iconBg="transparent"
            title={item.name}
            subtitle={effectText(item)}
            accessory={
              owned ? (
                <Chip color="var(--gray)">Owned</Chip>
              ) : (
                <Button size="small" variant="tinted" color="var(--gold)" disabled={!afford} loading={busy === item.id} onClick={async () => {
                  setBusy(item.id);
                  const r = await call('buy', { itemId: item.id }, { idempotent: true });
                  setBusy(null);
                  if (r.ok) sfx.coin();
                }}>
                  🪙 {item.price}
                </Button>
              )
            }
          />
        );
      })}
    </Section>
  );
}

function ForgePane() {
  const { call } = useGame();
  const { state } = useView();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Section header="Forge" footer="Materials come from the habits that match them: walking gives leather, study gives arcane dust, and so on.">
      {RECIPES.map((r) => {
        const item = ITEM_BY_ID[r.itemId]!;
        const owned = Boolean(state.inventory[item.id]);
        const enough = Object.entries(r.materials).every(([m, n]) => (state.materials[m as keyof typeof state.materials] ?? 0) >= (n ?? 0));
        const can = !owned && enough && state.gold >= r.gold && state.level >= r.level;
        return (
          <Row
            key={r.id}
            icon={<ItemIcon itemId={item.id} size={30} />}
            iconBg="transparent"
            title={item.name}
            subtitle={
              <span className="flex flex-wrap gap-x-2">
                {Object.entries(r.materials).map(([m, n]) => (
                  <span key={m} className={cx((state.materials[m as keyof typeof state.materials] ?? 0) < (n ?? 0) && 'text-ired')}>
                    {n} {MATERIAL_INFO[m as keyof typeof MATERIAL_INFO].name}
                  </span>
                ))}
                <span className={cx(state.gold < r.gold && 'text-ired')}>🪙 {r.gold}</span>
                {state.level < r.level && <span className="text-ired">Lv {r.level}</span>}
              </span>
            }
            accessory={
              owned ? (
                <Chip color="var(--gray)">Owned</Chip>
              ) : (
                <Button size="small" variant="tinted" disabled={!can} loading={busy === r.id} onClick={async () => {
                  setBusy(r.id);
                  const res = await call('craft', { recipeId: r.id }, { idempotent: true });
                  setBusy(null);
                  if (res.ok) sfx.loot();
                }}>
                  <Icon.Hammer size={14} /> Craft
                </Button>
              )
            }
          />
        );
      })}
    </Section>
  );
}

function FeatsPane() {
  const { state } = useView();
  const got = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  return (
    <>
      <p className="mb-3 px-1 text-footnote text-label2">
        {got} of {ACHIEVEMENTS.length} unlocked
      </p>
      <div className="mb-7 grid grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const on = state.achievements[a.id];
          const hidden = a.secret && !on;
          return (
            <div key={a.id} className={cx('rounded-card bg-card p-3', !on && 'opacity-55')} style={{ boxShadow: 'var(--shadow)' }}>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full text-[20px]" style={{ background: on ? 'color-mix(in srgb, var(--yellow) 25%, transparent)' : 'var(--fill2)' }}>
                {on ? '🏆' : hidden ? '❔' : <Icon.Lock size={18} className="text-label3" />}
              </div>
              <div className="text-subhead font-semibold">{hidden ? 'Secret' : a.name}</div>
              <div className="text-caption text-label2">{hidden ? 'Keep playing to discover it.' : a.description}</div>
              {on && <div className="mt-1 text-caption2 text-label3">{prettyDate(on, { month: 'short', day: 'numeric' })}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StoryPane() {
  const { state } = useView();
  const entries = [...state.chronicle].reverse();
  if (entries.length === 0) return <Empty icon={<Icon.Book size={44} strokeWidth={1.5} />} title="Your Chronicle is empty" message="Each week and milestone adds a page with a snapshot of your hero." />;
  return (
    <div className="relative mb-7 ml-3 border-l-2 border-sep pl-5">
      {entries.map((e, i) => (
        <div key={i} className="relative mb-5">
          <span className="absolute -left-[29px] top-3 h-3.5 w-3.5 rounded-full border-2 border-bg bg-tint" />
          <div className="flex gap-3 rounded-card bg-card p-3" style={{ boxShadow: 'var(--shadow)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="pixelated h-16 w-12 shrink-0" src={portraitUrl(pixelAppearance({ ...state.appearance, bodyTier: e.bodyTier as 1 | 2 | 3 }, e.equipment))} />
            <div className="min-w-0">
              <div className="text-caption text-label2">{prettyDate(e.date, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="text-headline">{e.label}</div>
              <div className="text-footnote text-label2">
                Level {e.level}
                {e.title ? ` · ${e.title}` : ''}
              </div>
              <p className="mt-1 text-subhead">{e.highlight}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
