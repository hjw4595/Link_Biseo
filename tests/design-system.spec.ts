import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from './auth-fixture';
import { presetApi } from './quick-launch-fixture';
import { cn } from '../src/lib/utils';

const root = 'artifacts/wo-ui-05/design-system';
const phase = process.env.UI_CAPTURE_PHASE === 'before' ? 'before' : 'after';
const screens = [
  ['home-mobile', '/', 390],
  ['home-pc', '/', 1440],
  ['preset-expanded', '/', 1440],
  ['links', '/links', 1440],
  ['categories', '/categories', 1440],
  ['new-link', '/links/new', 390],
  ['settings', '/settings', 1440],
] as const;

test.describe('fixed-time visual baselines', () => {
  const visualTime = '2026-10-31T03:00:00.000Z';
  test.use({ productTime: visualTime, timezoneId: 'Asia/Seoul' });

  for (const [name, route, width] of screens) {
    test(`design system visual baseline ${name}`, async ({ page }) => {
      // Keep timers running normally; only Date is fixed for these seven snapshots.
      await page.clock.setFixedTime(new Date(visualTime));
      await presetApi(page, 2);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      if (route === '/') {
        await expect(
          page.getByRole('button', { name: '비서의 추천', exact: true }),
        ).toBeVisible();
        await expect(page.getByTestId('link-item')).toHaveCount(3);
        await expect(
          page.getByRole('region', { name: '카테고리', exact: true }),
        ).toHaveCount(0);
        if (width >= 1024)
          await expect(
            page.getByRole('button', { name: '업무 1 펼치기' }),
          ).toBeVisible();
      }
      if (name === 'preset-expanded') {
        await page.getByRole('button', { name: '업무 1 펼치기' }).click();
        await expect(
          page
            .getByRole('list', { name: '업무 1 포함 링크' })
            .getByRole('link'),
        ).toHaveCount(2);
        // Capture the expanded state without a pointer-dependent hover color.
        await page.mouse.move(0, 0);
      }
      if (route === '/links')
        await expect(page.getByTestId('link-item')).toHaveCount(8);
      if (route === '/categories')
        await expect(
          page
            .getByRole('list', { name: '저장된 카테고리' })
            .locator(':scope > li'),
        ).toHaveCount(6);
      if (route === '/links/new')
        await expect(page.locator('#category option')).toHaveCount(7);
      if (route === '/settings') {
        await expect(
          page.locator('[aria-label="최근 7일 사용한 링크"]'),
        ).toContainText('0개');
        await expect(
          page.getByLabel('미사용 링크 추천 기간', { exact: true }),
        ).toBeEnabled();
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixels: 0,
      });
      await mkdir(`${root}/${phase}`, { recursive: true });
      await page.screenshot({
        path: `${root}/${phase}/${name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      const metrics = await page
        .locator(
          'header, h1, h2, h3, input, select, [data-slot="button"], [data-testid="link-item"]',
        )
        .evaluateAll((elements) =>
          elements
            .filter((e) => e.getClientRects().length)
            .map((e) => {
              const s = getComputedStyle(e),
                r = e.getBoundingClientRect();
              return {
                tag: e.tagName,
                text: e.textContent?.trim(),
                width: r.width,
                height: r.height,
                color: s.color,
                background: s.backgroundColor,
                border: s.borderColor,
                radius: s.borderRadius,
                font: s.fontFamily,
                size: s.fontSize,
                weight: s.fontWeight,
                lineHeight: s.lineHeight,
              };
            }),
        );
      await writeFile(
        `${root}/${phase}/${name}.json`,
        JSON.stringify(metrics, null, 2),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }
});

test('custom typography merges independently from text colors', () => {
  expect(cn('text-list', 'text-accent')).toBe('text-list text-accent');
  expect(
    cn('text-meta text-muted-foreground', 'text-hero text-foreground'),
  ).toBe('text-hero text-foreground');
  expect(cn('text-list', 'text-sm')).toBe('text-sm');
  expect(cn('text-base', 'text-meta')).toBe('text-meta');
});

test('existing preview preserves focus, disabled, loading and error states', async ({
  page,
}) => {
  await page.goto('/dev/ui');
  const primary = page.getByRole('button', { name: 'Primary', exact: true });
  await primary.focus();
  await expect(primary).toBeFocused();
  await expect(primary).toHaveCSS('outline-width', '2px');
  await expect(primary).toHaveCSS('outline-color', 'rgb(143, 167, 200)');
  await expect(primary).toHaveCSS('min-height', '48px');
  await expect(primary).toHaveCSS('font-size', '14px');
  await primary.hover();
  await expect(primary).toHaveCSS('background-color', 'rgb(160, 182, 211)');
  await expect(
    page.getByRole('button', { name: 'Disabled', exact: true }),
  ).toBeDisabled();
  const loading = page.getByRole('button', { name: 'Loading', exact: true });
  await expect(loading).toBeDisabled();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  const field = page.getByLabel('기본 입력', { exact: true });
  await field.focus();
  await expect(field).toHaveCSS('height', '48px');
  await expect(field).toHaveCSS('font-size', '16px');
  await expect(field).toHaveCSS('border-color', 'rgb(143, 167, 200)');
  const invalid = page.getByLabel('오류 입력', { exact: true });
  await expect(invalid).toHaveAttribute('aria-invalid', 'true');
  await expect(invalid).toHaveCSS('border-color', 'rgb(216, 106, 112)');
  await expect(invalid).toHaveAttribute('aria-describedby', 'preview-error');
  await expect(page.locator('#preview-error')).toBeVisible();
  await expect(page.getByLabel('비활성 입력', { exact: true })).toBeDisabled();
  await mkdir(`${root}/after`, { recursive: true });
  await page.screenshot({
    path: `${root}/after/control-states.png`,
    fullPage: true,
  });
});

test('palette contrast measurements keep existing readable foregrounds', async ({
  page,
}) => {
  await page.goto('/');
  const colors = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        'background',
        'surface',
        'surface-raised',
        'foreground',
        'text-secondary',
        'accent',
        'danger',
        'border',
        'disabled',
      ].map((name) => [name, s.getPropertyValue(`--${name}`).trim()]),
    );
  });
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => {
      const c = parseInt(hex.slice(start, start + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return (
      channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    );
  };
  const contrast = (a: string, b: string) => {
    const l1 = luminance(colors[a]!),
      l2 = luminance(colors[b]!);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const pairs = [
    'foreground',
    'text-secondary',
    'accent',
    'danger',
    'border',
    'disabled',
  ].flatMap((front) =>
    ['background', 'surface', 'surface-raised'].map((back) => ({
      front,
      back,
      ratio: contrast(front, back),
    })),
  );
  for (const pair of pairs.filter((p) =>
    ['foreground', 'text-secondary', 'accent'].includes(p.front),
  ))
    expect(pair.ratio).toBeGreaterThanOrEqual(4.5);
  await mkdir(root, { recursive: true });
  await writeFile(
    `${root}/contrast.json`,
    JSON.stringify(
      {
        colors,
        pairs,
        note: 'Measured existing palette, not an overall accessibility certification. Decorative borders and disabled text are reported separately.',
      },
      null,
      2,
    ),
  );
});
