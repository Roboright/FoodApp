import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, brand, unit, quantity, calories, proteinG, carbG, fatG, sugarG, fiberG, notes } = body

  const item = await db.foodItem.update({
    where: { id },
    data: {
      name: name?.trim(),
      brand: brand?.trim() || null,
      unit,
      quantity: quantity != null ? Number(quantity) : undefined,
      calories: calories != null ? Number(calories) : undefined,
      proteinG: proteinG != null ? Number(proteinG) : undefined,
      carbG: carbG != null ? Number(carbG) : undefined,
      fatG: fatG != null ? Number(fatG) : undefined,
      sugarG: sugarG != null ? Number(sugarG) : null,
      fiberG: fiberG != null ? Number(fiberG) : null,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.foodItem.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
