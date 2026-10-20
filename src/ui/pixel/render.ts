// ドット絵の人物と背景を、コードで計算して描く（付録B-1）。画像ファイルは使わない。
// 光と影は光源の向きとの内積で、年齢は頭身と服で、時間帯は色の混ぜ合わせで表す。

export const W = 96;
export const H = 64;

export type Face = 'normal' | 'smile' | 'anxious' | 'sad' | 'relieved';
export type Pose = 'stand' | 'phone';
export type TimeOfDay = 'day' | 'dusk' | 'night';
export type Place = 'classroom' | 'nurse' | 'hallway' | 'bedroom' | 'living' | 'campus' | 'station' | 'office' | 'clinic' | 'home2' | 'gate';
export type HairStyle = 'short' | 'mid' | 'bob' | 'long' | 'tied';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  /** 年齢ごとの服の色：[〜19歳, 20〜30歳, 31歳〜] */
  clothes: [string, string, string];
  pants: string;
}

export interface Actor {
  look: Look;
  age: number;
  face?: Face;
  pose?: Pose;
  /** 立ち位置（足もとの中心の x 座標） */
  x: number;
  /** 呼吸で上半身を持ち上げるドット数（0か1） */
  bob?: number;
  /** まばたき中 */
  blink?: boolean;
}

