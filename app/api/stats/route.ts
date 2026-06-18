import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getMondayOfWeek, toDateString } from "@/lib/week"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const weekCount = Math.min(parseInt(searchParams.get("weeks") ?? "6"), 12)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisMonday = getMondayOfWeek(today)

  const rangeStart = new Date(thisMonday)
  rangeStart.setDate(rangeStart.getDate() - weekCount * 7)
  const rangeEnd = new Date(thisMonday)
  rangeEnd.setDate(rangeEnd.getDate() + 14) // include next week

  const [profiles, weightEntries, mealPlans, adHocLogs, eatenLogs] = await Promise.all([
    db.profile.findMany({
      select: {
        id: true, name: true,
        calorieTarget: true, proteinTarget: true, carbTarget: true, fatTarget: true, sugarTarget: true,
      },
    }),
    db.weightEntry.findMany({ where: { date: { gte: rangeStart, lt: rangeEnd } } }),
    db.mealPlan.findMany({
      where: { weekStartDate: { gte: rangeStart, lt: rangeEnd } },
      include: {
        mealSlots: {
          include: {
            recipe: { select: { servings: true, nutrition: true } },
            profiles: true,
          },
        },
      },
    }),
    db.mealLog.findMany({
      where: { logType: "AD_HOC", loggedAt: { gte: rangeStart, lt: rangeEnd } },
      select: {
        profileId: true, loggedAt: true,
        caloriesOverride: true, proteinOverride: true, carbOverride: true, fatOverride: true, sugarOverride: true,
      },
    }),
    // Logs for planned meals that were actually eaten (AS_PLANNED or MODIFIED)
    db.mealLog.findMany({
      where: {
        logType: { in: ["AS_PLANNED", "MODIFIED"] },
        mealSlotId: { not: null },
        loggedAt: { gte: rangeStart, lt: rangeEnd },
      },
      select: { mealSlotId: true, profileId: true },
    }),
  ])

  // Build a Set of "slotId:profileId" pairs that were actually eaten
  const eatenSet = new Set(eatenLogs.map((l) => `${l.mealSlotId}:${l.profileId}`))

  const weeks = []

  // i = -1 → next week, i = 0 → this week, i = 1..weekCount → past weeks
  for (let i = -1; i < weekCount; i++) {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(weekStart.getDate() - (weekCount - 1 - i) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)

    const isFutureWeek = weekStart > today

    // Past weeks: 7. Current week: days elapsed so far. Future week: 7 (show full plan avg).
    const daysElapsed = weekEnd <= today
      ? 7
      : isFutureWeek
        ? 7
        : Math.min(7, Math.max(1, Math.round((today.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1))

    const plan = mealPlans.find((p) => {
      const ps = new Date(p.weekStartDate)
      ps.setHours(0, 0, 0, 0)
      return ps.getTime() === weekStart.getTime()
    })

    const profileStats = profiles.map((profile) => {
      // ── Weight ──────────────────────────────────────────────────────────────
      const thisWeekWeights = weightEntries.filter((e) => {
        const d = new Date(e.date); d.setHours(0, 0, 0, 0)
        return e.profileId === profile.id && d >= weekStart && d < weekEnd
      })
      const prevWeekWeights = weightEntries.filter((e) => {
        const d = new Date(e.date); d.setHours(0, 0, 0, 0)
        return e.profileId === profile.id && d >= prevWeekStart && d < weekStart
      })
      const avgWeightKg = thisWeekWeights.length > 0
        ? thisWeekWeights.reduce((s, e) => s + e.weightKg, 0) / thisWeekWeights.length
        : null
      const prevAvgWeightKg = prevWeekWeights.length > 0
        ? prevWeekWeights.reduce((s, e) => s + e.weightKg, 0) / prevWeekWeights.length
        : null

      // ── Nutrition from meal plan ─────────────────────────────────────────────
      const slots = plan?.mealSlots ?? []
      let totalCals = 0, totalProt = 0, totalCarb = 0, totalFat = 0, totalSugar = 0
      let hasNutrition = false

      for (const slot of slots) {
        const sp = slot.profiles.find((p) => p.profileId === profile.id)
        if (!sp) continue

        // For past/current weeks, only count slots the person actually logged as eaten.
        // For future weeks, use the full plan as a projection.
        if (!isFutureWeek && !eatenSet.has(`${slot.id}:${profile.id}`)) continue

        const nut = slot.recipe?.nutrition
        const servings = slot.recipe?.servings ?? 1

        const cals = sp.calories ?? (nut ? nut.calories / servings * sp.servingFraction : null)
        const prot = sp.proteinG ?? (nut ? nut.proteinG / servings * sp.servingFraction : null)
        const carb = sp.carbG ?? (nut ? nut.carbG / servings * sp.servingFraction : null)
        const fat = sp.fatG ?? (nut ? nut.fatG / servings * sp.servingFraction : null)
        const sugar = nut?.sugarG != null ? nut.sugarG / servings * sp.servingFraction : null

        if (cals !== null) { totalCals += cals; hasNutrition = true }
        if (prot !== null) totalProt += prot
        if (carb !== null) totalCarb += carb
        if (fat !== null) totalFat += fat
        if (sugar !== null) totalSugar += sugar
      }

      // ── Nutrition from extras ────────────────────────────────────────────────
      const weekExtras = adHocLogs.filter((l) => {
        const d = new Date(l.loggedAt); d.setHours(0, 0, 0, 0)
        return l.profileId === profile.id && d >= weekStart && d < weekEnd
      })
      for (const e of weekExtras) {
        totalCals += e.caloriesOverride ?? 0
        totalProt += e.proteinOverride ?? 0
        totalCarb += e.carbOverride ?? 0
        totalFat += e.fatOverride ?? 0
        totalSugar += e.sugarOverride ?? 0
        if (e.caloriesOverride) hasNutrition = true
      }

      return {
        profileId: profile.id,
        profileName: profile.name,
        weightDays: thisWeekWeights.length,
        avgWeightKg: avgWeightKg !== null ? Math.round(avgWeightKg * 10) / 10 : null,
        weightDeltaKg: avgWeightKg !== null && prevAvgWeightKg !== null
          ? Math.round((avgWeightKg - prevAvgWeightKg) * 10) / 10
          : null,
        avgCalories: hasNutrition ? Math.round(totalCals / daysElapsed) : null,
        avgProteinG: hasNutrition ? Math.round(totalProt / daysElapsed) : null,
        avgCarbG: hasNutrition ? Math.round(totalCarb / daysElapsed) : null,
        avgFatG: hasNutrition ? Math.round(totalFat / daysElapsed) : null,
        avgSugarG: totalSugar > 0 ? Math.round(totalSugar / daysElapsed) : null,
        calorieTarget: profile.calorieTarget,
        proteinTarget: profile.proteinTarget,
        carbTarget: profile.carbTarget,
        fatTarget: profile.fatTarget,
        sugarTarget: profile.sugarTarget,
      }
    })

    weeks.push({ weekStart: toDateString(weekStart), profileStats })
  }

  return NextResponse.json(weeks.reverse())
}
