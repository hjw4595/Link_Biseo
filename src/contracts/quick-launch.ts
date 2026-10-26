import {
  isLinkResponse,
  isTimestamp,
  isUuid,
  type LinkResponse,
} from './links';
export interface PresetSummary {
  id: string;
  name: string;
  sortOrder: number;
  linkCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface PresetDetail extends PresetSummary {
  links: { sortOrder: number; link: LinkResponse }[];
}
export interface PresetInput {
  name: string;
  linkIds: string[];
}
export const PRESET_LINK_LIMIT = 8;
// Responses keep accepting the historical 20-link snapshots without truncation.
export function validPresetMembers(
  ids: readonly string[],
  previous: readonly string[] = [],
) {
  if (new Set(ids).size !== ids.length) return false;
  return previous.length > PRESET_LINK_LIMIT
    ? ids.every((id) => previous.includes(id))
    : ids.length <= PRESET_LINK_LIMIT;
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function validPresetName(value: string) {
  const name = value.trim();
  if (!name || Array.from(name).length > 100 || name.includes('\u0000'))
    return false;
  try {
    encodeURIComponent(name);
    return true;
  } catch {
    return false;
  }
}
export function isPresetSummary(v: unknown): v is PresetSummary {
  return (
    record(v) &&
    isUuid(v.id) &&
    typeof v.name === 'string' &&
    validPresetName(v.name) &&
    count(v.sortOrder) &&
    count(v.linkCount) &&
    v.linkCount <= 20 &&
    isTimestamp(v.createdAt) &&
    isTimestamp(v.updatedAt)
  );
}
export function isPresetList(v: unknown): v is { items: PresetSummary[] } {
  return (
    record(v) &&
    Array.isArray(v.items) &&
    v.items.length <= 50 &&
    v.items.every(isPresetSummary) &&
    new Set(v.items.map((p) => p.id)).size === v.items.length
  );
}
export function isPresetDetail(v: unknown): v is PresetDetail {
  if (
    !isPresetSummary(v) ||
    !('links' in v) ||
    !Array.isArray(v.links) ||
    v.links.length !== v.linkCount
  )
    return false;
  const ids = new Set<string>(),
    orders = new Set<number>();
  return v.links.every((item: unknown) => {
    if (
      !record(item) ||
      !count(item.sortOrder) ||
      !isLinkResponse(item.link) ||
      ids.has(item.link.id) ||
      orders.has(item.sortOrder)
    )
      return false;
    ids.add(item.link.id);
    orders.add(item.sortOrder);
    return true;
  });
}
