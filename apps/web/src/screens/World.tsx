'use client';

import { BOSSES, EMOTES, PRESET_PHRASES, ZONES } from '@realmbound/content';
import { initiationDay, localDateTime } from '@realmbound/game-engine';
import * as Phaser from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { haptic, reducedMotion, sfx } from '@/lib/feedback';
import { conditionOf, pixelAppearance } from '@/lib/sprites';
import { useGame, useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { cx, Segmented } from '@/ui/primitives';
import { buildZone, type ZoneKey } from '@/world/maps';
import { joinZone, type WorldNet } from '@/world/net';
import { WorldScene } from '@/world/scene';

const EMOTE_EMOJI: Record<string, string> = { wave: '👋', cheer: '🎉', heart: '❤️', laugh: '😂', sleep: '💤', thumbs_up: '👍' };
const ZONE_ORDER: ZoneKey[] = ['riverstone', 'whispering_woods', 'player_room'];
const ZONE_SHORT: Record<ZoneKey, string> = { riverstone: 'Riverstone', whispering_woods: 'Woods', player_room: 'My Room' };

export function WorldScreen() {
  const { mode, userId, toast } = useGame();
  const view = useView();
  const { state, player } = view;
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const netRef = useRef<WorldNet | null>(null);
  const [zone, setZone] = useState<ZoneKey>('riverstone');
  const [spawn, setSpawn] = useState<{ x: number; y: number } | null>(null);
  const [online, setOnline] = useState(0);
  const [panel, setPanel] = useState<'emote' | 'phrase' | null>(null);
  const day = initiationDay(state);
  const unlocked = (z: ZoneKey) => day >= ZONES[z].unlockDay || state.initiation.graduated;

  const look = useMemo(() => pixelAppearance(state.appearance, state.equipment), [state.appearance, state.equipment]);
  const lookKey = JSON.stringify(look);
  const bossDef = state.boss ? BOSSES.find((b) => b.id === state.boss!.id) : undefined;
  const bossKey = state.boss ? `${state.boss.id}:${state.boss.hp}:${state.boss.defeated}` : '';

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const map = buildZone(zone, state.worldState);
    if (spawn) map.spawn = spawn;
    const hour = localDateTime(new Date(), player.timezone).hour;
    const scene = new WorldScene();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      backgroundColor: '#1f3a1f',
      pixelArt: true,
      roundPixels: true,
      scale: { mode: Phaser.Scale.RESIZE, width: el.clientWidth, height: el.clientHeight },
      input: { touch: { capture: true } },
      banner: false,
      audio: { noAudio: true },
      scene: [],
    });
    game.scene.add('world', scene, true, {
      zone: map,
      me: { id: userId ?? 'me', name: player.username, look, condition: conditionOf(state) },
      hour,
      worldState: state.worldState,
      boss: state.boss && bossDef ? { id: state.boss.id, name: bossDef.name, hp: state.boss.hp, maxHp: state.boss.maxHp, defeated: state.boss.defeated } : undefined,
      reducedMotion: reducedMotion(),
      onExit: (to: ZoneKey, at: { x: number; y: number }) => {
        sfx.soft();
        setSpawn(at);
        setZone(to);
      },
      onMove: (path: [number, number][]) => netRef.current?.move(path),
      onInteract: (id: string) => {
        if (id === 'quest_board') toast('Your quests are on the Quests tab.');
        if (id === 'shop' || id === 'forge') toast(`The ${id} is in the Hero tab.`);
        if (id === 'bed') toast('Log your sleep on the Today tab each morning.');
      },
    });
    sceneRef.current = scene;

    // Shared town (online accounts only; the private room stays private).
    if (mode === 'remote' && userId && zone !== 'player_room') {
      netRef.current = joinZone(
        zone,
        { id: userId, name: player.username, look, x: map.spawn.x, y: map.spawn.y },
        {
          onPeers: (peers) => {
            setOnline(peers.length + 1);
            sceneRef.current?.setPeers(peers);
          },
          onMove: (id, path) => sceneRef.current?.peerMove(id, path),
          onPlace: (id, x, y) => sceneRef.current?.peerPlace(id, x, y),
          onEmote: (id, e) => sceneRef.current?.peerSay(id, e),
          onPhrase: (id, t) => sceneRef.current?.peerSay(id, t),
        },
      );
    } else setOnline(1);

    return () => {
      netRef.current?.leave();
      netRef.current = null;
      sceneRef.current = null;
      game.destroy(true);
    };
    // Rebuild the scene when the zone, look or world changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, lookKey, state.worldState, bossKey, mode, userId]);

  const sendEmote = (i: number) => {
    haptic();
    sfx.tap();
    sceneRef.current?.meSay(EMOTES[i]!);
    netRef.current?.emote(i);
    setPanel(null);
  };
  const sendPhrase = (i: number) => {
    haptic();
    sfx.tap();
    sceneRef.current?.meSay(PRESET_PHRASES[i]!);
    netRef.current?.phrase(i);
    setPanel(null);
  };

  return (
    <div className="absolute inset-0 bg-[#1f3a1f]">
      <div ref={host} className="absolute inset-0 touch-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 50px)' }} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <div className="pointer-events-auto mx-auto max-w-md rounded-[16px] p-1.5 shadow-lg material">
          <Segmented
            value={zone}
            onChange={(z) => {
              if (!unlocked(z)) {
                toast(`${ZONES[z].name} opens on day ${ZONES[z].unlockDay} of your Initiation.`);
                return;
              }
              setSpawn(null);
              setZone(z);
            }}
            options={ZONE_ORDER.map((z) => ({ value: z, label: unlocked(z) ? ZONE_SHORT[z] : `🔒 ${ZONE_SHORT[z]}` }))}
          />
          <div className="flex items-center justify-between px-2 pb-0.5 pt-1.5 text-caption text-label2">
            <span className="truncate">{ZONES[zone].blurb}</span>
            {zone !== 'player_room' && (
              <span className="ml-2 flex shrink-0 items-center gap-1 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-igreen" />
                {mode === 'remote' ? `${online} here` : 'Offline'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="absolute right-3 z-10 flex flex-col items-end gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        {panel === 'emote' && (
          <div className="animate-pop grid grid-cols-3 gap-1 rounded-[18px] p-2 shadow-lg material">
            {EMOTES.map((e, i) => (
              <button key={e} aria-label={e} onClick={() => sendEmote(i)} className="pressable flex h-12 w-12 items-center justify-center rounded-[12px] text-[26px] active:bg-fill2">
                {EMOTE_EMOJI[e]}
              </button>
            ))}
          </div>
        )}
        {panel === 'phrase' && (
          <div className="animate-pop max-h-72 w-60 overflow-y-auto rounded-[18px] py-1 shadow-lg material no-scrollbar">
            {PRESET_PHRASES.map((p, i) => (
              <button key={p} onClick={() => sendPhrase(i)} className="block w-full px-4 py-2.5 text-left text-subhead active:bg-fill2">
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <RoundButton label="Say something" active={panel === 'phrase'} onClick={() => setPanel(panel === 'phrase' ? null : 'phrase')}>
            <Icon.Chat size={22} />
          </RoundButton>
          <RoundButton label="Emote" active={panel === 'emote'} onClick={() => setPanel(panel === 'emote' ? null : 'emote')}>
            <Icon.Smile size={22} />
          </RoundButton>
        </div>
      </div>
      <p className="pointer-events-none absolute left-3 z-10 text-caption font-medium text-white/80 drop-shadow" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 70px)' }}>
        Tap to walk · tap people to talk
      </p>
    </div>
  );
}

function RoundButton({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} className={cx('pressable flex h-12 w-12 items-center justify-center rounded-full shadow-lg', active ? 'bg-tint text-white' : 'material text-tint')}>
      {children}
    </button>
  );
}
