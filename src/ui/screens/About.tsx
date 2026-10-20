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
          <li>見られても安全なように、すぐに閉じるボタンを置き、個人情報は集めません。</li>
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
          <li>避妊のトラブル：米国の「1年間ふだんどおりに使ったときの妊娠率」（S25）を、物語の1年に1回の判定として使っています。日本の公的な統計がないためです。</li>
          <li>緊急避妊薬：トラブルが起きたあとの妊娠の確率を100%とし、緊急避妊薬を使った場合に、妊娠阻止率84%（S26）を差し引いています。</li>
          <li>サキの決定：20〜24歳で妊娠した人が人工妊娠中絶を選ぶ割合（S27）を使っています。決めるのはサキで、ケイの選択はこの確率を変えません。</li>
          <li>パートナーの就業継続：第1子の出産前後に妻が仕事を続けた割合（S20）を、結婚しているかどうかに関わらず、ケイのパートナーに当てはめています。</li>
          <li>パートナーシップ制度：制度のある自治体の人口カバー率（S29）を、「住む自治体に制度がある確率」とみなしています。</li>
          <li>低出生体重：基本の確率9.8%（S15）に、妊娠前のやせのオッズ比1.61（S30）をオッズとして掛け、約14.9%としています。16歳のころの極端な食事制限が妊娠前のやせにつながったという設定は、物語上のものです。</li>
          <li>不妊治療：35歳の正確な年齢別の値がないため、「22〜35歳ごろは約30%前後」（S17）を使っています（暫定値）。</li>
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
