import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { db } from "@/lib/db"
import { matchAndEstimate } from "@/lib/food-match"

const ImageAnalysisSchema = z.object({
  type: z.enum(["food", "label"]).describe(
    "food: image shows a meal or ingredients. label: image shows a nutritional information panel."
  ),
  // food
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string().describe("g, ml, or pcs"),
  })).optional(),
  // label — always per 100g or per 100ml
  productName: z.string().optional(),
  per100Unit: z.string().optional().describe("g or ml"),
  caloriesPer100: z.number().optional(),
  proteinPer100: z.number().optional(),
  carbPer100: z.number().optional(),
  fatPer100: z.number().optional(),
  sugarPer100: z.number().optional(),
  fiberPer100: z.number().optional(),
  servingSize: z.number().optional().describe("Serving size in per100Unit if stated on the label"),
})

function parseConsumedAmount(context: string, servingSize: number | null): number | null {
  const text = context.toLowerCase().trim()

  // "55g" / "55 grams" / "55gr"
  const gMatch = text.match(/(\d+\.?\d*)\s*(?:grams?|gr\b|g\b)/)
  if (gMatch) return parseFloat(gMatch[1])

  // "200ml" / "200 ml"
  const mlMatch = text.match(/(\d+\.?\d*)\s*ml\b/)
  if (mlMatch) return parseFloat(mlMatch[1])

  if (servingSize) {
    // "2 servings" / "1.5 portions"
    const sMatch = text.match(/(\d+\.?\d*)\s*(?:servings?|portions?|scoops?)/)
    if (sMatch) return parseFloat(sMatch[1]) * servingSize

    // "a serving" / "one serving" / "1 serving"
    if (/\b(?:a|one|1)\s+(?:serving|portion|scoop)\b/.test(text)) return servingSize

    // "half a serving"
    if (/\bhalf\s+(?:a\s+)?(?:serving|portion)\b/.test(text)) return servingSize * 0.5
  }

  return null
}

export async function POST(req: Request) {
  const { imageBase64, mimeType, context } = await req.json()

  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 })
  }

  const contextLine = context?.trim() ? `\nUser note: "${context.trim()}"` : ""

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: ImageAnalysisSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imageBase64, mediaType: mimeType as `image/${string}` },
          {
            type: "text",
            text: `Analyse this image.${contextLine}
- If it shows a nutritional information panel or product label: set type="label", read the per-100g (or per-100ml) column values, and note the serving size if present.
- If it shows food, a meal, or ingredients: set type="food" and identify each item with a realistic portion estimate, using the user note to refine quantities.`,
          },
        ],
      },
    ],
  })

  // ── Label ─────────────────────────────────────────────────────────────────
  if (object.type === "label") {
    const per100Unit = object.per100Unit ?? "g"
    const servingSize = object.servingSize ?? null
    const consumed = context?.trim() ? parseConsumedAmount(context, servingSize) : null

    if (consumed && consumed > 0) {
      const scale = consumed / 100
      const r = (v: number) => Math.round(v * 10) / 10
      const item = {
        name: object.productName ?? "Product",
        quantity: consumed,
        unit: per100Unit,
        matchedFoodItemId: null,
        matchedFoodItemName: null,
        matchedFoodItemBrand: null,
        matched: false,
        calories: r((object.caloriesPer100 ?? 0) * scale),
        proteinG: r((object.proteinPer100 ?? 0) * scale),
        carbG: r((object.carbPer100 ?? 0) * scale),
        fatG: r((object.fatPer100 ?? 0) * scale),
        sugarG: r((object.sugarPer100 ?? 0) * scale),
      }
      return NextResponse.json({
        type: "food",
        items: [item],
        totals: {
          calories: Math.round(item.calories),
          proteinG: Math.round(item.proteinG),
          carbG: Math.round(item.carbG),
          fatG: Math.round(item.fatG),
          sugarG: Math.round(item.sugarG),
        },
      })
    }

    // No quantity found — return label for manual entry
    return NextResponse.json({
      type: "label",
      productName: object.productName ?? null,
      per100Unit,
      calories: object.caloriesPer100 ?? 0,
      proteinG: object.proteinPer100 ?? 0,
      carbG: object.carbPer100 ?? 0,
      fatG: object.fatPer100 ?? 0,
      sugarG: object.sugarPer100 ?? null,
      fiberG: object.fiberPer100 ?? null,
      servingSize,
    })
  }

  // ── Food photo ────────────────────────────────────────────────────────────
  const rawItems = object.items ?? []
  if (rawItems.length === 0) {
    return NextResponse.json({
      type: "food",
      items: [],
      totals: { calories: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0 },
    })
  }

  const foodItems = await db.foodItem.findMany()
  const result = await matchAndEstimate(rawItems, foodItems)
  return NextResponse.json({ type: "food", ...result })
}
