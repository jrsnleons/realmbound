'use client';

import { BOSSES, ITEM_BY_ID, MATERIAL_INFO, STAT_INFO, type Material } from '@realmbound/content';
import { diffDays, type Quest } from '@realmbound/game-engine';
import { useState } from 'react';
import { categoryColor, prettyDate } from '@/lib/game';
import { useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Chip, cx, Empty, ProgressBar, Screen, Segmented } from '@/ui/primitives';
import { MonsterArt } from '@/ui/MonsterArt';

const KIND_LABEL: Record<Quest['kind'], { label: string; color: string }> = {
  recovery: { label: 'Recovery', color: 'var(--green)' },
  returner: { label: 'Welcome back', color: 'var(--teal)' },
  initiation: { label: 'Initiation', color: 'var(--orange)' },
  main: { label: 'Main Quest', color: 'var(--tint)' },
  side: { label: 'Side Quest', color: 'var(--purple)' },
};
const ORDER: Quest['kind'][] = ['recovery', 'returner', 'initiation', 'main', 'side'];

export function QuestsScreen() {
  const { state } = useView();
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const active = state.quests.filter((q) => q.status === 'active').sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const done = state.quests.filter((q) => q.status === 'completed').sort((a, b) => (b.completedOn ?? '').localeCompare(a.completedOn ?? ''));
  const list = tab === 'active' ? active : done;

  return (
    <Screen title="Quests" subtitle={`${active.length} active · ${state.counters.questsCompleted} completed all time`}>
      {state.boss && <BossCard />}
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'done', label: 'Completed' },
        ]}
      />
      {list.length === 0 ? (
        <Empty
          icon={<Icon.Scroll size={44} strokeWidth={1.5} />}
          title={tab === 'active' ? 'The board is quiet' : 'No completed quests yet'}
          message={tab === 'active' ? (state.initiation.graduated ? 'New quests post every Monday.' : 'Your first personal quests appear on day 5 of the Initiation.') : 'Finish a quest and it shows up here.'}
        />
      ) : (
        <div className="space-y-3 pb-4">
          {list.map((q) => (
            <QuestCard key={q.id} quest={q} today={state.today} />
          ))}
        </div>
      )}
    </Screen>
  );
}

function QuestCard({ quest, today }: { quest: Quest; today: string }) {
  const kind = KIND_LABEL[quest.kind];
  const left = diffDays(today, quest.endsOn);
  const done = quest.status === 'completed';
  const accent = quest.category ? categoryColor(quest.category) : kind.color;
  return (
    <article className={cx('overflow-hidden rounded-[16px] bg-card', done && 'opacity-80')} style={{ boxShadow: 'var(--shadow)' }}>
      <div className="h-1" style={{ background: accent }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-rounded text-headline text-white" style={{ background: accent }}>
            {quest.npc.split(' ').pop()![0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-caption font-bold uppercase tracking-wide" style={{ color: kind.color }}>
                {kind.label}
              </span>
              <span className="text-caption text-label3">·</span>
              <span className="text-caption text-label2">{done ? `Done ${prettyDate(quest.completedOn ?? today, { month: 'short', day: 'numeric' })}` : left <= 0 ? 'Ends today' : left === 1 ? 'Ends tomorrow' : `${left} days left`}</span>
            </div>
            <h3 className="mt-0.5 text-headline">{quest.title}</h3>
            <p className="mt-0.5 text-subhead text-label2">{quest.description}</p>
            <p className="mt-1 text-caption text-label3">{quest.npc}</p>
          </div>
          {done && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-igreen text-white">
              <Icon.Check size={15} strokeWidth={3} />
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {quest.objectives.map((o) => {
            const v = Math.min(o.count, o.target);
            return (
              <div key={o.id}>
                <div className="mb-1 flex justify-between text-footnote">
                  <span>{o.label}</span>
                  <span className="tabular text-label2">
                    {v}/{o.target}
                  </span>
                </div>
                <ProgressBar value={v / o.target} color={v >= o.target ? 'var(--green)' : accent} />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {quest.rewards.xp > 0 && <Chip color="var(--xp)">+{quest.rewards.xp} XP</Chip>}
          {quest.rewards.gold > 0 && <Chip color="var(--gold)">+{quest.rewards.gold} gold</Chip>}
          {Object.entries(quest.rewards.materials ?? {}).map(([m, n]) => (
            <Chip key={m} color="var(--brown)">
              +{n} {MATERIAL_INFO[m as Material]?.name ?? m}
            </Chip>
          ))}
          {quest.rewards.itemId && <Chip color="var(--purple)">🎁 {ITEM_BY_ID[quest.rewards.itemId]?.name ?? 'Item'}</Chip>}
          {quest.rewards.title && <Chip color="var(--orange)">Title: {quest.rewards.title}</Chip>}
        </div>
      </div>
    </article>
  );
}

function BossCard() {
  const { state } = useView();
  const boss = state.boss!;
  const def = BOSSES.find((b) => b.id === boss.id);
  const pct = boss.hp / boss.maxHp;
  return (
    <section className="mb-6 overflow-hidden rounded-[20px] text-white" style={{ background: boss.defeated ? 'linear-gradient(160deg, #2f7d4f, #1d4d34)' : 'linear-gradient(160deg, #3a2448, #1c1426)', boxShadow: 'var(--shadow)' }}>
      <div className="flex items-center gap-4 p-4">
        <div className={cx('flex h-24 w-24 shrink-0 items-center justify-center rounded-[16px] bg-white/10', !boss.defeated && 'animate-float')}>
          <MonsterArt id={boss.id} size={88} defeated={boss.defeated} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-caption font-bold uppercase tracking-wide text-white/60">{boss.defeated ? 'Defeated this week' : 'Weekly threat'}</div>
          <div className="text-title3">{def?.name}</div>
          <p className="mt-0.5 text-footnote text-white/70">{def?.lore}</p>
          {def && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-caption font-semibold">
              Weak to <span style={{ color: STAT_INFO[def.weakness].color }}>●</span> {STAT_INFO[def.weakness].name}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="mb-1 flex justify-between text-footnote">
          <span className="font-semibold">HP</span>
          <span className="tabular text-white/70">
            {boss.hp} / {boss.maxHp}
          </span>
        </div>
        <ProgressBar value={pct} color={boss.defeated ? '#30d158' : 'linear-gradient(90deg,#ff453a,#ff9f0a)'} track="rgba(255,255,255,0.15)" height={8} />
        {boss.log.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-footnote text-white/70">
            {boss.log.slice(-3).map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        )}
        {!boss.defeated && <p className="mt-3 text-caption text-white/50">Every habit you log deals damage. Missed scheduled habits let it heal.</p>}
      </div>
    </section>
  );
}
