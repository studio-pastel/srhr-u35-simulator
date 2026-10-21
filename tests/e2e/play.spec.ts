// §12.3 の E2E。
import { expect, test, type Page } from '@playwright/test';

const EXIT_URL = 'https://www.google.co.jp/search?q=%E5%A4%A9%E6%B0%97';

/** コンソールのエラーと、CSP 違反を集める（§14 フェーズ3：CSP の下でコンソールにエラーが出ない） */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** 外部への通信をさせない。退出先だけは、ダミーのページを返す */
async function blockExternal(page: Page) {
  await page.route(/^https?:\/\/(?!localhost)/, (route) =>
    route.request().url().startsWith('https://www.google.co.jp/')
      ? route.fulfill({ contentType: 'text/html', body: '<html><body>exit</body></html>' })
      : route.abort(),
  );
}

/** オンボーディング（タイトル → あそびかた → 安心して遊ぶために）を進めて、主人公を選ぶ画面へ */
async function onboard(page: Page) {
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '主人公を選ぶ' }).click();
}

async function start(page: Page, name: string) {
  await page.goto('/#/select');
  await page.getByRole('button', { name: `${name}で始める` }).click();
}

/**
 * 最初の選択肢と吹き出しを押し続けて、全体のふりかえりまで進める。
 * 数百回のクリックになるため、ループはページの中で回す（押すのは画面の実際のボタン）。
 */
async function playToEnd(page: Page): Promise<string[]> {
  const result = await page.evaluate(async () => {
    const reviews: string[] = [];
    const wait = () => new Promise((r) => setTimeout(r, 20));
    for (let i = 0; i < 1500; i++) {
      const main = document.querySelector('main')!;
      const h1 = main.querySelector('h1')?.textContent ?? '';
      if (h1.includes('16歳から35歳まで')) return { ok: true, reviews };
      const m = h1.match(/(\d+)歳のふりかえり/);
      if (m && reviews.at(-1) !== m[1]) reviews.push(m[1]!);
      // 選択肢 → 吹き出し → そのほかのボタン（はじめる・次へ・物語にもどる など）の順に押す
      const b =
        main.querySelector<HTMLButtonElement>('.choices button.btn') ??
        main.querySelector<HTMLButtonElement>('button.next-tap') ??
        main.querySelector<HTMLButtonElement>('button.btn:not(.small):not([disabled])');
      if (!b) return { ok: false, reviews, stuck: main.innerText.slice(0, 300) };
      b.click();
      await wait();
    }
    return { ok: false, reviews };
  });
  if (!result.ok) throw new Error(`全体のふりかえりに着きませんでした：${JSON.stringify(result)}`);
  return result.reviews;
}

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

