import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names (clsx) and resolve conflicting Tailwind utility
 * classes (tailwind-merge), e.g. `cn('p-2', condition && 'p-4')` -> `'p-4'`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
