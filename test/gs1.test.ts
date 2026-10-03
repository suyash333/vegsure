import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDigitOk, interpretScan, toGtin } from "../src/core/gs1.js";
import { lookupProduct, packClaim, toProduct } from "../src/core/openfoodfacts.js";

describe("barcodes", () => {
  it("validates check digits", () => {
    assert.ok(checkDigitOk("3017624010701")); // EAN-13
    assert.ok(checkDigitOk("8901063010277")); // Indian EAN-13
    assert.ok(!checkDigitOk("3017624010702"));
    assert.ok(checkDigitOk("96385074")); // EAN-8
  });

  it("expands UPC-E to UPC-A", () => {
    assert.equal(toGtin("04252614"), "042100005264");
  });

  it("reads a plain EAN-13", () => {
    const t = interpretScan("3017624010701");
    assert.equal(t.kind, "gtin");
    if (t.kind === "gtin") assert.equal(t.gtin, "3017624010701");
  });

  it("offers the 13-digit form of a UPC-A", () => {
    const t = interpretScan("041570110201");
    assert.equal(t.kind, "gtin");
    if (t.kind === "gtin") assert.deepEqual(t.candidates, ["041570110201", "0041570110201"]);
  });

  it("rejects a bad check digit", () => {
    assert.equal(interpretScan("3017624010702").kind, "text");
  });
});

describe("QR codes", () => {
  it("reads a GS1 Digital Link", () => {
    const t = interpretScan("https://id.gs1.org/01/09506000134352/10/ABC123?17=251231");
    assert.equal(t.kind, "gtin");
    if (t.kind === "gtin") {
      assert.equal(t.gtin, "09506000134352");
      assert.ok(t.candidates.includes("9506000134352".padStart(13, "0")));
    }
  });

  it("reads a brand's own Digital Link domain", () => {
    const t = interpretScan("https://example.com/products/01/03017624010701");
    assert.equal(t.kind, "gtin");
  });

  it("reads a GS1 element string, bracketed or raw", () => {
    const a = interpretScan("(01)09506000134352(17)251231(10)AB1");
    const b = interpretScan("]Q30109506000134352\x1d17251231");
    assert.equal(a.kind, "gtin");
    assert.equal(b.kind, "gtin");
  });

  it("recognises a QR that is just a website", () => {
    assert.deepEqual(interpretScan("https://brand.example/recipes"), { kind: "url", url: "https://brand.example/recipes" });
  });
});

describe("Open Food Facts", () => {
  const fakeFetch = (found: string) => async (url: string) => {
    const code = /product\/(\d+)\.json/.exec(url)![1];
    if (code !== found) return new Response(JSON.stringify({ status: 0 }), { status: 404 });
    return new Response(
      JSON.stringify({
        status: 1,
        product: {
          code,
          product_name: "Test Biscuits",
          brands: "Acme, Acme Foods",
          ingredients_text: "Wheat flour, sugar",
          labels_tags: ["en:vegetarian"],
        },
      }),
    );
  };

  it("tries each candidate code", async () => {
    const p = await lookupProduct(["041570110201", "0041570110201"], fakeFetch("0041570110201"));
    assert.equal(p?.name, "Test Biscuits");
    assert.equal(p?.brand, "Acme");
    assert.equal(packClaim(p!), "vegetarian");
  });

  it("returns null when nothing is found", async () => {
    assert.equal(await lookupProduct(["123"], fakeFetch("999")), null);
  });

  it("prefers English ingredients", () => {
    const p = toProduct("1", { ingredients_text: "Zucker", ingredients_text_en: "Sugar" });
    assert.equal(p.ingredientsText, "Sugar");
  });
});
