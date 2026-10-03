// Checks an ingredient list against a diet and explains every ingredient that
// fails it. The verdict is only as good as the label: "check" findings mean the
// label doesn't say enough, and the UI must present them that way rather than
// as a pass or a fail.

import { ADDITIVE_CLASS, findAdditive } from "./additives.js";
import { type Category, type DietId, type Status, STATUS_RANK, statusFor } from "./diets.js";
import { type Ingredient, normalize, parseIngredients } from "./parse.js";
import { RULES, type Rule } from "./rules.js";

export type Verdict = "suitable" | "uncertain" | "not_suitable" | "unknown";

export interface Finding {
  /** Rule id, "E471" for additives, or "off:<id>" for Open Food Facts flags. */
  id: string;
  name: string;
  category: Category | "openfoodfacts";
  status: Exclude<Status, "ok">;
  reason: string;
  /** The ingredient as printed, e.g. "whole milk powder". */
  ingredient: string;
  /** Enclosing ingredients, outermost first: ["milk chocolate"]. */
  within: string[];
  source: "rules" | "additive" | "openfoodfacts";
}

export interface Analysis {
  diet: DietId;
  verdict: Verdict;
  /** Worst first. */
  findings: Finding[];
  /** "May contain" statements, and which animal products they name. */
  traces: { statement: string; mentions: string[] }[];
  ingredientCount: number;
}

/** Open Food Facts' own per-ingredient analysis, used as a second opinion. */
export interface OffIngredient {
  id?: string;
  text?: string;
  vegan?: string;
  vegetarian?: string;
  ingredients?: OffIngredient[];
}

export interface AnalyzeOptions {
  offIngredients?: OffIngredient[];
}

// ---- compiled rules ------------------------------------------------------

interface CompiledRule {
  rule: Rule;
  term: RegExp;
  except: RegExp | null;
}

const B = "(?<![\\p{L}\\p{N}])"; // word start
const E = "(?![\\p{L}\\p{N}])"; // word end

function escapeTerm(term: string): string {
  return normalize(term)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+");
}

function compile(rule: Rule): CompiledRule {
  const terms = [...rule.terms].sort((a, b) => b.length - a.length).map(escapeTerm);
  return {
    rule,
    term: new RegExp(`${B}(?:${terms.join("|")})${E}`, "u"),
    // Exceptions are written against normalised text, so hyphens are already spaces.
    except: rule.except?.length ? new RegExp(`${B}(?:${rule.except.join("|")})${E}`, "gu") : null,
  };
}

const COMPILED: readonly CompiledRule[] = RULES.map(compile);

/** Phrases that cancel a match for every rule: "milk free", "free from egg", "no gelatin", "vegan mayo". */
const UNIVERSAL_EXCEPT = new RegExp(
  [
    `${B}[\\p{L}']+(?:\\s+(?:and|or|&)\\s+[\\p{L}']+)*\\s+free${E}`,
    `${B}free\\s+from\\s+[\\p{L}']+(?:\\s+(?:and|or|&)\\s+[\\p{L}']+)*`,
    `${B}(?:no|without|zero)\\s+(?:added\\s+)?[\\p{L}']+`,
    `${B}(?:vegan|vegetarian|veggie|plant\\s+based|imitation|mock|artificial)\\s+[\\p{L}']+`,
  ].join("|"),
  "gu",
);

/** Says the ingredient is plant-sourced: clears the "could be animal" rules, never the definite ones. */
const PLANT_QUALIFIER =
  /(?<![\p{L}])(?:vegetable|plant|palm|soy|soya|sunflower|rapeseed|canola|coconut|non animal|vegan|microbial|synthetic|lichen|algal|algae)(?![\p{L}])/u;

const SOFT_CATEGORIES = new Set<Category>(["maybe_animal", "maybe_animal_vegan", "vitamin_d3", "flavour"]);

