// アプリ全体：ハッシュルーティング（§2.2）、共通の枠（§7）、クイック退出（§8.1）。
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import content from 'virtual:content';
import type { Content, CharacterId } from '../engine/schema';
import { CHARACTER_IDS } from '../engine/constants';
import type { RunState } from '../engine/types';
import { avatarsFor, type AvatarSpec } from '../engine/avatar';
import { newSeed } from '../engine/rng';
import { clearSession, loadRun, loadSettings, saveRun, saveSettings, type Settings } from '../engine/storage';
import { getChapter } from '../engine/progression';
import { modalStack } from './components/Modal';
import { Intro } from './screens/Intro';
import { Select } from './screens/Select';
import { Play } from './screens/Play';
import { ResourcesScreen } from './screens/Resources';
import { SourcesScreen } from './screens/Sources';
import { SettingsScreen } from './screens/Settings';
import { DevPreview } from './screens/DevPreview';

export type Route = 'intro' | 'select' | 'play' | 'resources' | 'sources' | 'settings' | 'dev';

const ROUTES: Record<string, Route> = {
  '': 'intro',
  '/': 'intro',
  '/select': 'select',
  '/play': 'play',
  '/resources': 'resources',
  '/sources': 'sources',
  '/settings': 'settings',
  '/dev': 'dev',
};

function routeFromHash(): Route {
  const r = ROUTES[location.hash.replace(/^#/, '')] ?? 'intro';
  return r === 'dev' && !import.meta.env.DEV ? 'intro' : r;
}

export function navigate(r: Route): void {
  const path = Object.entries(ROUTES).find(([, v]) => v === r)?.[0] ?? '/';
  location.hash = path === '' ? '/' : path;
}

/** すぐに閉じる（§8.1）：sessionStorage の進行状況を消し、replace で移動する（「戻る」で戻れない） */
export function quickExit(): void {
  clearSession();
  location.replace(content.config.exitUrl);
}

interface Pending {
  seed: string;
  salts: Record<CharacterId, number>;
}

export interface AppState {
  content: Content;
  settings: Settings;
  setSettings: (s: Settings) => void;
  run: RunState | null;
  setRun: (r: RunState | null) => void;
  /** 演出をするか（設定と prefers-reduced-motion の両方を見る） */
  animate: boolean;
  /** 主人公選択の画面で使う、まだ始めていない周回のシードとソルト */
  pending: Pending;
  setPending: (p: Pending) => void;
  avatars: Record<CharacterId, AvatarSpec>;
}

const Ctx = createContext<AppState | null>(null);
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppState がありません');
  return v;
}

const zeroSalts = () => Object.fromEntries(CHARACTER_IDS.map((id) => [id, 0])) as Record<CharacterId, number>;

function usePrefersReducedMotion(): boolean {
  const q = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [v, setV] = useState(Boolean(q?.matches));
  useEffect(() => {
    if (!q) return;
    const f = () => setV(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return v;
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [run, setRunState] = useState<RunState | null>(loadRun);
  const [pending, setPending] = useState<Pending>(() => ({ seed: newSeed(), salts: zeroSalts() }));
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const f = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.font = settings.fontSize;
    root.dataset.ruby = settings.ruby ? 'on' : 'off';
    root.dataset.motion = settings.motion ? 'on' : 'off';
  }, [settings]);

  useEffect(() => {
    document.title = content.config.siteName;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const close = modalStack[modalStack.length - 1];
      e.preventDefault();
      if (close) close();
      else quickExit();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);
  const setRun = useCallback((r: RunState | null) => {
    setRunState(r);
    saveRun(r);
  }, []);

  const avatars = useMemo(
    () => (run ? avatarsFor(run.seed, run.avatarSalts) : avatarsFor(pending.seed, pending.salts)),
    [run?.seed, run?.avatarSalts, pending],
  );

  const state: AppState = {
    content,
    settings,
    setSettings,
    run,
    setRun,
    animate: settings.motion && !reduced,
    pending,
    setPending,
    avatars,
  };

  let title: preact.ComponentChildren = content.config.siteName;
  if (route === 'play' && run && run.position.step !== 'finished') {
    const ch = getChapter(content, run.position.age);
    title = (
      <>
        <strong class="num">{run.position.age}歳</strong>
        {ch.season}
      </>
    );
  }

  return (
    <Ctx.Provider value={state}>
      <div class="app">
        <header class="topbar">
          <div class="topbar-title">{title}</div>
          <button type="button" class="exit-btn" onClick={quickExit}>
            すぐに閉じる
          </button>
        </header>
        <main id="main">
          {route === 'intro' && <Intro />}
          {route === 'select' && <Select />}
          {route === 'play' && <Play />}
          {route === 'resources' && <ResourcesScreen />}
          {route === 'sources' && <SourcesScreen />}
          {route === 'settings' && <SettingsScreen />}
          {route === 'dev' && import.meta.env.DEV && <DevPreview />}
        </main>
        <footer class="footer">
          <nav aria-label="サイト内のリンク">
            <a href="#/resources">相談窓口</a>
            <a href="#/sources">出典</a>
            <a href="#/settings">設定</a>
            <a href="#/">はじめに</a>
          </nav>
          <p style={{ margin: 0 }}>© 2026 {content.config.publisher}</p>
        </footer>
      </div>
    </Ctx.Provider>
  );
}