// ── 色の計算 ──
function h2r(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function r2h(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return r2h((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/** 明るく（a > 0）・暗く（a < 0）。明るい側は暖色に、暗い側は寒色に少しずらす */
export function shade(hex: string, a: number): string {
  let [h, s, l] = toHsl(h2r(hex));
  l = Math.max(0.03, Math.min(0.95, l + a * 0.16));
  h += a > 0 ? -8 * a : 12 * -a;
  return fromHsl(h, Math.min(1, s * (a < 0 ? 1.1 : 0.95)), l);
}
function mix(hex: string, to: string, k: number): string {
  const [r, g, b] = h2r(hex);
  const [tr, tg, tb] = h2r(to);
  return r2h(r * (1 - k) + tr * k, g * (1 - k) + tg * k, b * (1 - k) + tb * k);
}

const TIME: Record<TimeOfDay, { sky: string; tint: string; k: number }> = {
  day: { sky: '#9fd0f0', tint: '#ffffff', k: 0 },
  dusk: { sky: '#f2a65a', tint: '#ff9a50', k: 0.16 },
  night: { sky: '#24305a', tint: '#1a2240', k: 0.42 },
};

// ── 描画の土台 ──
type Grid = (string | null)[][];
const grid = (): Grid => Array.from({ length: H }, () => Array<string | null>(W).fill(null));
function put(g: Grid, x: number, y: number, c: string) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x >= 0 && y >= 0 && x < W && y < H) g[y]![x] = c;
}
function rect(g: Grid, x: number, y: number, w: number, h: number, c: string, shaded = false) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let col = c;
      if (shaded) {
        const f = i / (w - 1 || 1);
        col = f < 0.22 ? shade(c, 0.5) : f > 0.72 ? shade(c, -0.6) : c;
      }
      put(g, x + i, y + j, col);
    }
}
/** 楕円。光源（左上）との内積で3段階の陰影を付ける */
function ell(g: Grid, cx: number, cy: number, rx: number, ry: number, c: string, clip?: (x: number, y: number) => boolean) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (clip && !clip(x, y)) continue;
      const d = -(nx * 0.55 + ny * 0.75);
      put(g, x, y, d > 0.45 ? shade(c, 0.6) : d < -0.35 ? shade(c, -0.7) : c);
    }
}
function seeded(n: number) {
  let a = n;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

// ── 背景 ──
function window_(g: Grid, x: number, y: number, w: number, h: number, time: TimeOfDay) {
  const T = TIME[time];
  rect(g, x, y, w, h, T.sky);
  if (time === 'night') {
    const r = seeded(7);
    for (let i = 0; i < 12; i++) put(g, x + r() * w, y + r() * h, '#f4f0c8');
  }
  if (time === 'dusk') rect(g, x, y + h - 7, w, 7, shade(T.sky, -0.4));
  const frame = mix('#f4f1ea', T.tint, T.k);
  rect(g, x + Math.floor(w / 2) - 1, y, 2, h, frame);
  rect(g, x, y + Math.floor(h / 2) - 1, w, 2, frame);
  rect(g, x - 2, y - 2, w + 4, 2, mix('#d9d2c2', T.tint, T.k));
  rect(g, x - 2, y + h, w + 4, 2, mix('#d9d2c2', T.tint, T.k));
}

function background(place: Place, time: TimeOfDay): Grid {
  const g = grid();
  const T = TIME[time];
  const t = (c: string) => mix(c, T.tint, T.k);
  const floorY = 50;
  const wallBase: Record<Place, string> = {
    classroom: '#ece4d2',
    nurse: '#e8f0ee',
    hallway: '#e3ded2',
    bedroom: '#e6dccb',
    living: '#efe3cf',
    campus: '#bfe0f2',
    station: '#2b3355',
    office: '#e3e6ea',
    clinic: '#e8f0ee',
    home2: '#efe3cf',
    gate: '#9fd0f0',
  };
  const floorBase: Partial<Record<Place, string>> = { gate: '#a89f90', station: '#6b6f78', office: '#9aa0a8', clinic: '#c2ccc9', nurse: '#c9d4d1', campus: '#8db36a' };
  const wall = t(wallBase[place]);
  const floor = t(floorBase[place] ?? '#b58c5f');
  rect(g, 0, 0, W, H, wall);
  rect(g, 0, floorY, W, H - floorY, floor);
  if (place !== 'campus' && place !== 'station' && place !== 'gate') for (let x = 0; x < W; x += 12) rect(g, x, floorY, 1, H - floorY, shade(floor, -0.5));
  rect(g, 0, floorY - 1, W, 1, shade(wall, -0.6));

  switch (place) {
    case 'classroom':
      rect(g, 4, 8, 36, 20, t('#3f5a4a'));
      rect(g, 4, 28, 36, 2, t('#8a6d4a'));
      rect(g, 8, 13, 14, 1, '#dfe8df');
      rect(g, 8, 17, 22, 1, '#dfe8df');
      window_(g, 60, 8, 30, 24, time);
      rect(g, 60, 40, 26, 3, t('#9c6644'), true);
      rect(g, 62, 43, 2, 7, t('#7a4f33'));
      rect(g, 82, 43, 2, 7, t('#7a4f33'));
      break;
    case 'nurse':
      window_(g, 62, 8, 28, 22, time);
      rect(g, 4, 30, 30, 8, t('#f4f4f4'), true);
      rect(g, 4, 38, 2, 12, t('#9fbfb8'));
      rect(g, 32, 38, 2, 12, t('#9fbfb8'));
      rect(g, 6, 8, 14, 18, t('#f4f4f4'));
      rect(g, 12, 10, 2, 8, '#d06a6a');
      rect(g, 9, 13, 8, 2, '#d06a6a');
      break;
    case 'hallway':
      for (let x = 2; x < W; x += 24) window_(g, x + 2, 6, 18, 18, time);
      rect(g, 0, 32, W, 2, t('#c9c2b4'));
      break;
    case 'bedroom':
      window_(g, 62, 6, 28, 24, time);
      rect(g, 52, 40, 40, 6, t('#8fa6c8'), true);
      rect(g, 52, 46, 40, 4, t('#6a5040'));
      rect(g, 52, 36, 10, 5, t('#f4f1ea'));
      rect(g, 6, 14, 18, 24, t('#9c6644'), true);
      for (let y = 20; y < 38; y += 6) rect(g, 6, y, 18, 1, shade(t('#9c6644'), -0.6));
      rect(g, 8, 15, 3, 5, t('#c0563a'));
      rect(g, 12, 16, 3, 4, t('#3d5a80'));
      break;
    case 'living':
    case 'home2':
      window_(g, 36, 6, 26, 22, time);
      rect(g, 4, 10, 22, 30, t('#9c6644'), true);
      for (let y = 16; y < 40; y += 8) rect(g, 4, y, 22, 1, shade(t('#9c6644'), -0.6));
      rect(g, 62, 40, 30, 8, t('#7a9e3b'), true);
      rect(g, 62, 36, 30, 4, shade(t('#7a9e3b'), 0.3));
      if (time !== 'day') ell(g, 74, 10, 4, 3, '#f7d98a');
      break;
    case 'campus':
      rect(g, 0, 22, W, 28, t('#c9c2b4'));
      for (let x = 4; x < W; x += 10) rect(g, x, 26, 5, 7, t('#7f9fb8'));
      ell(g, 10, 30, 8, 9, t('#5e8c61'));
      break;
    case 'station':
      rect(g, 0, 30, W, 20, '#4a4f5c');
      rect(g, 6, 8, 18, 7, '#f4e9a6');
      for (let x = 0; x < W; x += 6) put(g, x, 48, '#f4e9a6');
      break;
    case 'office':
      window_(g, 6, 8, 30, 22, time);
      rect(g, 58, 38, 32, 3, t('#8a7a6a'), true);
      rect(g, 60, 41, 2, 9, t('#5a4a3a'));
      rect(g, 86, 41, 2, 9, t('#5a4a3a'));
      rect(g, 66, 28, 14, 10, t('#2f3542'));
      rect(g, 67, 29, 12, 8, time === 'night' ? '#7fb0d8' : '#a8c8e0');
      break;
    case 'gate': {
      // 夕方の校門：空、校舎、門柱、桜の木
      rect(g, 0, 0, W, 50, T.sky);
      if (time === 'dusk') rect(g, 0, 30, W, 20, shade(T.sky, -0.3));
      rect(g, 8, 14, 80, 30, t('#e8e1d3'), true);
      for (let x = 12; x < 86; x += 8) rect(g, x, 20, 5, 6, t('#7f9fb8'));
      for (let x = 12; x < 86; x += 8) rect(g, x, 32, 5, 6, t('#7f9fb8'));
      rect(g, 44, 6, 8, 8, t('#e8e1d3'), true);
      ell(g, 48, 10, 2, 2, t('#f4f1ea'));
      rect(g, 2, 30, 5, 20, t('#9a9387'), true);
      rect(g, 89, 30, 5, 20, t('#9a9387'), true);
      ell(g, 6, 22, 9, 8, t('#f0b8c0'));
      ell(g, 90, 20, 8, 7, t('#f0b8c0'));
      break;
    }
    case 'clinic':
      rect(g, 50, 30, 40, 4, t('#9fbfb8'), true);
      rect(g, 50, 34, 40, 6, t('#7fa59c'));
      rect(g, 6, 8, 16, 10, '#ffffff');
      rect(g, 13, 9, 2, 8, '#d06a6a');
      rect(g, 10, 12, 8, 2, '#d06a6a');
      break;
  }
  return g;
}

// ── 人物 ──
function person(g: Grid, a: Actor) {
  const { look } = a;
  const face = a.face ?? 'normal';
  const child = a.age < 12;
  const t = Math.max(0, Math.min(1, (a.age - 16) / 19));
  const ci = a.age < 20 ? 0 : a.age < 31 ? 1 : 2;
  const cl = look.clothes[ci];
  const feet = 56;
  const cx = a.x;
  const s = child ? 0.7 : 1;
  const legH = Math.round((6 + t * 4) * s);
  const bodyH = Math.round((10 + t * 5) * s);
  const bodyW = Math.round((11 + t * 2) * s);
  const hr = child ? 5 : 7;
  const top = feet - legH - bodyH - (a.bob ?? 0);
  const sad = face === 'sad' || face === 'anxious';

  rect(g, cx - 4, feet - legH, 3, legH, look.pants, true);
  rect(g, cx + 1, feet - legH, 3, legH, look.pants, true);
  rect(g, cx - 5, feet - 1, 4, 2, '#3a3030');
  rect(g, cx + 1, feet - 1, 4, 2, '#3a3030');
  const bl = cx - Math.floor(bodyW / 2);
  const br = cx + Math.ceil(bodyW / 2);
  rect(g, bl, top, bodyW, bodyH, cl, true);
  rect(g, bl - 3, top + 1 + (sad ? 1 : 0), 3, bodyH - 3, cl, true);
  put(g, bl - 2, top + bodyH - 2 + (sad ? 1 : 0), look.skin);
  if (a.pose === 'phone') {
    rect(g, br, top + 2, 3, 5, cl, true);
    rect(g, br + 1, top + 1, 4, 3, cl, true);
    rect(g, br + 4, top - 1, 3, 5, '#2f3542');
    put(g, br + 3, top + 1, look.skin);
  } else {
    rect(g, br, top + 1 + (sad ? 1 : 0), 3, bodyH - 3, cl, true);
    put(g, br + 1, top + bodyH - 2 + (sad ? 1 : 0), look.skin);
  }
  if (ci === 1 && !child) {
    put(g, cx - 1, top, '#f4f4f4');
    put(g, cx, top, '#f4f4f4');
    put(g, cx - 1, top + 1, '#f4f4f4');
    put(g, cx, top + 1, '#f4f4f4');
  }
  rect(g, cx - 1, top - 2, 3, 2, shade(look.skin, -0.4));

  const hx = cx + 0.5;
  const hy = top - hr - 1 + (face === 'sad' ? 1 : 0);
  ell(g, hx, hy, hr, hr + 0.5, look.skin);
  const hc = look.hair;
  ell(g, hx, hy - 0.5, hr + 1, hr + 1, hc, (_x, y) => y < hy - 1.5);
  for (let x = Math.floor(hx - hr); x <= hx + hr; x++) if ((x * 7) % 3 !== 0) put(g, x, hy - 1, hc);
  const side = { short: 0, mid: 3, bob: 6, long: 13, tied: 0 }[look.hairStyle];
  if (side) {
    rect(g, Math.floor(hx - hr - 1), Math.floor(hy - 2), 2, side, hc, true);
    rect(g, Math.floor(hx + hr), Math.floor(hy - 2), 2, side, hc, true);
  }
  if (look.hairStyle === 'tied') ell(g, hx + hr + 1, hy, 2, 3, hc);

  const ey = Math.floor(hy + 1);
  const xL = Math.floor(hx - (child ? 3 : 4));
  const xR = Math.floor(hx + 2);
  const E = '#2b2b33';
  const mouth = '#a84a44';
  const m = (pts: [number, number][]) => pts.forEach(([x, y]) => put(g, hx + x, hy + y, mouth));
  if (a.blink && face !== 'relieved' && face !== 'smile') {
    for (const ex of [xL, xR]) {
      put(g, ex, ey + 1, E);
      put(g, ex + 1, ey + 1, E);
    }
  } else if (face === 'relieved' || face === 'smile') {
    for (const ex of [xL, xR]) {
      put(g, ex, ey + 1, E);
      put(g, ex + 1, ey, E);
    }
  } else {
    for (const ex of [xL, xR]) {
      put(g, ex, ey, E);
      put(g, ex + 1, ey, E);
      put(g, ex, ey + 1, E);
      put(g, ex + 1, ey + 1, E);
      put(g, ex, ey, '#ffffff');
    }
  }
  if (face === 'normal' || face === 'relieved') m([[-1, 4], [0, 4]]);
  if (face === 'smile') m([[-2, 4], [-1, 5], [0, 5], [1, 4]]);
  if (face === 'anxious') {
    put(g, xL - 1, ey - 2, hc);
    put(g, xL, ey - 2, hc);
    put(g, xR + 1, ey - 2, hc);
    put(g, xR + 2, ey - 2, hc);
    m([[-1, 5], [0, 4]]);
  }
  if (face === 'sad') {
    put(g, xL, ey - 2, hc);
    put(g, xL + 1, ey - 3, hc);
    put(g, xR + 1, ey - 2, hc);
    put(g, xR, ey - 3, hc);
    m([[-2, 5], [-1, 4], [0, 4], [1, 5]]);
    put(g, xL, ey + 2, '#6fb7e8');
    put(g, xL, ey + 3, '#6fb7e8');
  }
  if (face !== 'sad' && face !== 'anxious') {
    put(g, xL - 1, ey + 3, '#eaa08a');
    put(g, xR + 2, ey + 3, '#eaa08a');
  }
}

export interface SceneSpec {
  place: Place;
  time: TimeOfDay;
  actors: Actor[];
}

/** 場面を canvas に描く。人物の外側にだけ輪郭線を引き、時間帯の色を人物にも少し混ぜる */
export function drawScene(canvas: HTMLCanvasElement, spec: SceneSpec): void {
  const bg = background(spec.place, spec.time);
  const ch = grid();
  for (const a of spec.actors) person(ch, a);
  const T = TIME[spec.time];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = bg[y]![x];
      const own = ch[y]![x];
      if (own) c = mix(own, T.tint, T.k * 0.6);
      else if (
        (ch[y]![x + 1] ?? null) ||
        (ch[y]![x - 1] ?? null) ||
        (ch[y + 1]?.[x] ?? null) ||
        (ch[y - 1]?.[x] ?? null)
      )
        c = '#2a2230';
      const [r, g, b] = h2r(c ?? '#000000');
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
}

/** 話している人の顔アイコン（頭のまわりだけを切り出す） */
export function drawFace(canvas: HTMLCanvasElement, look: Look, age: number, face: Face = 'normal'): void {
  const g = grid();
  person(g, { look, age, face, x: 48 });
  let top = 0;
  while (top < H && !g[top]!.some((c) => c)) top++;
  const S = 20;
  const x0 = 38;
  const y0 = Math.max(0, top - 1);
  if (canvas.width !== S) canvas.width = S;
  if (canvas.height !== S) canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = g[y0 + y]?.[x0 + x] ?? '#e7e5df';
      const [r, gg, b] = h2r(c);
      const i = (y * S + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
}
