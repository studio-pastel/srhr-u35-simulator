// 保存（§6.9、P5）。既定は sessionStorage。利用者が選んだときだけ localStorage。
// どの読み書きも try/catch で包み、ストレージが使えない環境でも遊べるようにする（§3）。
import type { RunState } from './types';

const PREFIX = 'srhr.v1.';
const KEY_RUN = `${PREFIX}run`;
const KEY_SETTINGS = `${PREFIX}settings`;
const KEY_PERSIST = `${PREFIX}persist`;
const KEY_HISTORY = `${PREFIX}history`;
/** 保存しておく、終えた周回の数（比較に使う） */
const HISTORY_MAX = 6;

export interface Settings {
  fontSize: 'normal' | 'large';
  ruby: boolean;
  motion: boolean;
}

export const DEFAULT_SETTINGS: Settings = { fontSize: 'normal', ruby: true, motion: true };

function store(kind: 'session' | 'local'): Storage | null {
  try {
    const s = kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function read(s: Storage | null, key: string): string | null {
  try {
    return s?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(s: Storage | null, key: string, value: string): boolean {
  try {
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(s: Storage | null, key: string): void {
  try {
    s?.removeItem(key);
  } catch {
    /* 使えない環境では何もしない */
  }
}

/** 「この端末に保存して、あとで続きから遊ぶ」がオンか */
export function isPersistent(): boolean {
  return read(store('local'), KEY_PERSIST) === '1';
}

function active(): Storage | null {
  return isPersistent() ? store('local') : store('session');
}

/** 保存先を切り替える。切り替えた時点の内容を新しい保存先に移し、古い方からは消す */
export function setPersistent(on: boolean): boolean {
  const run = read(active(), KEY_RUN);
  const settings = read(active(), KEY_SETTINGS);
  const history = read(active(), KEY_HISTORY);
  const local = store('local');
  const session = store('session');
  if (on) {
    if (!write(local, KEY_PERSIST, '1')) return false;
    if (run) write(local, KEY_RUN, run);
    if (settings) write(local, KEY_SETTINGS, settings);
    if (history) write(local, KEY_HISTORY, history);
    remove(session, KEY_RUN);
    remove(session, KEY_SETTINGS);
    remove(session, KEY_HISTORY);
  } else {
    if (run) write(session, KEY_RUN, run);
    if (settings) write(session, KEY_SETTINGS, settings);
    if (history) write(session, KEY_HISTORY, history);
    remove(local, KEY_PERSIST);
    remove(local, KEY_RUN);
    remove(local, KEY_SETTINGS);
    remove(local, KEY_HISTORY);
  }
  return true;
}

export function saveRun(state: RunState | null): void {
  if (state === null) remove(active(), KEY_RUN);
  else write(active(), KEY_RUN, JSON.stringify(state));
}

export function loadRun(): RunState | null {
  const raw = read(active(), KEY_RUN);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as RunState;
    return v && v.version === 4 ? v : null;
  } catch {
    return null;
  }
}

/** 終えた周回を保存する（§6.9：RunState と完了した周回の要約だけ）。同じ runId は上書きする */
export function saveCompleted(run: RunState): void {
  const list = loadHistory().filter((r) => r.runId !== run.runId);
  list.push(run);
  write(active(), KEY_HISTORY, JSON.stringify(list.slice(-HISTORY_MAX)));
}

export function loadHistory(): RunState[] {
  const raw = read(active(), KEY_HISTORY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as RunState[];
    return Array.isArray(v) ? v.filter((r) => r && r.version === 4) : [];
  } catch {
    return [];
  }
}

export function saveSettings(s: Settings): void {
  write(active(), KEY_SETTINGS, JSON.stringify(s));
}

export function loadSettings(): Settings {
  const raw = read(active(), KEY_SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 「保存したデータを消す」：両方のストレージから、このサイトのキーをすべて消す */
export function clearAll(): void {
  for (const s of [store('session'), store('local')]) {
    try {
      if (!s) continue;
      const keys: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach((k) => remove(s, k));
    } catch {
      /* 使えない環境では何もしない */
    }
  }
}

/** クイック退出（§8.1）：sessionStorage の進行状況を消す */
export function clearSession(): void {
  const s = store('session');
  remove(s, KEY_RUN);
  remove(s, KEY_SETTINGS);
  remove(s, KEY_HISTORY);
}
