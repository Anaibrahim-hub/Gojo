import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a number as Ethiopian Birr, e.g. "ETB 1,500,000" */
export function formatETB(price: number): string {
  return etbFormatter.format(price);
}

/** Compact ETB for tight spaces: "ETB 1.5M", "ETB 750K" */
export function formatETBCompact(price: number): string {
  if (price >= 1_000_000) return `ETB ${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `ETB ${(price / 1_000).toFixed(0)}K`;
  return `ETB ${price}`;
}
