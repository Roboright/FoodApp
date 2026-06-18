import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const items = await db.foodItem.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, brand, unit, quantity, calories, proteinG, carbG, fatG, sugarG, fiberG, notes } = body

  const item = await db.foodItem.create({
    data: {
      name: name.trim(),
      brand: brand?.trim() || null,
      unit,
      quantity: Number(quantity),
      calories: Number(calories),
      proteinG: Number(proteinG),
      carbG: Number(carbG),
      fatG: Number(fatG),
      sugarG: sugarG != null ? Number(sugarG) : null,
      fiberG: fiberG != null ? Number(fiberG) : null,
      notes: notes?.trim() || null,
      source: "MANUAL",
    },
  })
  return NextResponse.json(item, { status: 201 })
}
