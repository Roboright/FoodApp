import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { db } from "@/lib/db"

const VALID_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const

const BatchSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    mealTypes: z.array(z.enum(VALID_TYPES)).min(1),
  })),
})

export async function POST() {
  const uncategorized = await db.recipe.findMany({
    where: { mealTypes: { isEmpty: true } },
    select: { id: true, title: true, description: true, tags: true },
  })

  if (uncategorized.length === 0) {
    return NextResponse.json({ categorized: 0 })
  }

  // Batch in groups of 30 to stay within prompt limits
  const BATCH = 30
  let total = 0

  for (let i = 0; i < uncategorized.length; i += BATCH) {
    const batch = uncategorized.slice(i, i + BATCH)
    const list = batch.map((r) =>
      `id: ${r.id} | title: "${r.title}"${r.description ? ` | desc: "${r.description}"` : ""}${r.tags.length ? ` | tags: ${r.tags.join(", ")}` : ""}`
    ).join("\n")

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: BatchSchema,
      prompt: `Classify each recipe into one or more meal types: BREAKFAST, LUNCH, DINNER, SNACK.
Rules:
- A recipe can belong to multiple types if genuinely versatile (e.g. scrambled eggs → BREAKFAST, LUNCH)
- Snacks are small, simple items typically eaten between meals
- Return exactly one result per recipe using the exact id provided

${list}`,
    })

    for (const { id, mealTypes } of object.results) {
      await db.recipe.update({ where: { id }, data: { mealTypes } })
    }
    total += object.results.length
  }

  return NextResponse.json({ categorized: total })
}
