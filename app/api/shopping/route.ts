import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryKey = "meat" | "bread" | "basics" | "fresh" | "dairy" | "canned" | "pantry"

export const CATEGORY_ORDER: CategoryKey[] = [
  "meat", "bread", "basics", "fresh", "dairy", "canned", "pantry",
]

export const CATEGORY_META: Record<CategoryKey, { label: string; emoji: string; isPantry: boolean }> = {
  meat:   { label: "Meat & Fish",                    emoji: "🥩", isPantry: false },
  bread:  { label: "Bread, Pasta & Rice",             emoji: "🍞", isPantry: false },
  basics: { label: "Eggs, Milk & Potatoes",           emoji: "🥚", isPantry: false },
  fresh:  { label: "Fresh Vegetables, Herbs & Fruit", emoji: "🥦", isPantry: false },
  dairy:  { label: "Dairy",                           emoji: "🧀", isPantry: false },
  canned: { label: "Canned & Other",                  emoji: "🥫", isPantry: false },
  pantry: { label: "Pantry Staples",                  emoji: "🧂", isPantry: true  },
}

function categorize(name: string): CategoryKey {
  const n = name.toLowerCase().trim()

  // 1. Pantry — checked first to catch "chicken stock" before meat, "pepper" before veg
  if (/\b(stock|broth|bouillon)\b/.test(n)) return "pantry"
  if (/\boil\b/.test(n)) return "pantry"
  if (/\b(vinegar|soy sauce|fish sauce|oyster sauce|hoisin|worcestershire|hot sauce|sriracha|tabasco|teriyaki|ponzu)\b/.test(n)) return "pantry"
  if (/\b(tomato paste|tomato puree|passata)\b/.test(n)) return "pantry"
  if (/\bdried\b/.test(n)) return "pantry"
  if (/\bpowder\b/.test(n) && !/baking/.test(n)) return "pantry"
  if (/\b(paprika|cumin|turmeric|coriander spice|cinnamon|nutmeg|cardamom|cayenne|allspice|star anise|five spice|garam masala|harissa|curry paste|curry powder)\b/.test(n)) return "pantry"
  if (/\bsalt\b/.test(n)) return "pantry"
  if (/\b(sugar|honey|maple syrup|agave|molasses)\b/.test(n)) return "pantry"
  if (/\b(flour|baking powder|baking soda|cornstarch|cornflour|yeast|breadcrumb|panko)\b/.test(n)) return "pantry"
  if (/\b(vanilla|cocoa|cacao|chocolate chip|dark chocolate)\b/.test(n)) return "pantry"
  if (/\b(tahini|peanut butter|almond butter|nut butter)\b/.test(n)) return "pantry"
  if (/\b(miso|tamari|coconut aminos)\b/.test(n)) return "pantry"
  if (/\b(walnut|almond|cashew|pecan|hazelnut|pine nut|pumpkin seed|sunflower seed|sesame seed|chia|flaxseed)\b/.test(n)) return "pantry"
  if (/\b(jam|jelly|marmalade)\b/.test(n)) return "pantry"
  if (/\b(pepper)\b/.test(n) && /\b(black|white|ground|cracked)\b/.test(n)) return "pantry"

  // 2. Meat & fish
  if (/\b(chicken|turkey|duck|quail)\b/.test(n)) return "meat"
  if (/\b(beef|veal|pork|lamb|mutton|venison|bison|rabbit|goat)\b/.test(n)) return "meat"
  if (/\b(salmon|tuna|cod|halibut|tilapia|sea bass|trout|mackerel|sardine|herring|hake|snapper|sole|haddock|pollock)\b/.test(n)) return "meat"
  if (/\b(shrimp|prawn|crab|lobster|scallop|mussel|clam|squid|octopus|anchovy)\b/.test(n)) return "meat"
  if (/\b(mince|ground (beef|turkey|pork)|steak|fillet|breast|thigh|drumstick|tenderloin|chop|ribs|cutlet)\b/.test(n)) return "meat"
  if (/\b(bacon|ham|sausage|salami|chorizo|pancetta|lardons|prosciutto|pepperoni|mortadella)\b/.test(n)) return "meat"

  // 3. Bread, pasta, rice, grains
  if (/\b(bread|baguette|ciabatta|sourdough|pita|tortilla|wrap|naan|chapati|focaccia)\b/.test(n)) return "bread"
  if (/\b(pasta|spaghetti|penne|fusilli|rigatoni|farfalle|linguine|tagliatelle|fettuccine|lasagne|gnocchi|orzo|ravioli|tortellini|macaroni)\b/.test(n)) return "bread"
  if (/\b(rice|basmati|jasmine|arborio)\b/.test(n)) return "bread"
  if (/\b(noodle|ramen|udon|soba|vermicelli)\b/.test(n)) return "bread"
  if (/\b(oat|quinoa|couscous|bulgur|farro|barley|polenta|millet)\b/.test(n)) return "bread"

  // 4. Eggs, milk, potatoes
  if (/\begg\b/.test(n) && !/eggplant/.test(n)) return "basics"
  if (/\bmilk\b/.test(n)) return "basics"
  if (/\bsweet potato\b/.test(n)) return "basics"
  if (/\bpotato\b/.test(n) && !/tomato/.test(n)) return "basics"

  // 5. Dairy
  if (/\b(cheddar|mozzarella|parmesan|feta|brie|camembert|gouda|gruyere|ricotta|mascarpone|cottage cheese|cream cheese|halloumi|pecorino|gorgonzola|goat cheese)\b/.test(n)) return "dairy"
  if (/\bcheese\b/.test(n)) return "dairy"
  if (/\b(yogurt|yoghurt|kefir|fromage frais)\b/.test(n)) return "dairy"
  if (/\b(cream|creme fraiche|sour cream|whipping cream|double cream|heavy cream)\b/.test(n)) return "dairy"
  if (/\b(butter|ghee|margarine)\b/.test(n)) return "dairy"

  // 6. Canned & legumes
  if (/\b(canned|tinned)\b/.test(n)) return "canned"
  if (/\b(chickpea|garbanzo|lentil|kidney bean|black bean|white bean|cannellini|pinto bean|navy bean|borlotti|butter bean)\b/.test(n)) return "canned"
  if (/\b(coconut milk|coconut cream)\b/.test(n)) return "canned"
  if (/\b(tofu|tempeh|edamame)\b/.test(n)) return "canned"

  // 7. Fresh vegetables, herbs, fruits
  if (/\b(tomato)\b/.test(n) && !/\b(paste|puree|sauce|canned|dried)\b/.test(n)) return "fresh"
  if (/\b(pepper|capsicum|chili|jalapeño)\b/.test(n) && !/\b(paste|sauce|flake|powder|ground|black|white)\b/.test(n)) return "fresh"
  if (/\b(onion|shallot|leek|spring onion|scallion)\b/.test(n) && !/\b(powder|dried|flake|granule)\b/.test(n)) return "fresh"
  if (/\bgarlic\b/.test(n) && !/\b(powder|paste|dried|granule)\b/.test(n)) return "fresh"
  if (/\bginger\b/.test(n) && !/\b(powder|dried|ground)\b/.test(n)) return "fresh"
  if (/\b(spinach|kale|lettuce|arugula|rocket|chard|watercress|bok choy|cabbage|brussels sprout|broccoli|cauliflower)\b/.test(n)) return "fresh"
  if (/\b(carrot|celery|cucumber|zucchini|courgette|aubergine|eggplant|mushroom|asparagus|corn|peas?|green bean|mangetout|okra)\b/.test(n)) return "fresh"
  if (/\b(avocado|apple|pear|banana|orange|lemon|lime|grapefruit|berry|strawberry|blueberry|raspberry|cherry|grape|mango|pineapple|kiwi|peach|plum|melon|watermelon)\b/.test(n)) return "fresh"
  if (/\b(basil|parsley|cilantro|coriander|mint|thyme|rosemary|sage|dill|tarragon|bay leaf|lemongrass)\b/.test(n) && !/dried/.test(n)) return "fresh"
  if (/\b(beetroot|radish|fennel|artichoke|turnip|parsnip|celeriac)\b/.test(n)) return "fresh"

  return "canned" // default catch-all into "Canned & Other"
}

