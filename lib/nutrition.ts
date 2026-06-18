import type { NutritionInfo } from "@prisma/client"

// `nutrition` holds totals for the WHOLE recipe (all `recipeServings` servings).
// Each attendee eats one serving of it by default — not the whole batch —
// so personal totals are `total / recipeServings * personalServings`.
// `servingsOverride` lets a slot record a different personal serving count
// (e.g. "ate 1.5 portions"); `servingFraction` further scales an individual's share.
export function scaledNutrition(
  nutrition: Pick<NutritionInfo, "calories" | "proteinG" | "carbG" | "fatG"> & { sugarG?: number | null },
  recipeServings: number,
  servingsOverride: number | null,
  servingFraction: number = 1.0
) {
  const personalServings = servingsOverride ?? 1
  const scale = (personalServings / recipeServings) * servingFraction
  return {
    calories: nutrition.calories * scale,
    proteinG: nutrition.proteinG * scale,
    carbG: nutrition.carbG * scale,
    fatG: nutrition.fatG * scale,
    sugarG: nutrition.sugarG != null ? nutrition.sugarG * scale : null,
  }
}

export function formatCalories(kcal: number) {
  return Math.round(kcal) + " kcal"
}

export function formatMacro(grams: number) {
  return Math.round(grams) + "g"
}

// Harris-Benedict BMR → TDEE → target based on goal
export function calculateTargets(params: {
  weightKg: number
  heightCm: number
  age: number
  sex: "MALE" | "FEMALE"
  activityLevel: string
  goal: "RECOMPOSITION" | "WEIGHT_LOSS" | "MAINTENANCE"
}) {
  const { weightKg, heightCm, age, sex, activityLevel, goal } = params

  const bmr =
    sex === "MALE"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  const activityMultipliers: Record<string, number> = {
    SEDENTARY: 1.2,
    LIGHTLY_ACTIVE: 1.375,
    MODERATELY_ACTIVE: 1.55,
    VERY_ACTIVE: 1.725,
    EXTREMELY_ACTIVE: 1.9,
  }
  const tdee = bmr * (activityMultipliers[activityLevel] ?? 1.55)

  const calorieAdjustments = {
    WEIGHT_LOSS: -500,
    RECOMPOSITION: -200,
    MAINTENANCE: 0,
  }
  const calories = Math.round(tdee + calorieAdjustments[goal])

  // Macro splits vary by goal
  const proteinPerKg = goal === "RECOMPOSITION" ? 2.2 : 1.8
  const proteinG = Math.round(weightKg * proteinPerKg)
  const fatG = Math.round((calories * 0.25) / 9)
  const carbG = Math.round((calories - proteinG * 4 - fatG * 9) / 4)

  return { calories, proteinG, carbG, fatG }
}
