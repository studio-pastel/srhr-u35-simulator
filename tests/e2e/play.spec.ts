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

async function start(page: Page, name: string) {
  await page.goto('/#/select');
  await page.getByRole('button', { name: `${name}で始める` }).click();
}

/**
 * 最初の選択肢（トリガー注意では「読む」）を押し続けて、全体のふりかえりまで進める。
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
      const buttons = [...main.querySelectorAll<HTMLButtonElement>('button.btn:not(.small):not([disabled])')];
      const b = buttons.find((x) => x.textContent?.trim() === '読む') ?? buttons[0];
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
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: 'ユウで始める' }).click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('link', { name: '相談窓口' }).click();
  await page.getByRole('link', { name: '物語にもどる' }).click();
  await page.getByRole('button', { name: 'すぐに閉じる' }).click();
  await page.waitForURL(EXIT_URL);
  await page.goBack().catch(() => undefined);
  expect(page.url()).not.toContain('localhost:4173');
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
      return Boolean(el?.matches('main button.btn:not(.small)'));
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
  for (const path of ['/', '/#/select', '/#/resources', '/#/sources', '/#/settings', '/#/about']) {
    await page.goto(path);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(sw, path).toBeLessThanOrEqual(iw);
  }
});
