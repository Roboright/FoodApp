import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { description, caloriesOverride, proteinOverride, carbOverride, fatOverride, sugarOverride, fiberOverride } = await req.json()
  const log = await db.mealLog.update({
    where: { id },
    data: { description, caloriesOverride, proteinOverride, carbOverride, fatOverride, sugarOverride, fiberOverride },
  })
  return NextResponse.json(log)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.mealLog.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
