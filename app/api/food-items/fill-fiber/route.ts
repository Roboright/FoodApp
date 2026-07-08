import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { db } from "@/lib/db"

const FiberSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    fiberG: z.number().describe("Fiber content in grams for the given quantity of this food item. Use 0 if negligible."),
  })),
})

const BATCH = 30

export async function POST() {
  const items = await db.foodItem.findMany({
    where: { fiberG: null },
    orderBy: { name: "asc" },
  })

  if (items.length === 0) {
    return NextResponse.json({ updated: 0, message: "All food items already have fiber values." })
  }

  let updated = 0

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: FiberSchema,
      prompt: `Estimate the dietary fiber content (in grams) for each of these food items at the stated reference quantity. Return the same item IDs.

${batch.map((fi) => `- id: ${fi.id} | ${fi.quantity}${fi.unit} of "${fi.name}"${fi.brand ? ` (${fi.brand})` : ""} — ${Math.round(fi.calories)} kcal, ${Math.round(fi.carbG)}g carbs`).join("\n")}`,
    })

    for (const est of object.items) {
      const item = batch.find((fi) => fi.id === est.id)
      if (!item) continue
      await db.foodItem.update({
        where: { id: item.id },
        data: { fiberG: Math.round(est.fiberG * 10) / 10 },
      })
      updated++
    }
  }

  return NextResponse.json({ updated, total: items.length })
}
