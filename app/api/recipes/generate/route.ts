import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import type { MealType } from "@prisma/client"

const RecipeSchema = z.object({
  title: z.string().describe("Recipe name"),
  description: z.string().describe("One-sentence description"),
  servings: z.number().int().describe("Number of servings this recipe makes"),
  prepMinutes: z.number().int().describe("Prep time in minutes"),
  cookMinutes: z.number().int().describe("Cook time in minutes"),
  instructions: z.string().describe("Step-by-step cooking instructions, each step on a new line"),
  tags: z.array(z.string()).describe("Tags like 'high-protein', 'quick', 'vegetarian'"),
  ingredients: z.array(
    z.object({
      name: z.string().describe("Ingredient name, singular and generic (e.g. 'chicken breast', not 'Rob's chicken breast')"),
      quantity: z.number().describe("Quantity for the WHOLE recipe (all servings combined)"),
      unit: z.string().describe("Unit of measure, e.g. 'g', 'ml', 'tbsp', 'piece'"),
      notes: z.string().optional().describe("Optional prep note, e.g. 'diced' or 'only for Rob's portion'"),
    })
  ).describe("Full ingredient list needed to cook the WHOLE recipe"),
  nutrition: z.object({
    caloriesTotal: z.number().describe("Total calories for entire recipe (all servings combined)"),
    proteinGTotal: z.number().describe("Total protein grams for entire recipe"),
    carbGTotal: z.number().describe("Total carbs grams for entire recipe"),
    fatGTotal: z.number().describe("Total fat grams for entire recipe"),
    fiberGTotal: z.number().optional().describe("Total fiber grams for entire recipe"),
    sugarGTotal: z.number().optional().describe("Total sugar grams for entire recipe"),
  }),
  portions: z.array(
    z.object({
      profileName: z.string().describe("Exact name of the person this portion guidance is for"),
      description: z
        .string()
        .describe(
          "What THIS person should plate up, phrased as direct guidance, e.g. 'Full portion with the rice' or 'Skip the rice, add an extra handful of greens instead'. Call out any compositional differences explicitly."
        ),
      calories: z.number().describe("Estimated calories in THIS person's actual plate as described"),
      proteinG: z.number().describe("Estimated protein grams in THIS person's actual plate"),
      carbG: z.number().describe("Estimated carb grams in THIS person's actual plate"),
      fatG: z.number().describe("Estimated fat grams in THIS person's actual plate"),
    })
  ).describe("Personalized plate guidance and nutrition for EACH person eating this meal"),
})

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
  SNACK_1: "snack",
  SNACK_2: "snack",
}

const MEAL_CONSTRAINTS: Record<string, string> = {
  BREAKFAST: "Breakfast must be NON-SAVOURY — think yoghurt bowls, granola, overnight oats, smoothies, fruit with nut butter, or similar sweet/neutral options. No eggs, no toast with savoury toppings, no cheese, no meat.",
  LUNCH: "Lunch must be quick: total prep + cook time must be ≤10 minutes. Think salads, wraps, pre-cooked grain bowls, no-cook assemblies.",
  DINNER: "",
  SNACK_1: "Snacks must be dead simple: total prep time ≤5 minutes, ideally no cooking. Think fruit, nuts, yoghurt, protein bars, rice cakes with toppings.",
  SNACK_2: "Snacks must be dead simple: total prep time ≤5 minutes, ideally no cooking. Think fruit, nuts, yoghurt, protein bars, rice cakes with toppings.",
}

// Fixed share of the daily budget each meal type represents. These are
// intentionally fixed (not redistributed when other meals are skipped in the
// app) — a skipped meal is usually eaten elsewhere, so its share shouldn't be
// piled onto the meals that *are* planned here.
const MEAL_SHARE: Record<string, number> = {
  BREAKFAST: 0.25,
  LUNCH: 0.3,
  DINNER: 0.35,
  SNACK_1: 0.05,
  SNACK_2: 0.05,
}

