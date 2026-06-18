import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"

const NutritionBatchSchema = z.object({
  items: z.array(z.object({
    name: z.string().describe(
      "Canonical name. For cooked grains/legumes append '(cooked)'. For raw meat/fish use plain name. Example: 'oats (cooked)', 'chicken breast', 'banana'."
    ),
    unit: z.string().describe("'g' for most solids, 'ml' for liquids, 'pcs' for countable items (eggs, bananas, apples)"),
    quantity: z.number().describe("100 for g/ml-based, 1 for pcs-based"),
    calories: z.number(),
    proteinG: z.number(),
    carbG: z.number(),
    fatG: z.number(),
    sugarG: z.number(),
    fiberG: z.number(),
  })),
})

const ParseLogsSchema = z.object({
  ingredients: z.array(z.string()).describe("Unique food ingredient names extracted from all descriptions, clean and generic"),
})

async function addBatch(names: string[], existingNames: Set<string>): Promise<number> {
  const BATCH = 20
  let added = 0

  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH)

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: NutritionBatchSchema,
      prompt: `Provide accurate nutritional values for each ingredient below.

IMPORTANT RULES:
- For grains, pasta, legumes: use COOKED values (100g cooked), append "(cooked)" to the name
- For meat, fish, eggs: use RAW values (100g raw or 1 piece)
- For vegetables, fruits: use RAW/FRESH values
- For dairy, nuts, oils: use as-sold values per 100g or 100ml
- Double-check protein for dairy: Greek yogurt ~9g, cream cheese ~7g, skyr ~11g
- Soy sauce: ~57 kcal per 100ml

Ingredients: ${batch.join(", ")}`,
    })

    for (const item of object.items) {
      const nameLower = item.name.toLowerCase()
      if (existingNames.has(nameLower)) continue
      try {
        await db.foodItem.create({
          data: {
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            calories: item.calories,
            proteinG: item.proteinG,
            carbG: item.carbG,
            fatG: item.fatG,
            sugarG: item.sugarG,
            fiberG: item.fiberG,
            source: "AI_ESTIMATED",
          },
        })
        existingNames.add(nameLower)
        added++
      } catch {
        // Skip on unique constraint conflict
      }
    }
  }

  return added
}

export async function POST() {
  const [ingredients, adHocLogs, existingItems] = await Promise.all([
    db.ingredient.findMany({ select: { name: true } }),
    db.mealLog.findMany({
      where: { logType: "AD_HOC", description: { not: null } },
      select: { description: true },
    }),
    db.foodItem.findMany({ select: { name: true } }),
  ])

  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()))

  // Collect names from recipe ingredients
  const fromRecipes = ingredients
    .map((i) => i.name)
    .filter((name) => !existingNames.has(name.toLowerCase()))

  // Extract ingredient names from free-text AD_HOC logs
  let fromLogs: string[] = []
  const descriptions = adHocLogs
    .map((l) => l.description)
    .filter(Boolean) as string[]

  if (descriptions.length > 0) {
    const { object: parsed } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: ParseLogsSchema,
      prompt: `Extract all individual food ingredient names from these meal log descriptions. Return only clean, generic names (e.g. "Greek yogurt", "banana", "oats"). Deduplicate.

Logs:
${descriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`,
    })

    fromLogs = parsed.ingredients.filter(
      (name) => !existingNames.has(name.toLowerCase())
    )
  }

  // Merge and deduplicate across both sources
  const allNew = [...new Set([...fromRecipes, ...fromLogs].map((n) => n.toLowerCase()))]
    .map((lower) => [...fromRecipes, ...fromLogs].find((n) => n.toLowerCase() === lower)!)

  if (allNew.length === 0) {
    return NextResponse.json({ added: 0, fromRecipes: 0, fromLogs: 0 })
  }

  const addedFromRecipes = await addBatch(fromRecipes.filter((n) => !existingNames.has(n.toLowerCase())), existingNames)
  const addedFromLogs = await addBatch(fromLogs.filter((n) => !existingNames.has(n.toLowerCase())), existingNames)

  return NextResponse.json({
    added: addedFromRecipes + addedFromLogs,
    fromRecipes: addedFromRecipes,
    fromLogs: addedFromLogs,
  })
}
