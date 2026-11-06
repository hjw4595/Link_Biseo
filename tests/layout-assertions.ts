import { expect, type Page, type Locator } from '@playwright/test';

// Test oracle is deliberately independent of production Tailwind classes.
export function expectedWidth(_path: string, viewport: number) {
  const cap = viewport < 768 ? 512 : viewport < 1024 ? 768 : 1152;
  return Math.min(viewport, cap);
}

export async function expectLayoutWidth(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport required');
  const width = (await page.locator('#main-content').boundingBox())?.width;
  expect(width).toBe(
    expectedWidth(new URL(page.url()).pathname, viewport.width),
  );
}

export async function expectClearOfNavigation(page: Page, content: Locator) {
  const box = await content.boundingBox();
  const inSheet = await content.evaluate((node) =>
    Boolean(node.closest('[data-app-sheet]')),
  );
  if (inSheet) {
    const panel = await page.locator('[data-app-sheet]').boundingBox();
    if (!box || !panel) throw new Error('Sheet content must exist');
    expect(box.y).toBeGreaterThanOrEqual(panel.y);
    expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
    return;
  }
  const nav = await page
    .getByRole('navigation', { name: '주요 메뉴' })
    .boundingBox();
  if (!box || !nav) throw new Error('Content and navigation must exist');
  if ((page.viewportSize()?.width ?? 0) < 1024)
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
  else expect(box.y).toBeGreaterThanOrEqual(nav.y + nav.height);
}
