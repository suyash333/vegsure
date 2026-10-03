// Food additives by number. Europe writes them "E120"; India writes "INS 120" or
// just "Colour (120)". Only additives that are, or may be, animal-derived are here —
// an unlisted number is not a finding.

import type { Category } from "./diets.js";

export interface Additive {
  name: string;
  category: Category;
  reason: string;
}

const MAYBE_FAT = "Made from fatty acids, which can be animal fat or vegetable oil. Labels rarely say which.";

const A = (name: string, category: Category, reason: string): Additive => ({ name, category, reason });

export const ADDITIVES: Readonly<Record<string, Additive>> = {
  "120": A("Carmine (E120)", "insect", "A red colour made from crushed cochineal insects."),
  "441": A("Gelatin (E441)", "slaughter", "Gelatin is boiled from animal skin and bones."),
  "542": A("Edible bone phosphate (E542)", "slaughter", "Made from animal bones."),
  "1000": A("Cholic acid (E1000)", "slaughter", "Extracted from ox bile."),
  "904": A("Shellac (E904)", "shellac", "A glaze from lac-insect resin. Not vegan; vegetarian bodies disagree."),
  "901": A("Beeswax (E901)", "bee", "Wax made by bees."),
  "913": A("Lanolin (E913)", "wool", "Wool grease from sheep."),
  "966": A("Lactitol (E966)", "dairy", "A sweetener made from milk sugar."),
  "1105": A("Lysozyme (E1105)", "egg", "An enzyme taken from egg white."),
  "920": A("L-cysteine (E920)", "maybe_animal", "Often made from feathers or hair; sometimes synthetic."),
  "921": A("L-cystine (E921)", "maybe_animal", "Often made from feathers or hair; sometimes synthetic."),
  "422": A("Glycerol (E422)", "maybe_animal", "Can be made from animal fat or vegetable oil."),
  "470": A("Salts of fatty acids (E470)", "maybe_animal", MAYBE_FAT),
  "470a": A("Salts of fatty acids (E470a)", "maybe_animal", MAYBE_FAT),
  "470b": A("Magnesium salts of fatty acids (E470b)", "maybe_animal", MAYBE_FAT),
  "471": A("Mono- and diglycerides (E471)", "maybe_animal", MAYBE_FAT),
  "472": A("Esters of mono- and diglycerides (E472)", "maybe_animal", MAYBE_FAT),
  "472a": A("Acetic esters of mono- and diglycerides (E472a)", "maybe_animal", MAYBE_FAT),
  "472b": A("Lactic esters of mono- and diglycerides (E472b)", "maybe_animal", MAYBE_FAT),
  "472c": A("Citric esters of mono- and diglycerides (E472c)", "maybe_animal", MAYBE_FAT),
  "472d": A("Tartaric esters of mono- and diglycerides (E472d)", "maybe_animal", MAYBE_FAT),
  "472e": A("DATEM (E472e)", "maybe_animal", MAYBE_FAT),
  "472f": A("Mixed esters of mono- and diglycerides (E472f)", "maybe_animal", MAYBE_FAT),
  "473": A("Sucrose esters of fatty acids (E473)", "maybe_animal", MAYBE_FAT),
  "474": A("Sucroglycerides (E474)", "maybe_animal", MAYBE_FAT),
  "475": A("Polyglycerol esters of fatty acids (E475)", "maybe_animal", MAYBE_FAT),
  "477": A("Propylene glycol esters of fatty acids (E477)", "maybe_animal", MAYBE_FAT),
  "481": A("Sodium stearoyl lactylate (E481)", "maybe_animal", MAYBE_FAT),
  "482": A("Calcium stearoyl lactylate (E482)", "maybe_animal", MAYBE_FAT),
  "483": A("Stearyl tartrate (E483)", "maybe_animal", MAYBE_FAT),
  "491": A("Sorbitan monostearate (E491)", "maybe_animal", MAYBE_FAT),
  "492": A("Sorbitan tristearate (E492)", "maybe_animal", MAYBE_FAT),
  "493": A("Sorbitan monolaurate (E493)", "maybe_animal", MAYBE_FAT),
  "494": A("Sorbitan monooleate (E494)", "maybe_animal", MAYBE_FAT),
  "495": A("Sorbitan monopalmitate (E495)", "maybe_animal", MAYBE_FAT),
  "430": A("Polyoxyethylene stearate (E430)", "maybe_animal", MAYBE_FAT),
  "431": A("Polyoxyethylene stearate (E431)", "maybe_animal", MAYBE_FAT),
  "432": A("Polysorbate 20 (E432)", "maybe_animal", MAYBE_FAT),
  "433": A("Polysorbate 80 (E433)", "maybe_animal", MAYBE_FAT),
  "434": A("Polysorbate 40 (E434)", "maybe_animal", MAYBE_FAT),
  "435": A("Polysorbate 60 (E435)", "maybe_animal", MAYBE_FAT),
  "436": A("Polysorbate 65 (E436)", "maybe_animal", MAYBE_FAT),
  "570": A("Stearic acid (E570)", "maybe_animal", MAYBE_FAT),
  "572": A("Magnesium stearate (E572)", "maybe_animal", MAYBE_FAT),
  "627": A("Disodium guanylate (E627)", "maybe_animal", "Sometimes made from meat or fish; can be fermented from plants."),
  "629": A("Calcium guanylate (E629)", "maybe_animal", "Sometimes made from meat or fish; can be fermented from plants."),
  "630": A("Inosinic acid (E630)", "maybe_animal", "Often made from meat or fish; can be fermented from plants."),
  "631": A("Disodium inosinate (E631)", "maybe_animal", "Often made from meat or fish; can be fermented from plants."),
  "632": A("Dipotassium inosinate (E632)", "maybe_animal", "Often made from meat or fish; can be fermented from plants."),
  "633": A("Calcium inosinate (E633)", "maybe_animal", "Often made from meat or fish; can be fermented from plants."),
  "634": A("Calcium ribonucleotides (E634)", "maybe_animal", "Sometimes made from meat or fish; can be fermented from plants."),
  "635": A("Disodium ribonucleotides (E635)", "maybe_animal", "Sometimes made from meat or fish; can be fermented from plants."),
};

/** Look up "472e", falling back to the family ("472") when the letter isn't listed. */
export function findAdditive(code: string): { code: string; additive: Additive } | undefined {
  const c = code.toLowerCase();
  const exact = ADDITIVES[c];
  if (exact) return { code: c, additive: exact };
  const family = c.replace(/[a-z]$/, "");
  const fam = ADDITIVES[family];
  return fam ? { code: family, additive: fam } : undefined;
}

/** Words that tell us a bare number like "(471)" is an additive code, not a quantity. */
export const ADDITIVE_CLASS =
  /\b(?:colou?rs?|colou?ring|emulsifiers?|emulsifying salts?|stabili[sz]ers?|thickeners?|thickening agents?|gelling agents?|preservatives?|antioxidants?|acidity regulators?|acidulants?|acids?|raising agents?|leavening agents?|flavou?r enhancers?|glazing agents?|humectants?|sweeteners?|anti ?caking agents?|firming agents?|flour treatment agents?|improvers?|bulking agents?|sequestrants?|carriers?|foaming agents?|ins|e)\b/;
