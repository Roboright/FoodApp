import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getMondayOfWeek, toDateString } from "@/lib/week"

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const thisMonday = getMondayOfWeek(today)
  const nextMonday = new Date(thisMonday)
  nextMonday.setDate(nextMonday.getDate() + 7)
  const todayStr = toDateString(today)

  const [profiles, weightEntries, mealPlan, adHocLogs, eatenLogs] = await Promise.all([
    db.profile.findMany({
      select: {
        id: true, name: true,
        calorieTarget: true, proteinTarget: true, carbTarget: true, fatTarget: true, sugarTarget: true, fiberTarget: true,
      },
    }),
    db.weightEntry.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
    db.mealPlan.findFirst({
      where: { weekStartDate: { gte: thisMonday, lt: nextMonday } },
      include: {
        mealSlots: {
          where: { date: { gte: today, lt: tomorrow } },
          include: {
            recipe: { select: { servings: true, nutrition: true } },
            profiles: true,
          },
        },
      },
    }),
    db.mealLog.findMany({
      where: { logType: "AD_HOC", loggedAt: { gte: today, lt: tomorrow } },
      select: {
        profileId: true,
        caloriesOverride: true, proteinOverride: true, carbOverride: true, fatOverride: true, sugarOverride: true, fiberOverride: true,
      },
    }),
    db.mealLog.findMany({
      where: {
        logType: { in: ["AS_PLANNED", "MODIFIED"] },
        mealSlotId: { not: null },
        loggedAt: { gte: today, lt: tomorrow },
      },
      select: { mealSlotId: true, profileId: true },
    }),
  ])

  const eatenSet = new Set(eatenLogs.map((l) => `${l.mealSlotId}:${l.profileId}`))

  const profileStats = profiles.map((profile) => {
    const weightEntry = weightEntries.find((e) => e.profileId === profile.id)

    const slots = mealPlan?.mealSlots ?? []
    let totalCals = 0, totalProt = 0, totalCarb = 0, totalFat = 0, totalSugar = 0, totalFiber = 0
    let hasNutrition = false

    for (const slot of slots) {
      const sp = slot.profiles.find((p) => p.profileId === profile.id)
      if (!sp) continue
      if (!eatenSet.has(`${slot.id}:${profile.id}`)) continue

      const nut = slot.recipe?.nutrition
      const servings = slot.recipe?.servings ?? 1

      const cals = sp.calories ?? (nut ? nut.calories / servings * sp.servingFraction : null)
      const prot = sp.proteinG ?? (nut ? nut.proteinG / servings * sp.servingFraction : null)
      const carb = sp.carbG ?? (nut ? nut.carbG / servings * sp.servingFraction : null)
      const fat = sp.fatG ?? (nut ? nut.fatG / servings * sp.servingFraction : null)
      const sugar = nut?.sugarG != null ? nut.sugarG / servings * sp.servingFraction : null
      const fiber = nut?.fiberG != null ? nut.fiberG / servings * sp.servingFraction : null

      if (cals !== null) { totalCals += cals; hasNutrition = true }
      if (prot !== null) totalProt += prot
      if (carb !== null) totalCarb += carb
      if (fat !== null) totalFat += fat
      if (sugar !== null) totalSugar += sugar
      if (fiber !== null) totalFiber += fiber
    }

    for (const e of adHocLogs.filter((l) => l.profileId === profile.id)) {
      totalCals += e.caloriesOverride ?? 0
      totalProt += e.proteinOverride ?? 0
      totalCarb += e.carbOverride ?? 0
      totalFat += e.fatOverride ?? 0
      totalSugar += e.sugarOverride ?? 0
      totalFiber += e.fiberOverride ?? 0
      if (e.caloriesOverride) hasNutrition = true
    }

    return {
      profileId: profile.id,
      profileName: profile.name,
      date: todayStr,
      weightKg: weightEntry ? Math.round(weightEntry.weightKg * 10) / 10 : null,
      calories: hasNutrition ? Math.round(totalCals) : null,
      proteinG: hasNutrition ? Math.round(totalProt) : null,
      carbG: hasNutrition ? Math.round(totalCarb) : null,
      fatG: hasNutrition ? Math.round(totalFat) : null,
      sugarG: totalSugar > 0 ? Math.round(totalSugar) : null,
      fiberG: totalFiber > 0 ? Math.round(totalFiber) : null,
      calorieTarget: profile.calorieTarget,
      proteinTarget: profile.proteinTarget,
      carbTarget: profile.carbTarget,
      fatTarget: profile.fatTarget,
      sugarTarget: profile.sugarTarget,
      fiberTarget: profile.fiberTarget,
    }
  })

  return NextResponse.json(profileStats)
}
