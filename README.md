# VegSure

A Yuka-style scanner for vegetarians and vegans. Scan a food pack's barcode or QR
code, or photograph its ingredient list, and VegSure shows which ingredients don't
fit your diet, and why.

It comes in two forms that share one ingredient checker (`src/core`):

- **Android/iOS app** (`mobile/`), built with Expo. Barcodes, QR codes and
  ingredient photos are read on the phone with **Google ML Kit**, offline.
- **Website** (repo root), a PWA hosted on Hostinger or any web host. It reads
  photos with Tesseract in the browser, and offers the Android app to Android
  visitors once you upload it.

## What it does

- **Scan a barcode or QR code** with the phone camera: EAN-13/8, UPC-A/E, and GS1
  QR / DataMatrix codes (including GS1 Digital Link). The product is looked up in
  [Open Food Facts](https://world.openfoodfacts.org), a free, open database of
  over 3 million foods with a large Indian catalogue. You can also type the number.
- **Photograph the ingredient list** when a product isn't in the database. The
  text is read on the phone (ML Kit in the app, Tesseract on the website; nothing
  is uploaded), then shown to you to correct before it's checked, because text
  recognition makes mistakes. The app reads English and Hindi/Marathi
  (Devanagari) labels, and picks out the "Ingredients" block so the nutrition
  table and address are left out.
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

## The website

```bash
npm install
npm run dev        # http://localhost:8000 (rebuilds on change)
npm test           # 41 tests of the shared checker, offline
npm run build      # static site in dist/
```

`dist/` is plain files with no server and no API keys. **The camera only works over
HTTPS** (or on `localhost`). To try it on a phone during development, use an HTTPS
tunnel such as `npx localtunnel --port 8000`.

### Deploying to Hostinger

Any Hostinger plan with a website works; Node.js hosting isn't needed.

1. **SSL:** in hPanel → Security → SSL, install the free certificate and turn on
   Force HTTPS.
2. **Upload automatically (recommended):** in GitHub → Settings → Secrets and
   variables → Actions, add `FTP_SERVER`, `FTP_USERNAME` and `FTP_PASSWORD` (from
   hPanel → Files → FTP Accounts). Every push to `main` then builds the site and
   uploads it to `public_html/` (`.github/workflows/deploy.yml`). Set the `FTP_DIR`
   variable if your site lives somewhere else.
3. **Or upload by hand:** `npm run build`, then upload everything *inside* `dist/`
   (including the hidden `.htaccess`) to `public_html/` in hPanel's File Manager.

`.htaccess` forces HTTPS, sets the right file types for the app manifest and the
APK, and stops browsers caching the page and the offline worker.

## The Android/iOS app

```bash
cd mobile
npm install
npm run typecheck
```

ML Kit is native code, so the app can't run in the Expo Go app. Use one of these:

- **Build an APK in the cloud (no Android Studio needed):** create a free account
  at expo.dev, then `npx eas-cli@latest login` and `npm run build:apk`. EAS builds
  the app and gives you a link to the `.apk`. Install it on your phone to test.
- **Build on your computer:** with Android Studio installed and a phone connected
  by USB (developer mode on), run `npm run android`.
- **Open in Android Studio:** run `npx expo prebuild --platform android` in
  `mobile/`, then open the generated `mobile/android` folder in Android Studio.
  For a debug build, keep `npx expo start` running so the app can load its
  JavaScript. `android/` is generated from `app.json`, so don't edit it by hand;
  delete it and run prebuild again after changing `app.json` or adding a native
  package.
- **Develop with live reload:** `npx eas-cli@latest build --profile development
  --platform android` once, install that APK, then `npm start` and open the
  project from the app.

### Offering the APK from your website

Rename the APK from EAS to **`vegsure.apk`** and upload it to `public_html/`, next
to `index.html`. The website then shows Android visitors a "Get the VegSure
Android app" card; until the file exists, the card stays hidden. Phones ask the
user to allow installs from their browser the first time. For wider reach,
publish to Google Play instead: `npx eas-cli@latest submit --platform android`.

Before publishing to Google Play, check the app id in `mobile/app.json`
(`com.developerzone.vegsure`). It can't be changed after the first Play Store release.

### Device requirements

- ML Kit runs on the phone's ordinary processor; no AI chip needed.
- Android: the version Expo SDK 57 supports. iOS: recent ML Kit needs roughly
  iOS 15.5 or newer.
- No Google Play services needed: the reading models are built into the app.
  This adds a few MB per script (the app includes Latin, Devanagari, Chinese,
  Japanese and Korean, as the ML Kit library bundles all five).
- An autofocus camera makes a real difference for small print.
- iOS: test on a real iPhone. ML Kit doesn't run in the simulator on Apple-silicon
  Macs.

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
src/web/            the website: camera scanner, Tesseract OCR, results, history
mobile/src/app/     the app's screens (Expo Router)
mobile/src/lib/     ML Kit OCR, storage, and the import of src/core
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
- ML Kit reads Latin and Devanagari script. Tamil, Telugu, Gujarati, Bengali or
  Kannada-only labels need the list typed in.
- Jain practice varies. Dried ginger and turmeric, and tapioca/sabudana, are
  marked *check* rather than *avoid*.

## Next steps worth considering

- A small server for the steps on-device reading can't do: EasyOCR for Tamil,
  Telugu, Kannada and Bengali labels, LLM checks of unknown ingredient words
  (text only), and caching answers by barcode.
- Hindi and other Indian-language ingredient terms in the word list.
- Letting users report a wrong verdict, and contributing photos back to Open Food Facts.
