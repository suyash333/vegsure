// Per-device preferences and scan history. Browser storage can be unavailable
// (private windows, blocked site data), so every access is guarded and the app
// works without it — you just lose history between visits.

import { type DietId, isDietId } from "../core/diets.js";
import type { Product } from "../core/openfoodfacts.js";

const DIET_KEY = "vegsure.diet";
const HISTORY_KEY = "vegsure.history";
const HISTORY_MAX = 30;

export interface HistoryEntry {
  id: string;
  at: number;
  /** null for a typed or photographed ingredient list. */
  product: Omit<Product, "ingredients"> | null;
  ingredientsText: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or blocked; history is a convenience
  }
}

export function getDiet(): DietId | null {
  const v = read(DIET_KEY);
  return isDietId(v) ? v : null;
}

export function setDiet(diet: DietId): void {
  write(DIET_KEY, diet);
}

export function getHistory(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(read(HISTORY_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).filter((e) => e && typeof e.ingredientsText === "string") : [];
  } catch {
    return [];
  }
}

export function addHistory(product: Product | null, ingredientsText: string): HistoryEntry {
  const slim = product ? (({ ingredients: _drop, ...rest }) => rest)(product) : null;
  const entry: HistoryEntry = {
    id: product?.code ?? `text-${Date.now()}`,
    at: Date.now(),
    product: slim,
    ingredientsText,
  };
  const rest = getHistory().filter((e) => e.id !== entry.id);
  write(HISTORY_KEY, JSON.stringify([entry, ...rest].slice(0, HISTORY_MAX)));
  return entry;
}

export function clearHistory(): void {
  write(HISTORY_KEY, "[]");
}
