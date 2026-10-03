import { type Analysis, analyze, type Finding, type Verdict } from "../core/analyze.js";
import { DIETS, type DietId } from "../core/diets.js";
import { interpretScan } from "../core/gs1.js";
import { addProductUrl, lookupProduct, packClaim, type Product } from "../core/openfoodfacts.js";
import { clear, h } from "./dom.js";
import { readIngredientPhoto } from "./ocr.js";
import { type ScanSession, scanImage, startScan } from "./scanner.js";
import { addHistory, clearHistory, getDiet, getHistory, setDiet } from "./store.js";

/** True in the claude.ai preview build, where the sandbox blocks the camera, OCR and product lookups. */
declare const __PREVIEW__: boolean;

const SAMPLES: { name: string; text: string }[] = [
  {
    name: "Cream biscuits",
    text: "Refined wheat flour (maida), sugar, edible vegetable oil (palm), invert sugar syrup, milk solids, raising agents [503(ii), 500(ii)], salt, emulsifiers [471, 322], colour (INS 120), artificial flavouring substances (vanilla). May contain traces of egg.",
  },
  {
    name: "Fruit gummies",
    text: "Glucose syrup, sugar, gelatine, dextrose, acid (citric acid), fruit juice from concentrate (5%), colours (E120, E100), glazing agent (beeswax, carnauba wax).",
  },
  {
    name: "Instant noodles",
    text: "Noodles: wheat flour, palm oil, salt. Masala: mixed spices (onion powder, coriander, chilli, turmeric, garlic powder), flavour enhancer (635), sugar, hydrolysed groundnut protein.",
  },
  {
    name: "Milk chocolate",
    text: "Ingredients: Sugar, cocoa butter, whole milk powder (20%), cocoa mass, emulsifier (soy lecithin), natural vanilla flavouring. May contain traces of nuts.",
  },
];

const root = document.getElementById("app")!;
const dietButton = document.getElementById("diet-button") as HTMLButtonElement;

let diet: DietId = getDiet() ?? "vegetarian";
let scan: ScanSession | null = null;
/** Re-renders the current screen; used when the diet changes. */
let rerender: () => void = renderHome;

// ---- navigation ------------------------------------------------------------

function show(render: () => void, push = true): void {
  scan?.stop();
  scan = null;
  rerender = render;
  if (push && history.state?.screen !== "inner") history.pushState({ screen: "inner" }, "");
  clear(root);
  window.scrollTo(0, 0);
  render();
}

window.addEventListener("popstate", () => show(renderHome, false));

function backButton(): HTMLElement {
  return h("button", { class: "back", type: "button", onclick: () => history.back() }, "‹ Back");
}

// ---- diet ------------------------------------------------------------------

function dietName(id: DietId): string {
  return DIETS.find((d) => d.id === id)!.name;
}

function updateDietButton(): void {
  dietButton.textContent = dietName(diet);
}

function openDietPicker(firstRun = false): void {
  const dialog = h(
    "dialog",
    { class: "diet-dialog", "aria-labelledby": "diet-title" },
    h("h2", { id: "diet-title" }, firstRun ? "What do you eat?" : "Your diet"),
    h("p", { class: "muted" }, "Products are checked against this. You can change it any time."),
    ...DIETS.map((d) =>
      h(
        "button",
        {
          type: "button",
          class: `diet-option${d.id === diet ? " selected" : ""}`,
          onclick: () => {
            diet = d.id;
            setDiet(d.id);
            updateDietButton();
            dialog.close();
            dialog.remove();
            show(rerender, false);
          },
        },
        h("strong", {}, d.name),
        h("span", {}, d.summary),
      ),
    ),
  );
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener("cancel", (e) => {
    if (firstRun) e.preventDefault();
  });
}

dietButton.addEventListener("click", () => openDietPicker());

// ---- home ------------------------------------------------------------------

