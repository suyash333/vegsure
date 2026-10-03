// The ingredient checker shared with the web app. Everything the app decides
// about an ingredient comes from here, so both apps always agree.
export { analyze, type Analysis, type Finding, type Verdict } from "../../../src/core/analyze";
export { DIETS, type DietId, isDietId } from "../../../src/core/diets";
export { interpretScan } from "../../../src/core/gs1";
export { addProductUrl, lookupProduct, packClaim, type Product } from "../../../src/core/openfoodfacts";
