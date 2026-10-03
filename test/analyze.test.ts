import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyze, matchIngredient } from "../src/core/analyze.js";
import type { DietId } from "../src/core/diets.js";
import { parseIngredients } from "../src/core/parse.js";

const ids = (text: string, diet: DietId) => analyze(text, diet).findings.map((f) => f.id);
const flagged = (text: string, diet: DietId) => analyze(text, diet).findings.map((f) => f.ingredient);
const matches = (text: string) => matchIngredient(text.toLowerCase()).map((m) => m.id);

describe("parser", () => {
  it("splits a list and nests bracketed sub-lists", () => {
    const { ingredients } = parseIngredients(
      "Sugar, Milk Chocolate (12%) (sugar, cocoa butter, milk powder), Emulsifier (471), salt.",
    );
    assert.deepEqual(ingredients.map((i) => i.text), ["sugar", "milk chocolate", "emulsifier (471)", "salt"]);
    assert.deepEqual(ingredients[1]!.children.map((i) => i.text), ["sugar", "cocoa butter", "milk powder"]);
    assert.equal(ingredients[1]!.label, "Milk Chocolate");
  });

  it("pulls out may-contain statements", () => {
    const { ingredients, traces } = parseIngredients("Wheat flour, sugar, oil. May contain traces of milk and egg.");
    assert.deepEqual(ingredients.map((i) => i.text), ["wheat flour", "sugar", "oil"]);
    assert.equal(traces.length, 1);
  });

  it("drops the Ingredients: prefix and percentages, keeps decimals intact", () => {
    const { ingredients } = parseIngredients("INGREDIENTS: Rice (62,5%), lentils 3.5%, salt");
    assert.deepEqual(ingredients.map((i) => i.text), ["rice", "lentils", "salt"]);
  });

  it("survives an unclosed bracket from OCR", () => {
    const { ingredients } = parseIngredients("Biscuit (wheat flour, sugar, gelatin");
    assert.ok(ingredients.length >= 1);
    assert.ok(analyze("Biscuit (wheat flour, sugar, gelatin", "vegetarian").verdict === "not_suitable");
  });
});

describe("word matching", () => {
  it("finds the obvious", () => {
    assert.deepEqual(matches("gelatin"), ["gelatin"]);
    assert.deepEqual(matches("chicken stock"), ["meat", "broth"]);
    assert.deepEqual(matches("whole milk powder"), ["milk"]);
    assert.deepEqual(matches("dried egg white"), ["egg"]);
    assert.deepEqual(matches("anchovy paste"), ["fish"]);
  });

  it("does not flag plant look-alikes", () => {
    for (const ok of [
      "coconut milk", "cocoa butter", "peanut butter", "shea butter", "almond milk powder", "cream of tartar",
      "eggplant", "eggless", "vegetable stock", "soy lecithin", "lactic acid", "butternut squash", "kidney beans",
      "blood orange juice", "oyster mushroom", "agar", "vanaspati", "honeydew melon", "muskmelon", "bean curd",
      "lemon curd", "microbial rennet", "graham flour", "hamburger bun seeds",
    ]) {
      assert.deepEqual(matches(ok).filter((id) => !["root_veg", "mushroom", "onion_garlic"].includes(id)), [], ok);
    }
  });

  it("respects free-from wording", () => {
    assert.deepEqual(matches("milk free chocolate"), []);
    assert.deepEqual(matches("egg-free"), []);
    assert.deepEqual(matches("free from gelatin"), []);
    assert.deepEqual(matches("dairy and egg free"), []);
    assert.deepEqual(matches("gluten free milk chocolate"), ["milk"]);
  });

  it("still flags the real thing next to a look-alike", () => {
    assert.deepEqual(matches("milk and coconut milk"), ["milk"]);
  });

  it("reads E numbers and Indian INS numbers", () => {
    assert.deepEqual(matches("colour (e120)"), ["E120"]);
    assert.deepEqual(matches("ins 120"), ["E120"]);
    assert.deepEqual(matches("E-471"), ["E471"]);
    assert.deepEqual(matches("emulsifier (471)"), ["E471"]);
    assert.deepEqual(matches("emulsifiers 472e"), ["E472e"]);
    assert.deepEqual(matches("thickener 441"), ["E441"]);
  });

  it("does not treat quantities as E numbers", () => {
    assert.deepEqual(matches("120 g sugar"), []);
    assert.deepEqual(matches("water 471"), []);
  });

  it("does not double-report a named additive and its number", () => {
    assert.deepEqual(matches("gelatine (e441)"), ["gelatin"]);
    assert.deepEqual(matches("carmine (e120)"), ["carmine"]);
  });

  it("lets a plant qualifier clear the maybe-animal rules only", () => {
    assert.deepEqual(matches("mono and diglycerides of fatty acids (vegetable)"), []);
    assert.deepEqual(matches("emulsifier (471) (from palm oil)"), []);
    assert.deepEqual(matches("vegetable glycerine"), []);
    assert.deepEqual(matches("vitamin d3 (lichen)"), []);
    // a qualifier never clears a definite rule
    assert.ok(matches("gelatin (vegetable)").includes("gelatin"));
    assert.deepEqual(matches("milk solids (vegetable fat blend)"), ["milk"]);
  });
});

