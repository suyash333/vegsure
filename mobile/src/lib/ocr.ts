// Reads an ingredient-list photo on the phone with Google ML Kit. Nothing is
// uploaded and it works offline. ML Kit reads Latin script (English) and
// Devanagari (Hindi, Marathi); labels in other scripts need a typed list.
//
// Swapping the OCR engine means changing only this file.

import TextRecognition, { type TextBlock, TextRecognitionScript } from "@react-native-ml-kit/text-recognition";

export type Script = "latin" | "devanagari";

export async function readIngredientPhoto(uri: string, script: Script = "latin"): Promise<string> {
  const result = await TextRecognition.recognize(
    uri,
    script === "devanagari" ? TextRecognitionScript.DEVANAGARI : TextRecognitionScript.LATIN,
  );
  return pickIngredients(result.blocks) || tidy(result.text);
}

const START = /\b(?:ingredients?|सामग्री|घटक)\b\s*[:.]?/i;
const STOP =
  /\b(?:nutrition(?:al)? (?:information|facts|value)|best before|storage|store in|manufactured by|marketed by|packed by|net (?:wt|weight|quantity)|mrp|fssai|customer care)\b/i;

/**
 * ML Kit returns text in blocks with positions. A pack's ingredient list is the
 * block starting "Ingredients" plus the blocks that continue it, until the
 * nutrition table or the maker's address begins. Picking blocks this way keeps
 * those out of the list, which reading the whole photo can't.
 */
export function pickIngredients(blocks: TextBlock[]): string {
  const ordered = [...blocks].sort((a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0) || (a.frame?.left ?? 0) - (b.frame?.left ?? 0));
  const start = ordered.findIndex((b) => START.test(b.text));
  if (start < 0) return "";
  const picked: string[] = [];
  for (const block of ordered.slice(start)) {
    if (picked.length && STOP.test(block.text)) break;
    picked.push(block.text);
    // Lists end with a full stop; a short block after one is usually something else.
    if (picked.length > 1 && /\.\s*$/.test(block.text) && block.text.length < 40) break;
  }
  return tidy(picked.join(" "));
}

export function tidy(text: string): string {
  let t = text
    .replace(/-\n(?=\p{Ll})/gu, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const start = t.search(START);
  if (start > 0) t = t.slice(start);
  const end = t.search(STOP);
  if (end > 40) t = t.slice(0, end);
  return t.trim();
}
