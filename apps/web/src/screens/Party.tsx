'use client';

import type { Appearance } from '@realmbound/game-engine';
import type { LiveParticipantRow, LiveSessionRow, PartyMemberView, PartyRow } from '@realmbound/server';
import { useCallback, useEffect, useState } from 'react';
import { haptic, sfx } from '@/lib/feedback';
import { pixelAppearance, portraitUrl } from '@/lib/sprites';
import { useGame, useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Alert, Button, Chip, cx, Empty, Ring, Row, Screen, Section, Segmented, Sheet, Spinner, TextField, Toggle } from '@/ui/primitives';

type PartyData = { party: PartyRow; members: PartyMemberView[] } | null;
type Live = { session: LiveSessionRow; participants: LiveParticipantRow[]; serverNow: string };

const KINDS: { kind: LiveSessionRow['kind']; emoji: string; label: string; blurb: string }[] = [
  { kind: 'focus', emoji: '📚', label: 'Focus', blurb: 'Study or deep work, phones down.' },
  { kind: 'walk', emoji: '🚶', label: 'Walk', blurb: 'Everyone heads out for a walk.' },
  { kind: 'clean', emoji: '🧹', label: 'Clean', blurb: 'Tidy your space together.' },
  { kind: 'stretch', emoji: '🧘', label: 'Stretch', blurb: 'Mobility and breathing.' },
  { kind: 'plan', emoji: '🗺️', label: 'Plan', blurb: 'Plan tomorrow or the week.' },
];
const kindInfo = (k: LiveSessionRow['kind']) => KINDS.find((x) => x.kind === k)!;

function Avatar({ appearance, equipment, size = 40 }: { appearance: Appearance; equipment: Record<string, string>; size?: number }) {
  return (
    <span className="flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-fill2" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={portraitUrl(pixelAppearance(appearance, equipment))} className="pixelated" style={{ width: size * 0.75, height: size, objectFit: 'cover', objectPosition: 'top' }} />
    </span>
  );
}

export function PartyScreen() {
  const { call, mode } = useGame();
  const [party, setParty] = useState<PartyData | undefined>(undefined);
  const [sessions, setSessions] = useState<(LiveSessionRow & { players: number })[]>([]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [leave, setLeave] = useState(false);

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([call('partyGet', undefined, { quiet: true }), call('liveList', undefined, { quiet: true })]);
    if (p.ok) setParty((p.data as PartyData) ?? null);
    if (l.ok) setSessions((l.data as (LiveSessionRow & { players: number })[]) ?? []);
  }, [call]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Screen title="Party" subtitle={party ? party.party.name : 'Adventure together'}>
      {mode === 'local' && (
        <div className="mb-5 rounded-card p-3 text-footnote" style={{ background: 'color-mix(in srgb, var(--blue) 12%, var(--card))' }}>
          You are playing offline. Live quests work solo here; create an account to party with friends.
        </div>
      )}

      {party === undefined ? (
        <div className="flex justify-center py-10 text-label2">
          <Spinner />
        </div>
      ) : party === null ? (
        <div className="mb-6 rounded-[20px] bg-card px-4 pb-5 pt-2" style={{ boxShadow: 'var(--shadow)' }}>
          <Empty
            icon={<span className="text-[48px]">🛡️</span>}
            title="No party yet"
            message="Parties of 3 to 6 see each other's daily progress (never habit names) and can start live quests together."
          />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setCreating(true)}>Create</Button>
            <Button variant="tinted" onClick={() => setJoining(true)}>
              Join with Code
            </Button>
          </div>
        </div>
      ) : (
        <PartyCard data={party} onLeave={() => setLeave(true)} />
      )}

      <Section
        header={
          <span className="flex items-center justify-between">
            <span>Live quests</span>
            <button className="text-footnote normal-case text-tint" onClick={() => setStarting(true)}>
              Start one
            </button>
          </span>
        }
        footer="Do something real at the same time as others. Finish the timer together for bonus XP."
      >
        {sessions.length === 0 ? (
          <Row icon={<Icon.Clock size={18} />} iconBg="var(--teal)" title="No live quests right now" subtitle="Start one and others can join" onClick={() => setStarting(true)} chevron />
        ) : (
          sessions.map((s) => (
            <SessionRow
              key={s.id}
              s={s}
              onJoin={async () => {
                const r = await call('liveJoin', { sessionId: s.id });
                if (r.ok) {
                  sfx.check();
                  setLive(r.data as Live);
                }
              }}
            />
          ))
        )}
      </Section>

      <CreatePartySheet open={creating} onClose={() => setCreating(false)} onDone={(d) => setParty(d)} />
      <JoinPartySheet open={joining} onClose={() => setJoining(false)} onDone={(d) => setParty(d)} />
      <StartLiveSheet open={starting} inParty={Boolean(party)} onClose={() => setStarting(false)} onStarted={(l) => setLive(l)} />
      <LiveSheet live={live} members={party?.members ?? []} onClose={() => {
        setLive(null);
        void load();
      }} />
      <Alert
        open={leave}
        title="Leave this party?"
        message="You can rejoin later with the code."
        onClose={() => setLeave(false)}
        actions={[
          { label: 'Cancel', style: 'cancel', onClick: () => setLeave(false) },
          {
            label: 'Leave',
            style: 'destructive',
            onClick: async () => {
              setLeave(false);
              const r = await call('partyLeave');
              if (r.ok) setParty(null);
            },
          },
        ]}
      />
    </Screen>
  );
}