function renderHome(): void {
  if (__PREVIEW__) return renderPreviewHome();
  root.append(androidAppCard());
  const photoInput = fileInput((file) => show(() => renderOcr(file)));
  const barcodeForm = h(
    "form",
    {
      class: "inline-form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const value = (barcodeForm.elements.namedItem("code") as HTMLInputElement).value.trim();
        if (value) show(() => renderLookup(value));
      },
    },
    h("input", { name: "code", inputmode: "numeric", autocomplete: "off", placeholder: "Barcode number", "aria-label": "Barcode number" }),
    h("button", { type: "submit", class: "secondary" }, "Look up"),
  );

  root.append(
    h(
      "section",
      { class: "actions" },
      h(
        "button",
        { type: "button", class: "action primary", onclick: () => show(renderScanner) },
        h("span", { class: "action-icon", "aria-hidden": "true" }, "▥"),
        h("span", {}, h("strong", {}, "Scan barcode or QR code"), h("small", {}, "Point your camera at the pack")),
      ),
      h(
        "button",
        { type: "button", class: "action", onclick: () => photoInput.click() },
        h("span", { class: "action-icon", "aria-hidden": "true" }, "◎"),
        h("span", {}, h("strong", {}, "Photograph ingredients"), h("small", {}, "For products not in the database")),
      ),
      h(
        "button",
        { type: "button", class: "action", onclick: () => show(() => renderTextEntry("")) },
        h("span", { class: "action-icon", "aria-hidden": "true" }, "✎"),
        h("span", {}, h("strong", {}, "Type or paste ingredients"), h("small", {}, "Check any list by hand")),
      ),
      photoInput,
      barcodeForm,
    ),
  );

  const items = getHistory();
  if (items.length) {
    const list = h("ul", { class: "history" });
    for (const entry of items) {
      const a = analyze(entry.ingredientsText, diet);
      const title = entry.product?.name ?? "Ingredient list";
      const sub = entry.product?.brand || (entry.product ? "" : entry.ingredientsText.slice(0, 60));
      list.append(
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              onclick: () => show(() => renderResult(entry.product ? { ...entry.product, ingredients: [] } : null, entry.ingredientsText)),
            },
            entry.product?.imageUrl
              ? h("img", { src: entry.product.imageUrl, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
              : h("span", { class: "thumb-placeholder", "aria-hidden": "true" }, "✎"),
            h("span", { class: "history-text" }, h("strong", {}, title), sub ? h("small", {}, sub) : null),
            h("span", { class: `dot ${a.verdict}`, title: VERDICT[a.verdict].title }),
          ),
        ),
      );
    }
    root.append(
      h(
        "section",
        {},
        h(
          "div",
          { class: "section-head" },
          h("h2", {}, "Recent"),
          h("button", { type: "button", class: "link", onclick: () => (clearHistory(), show(renderHome, false)) }, "Clear"),
        ),
        list,
      ),
    );
  }
  root.append(footer());
}

function fileInput(onFile: (file: File) => void): HTMLInputElement {
  const input = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) onFile(file);
  });
  return input;
}

// ---- scanner ---------------------------------------------------------------

function renderScanner(): void {
  const video = h("video", { class: "camera", playsinline: true, muted: true, "aria-label": "Camera view" });
  const status = h("p", { class: "scan-status", role: "status" }, "Starting camera…");
  const photoInput = fileInput(async (file) => {
    status.textContent = "Reading code from photo…";
    try {
      const code = await scanImage(file);
      if (code) show(() => renderLookup(code), false);
      else status.textContent = "No barcode found in that photo. Try again closer, with the code flat and in focus.";
    } catch {
      status.textContent = "Couldn't read that photo.";
    }
  });

  root.append(
    backButton(),
    h("div", { class: "viewfinder" }, video, h("div", { class: "frame", "aria-hidden": "true" })),
    status,
    h("button", { type: "button", class: "secondary wide", onclick: () => photoInput.click() }, "Use a photo of the barcode instead"),
    photoInput,
  );

  startScan(video, (value) => show(() => renderLookup(value), false))
    .then((session) => {
      if (rerender !== renderScanner) return session.stop();
      scan = session;
      status.textContent = "Hold the barcode or QR code inside the frame.";
    })
    .catch((err: unknown) => {
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      status.textContent = denied
        ? "Camera permission was refused. Allow camera access in your browser settings, or use a photo instead."
        : `Couldn't start the camera. ${err instanceof Error ? err.message : ""} You can use a photo instead.`;
    });
}

// ---- lookup ----------------------------------------------------------------

