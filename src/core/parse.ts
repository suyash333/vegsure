// Turns a printed ingredient list into a tree:
//
//   "Sugar, milk chocolate (12%) (sugar, cocoa butter, milk powder), emulsifier (471)"
//
// becomes "sugar", "milk chocolate" with three children, and "emulsifier (471)".
// A bracket with a list inside becomes children; a bracket with a single phrase —
// "(471)", "(vegetable)", "(soy)" — stays inline, because it qualifies its parent.

export interface Ingredient {
  /** Normalised text: lowercase, no accents, hyphens as spaces, inline brackets kept. */
  text: string;
  /** As printed, for display. */
  label: string;
  children: Ingredient[];
}

export interface ParsedList {
  ingredients: Ingredient[];
  /** "May contain traces of milk" style statements, removed from the list. */
  traces: string[];
}

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐-―\-_]/g, " ")
    .replace(/[^\p{L}\p{N}'()% ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TRACE_STATEMENT =
  /(?:may (?:also )?contain|may be present|may have traces|traces? of|could contain|made (?:on|in|using) (?:a |shared )?(?:factory|equipment|line|facility|premises|plant)|(?:produced|manufactured|made|packed|processed) (?:on|in) (?:a )?(?:factory|equipment|line|facility|premises|plant|site)|cross[- ]contamination)[^.]*(?:\.|$)/gi;

const NOISE = [
  /^\s*(?:list of )?ingredients?\s*[:.\-]?/i,
  /allergens?(?: advice| information)?\s*[:.]?\s*(?:for allergens,? )?(?:see|including) (?:ingredients )?in (?:bold|capitals|caps)[^.]*\.?/gi,
  /\bfor allergens,?[^.]*\.?/gi,
  /\b\d+(?:[.,]\d+)?\s*%/g,
  /\*+/g,
];

export function parseIngredients(raw: string): ParsedList {
  let text = raw.replace(/\r/g, "").replace(/\n+/g, ", ");
  const traces: string[] = [];
  text = text.replace(TRACE_STATEMENT, (m) => {
    traces.push(m.trim().replace(/\.$/, ""));
    return ", ";
  });
  for (const re of NOISE) text = text.replace(re, " ");
  // "Contains: milk, soy" lists real ingredients; keep the list, drop the word.
  text = text.replace(/\bcontains\s*:/gi, ", ");
  text = text.replace(/[[{]/g, "(").replace(/[\]}]/g, ")");
  return { ingredients: splitList(text), traces };
}

/** Split on , ; • and full stops at bracket depth 0. */
function splitList(text: string): Ingredient[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && isSeparator(text, i)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(toIngredient).filter((x): x is Ingredient => x !== null);
}

function isSeparator(text: string, i: number): boolean {
  const ch = text[i]!;
  if (ch === "," || ch === ";" || ch === "•" || ch === "·" || ch === "|") {
    // "1,5" is a decimal, not a separator.
    return !(ch === "," && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? ""));
  }
  // A full stop ends a sentence ("...salt. Contains milk.") but not "e.g." or "3.5".
  if (ch === ".") return !/\d/.test(text[i + 1] ?? "") && /\s|$/.test(text[i + 1] ?? "");
  return false;
}

function toIngredient(part: string): Ingredient | null {
  const label = part.replace(/\s+/g, " ").replace(/^[\s:.\-]+|[\s:.\-]+$/g, "").trim();
  if (!label) return null;

  // Walk the top-level brackets: list-like ones become children, the rest stay inline.
  let head = "";
  const children: Ingredient[] = [];
  let depth = 0;
  let groupStart = -1;
  for (let i = 0; i < label.length; i++) {
    const ch = label[i]!;
    if (ch === "(") {
      if (depth === 0) groupStart = i;
      depth++;
    } else if (ch === ")" && depth > 0) {
      depth--;
      if (depth === 0) {
        const inner = label.slice(groupStart + 1, i);
        if (hasTopLevelSeparator(inner)) children.push(...splitList(inner));
        else head += ` (${inner.trim()}) `;
        groupStart = -1;
      }
    } else if (depth === 0) {
      head += ch;
    }
  }
  // Unclosed bracket (common in OCR): keep what's inside as text.
  if (depth > 0 && groupStart >= 0) head += " " + label.slice(groupStart + 1);

  const text = normalize(head).replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!text && children.length === 0) return null;
  if (!/\p{L}|\d/u.test(text) && children.length === 0) return null;
  const shown = head.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").replace(/^[\s:.\-]+|[\s:.\-]+$/g, "").trim();
  return { text, label: shown || label, children };
}

function hasTopLevelSeparator(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && (ch === "," || ch === ";") && isSeparator(text, i)) return true;
  }
  return false;
}
