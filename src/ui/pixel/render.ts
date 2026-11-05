// 人物と背景を、コードで計算して描く（付録B-1、付録B-57）。画像ファイルは使わない。
// 人物は「まめ」：頭とからだがひとつながりの丸い形で、小さな丸い手と足だけを持つ。体つきを描かないので、
// からだの性別や体型を絵から決めつけない。年齢は大きさと服で、時間帯は色の混ぜ合わせで表す。
// 呼び出し側との約束（W・H の座標、drawScene・drawFace）は、ドット絵のころと同じにしている。

/** 人物の立ち位置（Actor.x）の座標の幅と高さ。描くときは 360×240 に広げる */
export const W = 96;
export const H = 64;
const SW = 360;
const SH = 240;
const K = SW / W;
const FLOOR = 186;
const FEET = 212;

export type Face = 'normal' | 'smile' | 'anxious' | 'sad' | 'relieved' | 'calm' | 'thinking';
export type Pose = 'stand' | 'phone';
export type TimeOfDay = 'day' | 'dusk' | 'night';
export type Place = 'classroom' | 'nurse' | 'hallway' | 'bedroom' | 'living' | 'campus' | 'station' | 'office' | 'clinic' | 'home2' | 'gate' | 'izakaya';
export type HairStyle = 'short' | 'mid' | 'bob' | 'long' | 'tied';
/** 見分けやすくするための持ち物（付録B-36） */
export type Accessory = 'glasses' | 'cap' | 'headphones' | 'beanie';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  /** 年齢ごとの服の色：[〜19歳, 20〜30歳, 31歳〜]。まめでは、からだ全体の色になる */
  clothes: [string, string, string];
  /** 足の色 */
  pants: string;
  accessory?: Accessory;
  accent?: string;
}

