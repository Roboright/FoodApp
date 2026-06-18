import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { calculateTargets } from "@/lib/nutrition"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Recalculate targets if body stats change
  const profile = await db.profile.findUnique({ where: { id } })
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const merged = { ...profile, ...body }
  let targets: { calorieTarget?: number; proteinTarget?: number; carbTarget?: number; fatTarget?: number } = {}

  const hasManualTargets = "proteinTarget" in body || "carbTarget" in body || "fatTarget" in body

  if (hasManualTargets) {
    // Derive calories from macros to guarantee internal consistency
    const p = body.proteinTarget ?? profile.proteinTarget ?? 0
    const c = body.carbTarget ?? profile.carbTarget ?? 0
    const f = body.fatTarget ?? profile.fatTarget ?? 0
    targets = {
      proteinTarget: p,
      carbTarget: c,
      fatTarget: f,
      calorieTarget: Math.round(p * 4 + c * 4 + f * 9),
    }
  } else if (merged.weightKg && merged.heightCm && merged.age && merged.sex && merged.activityLevel) {
    // Auto-calculate from biometrics when no manual targets provided
    const t = calculateTargets({
      weightKg: merged.weightKg,
      heightCm: merged.heightCm,
      age: merged.age,
      sex: merged.sex,
      activityLevel: merged.activityLevel,
      goal: merged.goal,
    })
    targets = { calorieTarget: t.calories, proteinTarget: t.proteinG, carbTarget: t.carbG, fatTarget: t.fatG }
  }

  const updated = await db.profile.update({
    where: { id },
    data: { ...body, ...targets },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.profile.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
