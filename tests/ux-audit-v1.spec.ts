// WO-V1-06 observation fixtures only. No production imports are modified.
import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, testUser } from './auth-fixture';
import {
  fixtureId,
  initialProduct,
  installProductApi,
} from './product-fixture';
import { presetApi } from './quick-launch-fixture';
import { bookmarkHtml } from './bookmark-browser-helper';
import { expectLayoutWidth } from './layout-assertions';

const root = 'artifacts/wo-v1-06';
async function save(name: string, data: unknown) {
  await mkdir(root, { recursive: true });
  await writeFile(`${root}/${name}.json`, JSON.stringify(data, null, 2));
}
async function shot(page: Page, name: string) {
  await mkdir(`${root}/screenshots`, { recursive: true });
  await page.screenshot({
    path: `${root}/screenshots/${name}.png`,
    fullPage: true,
  });
}
async function metrics(page: Page) {
  return page.evaluate(() => {
    const audit: unknown = Reflect.get(window, '__uxAudit');
    const value = (name: string): unknown =>
      audit && typeof audit === 'object' && name in audit
        ? Reflect.get(audit, name)
        : 'unmeasured';
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top + scrollY, height: b.height, width: b.width };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      favorites: box('[aria-labelledby="home-favorites-heading"]'),
      sections: Array.from(document.querySelectorAll('main section')).map(
        (el) => ({
          name:
            el.getAttribute('aria-label') ??
            el.querySelector('h2')?.textContent,
          top: el.getBoundingClientRect().top + scrollY,
          height: el.getBoundingClientRect().height,
        }),
      ),
      card: box('[aria-label="빠른 실행 목록"] > li'),
      management: box('[aria-label="링크 관리 도구"]'),
      h1: Array.from(document.querySelectorAll('h1')).map(
        (el) => el.textContent,
      ),
      h2: Array.from(document.querySelectorAll('h2')).map(
        (el) => el.textContent,
      ),
      visibleButtons: Array.from(document.querySelectorAll('button')).filter(
        (el) => el.getBoundingClientRect().height > 0,
      ).length,
      smallControls: Array.from(
        document.querySelectorAll('button,a,input,select'),
      )
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && (b.width < 24 || b.height < 24);
        })
        .map((el) => ({
          text: (el.getAttribute('aria-label') ?? el.textContent ?? '').slice(
            0,
            80,
          ),
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
      cls: value('cls'),
      longTaskMs: value('longTaskMs'),
      colors: Object.fromEntries(
        [
          '--background',
          '--surface',
          '--foreground',
          '--text-secondary',
          '--accent',
          '--danger',
          '--disabled',
        ].map((name) => [
          name,
          getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim(),
        ]),
      ),
    };
  });
}