// ─── Unit normalisation + conversion ─────────────────────────────────────────

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim()
  if (/^grams?$/.test(u)) return "g"
  if (/^kilograms?$/.test(u)) return "kg"
  if (/^(millilitres?|milliliters?)$/.test(u)) return "ml"
  if (/^(litres?|liters?)$/.test(u)) return "l"
  if (/^(tablespoons?|tbs)$/.test(u)) return "tbsp"
  if (/^teaspoons?$/.test(u)) return "tsp"
  if (/^(pieces?|pcs?|units?|nos?)$/.test(u)) return "pcs"
  if (/^cups?$/.test(u)) return "cup"
  if (/^(ounces?|oz)$/.test(u)) return "oz"
  if (/^(pounds?|lbs?)$/.test(u)) return "lb"
  if (/^cloves?$/.test(u)) return "cloves"
  if (/^bunches?$/.test(u)) return "bunch"
  if (/^slices?$/.test(u)) return "slices"
  if (/^cans?$/.test(u)) return "can"
  if (/^jars?$/.test(u)) return "jar"
  if (/^sprigs?$/.test(u)) return "sprigs"
  if (/^handfuls?$/.test(u)) return "handful"
  if (/^pinch(es)?$/.test(u)) return "pinch"
  return u
}

// Convert qty+unit to grams (weight) or ml (volume). Returns null if not convertible.
const WEIGHT_TO_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.59 }
const VOLUME_TO_ML: Record<string, number> = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 240 }

