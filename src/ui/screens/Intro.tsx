// 7.1 はじめに
import { navigate, useApp } from '../app';
import { isPersistent } from '../../engine/storage';

export function Intro() {
  const { run, content } = useApp();
  const canResume = run !== null && run.position.step !== 'finished';
  return (
    <>
      <h1 tabIndex={-1}>はじめに</h1>
      <section class="panel">
        <p style={{ marginTop: 0 }}>
          同じ高校に通う4人の、16歳から35歳までの人生をたどる学習コンテンツです。選択を重ねながら、からだ・安全・選択肢の幅・つながり・自己決定の変化を見ていきます。
        </p>
        <p>
          変化の理由は「選択」だけではありません。育った環境（生育条件）、社会のしくみ（社会条件）、そして偶然が重なっていることを、その都度、分けて示します。
        </p>
        <p style={{ marginBottom: 0 }}>
          点数や「よい結末」はありません。どの人生にも、正解・不正解の判定はしません。
        </p>
      </section>

      <h2>扱う内容</h2>
      <section class="panel caution">
        <p style={{ margin: 0 }}>
          性、避妊、妊娠、からだの悩み、交際相手や家族からの暴力、性的な被害を扱います。暴力の行為そのものは描きません。つらい内容のある章の前には注意を出し、その章を読まずに進むこともできます。
        </p>
      </section>

      <h2>「すぐに閉じる」ボタン</h2>
      <section class="panel">
        <p style={{ marginTop: 0 }}>
          画面の右上に、いつも「すぐに閉じる」ボタンがあります。押すか、キーボードの Esc キーを押すと、天気の検索結果のページに移動します。ブラウザの「戻る」では、このサイトに戻りません。
        </p>
        <p style={{ marginBottom: 0 }}>
          ただし、ブラウザの閲覧履歴そのものは消えません。履歴を消したいときは、ブラウザの設定から消してください。
        </p>
      </section>

      <h2>保存について</h2>
      <section class="panel">
        <p style={{ margin: 0 }}>
          名前や年齢などの個人情報は入力しません。進行状況は、{isPersistent() ? 'この端末に保存しています（設定で変えられます）' : 'このタブを閉じると消える場所に保存します'}。
          「設定」で、この端末に保存して続きから遊ぶこともできます。
        </p>
      </section>

      <h2>数字と出典</h2>
      <section class="panel">
        <p style={{ margin: 0 }}>
          確率や統計の数字は、公的な調査などにもとづいています。すべての数字に出典を付け、「出典」のページで一覧できます。原典を確認できていない数字には「暫定値」、日本以外のデータには「米国のデータ」などのラベルを付けています。
        </p>
      </section>

      {canResume && (
        <button type="button" class="btn primary" onClick={() => navigate('play')}>
          続きから遊ぶ
        </button>
      )}
      <button type="button" class={canResume ? 'btn' : 'btn primary'} onClick={() => navigate('select')}>
        {canResume ? '新しく始める' : 'はじめる'}
      </button>
      <p class="sub">{content.config.siteName}</p>
    </>
  );
}