function renderLookup(raw: string): void {
  const target = interpretScan(raw);

  if (target.kind === "url") {
    root.append(
      backButton(),
      h("h2", {}, "This QR code isn't a product code"),
      h("p", {}, "It links to a website rather than identifying the product:"),
      h("p", { class: "url" }, target.url),
      h(
        "p",
        {},
        h("a", { href: target.url, target: "_blank", rel: "noopener noreferrer", class: "button secondary" }, "Open link"),
      ),
      h("p", { class: "muted" }, "Scan the product's barcode instead (the striped one), or photograph the ingredient list."),
      retryActions(),
    );
    return;
  }
  if (target.kind === "text") {
    root.append(
      backButton(),
      h("h2", {}, "Not a product barcode"),
      h("p", { class: "url" }, target.text),
      h("p", { class: "muted" }, "That isn't a valid retail barcode. Check the number, or check this text as an ingredient list."),
      h("button", { type: "button", class: "secondary wide", onclick: () => show(() => renderTextEntry(target.text), false) }, "Check as ingredients"),
      retryActions(),
    );
    return;
  }

  const status = h("p", { class: "loading", role: "status" }, `Looking up ${target.gtin}…`);
  root.append(backButton(), status);
  const current = rerender;
  lookupProduct(target.candidates)
    .then((product) => {
      if (rerender !== current) return;
      if (!product) return show(() => renderNotFound(target.gtin), false);
      if (!product.ingredientsText) return show(() => renderNoIngredients(product), false);
      addHistory(product, product.ingredientsText);
      show(() => renderResult(product, product.ingredientsText), false);
    })
    .catch(() => {
      if (rerender !== current) return;
      status.textContent = "Couldn't reach the product database. Check your connection and try again, or photograph the ingredients.";
      root.append(retryActions());
    });
}

function retryActions(): HTMLElement {
  const photoInput = fileInput((file) => show(() => renderOcr(file), false));
  return h(
    "div",
    { class: "button-row" },
    h("button", { type: "button", class: "secondary", onclick: () => show(renderScanner, false) }, "Scan again"),
    h("button", { type: "button", class: "primary", onclick: () => photoInput.click() }, "Photograph ingredients"),
    photoInput,
  );
}

function renderNotFound(code: string): void {
  root.append(
    backButton(),
    h("h2", {}, "Product not found"),
    h("p", {}, `Barcode ${code} isn't in Open Food Facts yet. Photograph the ingredient list and we'll check it.`),
    retryActions(),
    h(
      "p",
      { class: "muted" },
      "Help the next person: ",
      h("a", { href: addProductUrl(code), target: "_blank", rel: "noopener" }, "add this product to Open Food Facts"),
      ".",
    ),
  );
}

function renderNoIngredients(product: Product): void {
  root.append(
    backButton(),
    productHeader(product),
    h("p", {}, "This product is in the database, but nobody has added its ingredient list yet. Photograph the list on the pack and we'll check it."),
    retryActions(),
    h("p", { class: "muted" }, h("a", { href: product.url, target: "_blank", rel: "noopener" }, "Add the ingredients on Open Food Facts")),
  );
}

// ---- photo and text entry --------------------------------------------------

function renderOcr(file: File): void {
  const preview = h("img", { class: "photo-preview", alt: "Your photo" });
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.onload = () => URL.revokeObjectURL(url);
  const bar = h("progress", { max: "1", value: "0" });
  const label = h("p", { class: "loading", role: "status" }, "Reading the label…");
  root.append(backButton(), h("h2", {}, "Reading ingredients"), preview, label, bar);
  const current = rerender;

  readIngredientPhoto(file, (stage, fraction) => {
    label.textContent = `${stage}…`;
    bar.value = fraction;
  })
    .then((text) => {
      if (rerender !== current) return;
      show(() => renderTextEntry(text, true), false);
    })
    .catch(() => {
      if (rerender !== current) return;
      label.textContent = "Couldn't read text from that photo. Try again in good light, close up and straight on — or type the list.";
      bar.remove();
      root.append(h("button", { type: "button", class: "secondary wide", onclick: () => show(() => renderTextEntry(""), false) }, "Type it instead"));
    });
}

function renderTextEntry(initial: string, fromPhoto = false): void {
  const area = h("textarea", {
    rows: "9",
    placeholder: "e.g. Wheat flour, sugar, palm oil, milk solids, emulsifier (471), salt",
    "aria-label": "Ingredient list",
  });
  area.value = initial;
  const check = () => {
    const text = area.value.trim();
    if (!text) return area.focus();
    addHistory(null, text);
    show(() => renderResult(null, text), false);
  };
  root.append(
    backButton(),
    h("h2", {}, fromPhoto ? "Check what we read" : "Ingredients"),
    fromPhoto
      ? h("p", { class: "notice" }, "Text recognition makes mistakes. Compare this with the pack and fix anything that's wrong before checking.")
      : h("p", { class: "muted" }, "Type or paste the ingredient list exactly as printed."),
    area,
    h("button", { type: "button", class: "primary wide", onclick: check }, "Check ingredients"),
  );
  if (!initial) area.focus();
}

// ---- result ----------------------------------------------------------------

