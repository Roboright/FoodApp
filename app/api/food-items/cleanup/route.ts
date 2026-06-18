import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"

const CleanupSchema = z.object({
  corrections: z.array(z.object({
    id: z.string().describe("ID of the item to update"),
    name: z.string().optional().describe("Corrected canonical name if it should change"),
    calories: z.number().optional(),
    proteinG: z.number().optional(),
    carbG: z.number().optional(),
    fatG: z.number().optional(),
    sugarG: z.number().optional(),
    fiberG: z.number().optional(),
    notes: z.string().optional().describe("e.g. 'cooked values per 100g' or 'raw values per 100g'"),
  })).describe("Items that need value corrections or name standardisation"),

  deletions: z.array(z.string()).describe(
    "IDs of duplicate or erroneous items to delete. Keep the most accurate / canonical entry and delete the rest."
  ),
})

export async function POST() {
  const items = await db.foodItem.findMany({ orderBy: { name: "asc" } })

  if (items.length === 0) {
    return NextResponse.json({ corrections: 0, deletions: 0 })
  }

  const itemList = items.map((i) =>
    `[${i.id}] "${i.name}" — ${i.quantity}${i.unit} → ${i.calories} kcal, ${i.proteinG}g prot, ${i.carbG}g carbs, ${i.fatG}g fat${i.sugarG != null ? `, ${i.sugarG}g sugar` : ""}`
  ).join("\n")

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: CleanupSchema,
    prompt: `You are auditing a food items nutrition database for a meal tracker. Here is the full list:

${itemList}

Your tasks:
1. CORRECT wrong real-world values. Known issues to fix:
   - light cream cheese: protein should be ~7g/100g, not 15g; calories ~134kcal is plausible if fat is ~12g
   - ground chicken: it's fattier than breast — ~170-200 kcal/100g raw, protein ~17g, fat ~10-13g
   - jasmine rice and similar: pick ONE baseline (cooked, 100g cooked ≈ 130 kcal) and fix any raw values masquerading as cooked; rename to make the baseline explicit, e.g. "jasmine rice (cooked)"
   - soy sauce: ~57 kcal / 100ml, ~6g protein — fix any inflated values
   - rice entries: standardise ALL rice to cooked values (100g cooked). Rename to reflect this.

2. STANDARDISE raw vs cooked: for grains, pasta, legumes — always use cooked baseline, 100g cooked. Append "(cooked)" to the name if not already there. For meat/fish use raw. For veg/fruit use fresh.

3. DEDUPLICATE near-identical entries: keep the most accurate one, delete the rest. Examples:
   - blueberries / blueberry / fresh blueberries → keep one
   - turkey breast / turkey breast slice / turkey breast slices / turkey deli slices → keep one
   - chili flakes / chilli flakes / red chilli flakes / red pepper flakes → keep one
   - Any other obvious duplicates or pluralisation variants

Only include items in corrections[] that genuinely need changes. Only include IDs in deletions[] for clear duplicates/errors. Do not invent changes — if a value looks correct, leave it alone.`,
  })

  // Apply deletions first
  let deletionCount = 0
  for (const id of object.deletions) {
    try {
      await db.foodItem.delete({ where: { id } })
      deletionCount++
    } catch {
      // Already deleted or not found
    }
  }

  // Apply corrections
  let correctionCount = 0
  for (const c of object.corrections) {
    try {
      await db.foodItem.update({
        where: { id: c.id },
        data: {
          ...(c.name !== undefined ? { name: c.name } : {}),
          ...(c.calories !== undefined ? { calories: c.calories } : {}),
          ...(c.proteinG !== undefined ? { proteinG: c.proteinG } : {}),
          ...(c.carbG !== undefined ? { carbG: c.carbG } : {}),
          ...(c.fatG !== undefined ? { fatG: c.fatG } : {}),
          ...(c.sugarG !== undefined ? { sugarG: c.sugarG } : {}),
          ...(c.fiberG !== undefined ? { fiberG: c.fiberG } : {}),
          ...(c.notes !== undefined ? { notes: c.notes } : {}),
        },
      })
      correctionCount++
    } catch {
      // Item may have been deleted in the deletion pass
    }
  }

  return NextResponse.json({
    corrections: correctionCount,
    deletions: deletionCount,
  })
}
