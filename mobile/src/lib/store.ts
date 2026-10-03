// Diet and scan history, kept on the phone.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { type DietId, isDietId, type Product } from "./core";

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

export async function loadDiet(): Promise<DietId | null> {
  try {
    const v = await AsyncStorage.getItem(DIET_KEY);
    return isDietId(v) ? v : null;
  } catch {
    return null;
  }
}

export async function saveDiet(diet: DietId): Promise<void> {
  await AsyncStorage.setItem(DIET_KEY, diet).catch(() => {});
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).filter((e) => e && typeof e.ingredientsText === "string") : [];
  } catch {
    return [];
  }
}

export async function addHistory(product: Product | null, ingredientsText: string): Promise<void> {
  const slim = product ? (({ ingredients: _drop, ...rest }) => rest)(product) : null;
  const entry: HistoryEntry = { id: product?.code ?? `text-${Date.now()}`, at: Date.now(), product: slim, ingredientsText };
  const rest = (await loadHistory()).filter((e) => e.id !== entry.id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...rest].slice(0, HISTORY_MAX))).catch(() => {});
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, "[]").catch(() => {});
}
