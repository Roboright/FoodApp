import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getMondayOfWeek } from "@/lib/week"
import type { MealType } from "@prisma/client"

const WEEKDAY_MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK_1", "SNACK_2"]

export async function GET() {
  const plans = await db.mealPlan.findMany({
    orderBy: { weekStartDate: "desc" },
    include: { _count: { select: { mealSlots: true } } },
  })
  return NextResponse.json(plans)
}

export async function POST(req: Request) {
  const body = await req.json()
  const rawDate = body.weekStartDate ? new Date(body.weekStartDate) : new Date()
  const monday = getMondayOfWeek(rawDate)

  // Idempotent: return existing plan without re-populating
  const existing = await db.mealPlan.findUnique({ where: { weekStartDate: monday } })
  if (existing) {
    return NextResponse.json(existing, { status: 201 })
  }

  const plan = await db.mealPlan.create({
    data: { weekStartDate: monday, status: "DRAFT" },
  })

  // Auto-populate Mon–Fri slots (all 5 meal types) for all profiles
  const profiles = await db.profile.findMany({ select: { id: true } })
  if (profiles.length > 0) {
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const date = new Date(monday)
      date.setDate(date.getDate() + dayOffset)
      for (const mealType of WEEKDAY_MEAL_TYPES) {
        const slot = await db.mealSlot.create({
          data: { mealPlanId: plan.id, date, mealType },
        })
        await db.mealSlotProfile.createMany({
          data: profiles.map((p) => ({
            mealSlotId: slot.id,
            profileId: p.id,
            servingFraction: 1.0,
          })),
        })
      }
    }
  }

  return NextResponse.json(plan, { status: 201 })
}
