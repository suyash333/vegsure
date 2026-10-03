# VegScan

A Yuka-style scanner for vegetarians and vegans. Scan a food pack's barcode or QR
code, or photograph its ingredient list, and VegScan shows which ingredients don't
fit your diet, and why.

## What it does

- **Scan a barcode or QR code** with the phone camera: EAN-13/8, UPC-A/E, and GS1
  QR / DataMatrix codes (including GS1 Digital Link). The product is looked up in
  [Open Food Facts](https://world.openfoodfacts.org), a free, open database of
  over 3 million foods with a large Indian catalogue. You can also type the number.
- **Photograph the ingredient list** when a product isn't in the database. The
  text is read on the phone (Tesseract, nothing is uploaded), then shown to you to
  correct before it's checked, because text recognition makes mistakes.
- **Type or paste** any ingredient list.
- **Four diets**: Vegetarian (no eggs, the usual meaning in India), Vegetarian
  (eats eggs), Vegan, and Jain (no eggs, honey, onion, garlic or root vegetables).
- **Three levels**, not just pass/fail:
  - *Not suitable*: gelatin, carmine (E120), meat, fish, egg, and so on.
  - *Check before eating*: ingredients that can be plant or animal, where the
    label doesn't say which (E471, glycerin, cheese that may use animal rennet,
    flavour enhancers 627/631/635…).
  - *Worth knowing*: things like "natural flavouring", which don't change the verdict.
- Reads **E numbers and Indian INS numbers**, including bare codes like
  `Emulsifier (471)`, and Indian terms (ghee, paneer, khoya, dahi, eggless…).
- Separates **"may contain" warnings** (cross-contamination) from real ingredients.
- Flags a conflict when a pack is **labelled vegetarian/vegan but the list disagrees**.
- **Recent scans** on the device, re-checked when you change diet. Installable as
  an app (PWA) and works offline apart from product lookups.

## Running it

```bash
npm install
npm run dev        # http://localhost:8000 (rebuilds on change)
npm test           # 41 tests, offline
npm run build      # static site in dist/
```

`dist/` is a plain static site with no server and no API keys, so you can host it on any
static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, Hostinger). **The camera
only works over HTTPS** (or on `localhost`). To try it on a phone during development,
use an HTTPS tunnel such as `npx localtunnel --port 8000` or `cloudflared`.

## How the checking works

```
src/core/
  diets.ts          what each diet allows, by category (one table)
  rules.ts          ingredient words → category, with look-alike exceptions
  additives.ts      E/INS numbers that are, or may be, animal-derived
  parse.ts          splits a printed list into a tree; pulls out "may contain"
  analyze.ts        matches rules per ingredient → findings + verdict
  gs1.ts            barcode / QR → GTIN (check digits, UPC-E, Digital Link)
  openfoodfacts.ts  product lookup
src/web/            the phone UI: camera scanner, OCR, results, history
```

- Each ingredient is checked separately, so "coconut milk, milk solids" flags only
  the milk solids. Look-alikes ("cocoa butter", "eggplant", "cream of tartar",
  "vegetable stock", "microbial rennet") and free-from wording ("egg-free", "no
  gelatin") are handled per rule.
- A plant qualifier, e.g. "E471 (from palm oil)", clears a "could be animal"
  finding, but never a definite one.
- Open Food Facts' own per-ingredient vegan/vegetarian tags are used as a second
  opinion, mainly for labels in languages the word list doesn't cover. Its
  "vegetarian" means eggs are allowed, so for egg-free diets its vegan-only "no"
  becomes a *check*, not a fail.

## Limits

- It can only judge what's printed. Processing aids such as bone-char-refined sugar
  or animal-derived clarifying agents never appear on labels.
- The word list is English plus common Indian terms. Other languages rely on Open
  Food Facts' tags.
- Jain practice varies. Dried ginger and turmeric, and tapioca/sabudana, are
  marked *check* rather than *avoid*.

## Next steps worth considering

- A native app (React Native / Expo) for faster scanning and app-store distribution.
  The `src/core` code is plain TypeScript and can be reused as-is.
- Hindi and other Indian-language ingredient terms, plus OCR in those scripts.
- Letting users report a wrong verdict, and contributing photos back to Open Food Facts.