export interface Actor {
  look: Look;
  age: number;
  face?: Face;
  pose?: Pose;
  /** 立ち位置（足もとの中心の x 座標。0〜96） */
  x: number;
  /** 呼吸の伸び（0〜1） */
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
export function mix(hex: string, to: string, k: number): string {
  const [r, g, b] = h2r(hex);
  const [tr, tg, tb] = h2r(to);
  return r2h(r * (1 - k) + tr * k, g * (1 - k) + tg * k, b * (1 - k) + tb * k);
}
/** 明るく（a > 0）・暗く（a < 0） */
export function shade(hex: string, a: number): string {
  return a > 0 ? mix(hex, '#ffffff', a * 0.5) : mix(hex, '#1b1d2a', -a * 0.45);
}

const TIME: Record<TimeOfDay, { sky: string; tint: string; k: number }> = {
  day: { sky: '#bfe3f5', tint: '#ffffff', k: 0 },
  dusk: { sky: '#f6b886', tint: '#ff9a50', k: 0.16 },
  night: { sky: '#2e3a68', tint: '#1a2240', k: 0.4 },
};

// ── 形 ──
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
function rr(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

type Ctx = CanvasRenderingContext2D;
function fill(ctx: Ctx, d: string, c: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = c;
  ctx.fill(new Path2D(d));
  ctx.globalAlpha = 1;
}
function line(ctx: Ctx, d: string, c: string, w: number) {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(d));
}
function seeded(n: number) {
  let a = n;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

// ── 背景 ──
function window_(ctx: Ctx, x: number, y: number, w: number, h: number, time: TimeOfDay, t: (c: string) => string) {
  const T = TIME[time];
  fill(ctx, rr(x - 4, y - 4, w + 8, h + 8, 14), t('#f7f3ea'));
  fill(ctx, rr(x, y, w, h, 10), T.sky);
  if (time === 'night') {
    const r = seeded(7);
    for (let i = 0; i < 9; i++) fill(ctx, circ(x + 6 + r() * (w - 12), y + 6 + r() * (h - 12), 1.4), '#f4f0c8');
    fill(ctx, circ(x + w * 0.75, y + h * 0.3, 7), '#fff4c4');
  } else if (time === 'dusk') fill(ctx, rr(x, y + h * 0.6, w, h * 0.4, 10), '#f19a74', 0.6);
  else fill(ctx, ell(x + w * 0.3, y + h * 0.35, 12, 5), '#ffffff', 0.8);
  line(ctx, `M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`, t('#f7f3ea'), 3);
}

function background(ctx: Ctx, place: Place, time: TimeOfDay) {
  const T = TIME[time];
  const t = (c: string) => mix(c, T.tint, T.k);
  const wallBase: Record<Place, string> = {
    classroom: '#f1ead9',
    nurse: '#eef4f1',
    hallway: '#ece6d9',
    bedroom: '#ece2d1',
    living: '#f2e7d4',
    campus: '#cfe8f3',
    station: '#3b4466',
    office: '#e7eaee',
    clinic: '#f3eef6',
    home2: '#f2e7d4',
    gate: T.sky,
    izakaya: '#d9ad7c',
  };
  const floorBase: Record<Place, string> = {
    classroom: '#dcc7a4',
    nurse: '#d6e2dd',
    hallway: '#d9cbb2',
    bedroom: '#cdb08a',
    living: '#d4b48c',
    campus: '#a9cf88',
    station: '#8a8f99',
    office: '#bcc2cb',
    clinic: '#e2d9ea',
    home2: '#d4b48c',
    gate: '#c9c0b0',
    izakaya: '#8a5f3e',
  };
  const wall = place === 'gate' ? T.sky : t(wallBase[place]);
  fill(ctx, `M0 0H${SW}V${SH}H0Z`, wall);
  fill(ctx, `M0 ${FLOOR}H${SW}V${SH}H0Z`, t(floorBase[place]));

  switch (place) {
    case 'classroom':
      fill(ctx, rr(18, 34, 150, 82, 10), t('#4f7a62'));
      line(ctx, 'M40 62q24 -6 48 0M40 82q40 -4 80 2', '#eaf3ec', 2.5);
      fill(ctx, rr(14, 116, 158, 8, 4), t('#c9a77c'));
      window_(ctx, 226, 34, 112, 84, time, t);
      fill(ctx, rr(226, 152, 96, 12, 6), t('#c08a5a'));
      fill(ctx, rr(234, 164, 8, 24, 4), t('#9c6c44'));
      fill(ctx, rr(306, 164, 8, 24, 4), t('#9c6c44'));
      break;
    case 'nurse':
      window_(ctx, 230, 32, 104, 80, time, t);
      fill(ctx, rr(24, 34, 54, 46, 10), '#ffffff');
      line(ctx, 'M51 46v22M40 57h22', '#e48aa0', 6);
      fill(ctx, rr(14, 128, 120, 26, 12), t('#ffffff'));
      fill(ctx, rr(14, 118, 34, 14, 7), t('#e9eef0'));
      fill(ctx, rr(22, 152, 8, 34, 4), t('#9fbfb8'));
      fill(ctx, rr(118, 152, 8, 34, 4), t('#9fbfb8'));
      break;
    case 'hallway':
      for (let x = 14; x < SW; x += 90) window_(ctx, x, 28, 66, 64, time, t);
      fill(ctx, rr(0, 118, SW, 8, 4), t('#d8cfbe'));
      break;
    case 'bedroom':
      window_(ctx, 226, 28, 108, 86, time, t);
      fill(ctx, rr(196, 146, 156, 30, 14), t('#8fa6c8'));
      fill(ctx, rr(196, 136, 40, 20, 10), t('#f4f1ea'));
      fill(ctx, rr(200, 172, 148, 16, 6), t('#9c7656'));
      fill(ctx, rr(20, 50, 70, 100, 10), t('#b88a62'));
      for (let y = 74; y < 150; y += 24) fill(ctx, rr(26, y, 58, 4, 2), t('#9c7656'));
      fill(ctx, rr(30, 56, 10, 16, 3), t('#e57a6a'));
      fill(ctx, rr(44, 58, 10, 14, 3), t('#5b8fd9'));
      fill(ctx, rr(58, 56, 10, 16, 3), t('#f2c14e'));
      break;
    case 'living':
    case 'home2':
      window_(ctx, 138, 26, 100, 84, time, t);
      fill(ctx, rr(18, 40, 80, 112, 10), t('#b88a62'));
      for (let y = 66; y < 150; y += 28) fill(ctx, rr(24, y, 68, 4, 2), t('#9c7656'));
      fill(ctx, rr(240, 146, 108, 28, 14), t('#8bb34a'));
      fill(ctx, rr(240, 128, 108, 24, 12), t('#a2c86a'));
      if (time !== 'day') fill(ctx, circ(280, 42, 16), '#f7d98a', 0.9);
      break;
    case 'campus':
      fill(ctx, rr(0, 84, SW, 102, 0), t('#e6dfd0'));
      for (let x = 16; x < SW; x += 38) fill(ctx, rr(x, 100, 22, 26, 6), t('#9fc2d9'));
      for (let x = 16; x < SW; x += 38) fill(ctx, rr(x, 140, 22, 26, 6), t('#9fc2d9'));
      fill(ctx, circ(40, 120, 34), t('#7fb07a'));
      fill(ctx, rr(36, 140, 8, 46, 4), t('#8a6a4a'));
      break;
    case 'station':
      fill(ctx, rr(0, 110, SW, 76, 0), '#4c5470');
      fill(ctx, rr(24, 30, 76, 28, 8), '#f4e9a6');
      fill(ctx, rr(34, 40, 56, 6, 3), '#4c5470');
      for (let x = 6; x < SW; x += 22) fill(ctx, rr(x, 194, 12, 4, 2), '#f4e9a6');
      break;
    case 'office':
      window_(ctx, 22, 30, 112, 84, time, t);
      fill(ctx, rr(214, 140, 124, 12, 6), t('#a8988a'));
      fill(ctx, rr(222, 152, 8, 34, 4), t('#7a6a5a'));
      fill(ctx, rr(322, 152, 8, 34, 4), t('#7a6a5a'));
      fill(ctx, rr(246, 96, 58, 40, 6), t('#3a4152'));
      fill(ctx, rr(250, 100, 50, 30, 4), time === 'night' ? '#7fb0d8' : '#bcd6e8');
      fill(ctx, rr(270, 134, 10, 8, 2), t('#3a4152'));
      break;
    case 'gate': {
      if (time === 'dusk') fill(ctx, rr(0, 110, SW, 76, 0), shade(T.sky, -0.3));
      fill(ctx, rr(30, 56, 300, 120, 10), t('#efe9dc'));
      for (let x = 46; x < 320; x += 30) {
        fill(ctx, rr(x, 76, 18, 22, 5), t('#9fc2d9'));
        fill(ctx, rr(x, 120, 18, 22, 5), t('#9fc2d9'));
      }
      fill(ctx, rr(166, 26, 28, 32, 8), t('#efe9dc'));
      fill(ctx, circ(180, 40, 8), t('#ffffff'));
      fill(ctx, rr(6, 110, 20, 76, 6), t('#a8a194'));
      fill(ctx, rr(334, 110, 20, 76, 6), t('#a8a194'));
      fill(ctx, circ(22, 84, 32), t('#f3c1c8'));
      fill(ctx, circ(338, 76, 30), t('#f3c1c8'));
      break;
    }
    case 'izakaya': {
      fill(ctx, rr(0, 0, SW, 22, 0), t('#3a2a22'));
      for (let x = 8; x < SW; x += 60) fill(ctx, rr(x, 22, 46, 32, 6), t('#2f3b52'));
      for (const cx of [52, 308]) {
        fill(ctx, ell(cx, 86, 18, 22), time === 'day' ? t('#e0665f') : '#f07a5e');
        fill(ctx, rr(cx - 12, 62, 24, 5, 2), t('#3a2a22'));
        fill(ctx, rr(cx - 12, 105, 24, 5, 2), t('#3a2a22'));
      }
      for (let x = 112; x < 250; x += 24) fill(ctx, rr(x, 64, 16, 46, 3), t('#f4ead2'));
      fill(ctx, rr(84, 142, 194, 14, 6), t('#a06a42'));
      fill(ctx, rr(96, 156, 8, 30, 4), t('#6a4a32'));
      fill(ctx, rr(258, 156, 8, 30, 4), t('#6a4a32'));
      for (const mx of [120, 172, 224]) {
        fill(ctx, rr(mx, 120, 18, 22, 4), '#f2c14e');
        fill(ctx, rr(mx, 118, 18, 6, 3), '#fbf6e8');
      }
      break;
    }
    case 'clinic':
      fill(ctx, rr(24, 32, 60, 48, 10), '#ffffff');
      line(ctx, 'M54 44v24M42 56h24', '#e48aa0', 6);
      fill(ctx, rr(190, 120, 150, 16, 8), t('#b7a6c9'));
      fill(ctx, rr(190, 136, 150, 50, 6), t('#cbbfdb'));
      break;
  }
}

// ── 人物（まめ） ──
interface Size {
  w: number;
  h: number;
}
/** 年齢ごとの大きさ。頭身ではなく、からだの大きさで年齢を表す */
function sizeOf(age: number): Size {
  if (age < 7) return { w: 38, h: 58 };
  if (age < 12) return { w: 40, h: 70 };
  if (age < 16) return { w: 44, h: 86 };
  if (age < 20) return { w: 46, h: 94 };
  if (age < 60) return { w: 48, h: 100 };
  return { w: 48, h: 94 };
}
const INK = '#2b2f3a';

/** 50歳を過ぎた人は、年齢に合わせて髪を白っぽくする */
function hairColor(look: Look, age: number): string {
  return age >= 50 ? mix(look.hair, '#d4d1cb', Math.min(0.85, 0.35 + (age - 50) / 40)) : look.hair;
}

function fringe(cx: number, cy: number, r: number): string {
  const L = cx - r - 1.2;
  const R = cx + r + 1.2;
  return `M${L} ${cy + 2}A${r + 1.2} ${r + 1.2} 0 0 1 ${R} ${cy}Q${cx + r * 0.45} ${cy - r * 0.6} ${cx - r * 0.1} ${cy - r * 0.42}Q${cx - r * 0.65} ${cy - r * 0.25} ${L} ${cy + 2}Z`;
}

function features(ctx: Ctx, face: Face, cx: number, cy: number, r: number, blink: boolean) {
  const ex = r * 0.38;
  const ey = cy + r * 0.14;
  const my = cy + r * 0.55;
  const s = (d: string) => line(ctx, d, INK, 1.7);
  const closed = face === 'smile' || face === 'relieved';
  const look = face === 'thinking' ? [1.3, -1.2] : [0, 0];
  for (const x of [cx - ex, cx + ex]) {
    if (face === 'smile') s(`M${x - 2.6} ${ey + 1}Q${x} ${ey - 2.4} ${x + 2.6} ${ey + 1}`);
    else if (face === 'relieved') s(`M${x - 2.6} ${ey}Q${x} ${ey + 2.4} ${x + 2.6} ${ey}`);
    else if (blink && !closed) s(`M${x - 2.2} ${ey}H${x + 2.2}`);
    else fill(ctx, circ(x + look[0]!, ey + look[1]! + (face === 'sad' ? 1 : 0), 1.9), INK);
  }
  if (face === 'anxious' || face === 'sad') {
    s(`M${cx - ex - 3} ${ey - 4}L${cx - ex + 2.5} ${ey - 6}`);
    s(`M${cx + ex + 3} ${ey - 4}L${cx + ex - 2.5} ${ey - 6}`);
  }
  if (face === 'smile') s(`M${cx - 4} ${my - 1}Q${cx} ${my + 4} ${cx + 4} ${my - 1}`);
  else if (face === 'relieved') s(`M${cx - 3} ${my}Q${cx} ${my + 2.5} ${cx + 3} ${my}`);
  else if (face === 'calm') s(`M${cx - 2.8} ${my}Q${cx} ${my + 1.4} ${cx + 2.8} ${my}`);
  else if (face === 'thinking') s(`M${cx - 0.5} ${my + 0.8}L${cx + 3.5} ${my + 0.2}`);
  else if (face === 'sad') s(`M${cx - 3.5} ${my + 2}Q${cx} ${my - 1.5} ${cx + 3.5} ${my + 2}`);
  else if (face === 'anxious') s(`M${cx - 4} ${my + 0.5}q2 -2 4 0q2 2 4 0`);
  else s(`M${cx - 2.5} ${my + 0.5}L${cx + 2.5} ${my + 0.5}`);
  if (face === 'smile' || face === 'relieved') for (const k of [-1, 1]) fill(ctx, ell(cx + k * r * 0.62, cy + r * 0.45, 3, 1.8), '#f29b9b', 0.6);
}

function accessory(ctx: Ctx, look: Look, cx: number, cy: number, r: number) {
  const a = look.accent ?? '#3a3f4a';
  switch (look.accessory) {
    case 'glasses':
      for (const k of [-1, 1]) line(ctx, circ(cx + k * r * 0.38, cy + r * 0.12, r * 0.27), a, 1.5);
      line(ctx, `M${cx - r * 0.11} ${cy + r * 0.1}L${cx + r * 0.11} ${cy + r * 0.1}`, a, 1.5);
      break;
    case 'cap':
      fill(ctx, `M${cx - r - 1} ${cy - 2}A${r + 1} ${r + 1} 0 0 1 ${cx + r + 1} ${cy - 2}Z`, a);
      fill(ctx, rr(cx, cy - 4.5, r * 1.55, 4.5, 2.2), shade(a, -0.5));
      break;
    case 'beanie':
      fill(ctx, `M${cx - r - 1.5} ${cy - 1}A${r + 1.5} ${r + 1.5} 0 0 1 ${cx + r + 1.5} ${cy - 1}Z`, a);
      fill(ctx, rr(cx - r - 2, cy - 5, 2 * r + 4, 6, 3), shade(a, -0.4));
      fill(ctx, circ(cx, cy - r - 3, 3), shade(a, 0.5));
      break;
    case 'headphones':
      line(ctx, `M${cx - r - 2} ${cy}A${r + 2} ${r + 3} 0 0 1 ${cx + r + 2} ${cy}`, shade(a, -0.4), 3);
      fill(ctx, rr(cx - r - 5, cy - 4, 6, 11, 3), a);
      fill(ctx, rr(cx + r - 1, cy - 4, 6, 11, 3), a);
      break;
  }
}

/** 頭の中心と半径（顔アイコンの切り出しにも使う） */
function headOf(age: number, x: number, feet: number, bob = 0) {
  if (age < 2) return { cx: x, cy: feet - 72, r: 10 };
  const s = sizeOf(age);
  const top = feet - s.h - 3 - bob * 2;
  const r = s.w * 0.34;
  return { cx: x, cy: top + s.w * 0.46, r };
}

/** 2歳未満の赤ちゃん：おくるみに包まれ、となりの大人に抱かれている高さに描く */
function baby(ctx: Ctx, a: Actor, x: number, feet: number) {
  const { cx, cy, r } = headOf(a.age, x, feet);
  fill(ctx, ell(cx, cy + 12, 16, 12), mix(a.look.clothes[0], '#ffffff', 0.5));
  fill(ctx, circ(cx, cy, r), a.look.skin);
  fill(ctx, `M${cx - r * 0.6} ${cy - r * 0.6}Q${cx} ${cy - r * 1.3} ${cx + r * 0.5} ${cy - r * 0.8}Q${cx} ${cy - r * 0.6} ${cx - r * 0.6} ${cy - r * 0.6}Z`, a.look.hair);
  features(ctx, a.face ?? 'relieved', cx, cy, r, false);
}

function person(ctx: Ctx, a: Actor, x: number, feet: number, tint: (c: string) => string) {
  if (a.age < 2) {
    baby(ctx, a, x, feet);
    return;
  }
  const { look } = a;
  const face = a.face ?? 'normal';
  const S = sizeOf(a.age);
  const bob = a.bob ?? 0;
  const h = S.h + bob * 2;
  const top = feet - h - 3;
  const { cx, cy, r } = headOf(a.age, x, feet, bob);
  const ci = a.age < 20 ? 0 : a.age < 31 ? 1 : 2;
  const body = tint(look.clothes[ci]);
  const hand = shade(body, -0.3);
  const hair = tint(hairColor(look, a.age));
  const sad = face === 'sad' || face === 'anxious';

  if (look.hairStyle === 'bob' || look.hairStyle === 'long') fill(ctx, rr(cx - r - 4, cy - r - 3, 2 * r + 8, look.hairStyle === 'long' ? r * 3.2 : r * 2.2, r), hair);
  if (look.hairStyle === 'mid') fill(ctx, ell(cx, cy - 1, r + 2.5, r + 2), hair);
  if (look.hairStyle === 'tied') fill(ctx, circ(cx + r * 1.05, cy - r * 0.8, r * 0.45), hair);
  for (const k of [-1, 1]) fill(ctx, ell(x + k * S.w * 0.22, feet - 2.5, 7, 4), tint(shade(look.pants, -0.2)));
  fill(ctx, rr(x - S.w / 2, top, S.w, h, S.w / 2), body);
  // 手：落ちこんでいるときは少し下に
  const handY = top + h * (sad ? 0.68 : 0.62);
  fill(ctx, ell(x - S.w / 2 - 1, handY, 5, 8), hand);
  if (a.pose === 'phone') {
    fill(ctx, ell(x + S.w / 2 - 6, top + h * 0.5, 5.5, 5), hand);
    fill(ctx, rr(x + S.w / 2 - 12, top + h * 0.5 - 14, 9, 14, 2), '#2f3542');
    fill(ctx, rr(x + S.w / 2 - 10.5, top + h * 0.5 - 12.5, 6, 10, 1), '#9fc6e6');
  } else fill(ctx, ell(x + S.w / 2 + 1, handY, 5, 8), hand);
  fill(ctx, circ(cx, cy, r), tint(look.skin));
  fill(ctx, fringe(cx, cy, r), hair);
  accessory(ctx, look, cx, cy, r);
  features(ctx, face, cx, cy, r, a.blink ?? false);
}

export interface SceneSpec {
  place: Place;
  time: TimeOfDay;
  actors: Actor[];
}

function prepare(canvas: HTMLCanvasElement, w: number, h: number): Ctx | null {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof Path2D === 'undefined') return null;
  return ctx;
}

/** 場面を canvas に描く。時間帯の色を、人物にも少し混ぜる */
export function drawScene(canvas: HTMLCanvasElement, spec: SceneSpec): void {
  const ctx = prepare(canvas, SW * 2, SH * 2);
  if (!ctx) return;
  ctx.setTransform(canvas.width / SW, 0, 0, canvas.height / SH, 0, 0);
  ctx.clearRect(0, 0, SW, SH);
  background(ctx, spec.place, spec.time);
  const T = TIME[spec.time];
  const tint = (c: string) => mix(c, T.tint, T.k * 0.6);
  // 奥（大人）から手前（赤ちゃん）の順に重ねる
  const order = [...spec.actors].sort((p, q) => Number(p.age < 2) - Number(q.age < 2));
  for (const a of order) person(ctx, a, a.x * K, FEET, tint);
}

/** 話している人の顔アイコン（頭のまわりだけを切り出す） */
export function drawFace(canvas: HTMLCanvasElement, look: Look, age: number, face: Face = 'normal'): void {
  const S = 96;
  const ctx = prepare(canvas, S, S);
  if (!ctx) return;
  const { cx, cy, r } = headOf(age, 0, 0);
  const span = r * 2.5;
  const k = canvas.width / span;
  ctx.setTransform(k, 0, 0, k, -(cx - span / 2) * k, -(cy - span / 2.1) * k);
  ctx.clearRect(cx - span, cy - span, span * 2, span * 2);
  fill(ctx, `M${cx - span} ${cy - span}h${span * 2}v${span * 2}h${-span * 2}Z`, '#eef3ef');
  person(ctx, { look, age, face, x: 0 }, 0, 0, (c) => c);
}
