import type { CategoryResponse } from '@/contracts/categories';
import type { ImportItem, ParsedBookmark } from './types';

export type CategoryTarget =
  | { kind: 'uncategorized' }
  | { kind: 'existing'; id: string }
  | { kind: 'create'; name: string; reviewRequired?: boolean };
export interface MappingConfig {
  mode: 'folders' | 'single';
  singleId: string;
  targets: Record<string, CategoryTarget>;
}
export const emptyMapping = (): MappingConfig => ({
  mode: 'folders',
  singleId: '',
  targets: {},
});
export const uncategorized: CategoryTarget = { kind: 'uncategorized' };
export function folderKey(item: ParsedBookmark): string {
  return JSON.stringify([item.folderPath, item.folderNodeId ?? null]);
}
export interface FolderGroup {
  key: string;
  path: string[];
  label: string;
  items: ImportItem[];
  selected: number;
  repeatedPath: boolean;
}
export function folderGroups(
  items: ImportItem[],
  selected: Set<string>,
): FolderGroup[] {
  const groups = new Map<string, FolderGroup>();
  for (const item of items) {
    if (item.eligibility !== 'ready') continue;
    const key = folderKey(item);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        path: item.folderPath,
        label: item.folderPath.length
          ? item.folderPath.join(' / ')
          : '폴더 없음',
        items: [],
        selected: 0,
        repeatedPath: false,
      };
      groups.set(key, group);
    }
    group.items.push(item);
    if (selected.has(item.localId)) group.selected++;
  }
  const paths = new Map<string, number>();
  for (const group of groups.values()) {
    const path = JSON.stringify(group.path);
    paths.set(path, (paths.get(path) ?? 0) + 1);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    repeatedPath: (paths.get(JSON.stringify(group.path)) ?? 0) > 1,
  }));
}
// DTO uses code points and ASCII whitespace; DB trims POSIX whitespace and lower().
// ASCII case folding is deterministic here. Non-ASCII collation conflicts remain
// authoritative on the server (409); do not invent additional name restrictions.
export function categoryNameKey(name: string) {
  return name
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
    .replace(/[A-Z]/g, (char) => char.toLowerCase());
}
export function categoryNameError(name: string): string | null {
  if (
    name.includes('\0') ||
    !/[^ \t\n\r\f\v]/u.test(name) ||
    [...name].length > 100
  )
    return '이름은 공백만 사용할 수 없고 NUL 없이 100자 이하여야 해요.';
  return null;
}
export interface MappingRow {
  key: string;
  label: string;
  count: number;
  target: CategoryTarget;
  error: string | null;
  description: string;
}
export interface MappingPlan {
  rows: MappingRow[];
  itemTargets: Map<string, string>;
  valid: boolean;
  categoryName: string;
}
export function mappingPlan(
  items: ImportItem[],
  selected: Set<string>,
  config: MappingConfig,
  categories: CategoryResponse[] | undefined,
): MappingPlan {
  const groups = folderGroups(items, selected);
  const active = groups.filter((group) => group.selected > 0);
  const rows: MappingRow[] = (
    config.mode === 'single'
      ? [
          {
            key: 'single',
            label: '모든 선택 링크',
            count: selected.size,
            target: config.singleId
              ? { kind: 'existing' as const, id: config.singleId }
              : uncategorized,
          },
        ]
      : active.map((group) => ({
          key: group.key,
          label: group.label,
          count: group.selected,
          target: config.targets[group.key] ?? uncategorized,
        }))
  ).map((row) => {
    const target = row.target;
    const category =
      target.kind === 'existing'
        ? categories?.find((category) => category.id === target.id)
        : undefined;
    const error =
      target.kind === 'existing' && !category
        ? '선택한 카테고리가 없어졌어요. 다시 선택하세요.'
        : target.kind === 'create'
          ? target.reviewRequired
            ? '생성 결과를 다시 조회한 뒤 매핑을 직접 확인하세요.'
            : categoryNameError(target.name)
          : null;
    return {
      ...row,
      error,
      description:
        target.kind === 'uncategorized'
          ? '미분류'
          : target.kind === 'existing'
            ? (category?.name ?? '카테고리 확인 필요')
            : `새 카테고리: ${target.name}`,
    };
  });
  for (const row of rows) {
    if (row.target.kind !== 'create') continue;
    const key = categoryNameKey(row.target.name);
    if (
      categories?.some((category) => categoryNameKey(category.name) === key) ||
      rows.some(
        (other) =>
          other !== row &&
          other.target.kind === 'create' &&
          categoryNameKey(other.target.name) === key,
      )
    ) {
      row.error =
        '같은 이름이 있어요. 기존 카테고리를 연결하거나 다른 이름 또는 미분류를 선택하세요.';
    }
  }
  const itemTargets = new Map(
    items
      .filter((item) => selected.has(item.localId))
      .map((item) => [
        item.localId,
        config.mode === 'single' ? 'single' : folderKey(item),
      ]),
  );
  return {
    rows,
    itemTargets,
    valid: !!categories && rows.every((row) => !row.error),
    categoryName:
      config.mode === 'single'
        ? (rows[0]?.description ?? '미분류')
        : '폴더별 매핑',
  };
}

export interface CategoryPreparation {
  key: string;
  name: string;
  status: 'not_attempted' | 'creating' | 'created' | 'failed' | 'unknown';
  categoryId?: string;
  reason?: string;
}