export async function POST(req: Request) {
  const body = await req.json()
  const { mealPlanId, slotId, date, mealType, profileIds, userPrompt } = body

  if (!profileIds?.length || !date || !mealType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const profiles = await db.profile.findMany({ where: { id: { in: profileIds } } })
  const audienceKey = [...profileIds].sort().join(":")
  const dateObj = new Date(date)

  // Reuse from the recipe cache when possible: the same dish shouldn't repeat within
  // REUSE_COOLDOWN_DAYS (in either direction from the target date), but beyond that a
  // previously-cooked, previously-suitable recipe is perfectly fine to serve again —
  // it saves an AI call and builds a familiar household rotation. Skip reuse when the
  // user typed a specific request; that signals they want something tailored/new.
  const REUSE_COOLDOWN_DAYS = 14
  if (!userPrompt) {
    const cooldownStart = new Date(dateObj)
    cooldownStart.setDate(cooldownStart.getDate() - REUSE_COOLDOWN_DAYS)
    const cooldownEnd = new Date(dateObj)
    cooldownEnd.setDate(cooldownEnd.getDate() + REUSE_COOLDOWN_DAYS)

    const recentlyServed = await db.mealSlot.findMany({
      where: { recipeId: { not: null }, date: { gte: cooldownStart, lte: cooldownEnd } },
      select: { recipeId: true },
    })
    const recentlyServedIds = [...new Set(recentlyServed.map((s) => s.recipeId!))]

    // Any recipe tagged for this meal type that hasn't appeared in the plan within
    // the cooldown window. No audience restriction — a 2-person recipe can be reused
    // for 1 person by eating 1 of its 2 servings; quantities scale via servings.
    const recipeType = mealType === "SNACK_1" || mealType === "SNACK_2" ? "SNACK" : mealType as string
    const reusable = await db.recipe.findMany({
      where: {
        id: { notIn: recentlyServedIds },
        nutrition: { isNot: null },
        mealTypes: { has: recipeType },
      },
      include: { nutrition: true },
    })

    if (reusable.length > 0) {
      // Prefer starred recipes — they should rotate back at least once per two weeks.
      const starred = reusable.filter((r) => r.starred)
      const pool = starred.length > 0 ? starred : reusable
      const recipe = pool[Math.floor(Math.random() * pool.length)]

      let targetSlotId: string | null = slotId ?? null
      if (slotId) {
        await db.mealSlot.update({ where: { id: slotId }, data: { recipeId: recipe.id } })
        targetSlotId = slotId
      } else if (mealPlanId) {
        const slot = await db.mealSlot.upsert({
          where: { mealPlanId_date_mealType: { mealPlanId, date: dateObj, mealType: mealType as MealType } },
          create: { mealPlanId, date: dateObj, mealType: mealType as MealType, recipeId: recipe.id },
          update: { recipeId: recipe.id },
        })
        targetSlotId = slot.id
      }

      // Clear stale per-person nutrition so the UI falls back to scaledNutrition(),
      // which correctly divides total nutrition by recipe.servings per attendee.
      if (targetSlotId) {
        await db.mealSlotProfile.updateMany({
          where: { mealSlotId: targetSlotId },
          data: { portionNote: null, calories: null, proteinG: null, carbG: null, fatG: null },
        })
      }

      return NextResponse.json(recipe, { status: 201 })
    }
  }

  // No suitable cached recipe — generate a new one with the AI, and steer it away from
  // anything cooked very recently so the household's rotation keeps feeling fresh.
  const threeWeeksAgo = new Date()
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)
  const recentRecipes = await db.recipe.findMany({
    where: { createdAt: { gte: threeWeeksAgo } },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "long" })
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

  const share = MEAL_SHARE[mealType as string] ?? 0.2

  // Each person's target intake *from this specific meal* (their daily target × this meal's share)
  const mealTargets = profiles.map((p) => {
    const effectiveProteinTarget = p.proteinCapG
      ? Math.min(p.proteinTarget ?? Infinity, p.proteinCapG)
      : p.proteinTarget
    return {
      profile: p,
      calories: p.calorieTarget ? p.calorieTarget * share : null,
      protein: effectiveProteinTarget ? effectiveProteinTarget * share : null,
      carb: p.carbTarget ? p.carbTarget * share : null,
      fat: p.fatTarget ? p.fatTarget * share : null,
      sugar: p.sugarTarget ? p.sugarTarget * share : null,
    }
  })

  const profileLines = mealTargets.map(({ profile: p, calories, protein, carb, fat, sugar }) => {
    const parts: string[] = [`${p.name} (goal: ${p.goal})`]
    if (calories !== null) parts.push(`~${Math.round(calories)} kcal from this meal`)
    if (protein !== null) parts.push(`~${Math.round(protein)}g protein`)
    if (carb !== null) parts.push(`~${Math.round(carb)}g carbs`)
    if (fat !== null) parts.push(`~${Math.round(fat)}g fat`)
    if (sugar !== null) parts.push(`⚠️ HARD sugar limit for this meal: ≤${Math.round(sugar)}g (daily cap: ${p.sugarTarget}g)`)
    if (p.proteinCapG) parts.push(`⚠️ HARD daily protein cap: ${p.proteinCapG}g total — never exceed across all meals`)
    if (p.notes) parts.push(`notes: ${p.notes}`)
    return `- ${parts.join(", ")}`
  }).join("\n")

  const cooldownNote = recentRecipes.length
    ? `Do not repeat: ${recentRecipes.map((r) => r.title).join(", ")}.`
    : ""

  const isSolo = profiles.length === 1
  const mealConstraint = MEAL_CONSTRAINTS[mealType as string] ?? ""

  const system = isSolo
    ? `You are a meal planning assistant designing a meal for one person eating alone.

Design a meal sized for ${profiles[0].name} only — set servings to 1 and scale ALL ingredient quantities for a single portion. Do not double or inflate quantities.

Write plating guidance and a nutrition estimate for that one person in the "portions" field (one entry only).

Also return the full ingredient list (for this one serving) and step-by-step instructions.

This meal's calorie/macro figures below are already this meal's own share of the person's daily target — they are NOT daily totals. Do not inflate to compensate for meals skipped elsewhere — those are eaten outside the app.

${mealConstraint ? `⚠️ MEAL TYPE RULE: ${mealConstraint}` : ""}
${isWeekend && !mealConstraint ? "It's a weekend — elaborate recipes with longer cook times are welcome." : !mealConstraint ? "It's a weekday — keep total prep + cook under 30 minutes." : ""}

${cooldownNote}`
    : `You are a meal planning assistant designing a single shared meal for a household of two people who often have different calorie/macro needs and preferences.

Design ONE shared dish — they cook and eat together — but feel free to vary the COMPOSITION of each person's plate where it genuinely helps hit their individual targets or preferences: e.g. one person's plate includes rice/bread/an extra side and the other's doesn't, one gets a bigger protein portion, one skips a topping. Keep the core of the dish identical (same base recipe, same cooking process); per-person differences should be additions, omissions, or portion-size tweaks that are easy to execute from one cooking session — not two separate recipes.

For EACH person, write direct plating guidance (the "portions" field) describing exactly what goes on their plate, and give an honest nutrition estimate for THAT specific plate (not a generic per-serving figure). These per-person nutrition figures do not need to add up neatly to the recipe total — they reflect each person's real, possibly-different plate.

Also return a full ingredient list (for the whole cooking session, all portions combined) so the app can build a shopping list, and clear step-by-step instructions covering how to prepare the dish AND how to assemble each person's plate differently if applicable.

This meal's calorie/macro figures below are already this meal's own share of each person's daily target — they are NOT daily totals, so do not scale them back up. Also do not inflate this meal to compensate for other meals skipped elsewhere in the plan — a skipped meal is eaten outside the app, its budget isn't available here.

${mealConstraint ? `⚠️ MEAL TYPE RULE: ${mealConstraint}` : ""}
${isWeekend && !mealConstraint ? "It's a weekend — elaborate recipes with longer cook times are welcome." : !mealConstraint ? "It's a weekday — keep total prep + cook under 30 minutes." : ""}

${cooldownNote}`

  const prompt = isSolo
    ? `Generate a ${MEAL_LABELS[mealType] ?? "meal"} recipe for ${dayOfWeek}.

This meal is for ${profiles[0].name} eating alone. Scale the recipe for 1 serving only.

Target nutrition for this meal:
${profileLines}
${userPrompt ? `\nUser request: ${userPrompt}` : ""}

Provide a single-serving recipe with ingredient quantities for one person, instructions, and one entry in the portions array for ${profiles[0].name}.`
    : `Generate a ${MEAL_LABELS[mealType] ?? "meal"} recipe for ${dayOfWeek}.

People eating this meal, and what each should aim to get from it:
${profileLines}
${userPrompt ? `\nUser request: ${userPrompt}` : ""}

Design one shared dish. Then, for each person listed above, describe their specific plate (composition + any differences from the other person's plate) and estimate that plate's actual nutrition — calibrated to get each person close to their own figures above, even if that means their plates differ in content or size. Also provide the full ingredient list for the whole cooking session and clear instructions.`

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: RecipeSchema,
    system,
    prompt,
  })

  const recipe = await db.recipe.create({
    data: {
      title: object.title,
      description: object.description,
      servings: object.servings,
      prepMinutes: object.prepMinutes,
      cookMinutes: object.cookMinutes,
      instructions: object.instructions,
      tags: object.tags,
      mealTypes: [mealType === "SNACK_1" || mealType === "SNACK_2" ? "SNACK" : mealType],
      audienceKey,
      sourceType: "AI_GENERATED",
      aiPromptSummary: userPrompt ?? null,
      nutrition: {
        create: {
          calories: object.nutrition.caloriesTotal,
          proteinG: object.nutrition.proteinGTotal,
          carbG: object.nutrition.carbGTotal,
          fatG: object.nutrition.fatGTotal,
          fiberG: object.nutrition.fiberGTotal ?? null,
          sugarG: object.nutrition.sugarGTotal ?? null,
          source: "AI_ESTIMATED",
        },
      },
    },
    include: { nutrition: true },
  })

  // Persist the ingredient list, reusing existing Ingredient rows by name where possible
  // (keeps the catalog tidy for a future shopping-list feature).
  for (let i = 0; i < object.ingredients.length; i++) {
    const ing = object.ingredients[i]
    const ingredient = await db.ingredient.upsert({
      where: { name: ing.name },
      create: { name: ing.name },
      update: {},
    })
    await db.recipeIngredient.create({
      data: {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes ?? null,
        order: i,
        quantityPerServing: ing.quantity / object.servings,
      },
    })
  }

  // Assign to slot
  let targetSlotId: string | null = slotId ?? null
  if (slotId) {
    await db.mealSlot.update({ where: { id: slotId }, data: { recipeId: recipe.id } })
  } else if (mealPlanId) {
    const slot = await db.mealSlot.upsert({
      where: {
        mealPlanId_date_mealType: {
          mealPlanId,
          date: new Date(date),
          mealType: mealType as MealType,
        },
      },
      create: { mealPlanId, date: new Date(date), mealType: mealType as MealType, recipeId: recipe.id },
      update: { recipeId: recipe.id },
    })
    targetSlotId = slot.id
  }

  // Store the AI's personalized plate guidance + nutrition for each attendee, matched by name.
  if (targetSlotId) {
    for (const { profile } of mealTargets) {
      const portion = object.portions.find(
        (p) => p.profileName.trim().toLowerCase() === profile.name.trim().toLowerCase()
      )
      if (!portion) continue
      await db.mealSlotProfile.updateMany({
        where: { mealSlotId: targetSlotId, profileId: profile.id },
        data: {
          portionNote: portion.description,
          calories: portion.calories,
          proteinG: portion.proteinG,
          carbG: portion.carbG,
          fatG: portion.fatG,
        },
      })
    }
  }

  return NextResponse.json(recipe, { status: 201 })
}
