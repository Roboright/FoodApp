import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const tag = searchParams.get("tag")
  const mealType = searchParams.get("mealType")

  const recipes = await db.recipe.findMany({
    where: {
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(mealType ? { mealTypes: { has: mealType } } : {}),
    },
    include: { nutrition: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(recipes)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { title, description, servings, prepMinutes, cookMinutes, instructions, tags, nutrition, ingredients } = body

  const recipe = await db.recipe.create({
    data: {
      title,
      description,
      servings: servings ?? 2,
      prepMinutes,
      cookMinutes,
      instructions,
      tags: tags ?? [],
      sourceType: "MANUAL",
      ...(nutrition
        ? {
            nutrition: {
              create: {
                calories: nutrition.calories,
                proteinG: nutrition.proteinG,
                carbG: nutrition.carbG,
                fatG: nutrition.fatG,
                fiberG: nutrition.fiberG,
                source: "MANUAL",
              },
            },
          }
        : {}),
      ...(ingredients?.length
        ? {
            recipeIngredients: {
              create: await Promise.all(
                ingredients.map(
                  async (ing: { name: string; quantity: number; unit: string; notes?: string }, i: number) => {
                    const ingredient = await db.ingredient.upsert({
                      where: { name: ing.name.toLowerCase().trim() },
                      update: {},
                      create: { name: ing.name.toLowerCase().trim() },
                    })
                    return {
                      ingredientId: ingredient.id,
                      quantity: ing.quantity,
                      unit: ing.unit,
                      notes: ing.notes,
                      order: i,
                    }
                  }
                )
              ),
            },
          }
        : {}),
    },
    include: { nutrition: true, recipeIngredients: { include: { ingredient: true } } },
  })
  return NextResponse.json(recipe, { status: 201 })
}
