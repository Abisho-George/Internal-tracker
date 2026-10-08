import clsx, { type ClassValue } from 'clsx';

/** Joins class names (thin wrapper over clsx so the kit has one import). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
