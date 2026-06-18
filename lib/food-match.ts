import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"

export type FoodItem = {
  id: string
  name: string
  brand: string | null
  unit: string
  quantity: number
  calories: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number | null
}

export type MatchedItem = {
  name: string
  quantity: number
  unit: string
  matchedFoodItemId: string | null
  matchedFoodItemName: string | null
  matchedFoodItemBrand: string | null
  matched: boolean
  calories: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number
}

export function fuzzyMatch(query: string, items: FoodItem[]): FoodItem | null {
  const q = query.toLowerCase().trim()

  const exact = items.find((i) => i.name.toLowerCase() === q)
  if (exact) return exact

  const contains = items.find(
    (i) => q.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(q)
  )
  if (contains) return contains

  const qWords = q.split(/\s+/)
  let best: FoodItem | null = null
  let bestScore = 0
  for (const item of items) {
    const iWords = item.name.toLowerCase().split(/\s+/)
    const overlap = qWords.filter((w) => iWords.some((iw) => iw.includes(w) || w.includes(iw))).length
    const score = overlap / Math.max(qWords.length, iWords.length)
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      best = item
    }
  }
  return best
}

const EstimateSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    calories: z.number(),
    proteinG: z.number(),
    carbG: z.number(),
    fatG: z.number(),
    sugarG: z.number(),
  })),
})

type ParsedItem = { name: string; quantity: number; unit: string }

export type NutritionTotals = {
  calories: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number
}

export async function matchAndEstimate(
  parsedItems: ParsedItem[],
  foodItems: FoodItem[]
): Promise<{ items: MatchedItem[]; totals: NutritionTotals }> {
  const matchedItems: MatchedItem[] = []
  const unmatched: ParsedItem[] = []

  for (const item of parsedItems) {
    const match = fuzzyMatch(item.name, foodItems)
    if (match) {
      const scale = item.quantity / match.quantity
      matchedItems.push({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        matchedFoodItemId: match.id,
        matchedFoodItemName: match.name,
        matchedFoodItemBrand: match.brand,
        matched: true,
        calories: Math.round(match.calories * scale * 10) / 10,
        proteinG: Math.round(match.proteinG * scale * 10) / 10,
        carbG: Math.round(match.carbG * scale * 10) / 10,
        fatG: Math.round(match.fatG * scale * 10) / 10,
        sugarG: Math.round((match.sugarG ?? 0) * scale * 10) / 10,
      })
    } else {
      unmatched.push(item)
    }
  }

  if (unmatched.length > 0) {
    const { object: estimated } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: EstimateSchema,
      prompt: `Estimate nutritional values for the following food items and quantities. Be precise.\n${unmatched.map((i) => `- ${i.quantity}${i.unit} of ${i.name}`).join("\n")}`,
    })

    for (let i = 0; i < unmatched.length; i++) {
      const item = unmatched[i]
      const est = estimated.items[i] ?? { calories: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0 }
      matchedItems.push({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        matchedFoodItemId: null,
        matchedFoodItemName: null,
        matchedFoodItemBrand: null,
        matched: false,
        calories: est.calories,
        proteinG: est.proteinG,
        carbG: est.carbG,
        fatG: est.fatG,
        sugarG: est.sugarG,
      })
    }
  }

  const totals = matchedItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      proteinG: acc.proteinG + item.proteinG,
      carbG: acc.carbG + item.carbG,
      fatG: acc.fatG + item.fatG,
      sugarG: acc.sugarG + item.sugarG,
    }),
    { calories: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0 }
  )

  return {
    items: matchedItems,
    totals: {
      calories: Math.round(totals.calories),
      proteinG: Math.round(totals.proteinG),
      carbG: Math.round(totals.carbG),
      fatG: Math.round(totals.fatG),
      sugarG: Math.round(totals.sugarG),
    },
  }
}
