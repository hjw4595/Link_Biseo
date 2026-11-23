import type { LinkSort } from '@/contracts/links';

export interface LinkFilterState {
  q: string;
  categoryId?: string;
  favorite: boolean;
  sort: LinkSort;
}
export function isLinkSort(value: string | null): value is LinkSort {
  return (
    value === 'default' ||
    value === 'recent' ||
    value === 'frequent' ||
    value === 'smart'
  );
}
export interface LinkFilterControls {
  filters: LinkFilterState;
  change: (patch: Partial<LinkFilterState>) => void;
  active: boolean;
  reset: () => void;
}
