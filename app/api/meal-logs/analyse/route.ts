import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { db } from "@/lib/db"
import { matchAndEstimate } from "@/lib/food-match"

const ParseSchema = z.object({
  items: z.array(z.object({
    name: z.string().describe("Food item name, generic and clean (e.g. 'Greek yogurt', 'oats', 'banana')"),
    quantity: z.number().describe("Amount consumed"),
    unit: z.string().describe("Unit matching the food database where possible: 'g', 'ml', or 'pcs'"),
  })),
})

export async function POST(req: Request) {
  const { description, profileName } = await req.json()

  const foodItems = await db.foodItem.findMany()

  const { object: parsed } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: ParseSchema,
    prompt: `${profileName ? `This food log is for ${profileName}. ` : ""}Parse this food log description into individual food items with quantities. Be precise about quantities — infer typical serving sizes when not specified.\nDescription: "${description}"`,
  })

  const result = await matchAndEstimate(parsed.items, foodItems)
  return NextResponse.json(result)
}
