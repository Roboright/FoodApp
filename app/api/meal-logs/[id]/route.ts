import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.mealLog.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
