'use client';
import { useSyncExternalStore } from 'react';
const query = '(min-width: 1024px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
export function useDesktopHome() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
