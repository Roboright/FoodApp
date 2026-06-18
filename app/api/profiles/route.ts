import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { calculateTargets } from "@/lib/nutrition"

export async function GET() {
  const profiles = await db.profile.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(profiles)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, goal, weightKg, heightCm, age, sex, activityLevel, notes, proteinCapG } = body

  let targets: { calorieTarget?: number; proteinTarget?: number; carbTarget?: number; fatTarget?: number } = {}
  if (weightKg && heightCm && age && sex && activityLevel && goal) {
    const t = calculateTargets({ weightKg, heightCm, age, sex, activityLevel, goal })
    targets = { calorieTarget: t.calories, proteinTarget: t.proteinG, carbTarget: t.carbG, fatTarget: t.fatG }
  }

  const profile = await db.profile.upsert({
    where: { name },
    create: { name, goal, weightKg, heightCm, age, sex, activityLevel, notes, proteinCapG, ...targets },
    update: { goal, weightKg, heightCm, age, sex, activityLevel, notes, proteinCapG, ...targets },
  })
  return NextResponse.json(profile, { status: 201 })
}
