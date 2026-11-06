import { createStore } from 'zustand/vanilla';
export type LaunchState = {
  mode: 'normal' | 'incognito';
  extensionConnection:
    | 'unknown'
    | 'checking'
    | 'connected'
    | 'unavailable'
    | 'unsupported'
    | 'error';
  incognitoPermission: 'unknown' | 'allowed' | 'denied';
  notice: string | null;
};
type LaunchActions = {
  update: (state: Partial<LaunchState>) => void;
  reset: () => void;
};
const initial: LaunchState = {
  mode: 'normal',
  extensionConnection: 'unknown',
  incognitoPermission: 'unknown',
  notice: null,
};
export const createLaunchStore = () =>
  createStore<LaunchState & LaunchActions>()((set) => ({
    ...initial,
    update: (state) => set(state),
    reset: () => set(initial),
  }));