function toBase(qty: number, unit: string): { qty: number; unit: string } | null {
  if (WEIGHT_TO_G[unit]) return { qty: qty * WEIGHT_TO_G[unit], unit: "g" }
  if (VOLUME_TO_ML[unit]) return { qty: qty * VOLUME_TO_ML[unit], unit: "ml" }
  return null
}

function fromBase(qty: number, unit: "g" | "ml"): { qty: number; unit: string } {
  if (unit === "g") return qty >= 1000 ? { qty: qty / 1000, unit: "kg" } : { qty, unit: "g" }
  return qty >= 1000 ? { qty: qty / 1000, unit: "l" } : { qty, unit: "ml" }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get("weekStart")
  if (!weekStart) return NextResponse.json([])

  const plan = await db.mealPlan.findFirst({
    where: { weekStartDate: new Date(weekStart) },
    include: {
      mealSlots: {
        where: { recipeId: { not: null } },
        include: {
          recipe: {
            include: {
              recipeIngredients: {
                include: { ingredient: true },
                orderBy: { order: "asc" },
              },
            },
          },
          profiles: { select: { profileId: true } },
        },
      },
    },
  })

  if (!plan) return NextResponse.json([])

  // Aggregate by name (case-insensitive). Track base qty in g or ml; fall back to
  // per-unit buckets when units are incompatible (e.g. "cloves" vs "g" for garlic).
  type AggEntry = {
    name: string
    category: CategoryKey
    baseQty: number      // grams or ml
    baseUnit: "g" | "ml" | null
    perUnit: Map<string, number>  // unit → qty for non-convertible units
  }
  const agg = new Map<string, AggEntry>()

  for (const slot of plan.mealSlots) {
    if (!slot.recipe || slot.profiles.length === 0) continue

    const scale = slot.servingsOverride != null
      ? slot.servingsOverride / slot.recipe.servings
      : 1

    for (const ri of slot.recipe.recipeIngredients) {
      const name = ri.ingredient.name
      const unit = normalizeUnit(ri.unit)
      const qty = ri.quantity * scale
      const nameKey = name.toLowerCase().trim()

      let entry = agg.get(nameKey)
      if (!entry) {
        entry = { name, category: categorize(name), baseQty: 0, baseUnit: null, perUnit: new Map() }
        agg.set(nameKey, entry)
      }

      const converted = toBase(qty, unit)
      if (converted) {
        const bu = converted.unit as "g" | "ml"
        if (entry.baseUnit === null) {
          entry.baseUnit = bu
          entry.baseQty = converted.qty
        } else if (entry.baseUnit === bu) {
          entry.baseQty += converted.qty
        } else {
          // incompatible base units (shouldn't happen for same ingredient, but handle gracefully)
          entry.perUnit.set(unit, (entry.perUnit.get(unit) ?? 0) + qty)
        }
      } else {
        entry.perUnit.set(unit, (entry.perUnit.get(unit) ?? 0) + qty)
      }
    }
  }

  // Flatten aggregated entries into display items
  const flatItems: { name: string; qty: number; unit: string; category: CategoryKey }[] = []
  for (const entry of agg.values()) {
    if (entry.baseUnit !== null && entry.baseQty > 0) {
      const { qty, unit } = fromBase(entry.baseQty, entry.baseUnit)
      flatItems.push({ name: entry.name, qty, unit, category: entry.category })
    }
    for (const [unit, qty] of entry.perUnit) {
      flatItems.push({ name: entry.name, qty, unit, category: entry.category })
    }
  }

  // Group into category buckets
  const buckets: Record<CategoryKey, { name: string; qty: number; unit: string }[]> = {
    meat: [], bread: [], basics: [], fresh: [], dairy: [], canned: [], pantry: [],
  }

  for (const item of flatItems) {
    buckets[item.category].push({ name: item.name, qty: item.qty, unit: item.unit })
  }

  // Sort items alphabetically within each category
  for (const key of CATEGORY_ORDER) {
    buckets[key].sort((a, b) => a.name.localeCompare(b.name))
  }

  const result = CATEGORY_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      ...CATEGORY_META[key],
      items: buckets[key],
    }))

  return NextResponse.json(result)
}
