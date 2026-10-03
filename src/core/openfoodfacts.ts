// Product lookup in Open Food Facts — a free, open, crowd-sourced database of
// over three million packaged foods, including a large and growing Indian
// catalogue. No API key. Data is ODbL-licensed: the UI must credit it.

import type { OffIngredient } from "./analyze.js";

export interface Product {
  code: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  ingredientsText: string;
  ingredients: OffIngredient[];
  /** Pack claims, e.g. "en:vegan", "en:vegetarian". */
  labels: string[];
  /** Open Food Facts' own whole-product verdicts, e.g. "en:vegan", "en:maybe-vegetarian". */
  analysisTags: string[];
  url: string;
}

const FIELDS = [
  "code", "product_name", "product_name_en", "brands", "image_front_small_url", "image_front_url",
  "ingredients_text", "ingredients_text_en", "ingredients", "labels_tags", "ingredients_analysis_tags",
].join(",");

export const OFF_BASE = "https://world.openfoodfacts.org";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Tries each candidate form of the barcode; returns the first product found, or null. */
export async function lookupProduct(candidates: string[], fetchImpl: Fetch = fetch): Promise<Product | null> {
  for (const code of candidates) {
    const res = await fetchImpl(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
    const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (body.status !== 1 || !body.product) continue;
    return toProduct(code, body.product);
  }
  return null;
}

export function toProduct(code: string, p: Record<string, unknown>): Product {
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  const arr = (k: string) => (Array.isArray(p[k]) ? (p[k] as unknown[]).filter((x): x is string => typeof x === "string") : []);
  return {
    code: str("code") || code,
    name: str("product_name_en") || str("product_name") || "Unnamed product",
    brand: str("brands").split(",")[0]?.trim() ?? "",
    imageUrl: str("image_front_small_url") || str("image_front_url") || null,
    ingredientsText: str("ingredients_text_en") || str("ingredients_text"),
    ingredients: Array.isArray(p.ingredients) ? (p.ingredients as OffIngredient[]) : [],
    labels: arr("labels_tags"),
    analysisTags: arr("ingredients_analysis_tags"),
    url: `${OFF_BASE}/product/${encodeURIComponent(str("code") || code)}`,
  };
}

/** What the pack itself claims, if anything. */
export function packClaim(product: Product): "vegan" | "vegetarian" | "non_vegetarian" | null {
  const l = new Set(product.labels);
  if (l.has("en:vegan")) return "vegan";
  if (l.has("en:non-vegetarian") || l.has("en:non-vegetarian-mark")) return "non_vegetarian";
  if (l.has("en:vegetarian") || l.has("en:indian-vegetarian-mark") || l.has("en:green-dot")) return "vegetarian";
  return null;
}

export function addProductUrl(code: string): string {
  return `${OFF_BASE}/cgi/product.pl?type=add&code=${encodeURIComponent(code)}`;
}
