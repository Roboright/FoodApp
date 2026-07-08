import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const body = await req.json()
  const {
    mealSlotId,
    profileId,
    logType,
    recipeId,
    servingsConsumed,
    description,
    caloriesOverride,
    proteinOverride,
    carbOverride,
    fatOverride,
    sugarOverride,
    fiberOverride,
    notes,
  } = body

  const { loggedAt } = body

  const log = await db.mealLog.create({
    data: {
      mealSlotId: mealSlotId ?? null,
      profileId,
      logType,
      loggedAt: loggedAt ? new Date(loggedAt) : undefined,
      recipeId: recipeId ?? null,
      servingsConsumed: servingsConsumed ?? null,
      description: description ?? null,
      caloriesOverride: caloriesOverride ?? null,
      proteinOverride: proteinOverride ?? null,
      carbOverride: carbOverride ?? null,
      fatOverride: fatOverride ?? null,
      sugarOverride: sugarOverride ?? null,
      fiberOverride: fiberOverride ?? null,
      notes: notes ?? null,
    },
  })
  return NextResponse.json(log, { status: 201 })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get("profileId")
  const date = searchParams.get("date")
  const weekStart = searchParams.get("weekStart")
  const logType = searchParams.get("logType")

  const logs = await db.mealLog.findMany({
    where: {
      ...(profileId ? { profileId } : {}),
      ...(logType ? { logType: logType as never } : {}),
      ...(weekStart
        ? {
            loggedAt: {
              gte: new Date(weekStart),
              lt: new Date(new Date(weekStart).getTime() + 7 * 86400000),
            },
          }
        : date
        ? {
            loggedAt: {
              gte: new Date(date),
              lt: new Date(new Date(date).getTime() + 86400000),
            },
          }
        : {}),
    },
    include: { recipe: { include: { nutrition: true } } },
    orderBy: { loggedAt: "desc" },
  })
  return NextResponse.json(logs)
}
