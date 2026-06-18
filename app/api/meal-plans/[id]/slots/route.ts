import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { MealType } from "@prisma/client"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: mealPlanId } = await params
  const body = await req.json()
  const { date, mealType, recipeId, servingsOverride, notes, profileIds } = body

  const slot = await db.mealSlot.upsert({
    where: {
      mealPlanId_date_mealType: {
        mealPlanId,
        date: new Date(date),
        mealType: mealType as MealType,
      },
    },
    create: {
      mealPlanId,
      date: new Date(date),
      mealType: mealType as MealType,
      recipeId: recipeId ?? null,
      servingsOverride: servingsOverride ?? null,
      notes: notes ?? null,
    },
    update: {
      recipeId: recipeId ?? null,
      servingsOverride: servingsOverride ?? null,
      notes: notes ?? null,
    },
    include: { recipe: { include: { nutrition: true } }, profiles: { include: { profile: true } } },
  })

  // Sync attendees if profileIds provided
  if (profileIds !== undefined) {
    await db.mealSlotProfile.deleteMany({ where: { mealSlotId: slot.id } })
    if (profileIds.length > 0) {
      await db.mealSlotProfile.createMany({
        data: profileIds.map((profileId: string) => ({
          mealSlotId: slot.id,
          profileId,
          servingFraction: 1.0,
        })),
      })
    }
  }

  const updated = await db.mealSlot.findUnique({
    where: { id: slot.id },
    include: { recipe: { include: { nutrition: true } }, profiles: { include: { profile: true } } },
  })
  return NextResponse.json(updated, { status: 201 })
}