// "E471", "e 471", "INS 471", "ins471", "E472e", "500(ii)"
const CODE_PREFIXED = /(?<![\p{L}\p{N}])(?:e|ins)\s?(\d{3,4})([a-f])?(?![\p{N}])/gu;
// A bare number, only trusted when the ingredient names an additive class.
const CODE_BARE = /(?<![\p{L}\p{N}.,])(\d{3,4})([a-f])?(?:\s*\(\s*[ivx]+\s*\))?(?![\p{N}%]|\s*(?:g|mg|kg|ml|l|kcal|kj|mcg|µg)\b)/gu;
const ONLY_CODES = /^(?:(?:e|ins)?\s?\d{3,4}[a-f]?(?:\s*\(\s*[ivx]+\s*\))?(?:\s*(?:and|&|or)\s*|\s+|$))+$/u;

// ---- matching ------------------------------------------------------------

interface RawMatch {
  id: string;
  name: string;
  category: Category;
  reason: string;
  source: "rules" | "additive";
}

export function matchIngredient(text: string, parentText = ""): RawMatch[] {
  const out: RawMatch[] = [];
  const cleaned = text.replace(UNIVERSAL_EXCEPT, " ");
  const plantQualified = PLANT_QUALIFIER.test(text);

  for (const c of COMPILED) {
    const subject = c.except ? cleaned.replace(c.except, " ") : cleaned;
    if (!c.term.test(subject)) continue;
    if (plantQualified && SOFT_CATEGORIES.has(c.rule.category)) continue;
    out.push({ id: c.rule.id, name: c.rule.name, category: c.rule.category, reason: c.rule.reason, source: "rules" });
  }

  const codes = new Set<string>();
  for (const m of text.matchAll(CODE_PREFIXED)) codes.add(m[1]! + (m[2] ?? ""));
  if (ADDITIVE_CLASS.test(text) || ADDITIVE_CLASS.test(parentText) || ONLY_CODES.test(text)) {
    for (const m of text.matchAll(CODE_BARE)) {
      const n = Number(m[1]);
      if (n >= 100 && n <= 1599) codes.add(m[1]! + (m[2] ?? ""));
    }
  }
  for (const code of codes) {
    const hit = findAdditive(code);
    if (!hit) continue;
    if (plantQualified && SOFT_CATEGORIES.has(hit.additive.category)) continue;
    const id = `E${hit.code.toUpperCase().replace(/^(\d+)([A-F])$/, (_, d: string, l: string) => d + l.toLowerCase())}`;
    // "gelatin (E441)" is one finding, not two.
    if (out.some((o) => o.category === hit.additive.category && sameSubstance(o.id, id))) continue;
    out.push({ id, name: hit.additive.name, category: hit.additive.category, reason: hit.additive.reason, source: "additive" });
  }
  return out;
}

const SAME: Record<string, string[]> = {
  gelatin: ["E441"],
  carmine: ["E120"],
  shellac: ["E904"],
  honey: ["E901"],
  lanolin: ["E913"],
  whey: ["E966"],
  egg: ["E1105"],
  bone: ["E542"],
  other_slaughter: ["E1000"],
  keratin: ["E920", "E921"],
  glycerin: ["E422"],
  glycerides: ["E470", "E470a", "E470b", "E471", "E472", "E472a", "E472b", "E472c", "E472d", "E472e", "E472f", "E473", "E474", "E475", "E477", "E432", "E433", "E434", "E435", "E436"],
  stearic_acid: ["E470", "E470a", "E470b", "E481", "E482", "E570", "E572"],
  flavour_enhancers: ["E627", "E629", "E630", "E631", "E632", "E633", "E634", "E635"],
};

function sameSubstance(ruleId: string, code: string): boolean {
  return SAME[ruleId]?.includes(code) ?? false;
}

// ---- analysis ------------------------------------------------------------

