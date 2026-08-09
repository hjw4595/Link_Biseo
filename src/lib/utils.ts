import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
// Teach the merger our existing @theme font sizes; text-* colors must not erase them.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: { 'font-size': [{ text: ['list', 'meta', 'hero'] }] },
  },
});
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
