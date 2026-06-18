import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plan = await db.mealPlan.findUnique({
    where: { id },
    include: {
      mealSlots: {
        include: {
          recipe: { include: { nutrition: true } },
          profiles: { include: { profile: true } },
          logs: true,
        },
        orderBy: [{ date: "asc" }, { mealType: "asc" }],
      },
    },
  })
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(plan)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const plan = await db.mealPlan.update({ where: { id }, data: body })
  return NextResponse.json(plan)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.mealPlan.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