describe("diets", () => {
  const cake = "Wheat flour, sugar, eggs, butter, baking powder";

  it("eggs fail vegetarian (Indian) but pass lacto-ovo", () => {
    assert.equal(analyze(cake, "vegetarian").verdict, "not_suitable");
    assert.deepEqual(ids(cake, "vegetarian"), ["egg"]);
    assert.equal(analyze(cake, "lacto_ovo").verdict, "suitable");
  });

  it("vegan flags eggs and dairy", () => {
    assert.deepEqual(ids(cake, "vegan").sort(), ["butter", "egg"]);
  });

  it("Jain flags onion and garlic and honey but not dairy", () => {
    const text = "Paneer, onion, garlic, tomato, honey, salt";
    assert.deepEqual([...new Set(ids(text, "jain"))].sort(), ["honey", "onion_garlic"]);
    assert.equal(analyze(text, "vegetarian").verdict, "suitable");
  });

  it("dried ginger is a check for Jains, not a fail", () => {
    assert.equal(analyze("Sugar, ginger powder", "jain").verdict, "uncertain");
  });

  it("cheese is a rennet check for vegetarians", () => {
    const a = analyze("Pasta, cheddar cheese, salt", "vegetarian");
    assert.equal(a.verdict, "uncertain");
    assert.equal(a.findings[0]!.status, "check");
    assert.equal(analyze("Pasta, vegetarian cheese, salt", "vegetarian").verdict, "suitable");
  });

  it("natural flavouring is information, not a verdict changer", () => {
    const a = analyze("Sugar, cocoa, natural flavouring", "vegan");
    assert.equal(a.verdict, "suitable");
    assert.equal(a.findings[0]!.status, "info");
  });

  it("unknown when there is no list", () => {
    assert.equal(analyze("   ", "vegan").verdict, "unknown");
  });
});

