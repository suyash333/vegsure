// The ingredient database. Each rule is matched against one ingredient at a time
// (after the list is split on commas and brackets), on lowercased, accent-free text.
//
// `terms` are whole-word phrases. `except` are phrases that look like a match but
// aren't — "coconut milk", "cocoa butter", "eggless". Exceptions are blanked out of
// the ingredient before the terms are tested, so "milk, coconut milk" in a single
// ingredient still flags the real milk.

import type { Category } from "./diets.js";

export interface Rule {
  id: string;
  name: string;
  category: Category;
  /** Shown to the user: why this matters. */
  reason: string;
  terms: string[];
  except?: string[];
}

const PLANT_PREFIX =
  "(?:coconut|soy|soya|almond|oat|rice|cashew|hemp|pea|peanut|hazelnut|walnut|pistachio|macadamia|nut|seed|sesame|sunflower|pumpkin seed|cocoa|cacao|shea|mango|kokum|illipe|sal|plant|vegetable|vegan|non[- ]?dairy|dairy[- ]?free)";

export const RULES: readonly Rule[] = [
  // ---- meat -------------------------------------------------------------
  {
    id: "meat",
    name: "Meat",
    category: "meat",
    reason: "Meat from an animal.",
    terms: [
      "meat", "beef", "pork", "ham", "bacon", "chicken", "turkey", "lamb", "mutton", "veal", "goat",
      "duck", "goose", "venison", "rabbit", "salami", "pepperoni", "chorizo", "prosciutto", "pancetta",
      "liver", "kidney", "poultry", "gosht", "keema", "murgh", "kheema", "meat extract", "beef extract",
      "chicken extract", "chicken fat", "beef fat", "pork fat", "mechanically separated",
    ],
    except: [
      "meat[- ]?free", "meatless", "mock meat", "plant[- ]based meat", "meat substitute", "meat analogue",
      "vegetarian chicken", "vegan chicken", "chicken[- ]?free", "imitation \\w+ flavou?r", "ham free",
      "turkey berry", "turkish", "chicken of the woods", "goat'?s? milk", "goat'?s? cheese", "goat'?s? butter",
      "lamb'?s lettuce", "duck egg", "goose egg", "kidney beans?", "liver ?wort",
    ],
  },
  {
    id: "sausage",
    name: "Sausage",
    category: "meat",
    reason: "Sausages are made from meat unless labelled vegetarian.",
    terms: ["sausage", "sausages", "frankfurter", "hot dog"],
    except: [`(?:vegetarian|vegan|veggie|plant[- ]based|soy|soya|meat[- ]?free) (?:sausages?|frankfurters?|hot dogs?)`],
  },
  {
    id: "broth",
    name: "Meat broth or stock",
    category: "meat",
    reason: "Broth and stock are made by boiling bones or meat unless they say vegetable.",
    terms: ["broth", "stock", "bouillon", "consomme", "bone broth", "dashi"],
    except: [`(?:vegetable|veg|veggie|mushroom|kombu|seaweed|vegan|plant) (?:broth|stock|bouillon|dashi)`, "kombu dashi"],
  },
  {
    id: "animal_fat",
    name: "Animal fat",
    category: "slaughter",
    reason: "Fat rendered from a slaughtered animal.",
    terms: ["lard", "tallow", "suet", "dripping", "drippings", "animal fat", "animal fats", "beef dripping", "schmaltz"],
  },
  {
    id: "gelatin",
    name: "Gelatin",
    category: "slaughter",
    reason: "Gelatin is boiled from animal skin and bones.",
    terms: ["gelatin", "gelatine", "gelatina", "edible gelatin", "hydrolysed gelatin", "collagen", "hydrolysed collagen"],
    except: [`(?:vegetable|vegan|plant|agar|seaweed|marine algae) (?:gelatin|gelatine|collagen)`, "gelatin[- ]?free"],
  },
  {
    id: "bone",
    name: "Bone",
    category: "slaughter",
    reason: "Made from animal bones.",
    terms: ["bone", "bones", "bone meal", "bone phosphate", "edible bone phosphate", "bone char", "bone marrow"],
  },
  {
    id: "rennet",
    name: "Rennet",
    category: "slaughter",
    reason: "Traditional rennet is taken from the stomach of a slaughtered calf.",
    terms: ["rennet", "animal rennet", "calf rennet", "pepsin", "chymosin"],
    except: [
      `(?:microbial|vegetable|vegetarian|non[- ]animal|plant|fungal|fermentation[- ]produced) (?:rennet|chymosin)`,
      "rennet[- ]?free",
    ],
  },
  {
    id: "animal_enzymes",
    name: "Animal enzymes",
    category: "slaughter",
    reason: "Enzymes stated to come from animals.",
    terms: ["animal enzymes", "animal enzyme", "pancreatin", "trypsin"],
  },
  {
    id: "blood",
    name: "Blood",
    category: "slaughter",
    reason: "Animal blood.",
    terms: ["blood", "blood plasma", "plasma protein", "haemoglobin", "hemoglobin", "blood powder"],
    except: ["blood orange", "blood oranges"],
  },
  {
    id: "other_slaughter",
    name: "Animal-derived (slaughter)",
    category: "slaughter",
    reason: "Comes from a slaughtered animal.",
    terms: ["cholic acid", "ox bile", "bile", "tripe", "offal", "castoreum", "civet", "musk", "ambergris", "placenta"],
    except: ["musk ?melon", "muskmelon"],
  },

  // ---- fish and seafood -------------------------------------------------
  {
    id: "fish",
    name: "Fish",
    category: "fish",
    reason: "Fish.",
    terms: [
      "fish", "anchovy", "anchovies", "tuna", "salmon", "cod", "sardine", "sardines", "mackerel", "herring",
      "pollock", "haddock", "trout", "tilapia", "hake", "bonito", "katsuobushi", "surimi", "fish sauce",
      "fish oil", "fish extract", "fish gelatin", "fish collagen", "cod liver oil", "caviar", "roe", "fish roe",
      "isinglass", "machli", "bombay duck", "dried fish", "nam pla",
    ],
    except: ["fish[- ]?free", "goldfish crackers?", "fish shaped"],
  },
  {
    id: "seafood",
    name: "Shellfish and seafood",
    category: "fish",
    reason: "Shellfish or other seafood.",
    terms: [
      "shellfish", "seafood", "shrimp", "shrimps", "prawn", "prawns", "crab", "lobster", "crayfish", "crawfish",
      "oyster", "oysters", "mussel", "mussels", "clam", "clams", "scallop", "scallops", "squid", "calamari",
      "octopus", "cuttlefish", "krill", "krill oil", "oyster sauce", "shrimp paste", "belacan", "chitosan",
      "crustacean", "crustaceans", "mollusc", "molluscs", "mollusk", "jhinga",
    ],
    except: ["oyster mushrooms?", "oyster sauce flavou?r(?:ed)? \\(vegetarian\\)", "vegetarian oyster sauce", "mushroom oyster sauce"],
  },
  {
    id: "worcestershire",
    name: "Worcestershire sauce",
    category: "fish",
    reason: "Worcestershire sauce is traditionally made with anchovies.",
    terms: ["worcestershire sauce", "worcester sauce"],
    except: ["(?:vegan|vegetarian) worcestershire sauce"],
  },

  // ---- insects ----------------------------------------------------------
  {
    id: "carmine",
    name: "Carmine (cochineal)",
    category: "insect",
    reason: "A red colour made from crushed cochineal insects.",
    terms: ["carmine", "carmines", "cochineal", "carminic acid", "natural red 4", "crimson lake"],
  },
  {
    id: "shellac",
    name: "Shellac",
    category: "shellac",
    reason: "A glaze made from resin secreted by lac insects; insects die in harvesting. Not vegan; vegetarian bodies disagree.",
    terms: ["shellac", "confectioner's glaze", "confectioners glaze", "lac resin", "resinous glaze", "lac"],
  },

  // ---- eggs -------------------------------------------------------------
  {
    id: "egg",
    name: "Egg",
    category: "egg",
    reason: "Egg — not eaten by vegans, or by most vegetarians in India.",
    terms: [
      "egg", "eggs", "egg white", "egg yolk", "egg powder", "dried egg", "whole egg", "egg solids", "albumen",
      "egg albumin", "ovalbumin", "egg lecithin", "lysozyme", "mayonnaise", "mayo", "meringue", "ovomucoid",
      "egg protein",
    ],
    except: [
      "eggless", "egg[- ]?free", "no eggs?", "without eggs?", "egg ?plants?", "(?:vegan|eggless|egg[- ]?free|veg) (?:mayonnaise|mayo)",
      "egg replacer", "egg substitute", "vegan egg",
    ],
  },
  {
    id: "albumin",
    name: "Albumin",
    category: "maybe_animal",
    reason: "Albumin is usually from egg or milk.",
    terms: ["albumin"],
    except: ["egg albumin", "(?:pea|potato|plant|soy|wheat) albumin"],
  },

  // ---- dairy ------------------------------------------------------------
  {
    id: "milk",
    name: "Milk",
    category: "dairy",
    reason: "Milk from cows, buffalo, goats or other animals.",
    terms: [
      "milk", "milks", "whole milk", "skimmed milk", "skim milk", "milk powder", "milk solids", "milk protein",
      "milk fat", "milkfat", "butterfat", "anhydrous milk fat", "milk derivatives", "condensed milk",
      "evaporated milk", "dairy", "dairy solids", "dried milk", "milk chocolate", "buttermilk", "doodh",
      "toned milk", "lactose", "milk sugar",
    ],
    except: [
      `${PLANT_PREFIX} (?:milk|milks|drink)`, `${PLANT_PREFIX} milk (?:powder|solids)`, "milk thistle", "milkweed",
      "(?:milk|dairy|lactose)[- ]?free", "non[- ]?dairy", "no (?:milk|dairy)", "without (?:milk|dairy)", "dairy alternative",
      "milk of magnesia", "milk ?wood",
    ],
  },
  {
    id: "cream",
    name: "Cream",
    category: "dairy",
    reason: "Cream is the fat skimmed from milk.",
    terms: ["cream", "sour cream", "double cream", "single cream", "whipping cream", "malai", "fresh cream", "ice cream", "creme fraiche", "clotted cream"],
    except: [`${PLANT_PREFIX} cream`, "cream of tartar", "(?:vegan|non[- ]?dairy|dairy[- ]?free) ice cream", "cream[- ]style", "cream flavou?r"],
  },
  {
    id: "butter",
    name: "Butter and ghee",
    category: "dairy",
    reason: "Butter and ghee are made from milk fat.",
    terms: ["butter", "butters", "ghee", "desi ghee", "butter oil", "clarified butter", "makhan", "makkhan", "brown butter"],
    except: [
      `${PLANT_PREFIX} butter`, "nut butter", "apple butter", "butter beans?", "butternut", "butterscotch flavou?r",
      "vegetable ghee", "vanaspati", "butter flavou?r(?:ed|ing)?", "peanut butter",
    ],
  },
  {
    id: "whey",
    name: "Whey and casein",
    category: "dairy",
    reason: "Whey and casein are milk proteins.",
    terms: [
      "whey", "whey powder", "whey protein", "sweet whey", "demineralised whey", "casein", "caseinate",
      "caseinates", "sodium caseinate", "calcium caseinate", "lactalbumin", "lactoglobulin", "lactoferrin",
      "milk mineral", "milk minerals", "lactitol",
    ],
  },
  {
    id: "yogurt",
    name: "Yogurt and curd",
    category: "dairy",
    reason: "Yogurt and curd are fermented milk.",
    terms: ["yogurt", "yoghurt", "yogurt powder", "curd", "curds", "dahi", "kefir", "quark", "lassi", "shrikhand", "chhena", "chenna"],
    except: [`${PLANT_PREFIX} (?:yogh?urt|curds?|kefir)`, "bean curd", "soy curd", "lemon curd"],
  },
  {
    id: "paneer",
    name: "Paneer and khoya",
    category: "dairy",
    reason: "Paneer and khoya are made from milk (set with acid, not rennet).",
    terms: ["paneer", "khoya", "khoa", "mawa", "rabri", "rabdi", "milk cake"],
    except: ["tofu paneer", "soy paneer", "vegan paneer"],
  },
  {
    id: "cheese",
    name: "Cheese",
    category: "cheese",
    reason: "Cheese is made from milk, and many cheeses are set with animal rennet unless labelled vegetarian.",
    terms: [
      "cheese", "cheeses", "cheese powder", "parmesan", "cheddar", "mozzarella", "gouda", "emmental", "gruyere",
      "pecorino", "grana padano", "edam", "feta", "brie", "camembert", "cream cheese", "processed cheese",
    ],
    except: [`(?:${PLANT_PREFIX}|vegan|cashew|nutritional yeast) (?:cheese|parmesan|mozzarella|cheddar)`, "cheese flavou?r(?:ed|ing)?", "cheese[- ]?free"],
  },

  // ---- bees -------------------------------------------------------------
  {
    id: "honey",
    name: "Honey and bee products",
    category: "bee",
    reason: "Made by bees. Not vegan, and avoided by Jains.",
    terms: ["honey", "honey powder", "honeycomb", "beeswax", "bees wax", "bee's wax", "royal jelly", "propolis", "bee pollen", "shahad"],
    except: ["honeydew", "honeydew melon", "honey ?bush", "honey[- ]?free", "honey flavou?r(?:ed|ing)?", "honeycrisp", "honey locust"],
  },

  // ---- other animal ----------------------------------------------------
  {
    id: "lanolin",
    name: "Lanolin",
    category: "wool",
    reason: "Lanolin is wool grease from sheep.",
    terms: ["lanolin", "wool grease", "wool fat", "wool wax"],
  },
  {
    id: "vitamin_d3",
    name: "Vitamin D3",
    category: "vitamin_d3",
    reason: "Vitamin D3 is usually made from lanolin (sheep's wool); some is from lichen.",
    terms: ["vitamin d3", "vitamin d 3", "cholecalciferol"],
    except: ["(?:lichen|vegan|plant)[- ](?:derived )?(?:vitamin d3|cholecalciferol)", "vitamin d3 \\(lichen\\)", "vitamin d3 from lichen"],
  },
  {
    id: "omega3",
    name: "Omega-3",
    category: "maybe_animal",
    reason: "Omega-3 is often from fish oil unless it says algae, flax or another plant.",
    terms: ["omega 3", "omega-3", "omega 3 fatty acids", "dha", "epa", "docosahexaenoic acid", "eicosapentaenoic acid"],
    except: [`(?:algal|algae|flax|flaxseed|linseed|chia|plant|vegetable|vegan|microalgae|schizochytrium) (?:oil )?(?:omega[- ]?3|dha|epa)`],
  },
  {
    id: "squalene",
    name: "Squalene",
    category: "maybe_animal",
    reason: "Squalene may come from shark liver; it can also be from olives or amaranth.",
    terms: ["squalene", "squalane"],
    except: [`(?:olive|amaranth|plant|vegetable|sugarcane) (?:derived )?(?:squalene|squalane)`],
  },
  {
    id: "keratin",
    name: "Keratin and L-cysteine",
    category: "maybe_animal",
    reason: "L-cysteine (a flour improver) is often made from feathers or hair.",
    terms: ["keratin", "l-cysteine", "l cysteine", "cysteine", "cystine", "l-cystine"],
    except: ["(?:synthetic|microbial|fermented|vegetable|plant) (?:l[- ])?cyst(?:e)?ine"],
  },
  {
    id: "glycerides",
    name: "Mono- and diglycerides",
    category: "maybe_animal",
    reason: "Emulsifiers made from fats, which can be animal or plant. Labels rarely say which.",
    terms: [
      "mono and diglycerides", "mono- and diglycerides", "mono and di glycerides", "mono- and di-glycerides",
      "monoglycerides", "diglycerides", "mono and diglycerides of fatty acids", "mono- and diglycerides of fatty acids",
      "glycerides of fatty acids", "polysorbate", "polysorbates",
    ],
    except: [`(?:vegetable|plant|palm|soy|soya|sunflower|rapeseed)(?: oil)?(?: based| derived| origin| source)? mono`, "\\(vegetable(?: origin| source)?\\)"],
  },
  {
    id: "glycerin",
    name: "Glycerin",
    category: "maybe_animal",
    reason: "Glycerin can be made from animal fat or vegetable oil.",
    terms: ["glycerin", "glycerine", "glycerol"],
    except: [`(?:vegetable|plant|palm|soy|soya|coconut)(?: oil)?(?: derived)? glycer(?:in|ine|ol)`],
  },
  {
    id: "stearic_acid",
    name: "Stearic acid and stearates",
    category: "maybe_animal",
    reason: "Stearic acid and its salts can come from animal fat or plants.",
    terms: ["stearic acid", "magnesium stearate", "calcium stearate", "sodium stearoyl lactylate", "calcium stearoyl lactylate", "fatty acids", "salts of fatty acids"],
    except: [`(?:vegetable|plant|palm|coconut|soy|soya)(?: oil)?(?: derived| based| source)? (?:stearic acid|magnesium stearate|calcium stearate|fatty acids)`],
  },
  {
    id: "flavour_enhancers",
    name: "Inosinate and guanylate",
    category: "maybe_animal",
    reason: "These flavour enhancers are sometimes made from meat or fish; they can also be fermented from plants.",
    terms: ["disodium inosinate", "inosinate", "disodium guanylate", "guanylate", "disodium 5'-ribonucleotides", "disodium 5 ribonucleotides", "ribonucleotides", "inosinic acid"],
  },
  {
    id: "natural_flavour",
    name: "Natural flavouring",
    category: "flavour",
    reason: "Natural flavourings are almost always plant-based, but labels don't have to say, and a few are animal.",
    terms: ["natural flavour", "natural flavours", "natural flavor", "natural flavors", "natural flavouring", "natural flavourings", "natural flavoring", "flavouring", "flavourings", "flavoring", "flavorings"],
    except: [
      "(?:natural )?(?:vegetable|plant|fruit|vanilla|lemon|orange|mint|smoke|spice|herb) flavou?r(?:s|ings?)?",
      "nature[- ]identical",
      "(?:artificial|synthetic) flavou?r(?:s|ings?)?",
    ],
  },
  {
    id: "enzymes",
    name: "Enzymes",
    category: "flavour",
    reason: "Enzymes are usually microbial, but some (like lipase) can be animal.",
    terms: ["enzyme", "enzymes", "lipase"],
    except: ["(?:microbial|fungal|vegetable|plant|bacterial) (?:enzymes?|lipase)", "animal enzymes?"],
  },
  {
    id: "milk_alternative_cocoa",
    name: "Lactic culture / milk-sourced ingredient",
    category: "maybe_animal_vegan",
    reason: "Cultures and some ingredients are often grown on milk.",
    terms: ["lactic cultures", "lactic culture", "live cultures", "starter culture", "cultures"],
    except: ["(?:vegan|plant|dairy[- ]?free|non[- ]?dairy) (?:lactic )?cultures?"],
  },

  // ---- Jain: roots, bulbs and fungi ------------------------------------
  {
    id: "onion_garlic",
    name: "Onion and garlic",
    category: "root",
    reason: "Bulbs grown underground; Jains avoid them.",
    terms: [
      "onion", "onions", "onion powder", "dehydrated onion", "garlic", "garlic powder", "dehydrated garlic",
      "shallot", "shallots", "leek", "leeks", "spring onion", "spring onions", "scallion", "scallions", "chives",
      "pyaz", "pyaaz", "lehsun", "lahsun",
    ],
    except: ["onion[- ]?free", "garlic[- ]?free", "no onion", "no garlic", "without onion", "without garlic", "onion seeds?", "kalonji"],
  },
  {
    id: "root_veg",
    name: "Root vegetables",
    category: "root",
    reason: "Grown underground; Jains avoid root vegetables.",
    terms: [
      "potato", "potatoes", "potato starch", "potato flakes", "potato powder", "dehydrated potato", "carrot", "carrots",
      "beetroot", "beet", "beets", "radish", "radishes", "sweet potato", "yam", "yams", "turnip", "turnips", "cassava",
      "taro", "colocasia", "arbi", "aloo", "gajar", "mooli", "shakarkand", "jimikand",
    ],
    except: ["beet sugar", "sugar beet", "potato[- ]?free"],
  },
  {
    id: "mushroom",
    name: "Mushrooms",
    category: "root",
    reason: "Fungi; Jains avoid mushrooms.",
    terms: ["mushroom", "mushrooms", "mushroom extract", "shiitake", "button mushroom", "oyster mushroom", "oyster mushrooms", "truffle", "truffles"],
    except: ["chocolate truffles?", "truffle flavou?r"],
  },
  {
    id: "ginger_turmeric",
    name: "Ginger and turmeric",
    category: "root_dried",
    reason: "Rhizomes. Many Jains accept them dried (as sonth or haldi powder) but not fresh.",
    terms: ["ginger", "ginger paste", "fresh ginger", "turmeric", "fresh turmeric", "adrak", "haldi"],
  },
  {
    id: "root_starch",
    name: "Root starches",
    category: "root_dried",
    reason: "Starch from roots such as cassava (tapioca/sabudana). Strict Jains avoid it; many accept it.",
    terms: ["tapioca", "tapioca starch", "sabudana", "arrowroot", "konjac", "glucomannan"],
  },
];
