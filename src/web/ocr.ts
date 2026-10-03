// Reads the text of an ingredient-list photo on the device, with Tesseract.
// Nothing is uploaded. The engine and English model (~4 MB) download on first
// use and are cached by the browser after that.

export type OcrProgress = (stage: string, fraction: number) => void;

const MAX_SIDE = 2000;

export async function readIngredientPhoto(file: Blob, onProgress: OcrProgress): Promise<string> {
  onProgress("Preparing photo", 0);
  const image = await downscale(file);
  onProgress("Loading text reader", 0.05);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress("Reading text", 0.2 + m.progress * 0.8);
      else if (typeof m.progress === "number") onProgress("Loading text reader", 0.05 + m.progress * 0.15);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return tidy(data.text);
  } finally {
    await worker.terminate();
  }
}

/** Phone photos are 12+ megapixels; OCR is faster and no less accurate at ~2000px. */
async function downscale(file: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.filter = "grayscale(1) contrast(1.3)";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    return file;
  }
}

/** Join the label's wrapped lines back into one list, and start at "Ingredients" if we can find it. */
export function tidy(text: string): string {
  let t = text.replace(/-\n(?=\p{Ll})/gu, "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  const start = t.search(/\bingredients?\b\s*[:.]?/i);
  if (start > 0) t = t.slice(start);
  const end = t.search(/\b(?:nutrition(?:al)? (?:information|facts|value)|best before|storage|store in|manufactured by|marketed by|net (?:wt|weight|quantity)|mrp)\b/i);
  if (end > 40) t = t.slice(0, end);
  return t.trim();
}
