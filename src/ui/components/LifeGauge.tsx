// 人生のゲージ（付録B-47）：0歳から35歳までのどこにいるかを、いつも見せる。進み具合であって、点数ではない。
const MAX = 35;
const STAGES: { label: string; from: number; to: number }[] = [
  { label: '子ども', from: 0, to: 12 },
  { label: '十代', from: 12, to: 20 },
  { label: '20代', from: 20, to: 30 },
  { label: '30代', from: 30, to: MAX },
];

export function LifeGauge({ age }: { age: number }) {
  const at = Math.min(Math.max(age, 0), MAX);
  const pct = (at / MAX) * 100;
  return (
    <div class="life-gauge" role="progressbar" aria-valuemin={0} aria-valuemax={MAX} aria-valuenow={at} aria-label={`人生のゲージ。35歳までのうち、いま${at}歳`}>
      <div class="life-gauge-track" aria-hidden="true">
        <span class="life-gauge-fill" style={{ width: `${pct}%` }} />
        <span class="life-gauge-pin num" style={{ left: `${pct}%` }}>
          {at}歳
        </span>
      </div>
      <div class="life-gauge-stages" aria-hidden="true">
        {STAGES.map((s) => (
          <span key={s.label} style={{ flexGrow: s.to - s.from }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
