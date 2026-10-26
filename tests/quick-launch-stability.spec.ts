import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';

const card = (page: Page) =>
  page.getByRole('listitem', { name: '빠른 실행 업무 1', exact: true });
const run = (page: Page) =>
  card(page).getByRole('button', { name: '실행', exact: true });
async function opens(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    Object.defineProperty(window, '__stableOpens', { value: calls });
    window.open = (...args) => {
      calls.push(args);
      return null;
    };
  });
}
async function visibleAgain(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
}

test('real 60-second idle keeps requests, card geometry and synchronous execution stable', async ({
  page,
}) => {
  test.setTimeout(100000);
  const start = Date.now();
  const api = await presetApi(page, 3);
  await opens(page);
  await page.route('**/quick-launch-presets/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '실행', exact: true }),
  ).toHaveCount(3);
  for (const button of await page
    .getByRole('button', { name: '실행', exact: true })
    .all())
    await expect(button).toBeEnabled();
  const preparedMs = Date.now() - start;
  await card(page).getByRole('button', { name: '업무 1 펼치기' }).click();
  await expect(card(page).getByRole('list')).toBeVisible();
  const initialRequests = api.requests.length;
  await page.evaluate(() => {
    const samples: {
      height: number;
      links: number;
      busy: boolean;
      disabled: boolean;
    }[] = [];
    const capture = () => {
      const el = document.querySelector('[aria-label="빠른 실행 업무 1"]')!;
      const button = el.querySelector<HTMLButtonElement>(
        'button[aria-describedby]',
      )!;
      samples.push({
        height: el.getBoundingClientRect().height,
        links: el.querySelectorAll('ul > li').length,
        busy: button.getAttribute('aria-busy') === 'true',
        disabled: button.disabled,
      });
    };
    capture();
    const timer = setInterval(capture, 100);
    Object.defineProperty(window, '__stability', { value: { samples, timer } });
  });
  // Deliberately real elapsed time; no fake clock or revalidation event in idle.
  await page.waitForTimeout(60000);
  const samples: {
    height: number;
    links: number;
    busy: boolean;
    disabled: boolean;
  }[] = await page.evaluate(() => {
    const observation = Reflect.get(window, '__stability');
    clearInterval(observation.timer);
    return observation.samples;
  });
  expect(api.requests).toHaveLength(initialRequests);
  expect(initialRequests).toBe(4);
  expect(new Set(samples.map((s) => s.height)).size).toBe(1);
  expect(samples.every((s) => s.links === 2 && !s.busy && !s.disabled)).toBe(
    true,
  );
  const synchronous = await run(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    return Reflect.get(window, '__stableOpens');
  });
  expect(synchronous).toHaveLength(2);
  await mkdir('artifacts/wo-ui-06', { recursive: true });
  await writeFile(
    'artifacts/wo-ui-06/idle.json',
    JSON.stringify(
      {
        api: 'Mock',
        browser: 'Chromium',
        realTime: true,
        preparedMs,
        idleMs: 60000,
        initialRequests,
        additionalDetailRequests: api.requests.length - initialRequests,
        samples,
        synchronous,
      },
      null,
      2,
    ),
  );
});

test('preset save revalidates only its detail; display reorder retains fresh details', async ({
  page,
}) => {
  const api = await presetApi(page, 2);
  await page.goto('/');
  for (const button of await page
    .getByRole('button', { name: '실행', exact: true })
    .all())
    await expect(button).toBeEnabled();
  await expect(run(page)).toBeEnabled();
  const reads = (id: string) =>
    api.requests.filter((r) => r.method === 'GET' && r.path.endsWith(id))
      .length;
  await expect.poll(() => reads(api.items[1]!.id)).toBe(1);
  await card(page).getByRole('button', { name: '업무 1 펼치기' }).click();
  await card(page).getByRole('button', { name: '편집' }).click();
  await page.getByLabel('이름', { exact: true }).fill('수정된 빠른 실행');
  await page.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = api.items.find((p) => p.name === '수정된 빠른 실행')!;
  await expect.poll(() => reads(saved.id)).toBe(2);
  expect(reads(api.items.find((p) => p.name === '업무 2')!.id)).toBe(1);
  const before = api.requests.filter(
    (r) => r.method === 'GET' && r.path.split('/').length === 3,
  ).length;
  await page.getByRole('button', { name: '순서 변경', exact: true }).click();
  await page
    .getByRole('button', { name: '수정된 빠른 실행 아래로 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '빠른 실행 목록' }),
  ).toBeVisible();
  for (const button of await page
    .getByRole('button', { name: '실행', exact: true })
    .all())
    await expect(button).toBeEnabled();
  expect(
    api.requests.filter(
      (r) => r.method === 'GET' && r.path.split('/').length === 3,
    ),
  ).toHaveLength(before);
});

for (const status of [200, 500, 403, 404]) {
  test(`visibility revalidation keeps cached rows and safely handles ${status}`, async ({
    page,
  }) => {
    const api = await presetApi(page, 1);
    await opens(page);
    await page.clock.install();
    await page.goto('/');
    await expect(run(page)).toBeEnabled();
    await card(page).getByRole('button', { name: '업무 1 펼치기' }).click();
    const height = (await card(page).boundingBox())!.height;
    await page.clock.fastForward(16000);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/quick-launch-presets/*', async (route) => {
      await gate;
      await route.fallback();
    });
    api.detailFailure = status === 200 ? 0 : status;
    api.items[0]!.links[0]!.link.url = 'https://example.com/revalidated';
    await visibleAgain(page);
    await expect(run(page)).toBeDisabled();
    await expect(run(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(
      card(page).getByRole('list').locator(':scope > li'),
    ).toHaveCount(2);
    expect((await card(page).boundingBox())!.height).toBe(height);
    await expect(card(page).getByRole('link').first()).not.toHaveAttribute(
      'href',
    );
    release();
    if (status !== 200) {
      await expect(card(page).getByRole('alert')).toBeVisible();
      await expect(run(page)).toBeDisabled();
      await expect(card(page).getByRole('link').first()).not.toHaveAttribute(
        'href',
      );
      await expect(
        card(page).getByRole('list').locator(':scope > li'),
      ).toHaveCount(2);
      const count = api.requests.length;
      await page.clock.fastForward(60000);
      expect(api.requests).toHaveLength(count);
      api.detailFailure = 0;
      await card(page).getByRole('button', { name: '다시 불러오기' }).click();
    }
    await expect(run(page)).toBeEnabled();
    expect(
      await page.evaluate(() => Reflect.get(window, '__stableOpens')),
    ).toEqual([]);
    await run(page).click();
    expect(
      await page.evaluate(() => Reflect.get(window, '__stableOpens')),
    ).toEqual([
      ['https://example.com/revalidated', '_blank', 'noopener,noreferrer'],
      [api.items[0]!.links[1]!.link.url, '_blank', 'noopener,noreferrer'],
    ]);
  });
}
