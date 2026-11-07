// 7.13 このサイトについて
import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app';

export function AboutScreen() {
  const { content } = useApp();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus(), []);
  const defaults = content.conditions.map((c) => ({ label: c.label, value: c.options.find((o) => o.id === c.defaultOption)?.label ?? '未設定' }));

  return (
    <>
      <h1 tabIndex={-1} ref={h}>
        このサイトについて
      </h1>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>発行者</h2>
        <p style={{ margin: 0 }}>{content.config.publisher}。教育のための無料のサイトです。</p>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>よりどころにしている指針</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>WHO「Preconception care（プレコンセプションケア）」介入パッケージ（2013年）</li>
          <li>UNESCOほか「国際セクシュアリティ教育ガイダンス」改訂版（2018年）</li>
        </ul>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>大切にしていること</h2>
        <ol style={{ margin: 0, paddingLeft: '1.4em' }}>
          <li>「よい結末」や点数はありません。妊娠や出産を、ゴールとしては描きません。</li>
          <li>変化を、本人の選択だけのせいにしません。育った環境、社会のしくみ、まわりの人の行い、偶然を分けて示します。</li>
          <li>確率は、公的な調査などの数字にもとづいて決めています。</li>
          <li>暴力の被害は扱いますが、暴力の行為そのものは描きません。つらい内容のある章は、読まずに進めます。</li>
          <li>見られても安全なように、Esc キーですぐに別のページへ移れるようにし、個人情報は集めません。</li>
          <li>どんな性のあり方や生き方も、「問題」としては描きません。</li>
          <li>暴力が止まるかどうかを、被害を受けた人の選択では決めません。止めることができるのは、暴力をふるう側です。</li>
        </ol>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>変化の5つの要因</h2>
        <p style={{ margin: 0 }}>
          選択、生育条件（育った環境）、社会条件（社会のしくみ）、他者の行為、偶然の5つです。暴力を受けたことによる変化は、本人の選択ではなく「他者の行為」として示します。友人や先生、相談員などの支えによる変化も「他者の行為」に含めます。
        </p>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>社会条件の既定値</h2>
        <p>はじめの周回の社会条件は、次のとおりです。これは物語のための設定で、日本の多数派を表すものではありません。</p>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          {defaults.map((d) => (
            <li key={d.label}>
              {d.label}：{d.value}
            </li>
          ))}
        </ul>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>数字の使い方（解釈）</h2>
        <p>統計の数字を物語の確率にするとき、次のように読みかえています。</p>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>心の不調（17歳）：うつ病の12か月有病率（S54。全体2.1%、男性1.0%、女性3.0%）を、1年に1回の判定に使っています。成人の調査で、高校生の値ではありません。トランスジェンダー女性・男性とノンバイナリーの人は、全体の値に、気分・不安障害にあてはまる可能性の比（S57 の37.5%と13.3%の比、2.82）を掛けています。</li>
          <li>性暴力（17歳）：16〜19歳で性交を伴う性暴力にあった割合（S33）を、自認する性別の値で使っています（女性2.7%、男性0.5%、Xジェンダー・ノンバイナリー7.5%）。</li>
        </ul>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>監修</h2>
        <p style={{ margin: 0 }}>監修：準備中</p>
      </section>

      <section class="panel">
        <h2 style={{ marginTop: 0 }}>個人情報と通信</h2>
        <p style={{ margin: 0 }}>
          名前や年齢などの個人情報は入力しません。アクセス解析や広告、外部のフォント・画像は使っていません。進行状況は、あなたの端末の中だけに保存します。
        </p>
      </section>

      <p class="sub num">更新日：{__BUILD_DATE__}</p>
    </>
  );
}