for (const name of ['ミナミ', 'ハルト', 'ユウ', 'ケイ']) {
  test(`${name}で16歳から35歳まで通しでプレイできる（CSP の下でエラーなし）`, async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, name);
    await expect(page.locator('main h1')).toContainText('16歳');
    const reviews = await playToEnd(page);
    expect(reviews).toEqual(['16', '17', '19', '21', '24', '27', '30', '35']);
    await expect(page.getByRole('heading', { name: '4人の軌跡を重ねる' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('「すぐに閉じる」で exitUrl に移動し、ブラウザの「戻る」で戻れない', async ({ page }) => {
  // トップページから、画面の操作だけで進む（サイト内の移動では履歴を増やさない）
  await page.goto('/');
  await onboard(page);
  await page.getByRole('button', { name: 'ユウで始める' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('link', { name: /私も相談したいことがある/ }).click();
  await page.getByRole('link', { name: '物語にもどる' }).click();
  await page.getByRole('button', { name: 'すぐに閉じる' }).click();
  await page.waitForURL(EXIT_URL);
  await page.goBack().catch(() => undefined);
  expect(page.url()).not.toContain('localhost:4173');
});

test('ブラウザの「戻る」でサイトを離れても、同じタブで戻れば続きから遊べる', async ({ page }) => {
  // 別のサイトから来た状態をつくる
  await page.goto('https://www.google.co.jp/search?q=before');
  await page.goto('/');
  await onboard(page);
  await page.getByRole('button', { name: 'ケイで始める' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  for (let i = 0; i < 3; i++) await page.locator('main button.next-tap').first().click();
  const saved = await page.evaluate(() => sessionStorage.getItem('srhr.v1.run'));
  expect(saved).not.toBeNull();

  // 「戻る」：サイト内の移動は履歴に残らないので、前のサイトに戻る
  await page.goBack();
  expect(page.url()).toContain('google.co.jp');

  // 「進む」で戻ると、同じ場面から続けられる（場面の中の吹き出しは、その場面の最初から表示する）
  await page.goForward();
  await expect(page.locator('main button.next-tap')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('srhr.v1.run'))).toBe(saved);

  // URL を入れ直して開いても（同じタブなら）、「続きから遊ぶ」が出る
  await page.goto('/');
  await expect(page.getByRole('button', { name: '続きから遊ぶ' })).toBeVisible();
});

test('Esc キーでも「すぐに閉じる」が動き、進行状況が消える', async ({ page }) => {
  await start(page, 'ケイ');
  await page.getByRole('button', { name: 'はじめる' }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('srhr.v1.run'))).not.toBeNull();
  await page.keyboard.press('Escape');
  await page.waitForURL(EXIT_URL);
  await page.goto('/#/play');
  await expect(page.getByRole('heading', { name: '進行中の周回がありません' })).toBeVisible();
});

test('キーボードだけで1章を終えられる', async ({ page }) => {
  await page.goto('/#/select');
  // 「ミナミで始める」までタブで移動して Enter
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'ミナミで始める') break;
  }
  await page.keyboard.press('Enter');
  for (let i = 0; i < 300; i++) {
    if (await page.getByRole('heading', { name: '16歳のふりかえり' }).isVisible()) break;
    await page.keyboard.press('Tab');
    const isAction = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return Boolean(el?.matches('main button.btn:not(.small), main button.next-tap'));
    });
    if (isAction) await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { name: '16歳のふりかえり' })).toBeVisible();
  // フォーカスが見える（outline が付いている）
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');
});

test('2周目の「同じ偶然で、条件だけ変える」で、比較画面に差分が出る', async ({ page }) => {
  const errors = watchErrors(page);
  await start(page, 'ミナミ');
  await expect(page.locator('main h1')).toContainText('16歳');
  await playToEnd(page);
  await page.getByRole('button', { name: '2周目へ' }).click();
  await page.getByLabel('学校では学ばなかった').check();
  await page.getByRole('button', { name: '同じ偶然で、条件だけ変える' }).click();
  // 画面がプレイ（16歳の章トップ）に切り替わってから進める
  await expect(page.locator('main h1')).toContainText('16歳');
  await playToEnd(page);
  await page.getByRole('button', { name: '前の周回と比べる' }).click();
  await expect(page.getByRole('heading', { name: '2つの周回を比べる' })).toBeVisible();
  await expect(page.locator('main')).toContainText('変えた社会条件：学校の性教育');
  await expect(page.locator('main')).toContainText('差が出た章と、その理由');
  await expect(page.locator('main section h3').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('幅360pxで横スクロールが出ない', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ['/', '/#/select', '/#/support', '/#/sources', '/#/settings', '/#/about']) {
    await page.goto(path);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(sw, path).toBeLessThanOrEqual(iw);
  }
});

test('相手の視点は「そのころ、〇〇は……」から、のぞいたときだけ読める（付録B-11）', async ({ page }) => {
  await start(page, 'ミナミ');
  // 17歳の最初のイベント（するかどうか）を終えて「そのころ」が出るまで進める
  const reached = await page.evaluate(async () => {
    const wait = () => new Promise((r) => setTimeout(r, 20));
    for (let i = 0; i < 600; i++) {
      const main = document.querySelector('main')!;
      if (main.querySelector('.peek')) return true;
      const b =
        main.querySelector<HTMLButtonElement>('.choices button.btn') ??
        main.querySelector<HTMLButtonElement>('button.next-tap') ??
        main.querySelector<HTMLButtonElement>('button.btn:not(.small):not([disabled])');
      b?.click();
      await wait();
    }
    return false;
  });
  expect(reached).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('そのころ、ハルトは……');
  // のぞくまでは、相手の会話は出ない
  await expect(page.locator('.peek .chat-log')).toHaveCount(0);
  await page.getByRole('button', { name: 'ハルトの側を、のぞいてみる' }).click();
  await expect(page.locator('.peek .chat-log')).toContainText('ハルト（心の声）');
  await expect(page.locator('.peek .choices')).toHaveCount(0); // 相手の視点に選択肢はない
  await page.getByRole('button', { name: '先へ進む' }).click();
  await expect(page.locator('.peek')).toHaveCount(0);
});