const scales = [
  { name: 'zero', links: 0, categories: 0, favorites: 0, presets: 0 },
  { name: 'small', links: 5, categories: 3, favorites: 2, presets: 2 },
  { name: 'medium', links: 50, categories: 10, favorites: 10, presets: 8 },
  { name: 'large', links: 200, categories: 20, favorites: 30, presets: 30 },
  { name: 'max', links: 200, categories: 20, favorites: 30, presets: 50 },
];
for (const scale of scales)
  for (const width of [390, 1440])
    test(`UX audit ${scale.name} data at ${width}px`, async ({
      page,
      context,
      browser,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        const audit = { cls: 0, longTaskMs: 0 };
        Object.defineProperty(window, '__uxAudit', { value: audit });
        for (const type of ['layout-shift', 'longtask']) {
          let total = 0;
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (
                  type === 'layout-shift' &&
                  'value' in entry &&
                  typeof entry.value === 'number' &&
                  (!('hadRecentInput' in entry) || !entry.hadRecentInput)
                )
                  total += entry.value;
                if (type === 'longtask') total += entry.duration;
              }
              audit[type === 'layout-shift' ? 'cls' : 'longTaskMs'] = total;
            }).observe({ type, buffered: true });
          } catch {
            /* Unsupported browser metrics remain unmeasured. */
          }
        }
      });
      const api = await installProductApi(context);
      const state = initialProduct();
      const baseCategory = state.categories[0]!;
      const baseLink = state.links[0]!;
      state.categories = Array.from({ length: scale.categories }, (_, i) => ({
        ...baseCategory,
        id: fixtureId(`audit-category-${i}`),
        name: `관심 카테고리 ${i + 1}`,
        sortOrder: i,
      }));
      state.links = Array.from({ length: scale.links }, (_, i) => ({
        ...baseLink,
        id: fixtureId(`audit-link-${i}`),
        title: `Audit link ${String(i).padStart(4, '0')} 한글 日本語`,
        url: `https://audit.example.test/${i}`,
        domain: 'audit.example.test',
        categoryId:
          state.categories[i % Math.max(1, scale.categories)]?.id ?? null,
        isFavorite: i < scale.favorites,
        clickCount: 0,
        lastOpenedAt: null,
      }));
      api.users.set(testUser.id, state);
      const presets = await presetApi(page, scale.presets);
      presets.items.forEach((preset, i) => {
        preset.name = `업무 묶음 ${String(i + 1).padStart(2, '0')}`;
        preset.links = state.links
          .slice(0, scale.name === 'max' ? 20 : 3)
          .map((link, sortOrder) => ({ link, sortOrder }));
        preset.linkCount = preset.links.length;
      });
      const requests: { method: string; path: string; query: string }[] = [];
      page.on('request', (r) => {
        const u = new URL(r.url());
        if (u.origin === 'http://127.0.0.1:54329')
          requests.push({
            method: r.method(),
            path: u.pathname,
            query: u.search,
          });
      });
      const started = performance.now();
      await page.goto('/');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      if (!scale.favorites)
        await expect(
          page.getByText('즐겨찾기한 링크가 없어요.', { exact: true }),
        ).toBeVisible();
      await expect(
        page
          .getByRole('region', { name: '즐겨찾기', exact: true })
          .getByTestId('link-item'),
      ).toHaveCount(Math.min(6, scale.favorites));
      if (scale.presets && width >= 1024)
        await expect(
          page
            .getByRole('list', { name: '빠른 실행 목록' })
            .locator(':scope > li'),
        ).toHaveCount(Math.min(6, scale.presets));
      if (width < 1024) {
        await expect(
          page.getByRole('region', { name: '빠른 실행', exact: true }),
        ).toHaveCount(0);
        expect(
          requests.filter((r) => r.path.startsWith('/quick-launch-presets')),
        ).toHaveLength(0);
      }
      const homeReadyMs = performance.now() - started;
      await expectLayoutWidth(page);
      const home = await metrics(page);
      const homeRequests = [...requests];
      await shot(page, `${scale.name}-home-${width}`);
      if (scale.presets) {
        // PC entry followed by resize preserves the same editor coverage on mobile.
        if (width < 1024)
          await page.setViewportSize({ width: 1440, height: 900 });
        await page
          .getByRole('button', { name: /펼치기$/ })
          .first()
          .click();
        await page
          .getByRole('button', { name: '편집', exact: true })
          .first()
          .click();
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByLabel('이름', { exact: true })).toBeVisible();
        await shot(page, `${scale.name}-preset-editor-${width}`);
        await page.keyboard.press('Escape');
      }
      requests.length = 0;
      const linksStart = performance.now();
      await page.goto('/links');
      await expect(page.getByTestId('link-item')).toHaveCount(
        Math.min(20, scale.links),
      );
      if (!scale.links)
        await expect(
          page.getByText('아직 링크가 없어요', { exact: true }),
        ).toBeVisible();
      const linksReadyMs = performance.now() - linksStart;
      const firstPage = await metrics(page);
      const firstRequests = [...requests];
      await shot(page, `${scale.name}-links-${width}`);
      const paginationStart = performance.now();
      while (
        await page.getByRole('button', { name: '더 보기', exact: true }).count()
      ) {
        const count = await page.getByTestId('link-item').count();
        await page
          .getByRole('button', { name: '더 보기', exact: true })
          .click();
        await expect(page.getByTestId('link-item')).toHaveCount(
          Math.min(count + 20, scale.links),
        );
      }
      const paginationMs = performance.now() - paginationStart;
      const allPages = await metrics(page);
      const allRequests = [...requests];
      if (scale.links >= 50)
        await shot(page, `${scale.name}-all-links-${width}`);
      let searchMs: number | null = null;
      if (scale.links) {
        const t = performance.now();
        await page
          .getByRole('searchbox')
          .fill(`Audit link ${String(scale.links - 1).padStart(4, '0')}`);
        await expect(page.getByTestId('link-item')).toHaveCount(1);
        searchMs = performance.now() - t;
        await page.getByRole('searchbox').fill('no-such-link-audit');
        await expect(page.getByTestId('link-item')).toHaveCount(0);
        await shot(page, `${scale.name}-search-empty-${width}`);
      }
      const screens: Record<string, unknown> = {};
      if (scale.name === 'small' || scale.name === 'zero') {
        const routes = [
          ['categories', '/categories'],
          ['settings', '/settings'],
          ['organization', '/assistant/organization'],
          ['new-link', '/links/new'],
        ] as const;
        for (const [name, route] of routes) {
          await page.goto(route);
          await expect(
            page.getByRole('navigation', {
              includeHidden: name === 'new-link',
            }),
          ).toBeVisible();
          if (name === 'settings')
            await expect(
              page.getByRole('heading', { name: '계정', exact: true }),
            ).toBeVisible();
          if (name === 'settings')
            await expect(
              page.getByLabel('미사용 링크 추천 기간', { exact: true }),
            ).toBeEnabled();
          if (name === 'categories') {
            if (scale.categories)
              await expect(
                page
                  .getByRole('list', { name: '저장된 카테고리' })
                  .locator(':scope > li'),
              ).toHaveCount(scale.categories);
            else
              await expect(
                page.getByText('아직 카테고리가 없어요.', { exact: true }),
              ).toBeVisible();
          }
          if (name === 'organization')
            await expect(
              page.getByText('원할 때 추천을 확인하세요'),
            ).toBeVisible();
          screens[name] = await metrics(page);
          await shot(page, `${scale.name}-${name}-${width}`);
        }
        if (scale.links) {
          await page.goto(`/links/${state.links[0]!.id}`);
          await expect(
            page.getByRole('heading', { name: '사용 빈도' }),
          ).toBeVisible();
          await expect(page.getByText(/회 열었어요/)).toBeVisible();
          screens.detail = await metrics(page);
          await shot(page, `${scale.name}-detail-${width}`);
          await page.goto(`/category/${state.categories[0]!.id}`);
          await expect(page.getByTestId('link-item')).toHaveCount(2);
          screens.category = await metrics(page);
          await shot(page, `${scale.name}-category-${width}`);
        }
        await page.goto('/links/import');
        const file = page.getByLabel('HTML 파일 선택', { exact: true });
        await expect(file).toBeEnabled();
        await file.setInputFiles({
          name: 'audit.html',
          mimeType: 'text/html',
          buffer: Buffer.from(bookmarkHtml(25)),
        });
        await expect(
          page.getByRole('button', {
            name: '선택한 링크 가져오기',
            exact: true,
          }),
        ).toBeEnabled();
        screens.import = await metrics(page);
        await shot(page, `${scale.name}-import-${width}`);
      }
      await save(`scale-${scale.name}-${width}`, {
        environment: {
          browser: browser.version(),
          viewport: width,
          server: 'Next dev localhost:3100',
          transport: 'Mock API route.fulfill, no latency throttling',
          samples: 1,
          cache: 'page.goto cold client; warm development compilation varies',
        },
        scale,
        homeReadyMs,
        linksReadyMs,
        paginationMs,
        searchMs,
        home,
        firstPage,
        allPages,
        homeRequests,
        firstRequests,
        allRequests,
        screens,
        automaticReportPosts: requests.filter(
          (r) => r.method === 'POST' && r.path === '/organization-reports',
        ).length,
      });
    });

test('UX audit category error and empty search', async ({ page, context }) => {
  const api = await installProductApi(context);
  await context.route('http://127.0.0.1:54329/categories', (route) =>
    route.fulfill({
      status: 500,
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {},
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/links');
  await expect(page.getByTestId('link-item')).toHaveCount(8);
  await shot(page, 'category-error-links-1440');
  const categoryError = await metrics(page);
  const placeholderCount = await page
    .getByText('카테고리 확인 중', { exact: true })
    .count();
  await page.getByRole('searchbox').fill('totally-absent-audit-query');
  await expect(page.getByTestId('link-item')).toHaveCount(0);
  const emptyText = await page.locator('main').innerText();
  await shot(page, 'search-no-results-1440');
  await save('state-observations', {
    categoryError,
    placeholderCount,
    emptyText,
    requests: api.requests.map((r) => ({
      method: r.method(),
      path: new URL(r.url()).pathname,
    })),
  });
});
