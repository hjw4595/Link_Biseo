import type { RefObject } from 'react';

export interface LinkRegistrationOptions {
  initialCategoryId?: string;
  returnToLinks?: boolean;
  onClose?: () => void;
  onRegistered?: (destination: string) => void;
  returnFocus?: RefObject<HTMLAnchorElement | null>;
}
