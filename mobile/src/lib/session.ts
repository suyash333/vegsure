// What the result screen should show. Ingredient lists and product data are too
// big to pass in a route's URL params, so the screen that finds them puts them
// here before navigating.

import { createContext, useContext } from "react";
import type { DietId, Product } from "./core";

export interface Checked {
  product: Product | null;
  ingredientsText: string;
}

let current: Checked | null = null;

export function setChecked(value: Checked): void {
  current = value;
}

export function getChecked(): Checked | null {
  return current;
}

export interface DietState {
  diet: DietId;
  /** False until the saved diet has loaded; true once known (or chosen). */
  ready: boolean;
  /** True when no diet was ever chosen on this phone. */
  firstRun: boolean;
  setDiet: (diet: DietId) => void;
}

export const DietContext = createContext<DietState>({
  diet: "vegetarian",
  ready: false,
  firstRun: false,
  setDiet: () => {},
});

export const useDiet = () => useContext(DietContext);

/** Open Food Facts asks apps to identify themselves. */
export const offFetch = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), "User-Agent": "VegSure/1.0 (Android/iOS app)" } });