function PartyCard({ data, onLeave }: { data: NonNullable<PartyData>; onLeave: () => void }) {
  const { toast } = useGame();
  const { player } = useView();
  const share = async () => {
    const text = `Join my Realmbound party "${data.party.name}" with code ${data.party.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(data.party.code);
        toast('Code copied', 'success');
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-[20px] bg-card p-4" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="flex-1">
          <div className="text-caption font-semibold uppercase text-label2">Invite code</div>
          <div className="tabular font-rounded text-title1 tracking-[0.2em]">{data.party.code}</div>
          <div className="text-footnote text-label2">
            {data.members.length} of {data.party.maxMembers} adventurers
          </div>
        </div>
        <Button size="medium" variant="tinted" onClick={() => void share()}>
          <Icon.Share size={16} /> Invite
        </Button>
      </div>
      <Section header="Members" footer="Party members see daily progress counts, never your habit names.">
        {data.members.map((m) => {
          const p = m.todayProgress && m.todayProgress.scheduled ? m.todayProgress.done / m.todayProgress.scheduled : 0;
          return (
            <Row
              key={m.playerId}
              icon={<Avatar appearance={m.appearance} equipment={m.equipment} size={40} />}
              iconBg="transparent"
              title={
                <span className="flex items-center gap-1.5">
                  {m.username}
                  {m.playerId === data.party.leaderId && <span title="Leader">👑</span>}
                  {m.username === player.username && <span className="text-footnote text-label2">(you)</span>}
                </span>
              }
              subtitle={`Level ${m.level}${m.title ? ` · ${m.title}` : ''}`}
              accessory={
                <Ring value={p} size={34} stroke={4} color={p >= 1 ? 'var(--green)' : 'var(--tint)'}>
                  <span className="text-[9px] font-bold tabular">{m.todayProgress ? `${m.todayProgress.done}/${m.todayProgress.scheduled}` : '–'}</span>
                </Ring>
              }
            />
          );
        })}
      </Section>
      <Button variant="plain" color="var(--red)" className="mb-6 w-full" onClick={onLeave}>
        Leave Party
      </Button>
    </>
  );
}

function SessionRow({ s, onJoin }: { s: LiveSessionRow & { players: number }; onJoin: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const info = kindInfo(s.kind);
  const startsIn = Math.round((Date.parse(s.startsAt) - Date.now()) / 1000);
  return (
    <Row
      icon={<span className="text-[18px]">{info.emoji}</span>}
      iconBg="color-mix(in srgb, var(--teal) 22%, transparent)"
      title={s.title}
      subtitle={`${s.durationMin} min · ${s.players} joined · ${startsIn > 0 ? `starts in ${startsIn}s` : 'running'}${s.partyId ? ' · Party' : ''}`}
      accessory={
        <Button size="small" variant="tinted" loading={busy} onClick={async () => {
          setBusy(true);
          await onJoin();
          setBusy(false);
        }}>
          Join
        </Button>
      }
    />
  );
}

function CreatePartySheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (d: PartyData) => void }) {
  const { call } = useGame();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="New Party">
      <Section className="mt-2" footer="2 to 30 characters. Friends join with a 6-letter code.">
        <TextField value={name} onChange={setName} placeholder="Party name" maxLength={30} autoFocus />
      </Section>
      <Button className="w-full" disabled={name.trim().length < 2} loading={busy} onClick={async () => {
        setBusy(true);
        const r = await call('partyCreate', { name: name.trim() });
        setBusy(false);
        if (r.ok) {
          sfx.levelUp();
          onDone(r.data as PartyData);
          onClose();
        }
      }}>
        Create Party
      </Button>
    </Sheet>
  );
}

function JoinPartySheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (d: PartyData) => void }) {
  const { call } = useGame();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Join a Party">
      <Section className="mt-2">
        <TextField value={code} onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC123" maxLength={6} autoFocus className="tabular text-center font-rounded text-title2 tracking-[0.3em]" />
      </Section>
      <Button className="w-full" disabled={code.length !== 6} loading={busy} onClick={async () => {
        setBusy(true);
        const r = await call('partyJoin', { code });
        setBusy(false);
        if (r.ok) {
          sfx.levelUp();
          onDone(r.data as PartyData);
          onClose();
        }
      }}>
        Join
      </Button>
    </Sheet>
  );
}

function StartLiveSheet({ open, inParty, onClose, onStarted }: { open: boolean; inParty: boolean; onClose: () => void; onStarted: (l: Live) => void }) {
  const { call } = useGame();
  const [kind, setKind] = useState<LiveSessionRow['kind']>('focus');
  const [minutes, setMinutes] = useState('25');
  const [partyOnly, setPartyOnly] = useState(false);
  const [busy, setBusy] = useState<'queue' | 'host' | null>(null);
  const start = async (how: 'queue' | 'host') => {
    setBusy(how);
    const r = await call(how === 'queue' ? 'liveQueue' : 'liveCreate', { kind, durationMin: Number(minutes), partyOnly: inParty && partyOnly });
    setBusy(null);
    if (r.ok) {
      sfx.check();
      onStarted(r.data as Live);
      onClose();
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Live Quest">
      <div className="mb-6 mt-2 grid grid-cols-5 gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            onClick={() => {
              haptic();
              setKind(k.kind);
            }}
            className={cx('pressable flex flex-col items-center gap-1 rounded-[14px] py-3', kind === k.kind ? 'bg-tint text-white' : 'bg-card')}
          >
            <span className="text-[24px]">{k.emoji}</span>
            <span className="text-caption font-semibold">{k.label}</span>
          </button>
        ))}
      </div>
      <p className="mb-4 text-center text-subhead text-label2">{kindInfo(kind).blurb}</p>
      <Segmented className="mb-6" value={minutes} onChange={setMinutes} options={['15', '20', '25', '30', '45'].map((m) => ({ value: m, label: `${m} min` }))} />
      {inParty && (
        <Section>
          <Row title="Party only" accessory={<Toggle label="Party only" checked={partyOnly} onChange={setPartyOnly} />} />
        </Section>
      )}
      <div className="flex flex-col gap-2">
        <Button loading={busy === 'queue'} onClick={() => void start('queue')}>
          Find a Group
        </Button>
        <Button variant="tinted" loading={busy === 'host'} onClick={() => void start('host')}>
          Host a New Session
        </Button>
      </div>
    </Sheet>
  );
}

function LiveSheet({ live, members, onClose }: { live: Live | null; members: PartyMemberView[]; onClose: () => void }) {
  const { call } = useGame();
  const [state, setState] = useState<Live | null>(live);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    setState(live);
    setClaimed(false);
  }, [live]);
  const offset = state ? Date.parse(state.serverNow) - Date.now() : 0;

  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    const p = setInterval(async () => {
      const r = await call('liveJoin', { sessionId: state.session.id }, { quiet: true });
      if (r.ok) setState(r.data as Live);
    }, 15_000);
    return () => {
      clearInterval(t);
      clearInterval(p);
    };
  }, [state?.session.id, call]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const s = state.session;
  const info = kindInfo(s.kind);
  const t = now + offset;
  const start = Date.parse(s.startsAt);
  const end = Date.parse(s.endsAt);
  const phase = t < start ? 'lobby' : t < end ? 'running' : 'done';
  const remaining = Math.max(0, Math.ceil(((phase === 'lobby' ? start : end) - t) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const progress = phase === 'lobby' ? 1 - remaining / 60 : phase === 'running' ? (t - start) / (end - start) : 1;
  const known = state.participants.map((p) => members.find((m) => m.playerId === p.playerId)).filter(Boolean) as PartyMemberView[];

  return (
    <Sheet open onClose={onClose} title={s.title} tall>
      <div className="flex flex-col items-center pt-4 text-center">
        <span className="text-caption font-bold uppercase tracking-wider text-iteal">{phase === 'lobby' ? 'Gathering' : phase === 'running' ? `${info.label} in progress` : 'Complete'}</span>
        <div className="my-6">
          <Ring value={progress} size={220} stroke={12} color={phase === 'done' ? 'var(--green)' : 'var(--teal)'}>
            <div>
              <div className="text-[44px]">{info.emoji}</div>
              <div className="tabular font-rounded text-[44px] font-bold leading-none">{phase === 'done' ? '✓' : `${mm}:${ss}`}</div>
              <div className="mt-1 text-footnote text-label2">{phase === 'lobby' ? 'until start' : phase === 'running' ? 'remaining' : `${s.durationMin} minutes done`}</div>
            </div>
          </Ring>
        </div>
        <p className="max-w-xs text-subhead text-label2">{phase === 'running' ? `${info.blurb} Keep this open or come back when the timer ends.` : phase === 'lobby' ? 'Others can join until a few minutes after the start.' : 'Well done. Collect your rewards.'}</p>
        <div className="mt-6 flex items-center gap-2">
          <Chip color="var(--teal)">
            <Icon.People size={13} /> {state.participants.length} {state.participants.length === 1 ? 'adventurer' : 'adventurers'}
          </Chip>
          <div className="flex -space-x-2">
            {known.slice(0, 5).map((m) => (
              <Avatar key={m.playerId} appearance={m.appearance} equipment={m.equipment} size={30} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {phase === 'done' ? (
          <Button
            color="var(--green)"
            loading={busy}
            disabled={claimed}
            onClick={async () => {
              setBusy(true);
              const r = await call('liveComplete', { sessionId: s.id }, { idempotent: true });
              setBusy(false);
              if (r.ok) {
                setClaimed(true);
                sfx.levelUp();
              }
            }}
          >
            {claimed ? 'Rewards collected' : 'Collect Rewards'}
          </Button>
        ) : (
          <Button
            variant="gray"
            color="var(--red)"
            onClick={async () => {
              await call('liveLeave', { sessionId: s.id }, { quiet: true });
              onClose();
            }}
          >
            Leave Session
          </Button>
        )}
        {(phase === 'done' || claimed) && (
          <Button variant="plain" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </Sheet>
  );
}