const VERDICT: Record<Verdict, { title: string; body: (d: string) => string }> = {
  suitable: { title: "Looks suitable", body: (d) => `Nothing in the ingredient list conflicts with ${d}.` },
  uncertain: { title: "Check before eating", body: () => "Some ingredients can come from animals or plants, and the label doesn't say which." },
  not_suitable: { title: "Not suitable", body: (d) => `Contains ingredients that aren't ${d}.` },
  unknown: { title: "No ingredients to check", body: () => "We couldn't find an ingredient list." },
};

const DIET_ADJECTIVE: Record<DietId, string> = {
  vegetarian: "vegetarian",
  lacto_ovo: "vegetarian",
  vegan: "vegan",
  jain: "Jain",
};

function productHeader(product: Product): HTMLElement {
  return h(
    "header",
    { class: "product" },
    product.imageUrl ? h("img", { src: product.imageUrl, alt: "", referrerpolicy: "no-referrer" }) : null,
    h("div", {}, h("h2", {}, product.name), product.brand ? h("p", { class: "muted" }, product.brand) : null),
  );
}

function renderResult(product: Product | null, ingredientsText: string): void {
  const a = analyze(ingredientsText, diet, { offIngredients: product?.ingredients });
  const adjective = DIET_ADJECTIVE[diet];
  const v = VERDICT[a.verdict];
  const isVeganOrJainDiet = diet === "vegan" || diet === "jain";

  root.append(backButton());
  if (product) root.append(productHeader(product));
  root.append(
    h(
      "section",
      { class: `verdict ${a.verdict}`, role: "status" },
      h("p", { class: "verdict-diet" }, dietName(diet)),
      h("h2", {}, a.verdict === "suitable" ? `${v.title} ✓` : v.title),
      h("p", {}, v.body(adjective)),
    ),
  );

  if (product) {
    const claim = packClaim(product);
    const conflict =
      (claim === "vegan" && a.findings.some((f) => f.status === "avoid")) ||
      (claim === "vegetarian" && diet !== "vegan" && a.verdict === "not_suitable");
    if (claim) {
      const text =
        claim === "non_vegetarian"
          ? "The pack is marked non-vegetarian."
          : `The pack is labelled ${claim}${conflict ? ", but the ingredient list says otherwise — check the pack." : "."}`;
      root.append(h("p", { class: conflict || claim === "non_vegetarian" ? "notice warn" : "notice" }, text));
    }
  }

  const groups: { status: Finding["status"]; title: string }[] = [
    { status: "avoid", title: `Not ${adjective}` },
    { status: "check", title: "Could be animal-derived" },
    { status: "info", title: "Worth knowing" },
  ];
  for (const g of groups) {
    const items = groupByIngredient(a.findings.filter((f) => f.status === g.status));
    if (!items.length) continue;
    root.append(
      h(
        "section",
        { class: `findings ${g.status}` },
        h("h3", {}, g.title, h("span", { class: "count" }, String(items.length))),
        h(
          "ul",
          {},
          ...items.map((item) =>
            h(
              "li",
              {},
              h("strong", {}, item.ingredient),
              item.within.length ? h("span", { class: "within" }, ` in ${item.within.join(" › ")}`) : null,
              ...item.reasons.map((r) => h("p", {}, h("em", {}, `${r.name}: `), r.reason)),
              item.fromOff ? h("p", { class: "source" }, "Flagged by Open Food Facts") : null,
            ),
          ),
        ),
      ),
    );
  }

  const traceMentions = a.traces.flatMap((t) => t.mentions);
  if (a.traces.length) {
    root.append(
      h(
        "section",
        { class: "traces" },
        h("h3", {}, "May contain"),
        ...a.traces.map((t) => h("p", {}, `“${t.statement}”`)),
        traceMentions.length
          ? h(
              "p",
              { class: "muted" },
              `This is a cross-contamination warning (${[...new Set(traceMentions)].join(", ").toLowerCase()}), not an ingredient. ` +
                (isVeganOrJainDiet ? "Most vegans accept it; it's your call." : "Most vegetarians accept it; it's your call."),
            )
          : null,
      ),
    );
  }

  root.append(
    h(
      "details",
      { class: "ingredients" },
      h("summary", {}, `Full ingredient list (${a.ingredientCount})`),
      highlightedList(ingredientsText, a),
    ),
  );

  root.append(
    h(
      "p",
      { class: "disclaimer" },
      "Checked against the printed ingredient list only. Labels can be wrong, incomplete or out of date, and hidden processing aids (such as bone-char sugar) are never listed. If it matters, contact the manufacturer.",
    ),
  );
  if (product) {
    root.append(
      h(
        "p",
        { class: "muted small" },
        "Product data from ",
        h("a", { href: product.url, target: "_blank", rel: "noopener" }, "Open Food Facts"),
        " (ODbL). Something wrong? You can fix it there.",
      ),
    );
  }
  root.append(h("div", { class: "button-row" }, h("button", { type: "button", class: "primary", onclick: () => show(__PREVIEW__ ? renderHome : renderScanner, false) }, __PREVIEW__ ? "Check another" : "Scan another")));
}