describe("real labels", () => {
  it("chocolate bar", () => {
    const text =
      "Ingredients: Sugar, Cocoa Butter, Whole Milk Powder (20%), Cocoa Mass, Emulsifier (Soy Lecithin), Natural Vanilla Flavouring. " +
      "May contain traces of nuts.";
    assert.equal(analyze(text, "vegetarian").verdict, "suitable");
    const v = analyze(text, "vegan");
    assert.equal(v.verdict, "not_suitable");
    assert.deepEqual(v.findings.map((f) => f.ingredient), ["Whole Milk Powder"]);
  });

  it("gummy sweets", () => {
    const text = "Glucose syrup, sugar, gelatine, dextrose, acid (citric acid), fruit juice, colours (E120, E100), glazing agent (beeswax, carnauba wax)";
    const veg = analyze(text, "vegetarian");
    assert.equal(veg.verdict, "not_suitable");
    assert.deepEqual(veg.findings.map((f) => f.id).sort(), ["E120", "gelatin"]);
    assert.ok(ids(text, "vegan").includes("honey"));
  });

  it("Indian biscuit with INS numbers", () => {
    const text =
      "Refined wheat flour (maida), sugar, edible vegetable oil (palm), invert sugar syrup, milk solids, " +
      "raising agents [503(ii), 500(ii)], salt, emulsifiers [471, 322], dough conditioner (223).";
    const veg = analyze(text, "vegetarian");
    assert.equal(veg.verdict, "uncertain");
    assert.deepEqual(veg.findings.map((f) => f.id), ["E471"]);
    assert.deepEqual(veg.findings[0]!.within, ["emulsifiers"]);
  });

  it("instant noodles masala", () => {
    const text =
      "Noodles: wheat flour, palm oil, salt. Masala: mixed spices (onion powder, coriander, chilli, turmeric, garlic powder), " +
      "flavour enhancer (635), sugar, hydrolysed groundnut protein";
    assert.deepEqual(ids(text, "vegetarian"), ["E635"]);
    const jain = analyze(text, "jain");
    assert.equal(jain.verdict, "not_suitable");
    assert.ok(jain.findings.some((f) => f.id === "onion_garlic"));
  });

  it("a child explains its parent once", () => {
    const text = "Milk chocolate (sugar, cocoa butter, whole milk powder), wheat flour";
    const v = analyze(text, "vegan");
    assert.equal(v.findings.length, 1);
    assert.equal(v.findings[0]!.ingredient, "whole milk powder");
    assert.deepEqual(v.findings[0]!.within, ["Milk chocolate"]);
  });

  it("names the animal products in a may-contain warning", () => {
    const v = analyze("Oats, sugar. May contain milk and egg.", "vegan");
    assert.equal(v.verdict, "suitable");
    assert.deepEqual(v.traces[0]!.mentions.sort(), ["Egg", "Milk"]);
  });
});

describe("Open Food Facts second opinion", () => {
  it("adds ingredients our rules cannot read", () => {
    const v = analyze("Zucker, Schweinegelatine", "vegetarian", {
      offIngredients: [
        { id: "en:sugar", text: "Zucker", vegan: "yes", vegetarian: "yes" },
        { id: "en:pork-gelatin", text: "Schweinegelatine", vegan: "no", vegetarian: "no" },
      ],
    });
    assert.equal(v.verdict, "not_suitable");
    assert.equal(v.findings[0]!.source, "openfoodfacts");
  });

  it("treats an OFF vegan-only 'no' as an egg check for Indian vegetarians", () => {
    const off = [{ id: "en:eiklar", text: "Eiklar", vegan: "no", vegetarian: "yes" }];
    assert.equal(analyze("Eiklar", "vegetarian", { offIngredients: off }).verdict, "uncertain");
    assert.equal(analyze("Eiklar", "lacto_ovo", { offIngredients: off }).verdict, "suitable");
    assert.equal(analyze("Eiklar", "vegan", { offIngredients: off }).verdict, "not_suitable");
  });

  it("does not duplicate what the rules already found", () => {
    const v = analyze("Sugar, gelatin", "vegetarian", {
      offIngredients: [{ id: "en:gelatin", text: "gelatin", vegan: "no", vegetarian: "no" }],
    });
    assert.equal(v.findings.length, 1);
    assert.equal(v.findings[0]!.source, "rules");
  });
});

describe("flagged ingredient names are shown as printed", () => {
  it("keeps the label's casing", () => {
    assert.deepEqual(flagged("Sugar, Gelatine", "vegan"), ["Gelatine"]);
  });
});
