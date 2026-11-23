import {
  isCategoryResponse,
  isCategorySummaryResponse,
  type CategoryResponse,
  type CategorySummaryResponse,
} from '@/contracts/categories';

export const UNCATEGORIZED_ID = 'uncategorized';
export const OTHER_ID = 'other';
const palette = ['#F0B65E', '#51C2B8', '#819DFA', '#E78DAE', '#A5B2C4'];
export interface DistributionItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
  memberIds?: string[];
}
export type DistributionResult =
  | { status: 'ready'; items: DistributionItem[] }
  | { status: 'invalid' | 'mismatch' };
export function categoryColor(id: string): string {
  let hash = 2166136261;
  for (const char of id.toLowerCase())
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return palette[(hash >>> 0) % palette.length] ?? '#F0B65E';
}
export function categoryDistribution(
  summary: CategorySummaryResponse,
  categories: CategoryResponse[],
): DistributionResult {
  if (
    !isCategorySummaryResponse(summary) ||
    !categories.every(isCategoryResponse)
  )
    return { status: 'invalid' };
  const ids = new Set(categories.map((category) => category.id.toLowerCase()));
  if (ids.size !== categories.length) return { status: 'invalid' };
  const counts = new Map(
    summary.items.map((item) => [item.id.toLowerCase(), item.linkCount]),
  );
  if (counts.size !== ids.size || [...ids].some((id) => !counts.has(id)))
    return { status: 'mismatch' };
  const percentage = (count: number) =>
    summary.totalLinkCount === 0 ? 0 : (count / summary.totalLinkCount) * 100;
  const ordinary = [...categories]
    .sort(
      (a, b) =>
        (counts.get(b.id.toLowerCase()) ?? 0) -
          (counts.get(a.id.toLowerCase()) ?? 0) ||
        a.sortOrder - b.sortOrder ||
        a.id.toLowerCase().localeCompare(b.id.toLowerCase()),
    )
    .map((category) => {
      const count = counts.get(category.id.toLowerCase()) ?? 0;
      return {
        id: category.id.toLowerCase(),
        name: category.name,
        count,
        percentage: percentage(count),
        color: categoryColor(category.id),
      };
    });
  const positive = ordinary.filter((item) => item.count > 0);
  const hasUncategorized = summary.uncategorizedCount > 0;
  // Six ordinary categories also use top five + Other: five palette slots cannot
  // uniquely color six ordinary sectors. This is the WO-UI-19.1 exception.
  const grouped =
    positive.length + Number(hasUncategorized) > 6 ||
    positive.length > palette.length;
  const keep = grouped ? (hasUncategorized ? 4 : 5) : positive.length;
  const items: DistributionItem[] = positive.slice(0, keep);
  // Assign by UUID, not count/display rank. The same visible set always gets
  // the same colors; changing that set may change collision resolution.
  const usedColors = new Set<string>();
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const preferred = palette.indexOf(item.color);
    const color = palette
      .map((_, offset) => palette[(preferred + offset) % palette.length])
      .find(
        (candidate) => candidate !== undefined && !usedColors.has(candidate),
      );
    if (!color) return { status: 'invalid' };
    item.color = color;
    usedColors.add(color);
  }
  if (hasUncategorized)
    items.push({
      id: UNCATEGORIZED_ID,
      name: '미분류',
      count: summary.uncategorizedCount,
      percentage: percentage(summary.uncategorizedCount),
      color: '#D0C9BB',
    });
  const excluded = positive.slice(keep);
  const otherCount = excluded.reduce((sum, item) => sum + item.count, 0);
  if (excluded.length && otherCount > 0)
    items.push({
      id: OTHER_ID,
      name: '기타',
      count: otherCount,
      percentage: percentage(otherCount),
      color: '#7B818D',
      memberIds: excluded.map((item) => item.id),
    });
  if (
    items.length > 6 ||
    items.reduce((sum, item) => sum + item.count, 0) !== summary.totalLinkCount
  )
    return { status: 'invalid' };
  return { status: 'ready', items };
}
