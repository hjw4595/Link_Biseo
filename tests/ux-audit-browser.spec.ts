import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, testSession, testUser } from './auth-fixture';
import { installProductApi } from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { bookmarkHtml } from './bookmark-browser-helper';

for (const name of ['chrome', 'msedge', 'firefox', 'webkit'] as const)
  test(`UX audit browser ${name}`, async () => {
    test.setTimeout(90000);
    const browser =
      name === 'firefox'
        ? await firefox.launch({
            firefoxUserPrefs: { 'dom.disable_open_during_load': true },
          })
        : name === 'webkit'
          ? await webkit.launch()
          : await chromium.launch({
              channel: name,
              ignoreDefaultArgs: ['--disable-popup-blocking'],
            });
    const context = await browser.newContext({
      baseURL: 'http://localhost:3100',
      viewport: { width: 390, height: 900 },
    });
    const observed: Record<string, unknown> = {
      browser: name,
      version: browser.version(),
      api: 'Mock',
      device: 'Windows automated profile, not native mobile/Safari',
    };
    try {
      await context.route(
        /^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/,
        (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<h1>Mock external site</h1>',
          }),
      );
      const api = await installProductApi(context);
      const page = await context.newPage();
      await page.addInitScript(() => {
        const calls: {
          target: string | undefined;
          features: string | undefined;
        }[] = [];
        Object.defineProperty(window, '__uxOpenCalls', { value: calls });
        const original = window.open;
        window.open = function (url, target, features) {
          calls.push({ target, features });
          return original.call(window, url, target, features);
        };
      });
      await page.route('**/auth/v1/token?grant_type=password', (route) =>
        route.fulfill({
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3100',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
          json: testSession(false, 'email'),
        }),
      );
      await presetApi(page, 1, 2);
      await page.goto('/login');
      // A dev connection can stay busy after the login UI is usable. Wait for
      // the controls and fonts we actually capture, not unrelated network idle.
      await expect(page.getByLabel('이메일', { exact: true })).toBeEditable();
      await expect(page.getByLabel('비밀번호', { exact: true })).toBeEditable();
      await expect(
        page.getByRole('button', { name: '이메일로 로그인', exact: true }),
      ).toBeEnabled();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await mkdir('artifacts/wo-v1-06/screenshots', { recursive: true });
      await page.screenshot({
        path: `artifacts/wo-v1-06/screenshots/${name}-login-390.png`,
      });
      await page
        .getByLabel('이메일', { exact: true })
        .pressSequentially(testUser.email, { delay: 40 });
      await page
        .getByLabel('비밀번호', { exact: true })
        .pressSequentially('audit-mock-password', { delay: 40 });
      await page.getByLabel('비밀번호', { exact: true }).press('Enter');
      await expect(page).toHaveURL('/');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page
        .getByRole('button', { name: '업무 1 펼치기', exact: true })
        .click();
      await page.getByRole('button', { name: '편집', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const memberRows = page.getByRole('list', { name: '선택한 링크 순서' });
      const down = memberRows.getByRole('button', {
        name: 'ChatGPT 아래로 이동',
        exact: true,
      });
      const up = memberRows.getByRole('button', {
        name: 'ChatGPT 위로 이동',
        exact: true,
      });
      await down.click();
      await expect(up).toBeFocused();
      await up.click();
      await expect(down).toBeFocused();
      const deleteTrigger = page.getByRole('button', {
        name: '빠른 실행 삭제',
        exact: true,
      });
      await deleteTrigger.click();
      const confirm = page.getByRole('alertdialog');
      await expect(confirm.getByRole('button', { name: '취소' })).toBeFocused();
      await page.keyboard.press('Tab');
      expect(
        await confirm.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press('Escape');
      await expect(confirm).toHaveCount(0);
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(deleteTrigger).toBeFocused();
      await page.keyboard.press('Escape');
      await expect
        .soft(page.getByRole('button', { name: '편집', exact: true }))
        .toBeFocused();
      observed.pointerCloseFocus = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: document.activeElement?.textContent,
      }));
      await page.screenshot({
        path: `artifacts/wo-v1-06/screenshots/${name}-sheet-return-390.png`,
      });
      await page.getByRole('button', { name: '편집', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: '편집', exact: true }),
      ).toBeFocused();
      observed.keyboardCloseFocus = true;
      observed.loginAndSheet = true;
      await expect(
        page.getByRole('button', { name: '실행', exact: true }),
      ).toBeEnabled();
      const recordsBefore = [
        ...(api.users.get(testUser.id)?.events.values() ?? []),
      ].reduce((sum, items) => sum + items.length, 0);
      await page.getByRole('button', { name: '실행', exact: true }).click();
      await expect(
        page.getByText('링크 열기를 요청했어요.', { exact: true }),
      ).toBeVisible();
      await expect
        .poll(
          () =>
            api.requests.filter(
              (r) => r.method() === 'POST' && r.url().endsWith('/open'),
            ).length,
        )
        .toBe(2);
      const opened = context.pages().filter((p) => p !== page);
      observed.requestedLinks = 2;
      observed.openCalls = await page.evaluate(() => {
        const value: unknown = Reflect.get(window, '__uxOpenCalls');
        return value;
      });
      observed.observedTabs = opened.length;
      observed.mockServerOpenRecords =
        [...(api.users.get(testUser.id)?.events.values() ?? [])].reduce(
          (sum, items) => sum + items.length,
          0,
        ) - recordsBefore;
      for (const popup of opened) {
        await popup.waitForLoadState();
        await popup.close();
      }
      await expect(page).toHaveURL('/');
      const popupPromise = context.waitForEvent('page');
      await page
        .getByRole('link', { name: /개별 열기/ })
        .first()
        .click();
      const fallback = await popupPromise;
      await fallback.waitForLoadState();
      observed.fallback = await fallback.evaluate(() => window.opener === null);
      await fallback.close();
      await expect
        .poll(
          () =>
            api.requests.filter(
              (r) => r.method() === 'POST' && r.url().endsWith('/open'),
            ).length,
        )
        .toBe(3);
      await page.goto('/links');
      await expect(page.getByTestId('link-item')).toHaveCount(8);
      await page.getByTestId('link-item').first().locator('a').first().click();
      await expect(
        page.getByRole('heading', { name: 'Mock external site' }),
      ).toBeVisible();
      observed.singleCurrentTab = true;
      await page.goto('/links/import');
      const file = page.getByLabel('HTML 파일 선택', { exact: true });
      await expect(file).toBeEnabled();
      await file.setInputFiles({
        name: 'audit.html',
        mimeType: 'text/html',
        buffer: Buffer.from(bookmarkHtml(3)),
      });
      await expect(
        page.getByRole('button', { name: '선택한 링크 가져오기', exact: true }),
      ).toBeEnabled();
      observed.fileUpload = true;
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      observed.responsive = [320, 390, 768, 1440];
      await page.screenshot({
        path: `artifacts/wo-v1-06/screenshots/${name}-import-1440.png`,
        fullPage: true,
      });
      await page.goto('/settings');
      await page.getByRole('button', { name: '로그아웃', exact: true }).click();
      await expect(page).toHaveURL('/login');
      observed.logout = true;
    } catch (error) {
      observed.lastScreen = await context
        .pages()[0]
        ?.locator('body')
        .innerText()
        .catch(() => 'unavailable');
      observed.failure = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await mkdir('artifacts/wo-v1-06', { recursive: true });
      await writeFile(
        `artifacts/wo-v1-06/browser-${name}.json`,
        JSON.stringify(observed, null, 2),
      );
      await context.close();
      await browser.close();
    }
  });
