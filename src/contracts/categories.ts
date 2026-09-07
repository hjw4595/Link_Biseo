export interface CategoryResponse {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateCategoryRequest {
  name: string;
  sortOrder?: number;
}
export interface UpdateCategoryRequest {
  name?: string;
  sortOrder?: number;
}

export interface ReorderCategoriesRequest {
  categoryIds: string[];
}
export interface CategorySummaryResponse {
  items: { id: string; linkCount: number }[];
  uncategorizedCount: number;
  totalLinkCount: number;
}

export function isCategorySummaryResponse(
  value: unknown,
): value is CategorySummaryResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('items' in value) ||
    !Array.isArray(value.items) ||
    !('uncategorizedCount' in value) ||
    !validCount(value.uncategorizedCount) ||
    !('totalLinkCount' in value) ||
    !validCount(value.totalLinkCount)
  )
    return false;
  const ids = new Set<string>();
  let total = value.uncategorizedCount;
  for (const item of value.items) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('id' in item) ||
      typeof item.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        item.id,
      ) ||
      ids.has(item.id.toLowerCase()) ||
      !('linkCount' in item) ||
      !validCount(item.linkCount)
    )
      return false;
    ids.add(item.id.toLowerCase());
    total += item.linkCount;
  }
  return Number.isSafeInteger(total) && total === value.totalLinkCount;
}
function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

export function isCategoryResponse(value: unknown): value is CategoryResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.id,
    ) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'sortOrder' in value &&
    typeof value.sortOrder === 'number' &&
    Number.isInteger(value.sortOrder) &&
    value.sortOrder >= -2147483648 &&
    value.sortOrder <= 2147483647 &&
    'createdAt' in value &&
    isTimestamp(value.createdAt) &&
    'updatedAt' in value &&
    isTimestamp(value.updatedAt)
  );
}
