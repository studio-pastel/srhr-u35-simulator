// 偶然のカード（付録B-53・B-54）。その年に起こるかもしれない、選べない出来事を、伏せたカードとして置いておく。
// その出来事が始まると、カードが光り、結果の画面でめくられる。終わったカードは表を向けて薄くする。
// 章のはじめ（幕間）では、何枚伏せてあるかを文でも伝える。
import { useApp } from '../app';
import type { RunState } from '../../engine/types';
import { chanceDeck } from '../stage';

/** drawn：結果の画面。いま引いたカードは場に出ているので、山には空いた枠だけを残す */
export function ChanceDeck({ run, drawn = false, caption = false }: { run: RunState; drawn?: boolean; caption?: boolean }) {
  const { content } = useApp();
  const deck = chanceDeck(content, run);
  const left = deck.filter((c) => c.state === 'pending').length;
  const label =
    deck.length === 0 ? 'この年は、偶然のカードはありません' : `この年に起こるかもしれない、選べない出来事。伏せたカードが残り${left}枚`;
  return (
    <div class={`chance-deck${caption ? ' with-caption' : ''}`} role="img" aria-label={label}>
      <span class="chance-deck-label">偶然のカード</span>
      <span class="deck-cards">
        {deck.length === 0 ? (
          <span class="deck-card empty" />
        ) : (
          deck.map((c) => (
            <span key={c.id} class={`deck-card ${drawn && c.state === 'active' ? 'empty' : c.state}`}>
              {c.state === 'done' ? '✓' : drawn && c.state === 'active' ? '' : '?'}
            </span>
          ))
        )}
      </span>
      {caption && <span class="chance-deck-caption">{deck.length === 0 ? 'この年は、伏せたカードはありません。' : `この年は、選べない出来事のカードが${deck.length}枚伏せてあります。いつ、どれが起きるかは選べません。`}</span>}
    </div>
  );
}
