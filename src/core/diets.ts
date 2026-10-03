// What each diet allows. Every rule in the ingredient database names a category,
// and this table decides what that category means for each diet. Keeping the
// decision here, not on each rule, means "do vegetarians eat eggs?" is answered
// in exactly one place.

export type DietId = "vegan" | "vegetarian" | "lacto_ovo" | "jain";

/**
 * avoid — the diet excludes it.
 * check — it might be animal-derived (or excluded); the label doesn't say.
 * info  — worth knowing, but too common and usually fine to change the verdict.
 * ok    — allowed.
 */
export type Status = "avoid" | "check" | "info" | "ok";

export const STATUS_RANK: Record<Status, number> = { ok: 0, info: 1, check: 2, avoid: 3 };

export interface Diet {
  id: DietId;
  name: string;
  summary: string;
}

export const DIETS: readonly Diet[] = [
  {
    id: "vegetarian",
    name: "Vegetarian (no eggs)",
    summary: "No meat, fish, eggs, gelatin or insects. Dairy and honey are fine. The usual meaning in India.",
  },
  {
    id: "lacto_ovo",
    name: "Vegetarian (eats eggs)",
    summary: "No meat, fish, gelatin or insects. Eggs, dairy and honey are fine.",
  },
  {
    id: "vegan",
    name: "Vegan",
    summary: "Nothing from animals: no meat, fish, eggs, dairy, honey or insects.",
  },
  {
    id: "jain",
    name: "Jain",
    summary: "Vegetarian with no eggs or honey, and no root vegetables such as onion, garlic or potato.",
  },
];

export type Category =
  | "meat" //            flesh of land animals
  | "fish" //            fish and seafood
  | "slaughter" //       by-products that need the animal killed: gelatin, lard, animal rennet
  | "insect" //          killed insects: carmine/cochineal
  | "shellac" //         lac-insect resin: vegetarian bodies disagree
  | "egg"
  | "dairy"
  | "cheese" //          dairy, and may be set with animal rennet
  | "bee" //             honey, beeswax
  | "wool" //            lanolin
  | "vitamin_d3" //      usually from lanolin, sometimes from lichen
  | "maybe_animal" //    can be plant or animal: E471, glycerin, stearic acid…
  | "maybe_animal_vegan" // plant or dairy/egg — matters only to vegans
  | "flavour" //         "natural flavours": occasionally animal, rarely disclosed
  | "root" //            onion, garlic, potato: Jain only
  | "root_dried"; //     ginger, turmeric: many Jains accept the dried spice

type Table = Record<Category, Record<DietId, Status>>;

const all = (s: Status): Record<DietId, Status> => ({ vegan: s, vegetarian: s, lacto_ovo: s, jain: s });

export const CATEGORY_STATUS: Table = {
  meat: all("avoid"),
  fish: all("avoid"),
  slaughter: all("avoid"),
  insect: all("avoid"),
  shellac: { vegan: "avoid", vegetarian: "check", lacto_ovo: "check", jain: "avoid" },
  egg: { vegan: "avoid", vegetarian: "avoid", lacto_ovo: "ok", jain: "avoid" },
  dairy: { vegan: "avoid", vegetarian: "ok", lacto_ovo: "ok", jain: "ok" },
  cheese: { vegan: "avoid", vegetarian: "check", lacto_ovo: "check", jain: "check" },
  bee: { vegan: "avoid", vegetarian: "ok", lacto_ovo: "ok", jain: "avoid" },
  wool: { vegan: "avoid", vegetarian: "ok", lacto_ovo: "ok", jain: "ok" },
  vitamin_d3: { vegan: "check", vegetarian: "ok", lacto_ovo: "ok", jain: "ok" },
  maybe_animal: all("check"),
  maybe_animal_vegan: { vegan: "check", vegetarian: "ok", lacto_ovo: "ok", jain: "ok" },
  flavour: all("info"),
  root: { vegan: "ok", vegetarian: "ok", lacto_ovo: "ok", jain: "avoid" },
  root_dried: { vegan: "ok", vegetarian: "ok", lacto_ovo: "ok", jain: "check" },
};

export function statusFor(category: Category, diet: DietId): Status {
  return CATEGORY_STATUS[category][diet];
}

export function isDietId(value: unknown): value is DietId {
  return typeof value === "string" && DIETS.some((d) => d.id === value);
}