interface Grouped {
  ingredient: string;
  within: string[];
  reasons: { name: string; reason: string }[];
  fromOff: boolean;
}

/** One row per ingredient: "cheese powder" flagged as milk and as cheese is one item with two reasons. */
function groupByIngredient(findings: Finding[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const f of findings) {
    const key = `${f.within.join(">")}>${f.ingredient}`;
    const g = map.get(key) ?? { ingredient: f.ingredient, within: f.within, reasons: [], fromOff: false };
    if (!g.reasons.some((r) => r.name === f.name)) g.reasons.push({ name: f.name, reason: f.reason });
    g.fromOff ||= f.source === "openfoodfacts";
    map.set(key, g);
  }
  return [...map.values()];
}

/** The list as printed, with flagged ingredients marked. Built from text nodes only. */
function highlightedList(text: string, a: Analysis): HTMLElement {
  const p = h("p", { class: "ingredient-text" });
  const marks = new Map<string, Finding["status"]>();
  for (const f of a.findings) if (!marks.has(f.ingredient.toLowerCase())) marks.set(f.ingredient.toLowerCase(), f.status);
  const terms = [...marks.keys()].filter((t) => t.length > 1).sort((x, y) => y.length - x.length);
  if (!terms.length) {
    p.textContent = text;
    return p;
  }
  const re = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  let last = 0;
  for (const m of text.matchAll(re)) {
    p.append(text.slice(last, m.index));
    p.append(h("mark", { class: marks.get(m[0].toLowerCase()) ?? "check" }, m[0]));
    last = m.index + m[0].length;
  }
  p.append(text.slice(last));
  return p;
}

const APK = "vegsure.apk";
let apkAvailable: Promise<boolean> | null = null;

/**
 * On Android, offer the native app (better scanning, works offline) once an APK
 * has been uploaded next to the site. Hidden until a HEAD request finds it, so
 * the site works the same before the first app release.
 */
function androidAppCard(): HTMLElement {
  const card = h(
    "a",
    { class: "app-card", href: APK, hidden: true },
    h("strong", {}, "Get the VegSure Android app"),
    h("small", {}, "Faster scanning, and reads ingredient photos offline."),
  );
  const isAndroid = /Android/i.test(navigator.userAgent);
  const installed = matchMedia("(display-mode: standalone)").matches;
  if (!isAndroid || installed) return card;
  apkAvailable ??= fetch(APK, { method: "HEAD", cache: "no-store" })
    .then((r) => r.ok && !/text\/html/i.test(r.headers.get("content-type") ?? ""))
    .catch(() => false);
  void apkAvailable.then((ok) => (card.hidden = !ok));
  return card;
}

function renderPreviewHome(): void {
  root.append(
    h(
      "p",
      { class: "notice" },
      "This is a preview of VegSure's ingredient checker. Barcode, QR and photo scanning need the camera and the Open Food Facts database, which this preview can't reach. They work in the app itself.",
    ),
    h(
      "section",
      { class: "actions" },
      h(
        "button",
        { type: "button", class: "action primary", onclick: () => show(() => renderTextEntry("")) },
        h("span", { class: "action-icon", "aria-hidden": "true" }, "✎"),
        h("span", {}, h("strong", {}, "Check an ingredient list"), h("small", {}, "Type or paste it as printed on the pack")),
      ),
    ),
    h("h2", {}, "Try a sample label"),
    h(
      "div",
      { class: "samples" },
      ...SAMPLES.map((sample) =>
        h("button", { type: "button", onclick: () => show(() => renderTextEntry(sample.text)) }, h("strong", {}, sample.name), h("small", {}, sample.text.slice(0, 70) + "…")),
      ),
    ),
    h("p", { class: "muted small" }, "These are example labels written for this preview, not real products. Switch diet with the button at the top to see the verdict change."),
  );
}

function footer(): HTMLElement {
  return h(
    "footer",
    {},
    h(
      "p",
      {},
      "Product data from ",
      h("a", { href: "https://world.openfoodfacts.org", target: "_blank", rel: "noopener" }, "Open Food Facts"),
      ", the free food database anyone can edit. Photos are read on your phone and never uploaded.",
    ),
  );
}

// ---- start -----------------------------------------------------------------

updateDietButton();
history.replaceState({ screen: "home" }, "");
renderHome();
if (!getDiet()) openDietPicker(true);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
