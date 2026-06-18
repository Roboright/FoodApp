import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = await db.recipe.findUnique({
    where: { id },
    include: {
      nutrition: true,
      recipeIngredients: { include: { ingredient: true }, orderBy: { order: "asc" } },
    },
  })
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(recipe)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { nutrition, ...rest } = body

  const recipe = await db.recipe.update({
    where: { id },
    data: {
      ...rest,
      ...(nutrition
        ? {
            nutrition: {
              upsert: {
                create: { ...nutrition, source: "MANUAL" },
                update: { ...nutrition, source: "MANUAL" },
              },
            },
          }
        : {}),
    },
    include: { nutrition: true },
  })
  return NextResponse.json(recipe)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.recipe.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
