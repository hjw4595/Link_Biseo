import type { Page } from '@playwright/test';
/** Legacy category tabs remain; My Links now has independent native controls. */
export async function selectLinkFilter(
  page: Page,
  choice: 'all' | 'favorites' | 'uncategorized',
) {
  const label = { all: '전체', favorites: '즐겨찾기', uncategorized: '미분류' }[
    choice
  ];
  const legacy = page.getByRole('tab', { name: label, exact: true });
  if (await legacy.count()) {
    await legacy.click();
    return;
  }
  const favorite = page.getByRole('button', { name: '즐겨찾기', exact: true });
  if (
    ((await favorite.getAttribute('aria-pressed')) === 'true') !==
    (choice === 'favorites')
  )
    await favorite.click();
  const category = page.getByLabel('카테고리 필터');
  if (choice === 'uncategorized') await category.selectOption('uncategorized');
  else if (
    choice === 'all' &&
    (await category.inputValue()) === 'uncategorized'
  )
    await category.selectOption('');
}
export async function registerLink(page: Page) {
  await page
    .getByRole('link', { name: /^링크 (추가|등록)$/, exact: true })
    .first()
    .click();
}
export async function openBookmarkImport(page: Page) {
  const menu = page.getByRole('button', {
    name: '내 링크 더보기',
    exact: true,
  });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('menuitem', { name: '북마크 가져오기', exact: true })
      .click();
  } else
    await page
      .getByRole('group', { name: '링크 작업' })
      .getByRole('link', { name: '북마크 가져오기', exact: true })
      .click();
}