export function analyze(ingredientText: string, diet: DietId, options: AnalyzeOptions = {}): Analysis {
  const parsed = parseIngredients(ingredientText);
  const findings: Finding[] = [];
  // Every ingredient a rule recognised, even ones this diet allows — so Open Food
  // Facts' opinion doesn't second-guess "milk" for a vegetarian.
  const recognised = new Set<string>();
  let count = 0;

  // Returns the rule ids found in this subtree, so a parent doesn't repeat what a
  // child already explains ("milk chocolate" vs its "milk powder").
  const visit = (ing: Ingredient, within: string[], parentText: string): Set<string> => {
    count++;
    const below = new Set<string>();
    for (const child of ing.children) {
      for (const id of visit(child, [...within, ing.label], ing.text)) below.add(id);
    }
    const here = new Set<string>(below);
    for (const m of matchIngredient(ing.text, parentText)) {
      here.add(m.id);
      recognised.add(normalize(ing.label));
      if (below.has(m.id)) continue;
      const status = statusFor(m.category, diet);
      if (status === "ok") continue;
      findings.push({ ...m, status, ingredient: ing.label, within });
    }
    return here;
  };
  for (const ing of parsed.ingredients) visit(ing, [], "");

  if (options.offIngredients?.length) {
    addOffFindings(options.offIngredients, diet, findings, recognised);
  }

  const traces = parsed.traces.map((statement) => {
    const text = normalize(statement).replace(/^.*?(?:contain|traces? of|handles?|processes?)\s+/, "");
    const mentions = new Set<string>();
    for (const part of text.split(/,|\band\b|\bor\b|&/)) {
      for (const m of matchIngredient(part.trim())) {
        if (statusFor(m.category, diet) !== "ok") mentions.add(m.name);
      }
    }
    return { statement, mentions: [...mentions] };
  });

  findings.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  return { diet, verdict: verdictOf(findings, count), findings, traces, ingredientCount: count };
}

export function verdictOf(findings: Finding[], ingredientCount: number): Verdict {
  if (ingredientCount === 0) return "unknown";
  if (findings.some((f) => f.status === "avoid")) return "not_suitable";
  if (findings.some((f) => f.status === "check")) return "uncertain";
  return "suitable";
}

/**
 * Open Food Facts tags each ingredient vegan/vegetarian yes/no/maybe, in any
 * language it knows. We add its "no" and "maybe" only where our own rules found
 * nothing for that ingredient — mostly labels in languages our word list lacks.
 * Its "vegetarian" means lacto-ovo, so a vegan-only "no" might be an egg: for diets
 * that exclude eggs that becomes a "check", not an "avoid".
 */
function addOffFindings(off: OffIngredient[], diet: DietId, findings: Finding[], recognised: Set<string>): void {
  const explained = new Set([...recognised, ...findings.map((f) => normalize(f.ingredient))]);

  const walk = (list: OffIngredient[], within: string[]) => {
    for (const ing of list) {
      const label = (ing.text ?? ing.id?.replace(/^\w\w:/, "") ?? "").trim();
      const key = normalize(label);
      if (ing.ingredients?.length) walk(ing.ingredients, [...within, label]);
      if (!label || explained.has(key)) continue;
      const status = offStatus(ing, diet);
      if (!status) continue;
      explained.add(key);
      findings.push({
        id: `off:${ing.id ?? key}`,
        name: label,
        category: "openfoodfacts",
        status,
        reason:
          status === "avoid"
            ? "Open Food Facts lists this ingredient as animal-derived."
            : "Open Food Facts says this ingredient may be animal-derived.",
        ingredient: label,
        within,
        source: "openfoodfacts",
      });
    }
  };
  walk(off, []);
}

function offStatus(ing: OffIngredient, diet: DietId): Exclude<Status, "ok" | "info"> | null {
  if (ing.vegetarian === "no") return "avoid";
  if (ing.vegetarian === "maybe") return "check";
  if (diet === "lacto_ovo") return null;
  if (ing.vegan === "no") return diet === "vegan" ? "avoid" : "check";
  if (ing.vegan === "maybe") return "check";
  return null;
}
