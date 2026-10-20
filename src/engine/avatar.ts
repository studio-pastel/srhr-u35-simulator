// アバターの決定的な生成（§16.3）。
// 入力は seed・characterId・avatarSalt の3つだけ。性別・性的指向・生育条件は入力しない。
import type { CharacterId } from './schema';
import { CHARACTER_IDS } from './constants';
import { cyrb128 } from './rng';

export const AVATAR_SHAPES = ['circle', 'roundedSquare', 'hexagon', 'drop', 'roundedTriangle', 'ellipse'] as const;
export const AVATAR_PATTERNS = ['plain', 'stripe', 'dot', 'concentric', 'lattice'] as const;
export const AVATAR_TILTS = [-12, -6, 0, 6, 12] as const;
/** §16.4 のアバター用パレット（ピンク系・水色系は含まない） */
export const AVATAR_PALETTE = [
  '#E0A526',
  '#2A9D8F',
  '#7A9E3B',
  '#C0563A',
  '#3D5A80',
  '#8D6E63',
  '#4F4F4F',
  '#D4A373',
  '#5E8C61',
  '#9C6644',
] as const;

export interface AvatarSpec {
  shape: (typeof AVATAR_SHAPES)[number];
  color: string;
  pattern: (typeof AVATAR_PATTERNS)[number];
  tilt: number;
}

/** 色相（度）。HSL の標準的な変換。無彩色は 0 */
export function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function draw(seed: string, id: CharacterId, salt: number, internal: number): AvatarSpec {
  const [a, b, c, d] = cyrb128(`${seed}:${id}:${salt}${internal ? `#${internal}` : ''}`);
  return {
    shape: AVATAR_SHAPES[a % AVATAR_SHAPES.length]!,
    color: AVATAR_PALETTE[b % AVATAR_PALETTE.length]!,
    pattern: AVATAR_PATTERNS[c % AVATAR_PATTERNS.length]!,
    tilt: AVATAR_TILTS[d % AVATAR_TILTS.length]!,
  };
}

const MIN_HUE_GAP = 30;

/**
 * 色を決める順番。seed から決定的に並べ替える（ソルトには依存しない）。
 * 固定の順にすると、順番と人物が結びつき、人物ごとの色の分布に差が出るため。
 */
export function avatarOrder(seed: string): CharacterId[] {
  return [...CHARACTER_IDS].sort((a, b) => cyrb128(`${seed}:order:${a}`)[0] - cyrb128(`${seed}:order:${b}`)[0] || a.localeCompare(b));
}

/**
 * 4人分のアバターを決める。avatarOrder の順に決め、
 * 先に決まった人物と色相が30度未満なら、内部のソルトを進めて決定的に再抽選する。
 */
export function avatarsFor(seed: string, salts: Record<CharacterId, number>): Record<CharacterId, AvatarSpec> {
  const out = {} as Record<CharacterId, AvatarSpec>;
  const hues: number[] = [];
  for (const id of avatarOrder(seed)) {
    let spec = draw(seed, id, salts[id] ?? 0, 0);
    for (let k = 1; hues.some((h) => hueDistance(h, hueOf(spec.color)) < MIN_HUE_GAP); k++) {
      if (k > 200) throw new Error('アバターの色を決められません');
      spec = draw(seed, id, salts[id] ?? 0, k);
    }
    hues.push(hueOf(spec.color));
    out[id] = spec;
  }
  return out;
}
