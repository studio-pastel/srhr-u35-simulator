// テスト用：19歳の章の見本（確率ノードと視点切替を含む）。
// 実際の 19歳の章はフェーズ2で書く。ここでは §10.4 の CH-CONTRACEPTION・CH-EC の形と、
// §6.7 の harutoRoute を、エンジンのテストのためだけに組む。数値は §10.5 の S25・S26 のもの。
export const fixtureChapter19 = {
  age: 19,
  title: '19歳（テスト用）',
  season: 'テスト',
  status: 'draft',
  intro: { minami: 'テスト', haruto: 'テスト', yu: 'テスト', kei: 'テスト' },
  events: [
    {
      id: 'E19-TEST-MH',
      age: 19,
      characters: ['minami', 'haruto'],
      kind: 'fixed',
      domains: ['テスト'],
      viewpointSwitch: { from: 'minami', to: 'haruto', entry: { minami: 'm1', haruto: 'h1' } },
      status: 'draft',
      scenes: [
        {
          id: 'm1',
          viewpoint: 'minami',
          text: 'ミナミの場面',
          choices: [
            { id: 'a', label: 'A', canonical: true, effects: [{ param: 'safety', sign: 1, size: 'S', source: 'choice', note: 'A' }], setFlags: { minamiR: 'a' }, next: 'END' },
            { id: 'b', label: 'B', effects: [{ param: 'connection', sign: 1, size: 'M', source: 'choice', note: 'B' }], setFlags: { minamiR: 'b' }, next: 'END' },
            { id: 'c', label: 'C', effects: [], setFlags: { minamiR: 'c' }, next: 'END' },
          ],
        },
        {
          id: 'h1',
          viewpoint: 'haruto',
          text: 'ハルトの場面',
          choices: [
            { id: 'reflect', label: '振り返る', effects: [{ param: 'autonomy', sign: 1, size: 'M', source: 'choice', note: '振り返った' }], setFlags: { harutoRoute: 'stopped' }, next: 'END' },
            { id: 'blame', label: '相手のせいにする', canonical: true, effects: [{ param: 'connection', sign: -1, size: 'S', source: 'choice', note: '相手のせいにした' }], setFlags: { harutoRoute: 'continued' }, next: 'END' },
          ],
        },
      ],
    },
    {
      id: 'E19-TEST-KS',
      age: 19,
      characters: ['kei'],
      kind: 'chance',
      domains: ['テスト'],
      statCard: ['S25'],
      status: 'draft',
      scenes: [
        {
          id: 'start',
          text: '避妊のトラブルが起きるか',
          chance: {
            id: 'CH-CONTRACEPTION',
            label: '避妊のトラブルが起きる確率',
            base: { value: 0.13, statRef: 'S25' },
            modifiers: [{ when: "flags.method == 'withdrawal'", op: 'set', value: 0.2, source: 'choice', statRef: 'S25', note: '腟外射精' }],
            outcomes: {
              happens: { effects: [{ param: 'body', sign: -1, size: 'S', note: 'トラブルが起きた' }], next: 'notice' },
              notHappens: { effects: [], setFlags: { pregnant: false }, next: 'END' },
            },
          },
        },
        {
          id: 'notice',
          text: '気づけるか',
          branches: [{ when: "flags.method == 'withdrawal' && flags.knowsWithdrawalUnreliable != true", next: 'unaware' }],
          next: 'ecAsk',
        },
        {
          id: 'ecAsk',
          text: '緊急避妊薬を使うか',
          choices: [
            { id: 'use', label: '入手する', canonical: true, effects: [{ param: 'options', sign: -1, size: 'S', source: 'upbringing', when: "up.economy == 'hardship'", note: '費用の負担' }], setFlags: { usedEC: true }, next: 'ec' },
            { id: 'wait', label: '様子を見る', effects: [], setFlags: { usedEC: false }, next: 'ec' },
          ],
        },
        { id: 'unaware', text: '気づかなかった', next: 'ec' },
        {
          id: 'ec',
          text: '妊娠が成立するか',
          chance: {
            id: 'CH-EC',
            label: '妊娠が成立する確率',
            base: { value: 1.0, statRef: 'S25' },
            modifiers: [{ when: 'flags.usedEC == true', op: 'mul', value: 0.16, source: 'choice', statRef: 'S26', note: '緊急避妊薬を使った' }],
            outcomes: {
              happens: { effects: [], setFlags: { pregnant: true }, next: 'END' },
              notHappens: { effects: [], setFlags: { pregnant: false }, next: 'END' },
            },
          },
        },
      ],
    },
  ],
};
