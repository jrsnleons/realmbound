'use client';

import { useEffect, useState } from 'react';
import { advanceLocalDay, localDayOffset } from '@/lib/client';
import { setSound, soundOn } from '@/lib/feedback';
import { store } from '@/lib/storage';
import { getTheme, setTheme, type ThemePref } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useGame, useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Button, NavButton, Row, Section, Segmented, Sheet, Stepper, TextField, Toggle } from '@/ui/primitives';
import { LookStep, type Look } from './Onboarding';

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call, mode, signOut, toast, refresh } = useGame();
  const view = useView();
  const { state } = view;
  const [email, setEmail] = useState<string | null>(null);
  const [look, setLook] = useState(false);
  const [rest, setRest] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [reduced, setReduced] = useState(false);
  const [sound, setSoundState] = useState(true);
  const [theme, setThemeState] = useState<ThemePref>('auto');
  const deviceTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  useEffect(() => {
    if (!open) return;
    setReduced(store.get('rb-reduced-motion') === 'on');
    setSoundState(soundOn());
    setThemeState(getTheme());
    if (mode === 'remote') void supabase().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [open, mode]);

  const exportData = async () => {
    let data: unknown;
    if (mode === 'remote') {
      const res = await supabase().rpc('export_my_data');
      if (res.error) {
        toast(res.error.message, 'error');
        return;
      }
      data = res.data;
    } else {
      data = { player: view.player, state, habits: view.habits };
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `realmbound-${view.player.username}-${state.today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Settings"
      tall
      trailing={
        <NavButton label="Done" bold onClick={onClose}>
          Done
        </NavButton>
      }
    >
      <Section className="mt-2" footer={mode === 'local' ? 'Offline play is saved on this device only. Create an account to play with others.' : undefined}>
        <Row icon={<Icon.Person size={18} />} iconBg="var(--tint)" title={view.player.username} subtitle={mode === 'remote' ? (email ?? 'Signed in') : 'Offline on this device'} />
      </Section>

      <Section header="Hero">
        <Row icon={<Icon.Sparkles size={18} />} iconBg="var(--pink)" title="Character" subtitle="Hair, face, skin and build" chevron onClick={() => setLook(true)} />
        <Row
          icon={<Icon.Moon size={18} />}
          iconBg="var(--indigo)"
          title="Sleep goal"
          accessory={
            <Stepper
              value={state.sleepGoalHours}
              min={4}
              max={12}
              step={0.5}
              format={(v) => `${v} h`}
              onChange={(v) => void call('setSleepGoal', { hours: v }, { idempotent: true })}
            />
          }
        />
        <Row
          icon={<Icon.Clock size={18} />}
          iconBg="var(--gray)"
          title="Time zone"
          subtitle={view.player.timezone !== deviceTz ? `This device is on ${deviceTz}` : undefined}
          detail={view.player.timezone.split('/').pop()?.replace(/_/g, ' ')}
          accessory={
            view.player.timezone !== deviceTz ? (
              <Button
                size="small"
                variant="tinted"
                onClick={async () => {
                  const r = await call('setTimezone', { timezone: deviceTz });
                  if (r.ok) {
                    toast('Time zone updated', 'success');
                    await refresh();
                  }
                }}
              >
                Use
              </Button>
            ) : undefined
          }
        />
      </Section>

      <Section header="Wellbeing" footer="Rest mode pauses consequences while you are sick, injured or need a break. Rewards still work.">
        <Row
          icon={<Icon.Heart size={18} />}
          iconBg="var(--green)"
          title="Rest mode"
          accessory={
            <Toggle
              label="Rest mode"
              checked={state.restMode.on}
              onChange={(on) => (on ? setRest(true) : void call('setRestMode', { on: false }, { idempotent: true }))}
            />
          }
        />
      </Section>

      <Section header="Display" footer="Automatic follows your device.">
        <div className="p-2">
          <Segmented
            value={theme}
            onChange={(v) => {
              setThemeState(v);
              setTheme(v);
            }}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Section>

      <Section header="Experience">
        <Row
          icon={<Icon.Speaker size={18} />}
          iconBg="var(--orange)"
          title="Sound effects"
          accessory={
            <Toggle
              label="Sound effects"
              checked={sound}
              onChange={(v) => {
                setSound(v);
                setSoundState(v);
              }}
            />
          }
        />
        <Row
          icon={<Icon.Eye size={18} />}
          iconBg="var(--blue)"
          title="Reduce motion"
          accessory={
            <Toggle
              label="Reduce motion"
              checked={reduced}
              onChange={(v) => {
                setReduced(v);
                store.set('rb-reduced-motion', v ? 'on' : 'off');
                document.documentElement.dataset.reducedMotion = v ? 'true' : 'false';
              }}
            />
          }
        />
      </Section>

      {mode === 'local' && (
        <Section header="Testing" footer={`Moves the game clock forward to try rollover, quests and bosses. Currently +${localDayOffset()} days.`}>
          <Row
            icon={<Icon.Forward size={18} />}
            iconBg="var(--teal)"
            title="Skip to tomorrow"
            onClick={async () => {
              advanceLocalDay();
              await refresh();
              toast('A new day dawns', 'success');
            }}
          />
        </Section>
      )}

      <Section header="Your data">
        <Row icon={<Icon.Download size={18} />} iconBg="var(--blue)" title="Export my data" onClick={() => void exportData()} />
        <Row icon={<Icon.Trash size={18} />} iconBg="var(--red)" title="Delete account" destructive onClick={() => setConfirmDelete(true)} />
      </Section>

      <Button variant="gray" color="var(--red)" className="w-full" onClick={() => void signOut()}>
        {mode === 'local' ? 'Leave offline mode' : 'Sign Out'}
      </Button>
      <p className="mt-6 text-center text-caption text-label3">Realmbound · build {process.env.NEXT_PUBLIC_BUILD ?? 'dev'}</p>

      <AppearanceSheet open={look} onClose={() => setLook(false)} />
      <RestSheet open={rest} onClose={() => setRest(false)} />
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Account">
        <p className="mb-4 mt-2 text-subhead text-label2">This permanently deletes your hero, habits and history. It cannot be undone. Type DELETE to confirm.</p>
        <Section>
          <TextField value={typed} onChange={setTyped} placeholder="DELETE" />
        </Section>
        <Button
          className="w-full"
          color="var(--red)"
          disabled={typed !== 'DELETE'}
          onClick={async () => {
            const r = await call('deleteAccount', { confirm: 'DELETE' });
            if (r.ok) {
              setConfirmDelete(false);
              await signOut();
            }
          }}
        >
          Delete Forever
        </Button>
      </Sheet>
    </Sheet>
  );
}

function AppearanceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call } = useGame();
  const { state } = useView();
  const [look, setLook] = useState<Look>(state.appearance);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setLook(state.appearance);
  }, [open, state.appearance]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Character"
      tall
      leading={
        <NavButton label="Cancel" onClick={onClose}>
          Cancel
        </NavButton>
      }
      trailing={
        <NavButton
          label="Save"
          bold
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            const r = await call('setAppearance', { appearance: look }, { idempotent: true });
            setBusy(false);
            if (r.ok) onClose();
          }}
        >
          Save
        </NavButton>
      }
    >
      <div className="pt-2">
        <LookStep look={look} setLook={setLook} equipment={state.equipment} showTitle={false} />
      </div>
    </Sheet>
  );
}

function RestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call } = useGame();
  const [reason, setReason] = useState<'illness' | 'injury' | 'rest' | 'other'>('rest');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Rest Mode">
      <p className="mb-4 mt-2 text-subhead text-label2">Missed habits will not hurt your momentum or heal the boss while rest mode is on. Turn it off when you are ready.</p>
      <Segmented
        className="mb-6"
        value={reason}
        onChange={setReason}
        options={[
          { value: 'rest', label: 'Break' },
          { value: 'illness', label: 'Sick' },
          { value: 'injury', label: 'Injured' },
          { value: 'other', label: 'Other' },
        ]}
      />
      <Button
        className="w-full"
        color="var(--green)"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const r = await call('setRestMode', { on: true, reason }, { idempotent: true });
          setBusy(false);
          if (r.ok) onClose();
        }}
      >
        Start Resting
      </Button>
    </Sheet>
  );
}

