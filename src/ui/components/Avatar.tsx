// 抽象アバター（§16.3）。SVG をコードで組み立てる。装飾として扱い、名前は必ず別にテキストで出す。
import type { AvatarSpec } from '../../engine/avatar';

let uid = 0;

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function shapePath(shape: AvatarSpec['shape']): string {
  switch (shape) {
    case 'circle':
      return 'M50 8a42 42 0 1 1 0 84a42 42 0 1 1 0-84z';
    case 'roundedSquare':
      return 'M26 10h48a16 16 0 0 1 16 16v48a16 16 0 0 1-16 16h-48a16 16 0 0 1-16-16v-48a16 16 0 0 1 16-16z';
    case 'hexagon':
      return 'M50 6l38 22v44l-38 22l-38-22v-44z';
    case 'drop':
      return 'M50 6c18 22 36 40 36 58a36 36 0 0 1-72 0c0-18 18-36 36-58z';
    case 'roundedTriangle':
      return 'M43 14a8 8 0 0 1 14 0l34 62a8 8 0 0 1-7 12h-68a8 8 0 0 1-7-12z';
    case 'ellipse':
      return 'M50 14a40 34 0 1 1 0 72a40 34 0 1 1 0-72z';
  }
}

function patternBody(p: AvatarSpec['pattern'], color: string) {
  switch (p) {
    case 'stripe':
      return <path d="M0 4h12" stroke={color} stroke-width="3" />;
    case 'dot':
      return <circle cx="6" cy="6" r="2.2" fill={color} />;
    case 'lattice':
      return <path d="M0 0l12 12M12 0l-12 12" stroke={color} stroke-width="1.6" />;
    default:
      return null;
  }
}

export function Avatar({ spec, size = 48 }: { spec: AvatarSpec; size?: number }) {
  const id = `av${++uid}`;
  const d = shapePath(spec.shape);
  const pc = shade(spec.color, 0.38);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}c`}>
          <path d={d} />
        </clipPath>
        {spec.pattern !== 'plain' && spec.pattern !== 'concentric' && (
          <pattern id={`${id}p`} width="12" height="12" patternUnits="userSpaceOnUse">
            {patternBody(spec.pattern, pc)}
          </pattern>
        )}
      </defs>
      <g transform={`rotate(${spec.tilt} 50 50)`}>
        <path d={d} fill={spec.color} />
        <g clip-path={`url(#${id}c)`}>
          {spec.pattern === 'concentric' &&
            [12, 24, 36].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={pc} stroke-width="3" />)}
          {spec.pattern !== 'plain' && spec.pattern !== 'concentric' && <rect width="100" height="100" fill={`url(#${id}p)`} />}
        </g>
      </g>
    </svg>
  );
}
