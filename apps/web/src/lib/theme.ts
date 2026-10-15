import { store } from './storage';

export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'rb-theme';

export function getTheme(): ThemePref {
  const v = store.get(KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

/** Whether the screen is dark right now, whichever of the player, a host page or the device decided it. */
export function isDark(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  const mine = root.dataset.rbTheme;
  if (mine) return mine === 'dark';
  if (root.dataset.theme) return root.dataset.theme === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function syncBarColour() {
  const colour = isDark() ? '#000000' : '#f2f2f7';
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  if (metas.length === 0) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    metas.push(meta);
  }
  // The build emits one tag per device scheme; set them all so the player's choice wins either way.
  for (const m of metas) m.setAttribute('content', colour);
}

export function applyTheme(pref: ThemePref = getTheme()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (pref === 'auto') delete root.dataset.rbTheme;
  else root.dataset.rbTheme = pref;
  syncBarColour();
}

export function setTheme(pref: ThemePref) {
  store.set(KEY, pref);
  applyTheme(pref);
}

/** Applies the saved choice and keeps the status-bar colour in step with device and host changes. */
export function startTheme() {
  applyTheme();
  const follow = () => syncBarColour();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', follow);
  new MutationObserver(follow).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-rb-theme'] });
}
