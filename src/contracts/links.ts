// Public HTTP contract verified against biseo_BE LinksController, 2026-10-15.
export type LinkSort = 'default' | 'recent' | 'frequent' | 'smart';
export interface LinkResponse {
  id: string;
  url: string;
  domain: string;
  title: string;
  description: string | null;
  faviconUrl: string | null;
  categoryId: string | null;
  isFavorite: boolean;
  clickCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface UpdateLinkRequest {
  categoryId?: string | null;
  customTitle?: string | null;
  customDescription?: string | null;
  isFavorite?: boolean;
}
export interface CreateLinkRequest extends UpdateLinkRequest {
  url: string;
  newCategoryName?: string;
}
export interface LinkPreviewResponse {
  url: string;
  domain: string;
  title: string | null;
  faviconUrl: string | null;
  status: 'ready' | 'failed';
}
export function isLinkPreviewResponse(v: unknown): v is LinkPreviewResponse {
  return (
    record(v) &&
    typeof v.url === 'string' &&
    typeof v.domain === 'string' &&
    nullableString(v.title) &&
    nullableString(v.faviconUrl) &&
    (v.status === 'ready' || v.status === 'failed')
  );
}
export interface ListLinksResponse {
  items: LinkResponse[];
  nextCursor: string | null;
}
export interface OpenLinkResponse {
  url: string;
  openedAt: string;
}
export interface LinkFilters {
  q?: string;
  categoryId?: string;
  favorite?: boolean;
  sort?: LinkSort;
  limit?: number;
}

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isTimestamp = (v: unknown): v is string =>
  typeof v === 'string' &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const nullableString = (v: unknown) => v === null || typeof v === 'string';
export function isLinkResponse(v: unknown): v is LinkResponse {
  return (
    record(v) &&
    isUuid(v.id) &&
    typeof v.url === 'string' &&
    typeof v.domain === 'string' &&
    typeof v.title === 'string' &&
    nullableString(v.description) &&
    nullableString(v.faviconUrl) &&
    (v.categoryId === null || isUuid(v.categoryId)) &&
    typeof v.isFavorite === 'boolean' &&
    typeof v.clickCount === 'number' &&
    Number.isSafeInteger(v.clickCount) &&
    v.clickCount >= 0 &&
    (v.lastOpenedAt === null || isTimestamp(v.lastOpenedAt)) &&
    isTimestamp(v.createdAt) &&
    isTimestamp(v.updatedAt)
  );
}
export function isListLinksResponse(v: unknown): v is ListLinksResponse {
  return (
    record(v) &&
    Array.isArray(v.items) &&
    v.items.every(isLinkResponse) &&
    (v.nextCursor === null ||
      (typeof v.nextCursor === 'string' &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.nextCursor) &&
        v.nextCursor.length <= 512))
  );
}
export function isOpenLinkResponse(v: unknown): v is OpenLinkResponse {
  return record(v) && typeof v.url === 'string' && isTimestamp(v.openedAt);
}
