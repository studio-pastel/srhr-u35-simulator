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

/** 乱数を固定して、同じ属性の主人公が出るようにする（数字ごとに別の人生になる） */
async function fixSeed(page: Page, n: number) {
  await page.addInitScript((v) => {
    // 2回目からは値を変える（周回のIDが前の周回と重ならないように）
    let i = 0;
    crypto.getRandomValues = ((a: Uint8Array) => a.fill(v + i++)) as typeof crypto.getRandomValues;
  }, n);
}

/** 最初の画面から始めて、生まれてから15歳までをとばし、16歳の幕間へ */
async function begin(page: Page) {
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: '15歳までとばす' }).click();
  await page.getByRole('button', { name: '16歳へ' }).click();
}

async function start(page: Page, n = 1) {
  await fixSeed(page, n);
  await page.goto('/');
  await begin(page);
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
      if (h1.includes('試作はここまで') || h1.includes('16歳から35歳まで')) return { ok: true, reviews };
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

for (const n of [1, 2, 3, 4]) {
  test(`ランダムな主人公${n}で最後まで通しでプレイできる（CSP の下でエラーなし）`, async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, n);
    await expect(page.locator('main h1')).toContainText('16歳');
    const reviews = await playToEnd(page);
    expect(reviews).toEqual(['16', '17']);
    await expect(page.getByRole('heading', { name: '変化の理由' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('「すぐに閉じる」で exitUrl に移動し、ブラウザの「戻る」で戻れない', async ({ page }) => {
  // トップページから、画面の操作だけで進む（サイト内の移動では履歴を増やさない）
  await page.goto('/');
  await begin(page);
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
  await begin(page);
  await page.getByRole('button', { name: 'はじめる' }).click();
  for (let i = 0; i < 2; i++) await page.locator('main button.next-tap').first().click();
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
  await start(page);
  await page.getByRole('button', { name: 'はじめる' }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('srhr.v1.run'))).not.toBeNull();
  await page.keyboard.press('Escape');
  await page.waitForURL(EXIT_URL);
  await page.goto('/#/play');
  await expect(page.getByRole('heading', { name: '進行中の周回がありません' })).toBeVisible();
});

test('キーボードだけで1章を終えられる', async ({ page }) => {
  await page.goto('/');
  // 「はじめる」までタブで移動して Enter
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'はじめる') break;
  }
  await page.keyboard.press('Enter');
  // 並列で動かすと遅くなるため、回数に余裕を持たせる
  for (let i = 0; i < 800; i++) {
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
  await start(page);
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
  for (const path of ['/', '/#/support', '/#/sources', '/#/settings', '/#/about']) {
    await page.goto(path);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(sw, path).toBeLessThanOrEqual(iw);
  }
});

test('1周目のあと、属性だけ変えて2周目を遊べる（付録B-43）', async ({ page }) => {
  const errors = watchErrors(page);
  await start(page);
  await expect(page.locator('main h1')).toContainText('16歳');
  await playToEnd(page);
  await page.getByRole('button', { name: '2周目へ' }).click();
  await page.getByRole('group', { name: '性自認' }).getByLabel('トランスジェンダー女性').check();
  await page.getByLabel('性別を問わない').check();
  await page.getByLabel('苦しい').check();
  await page.getByRole('button', { name: 'この属性で、もう一度' }).click();
  await expect(page.locator('main h1')).toContainText('16歳');
  await playToEnd(page);
  await page.getByRole('button', { name: '前の周回と比べる' }).click();
  await expect(page.getByRole('heading', { name: '2つの周回を比べる' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('最初の画面の「はじめる」から、生まれた日を通って16歳に着き、左上に「私」が出る（付録B-45）', async ({ page }) => {
  const errors = watchErrors(page);
  await fixSeed(page, 5);
  await page.goto('/');
  await expect(page.locator('main')).toContainText('安心して遊ぶために');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('main h1')).toContainText('生まれた日');
  await expect(page.locator('.topbar-me')).toContainText('私（');
  for (let i = 0; i < 80 && !(await page.getByRole('button', { name: '16歳へ' }).isVisible()); i++) {
    const choice = page.locator('.choices button').first();
    if (await choice.isVisible()) await choice.click();
    else await page.locator('button.next-tap').click();
  }
  await expect(page.locator('main h1')).toContainText('15歳');
  await page.getByRole('button', { name: '16歳へ' }).click();
  await expect(page.locator('.topbar-me')).toContainText('16歳');
  expect(errors).toEqual([]);
});
