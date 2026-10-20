import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAll, clearSession, isPersistent, loadRun, loadSettings, saveRun, setPersistent } from '../../src/engine/storage';
import { createRun } from '../../src/engine/progression';
import { realContent } from '../helpers';

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const content = realContent();
afterEach(() => vi.unstubAllGlobals());

describe('保存（§6.9）', () => {
  it('ストレージが使えない環境でも例外を出さない', () => {
    vi.stubGlobal('sessionStorage', undefined);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const run = createRun(content, { protagonist: 'yu' });
    expect(() => saveRun(run)).not.toThrow();
    expect(loadRun()).toBeNull();
    expect(loadSettings().ruby).toBe(true);
    expect(setPersistent(true)).toBe(false);
    expect(() => clearAll()).not.toThrow();
  });

  it('既定は sessionStorage。オンにしたときだけ localStorage に移す', () => {
    const ss = new MemStorage();
    const ls = new MemStorage();
    vi.stubGlobal('sessionStorage', ss);
    vi.stubGlobal('localStorage', ls);
    const run = createRun(content, { protagonist: 'kei' });
    saveRun(run);
    expect(ss.m.size).toBe(1);
    expect(ls.m.size).toBe(0);
    expect(isPersistent()).toBe(false);
    setPersistent(true);
    expect(loadRun()?.runId).toBe(run.runId);
    expect(ss.m.size).toBe(0);
    setPersistent(false);
    expect(ls.m.size).toBe(0);
    expect(loadRun()?.runId).toBe(run.runId);
    clearSession();
    expect(loadRun()).toBeNull();
  });
});
