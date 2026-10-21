import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conflict resolution.
 * Use everywhere instead of template-string class concat.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
