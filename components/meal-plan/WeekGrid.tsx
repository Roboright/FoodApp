"use client"

import { MEAL_TYPES, MEAL_LABELS, getWeekDates, toDateString } from "@/lib/week"
import { scaledNutrition } from "@/lib/nutrition"
import { DailyNutritionBar } from "@/components/nutrition/MacroBar"
import { SlotCard } from "./SlotCard"
import { useProfile } from "@/components/layout/ProfileContext"
import type { MealType } from "@prisma/client"

type Recipe = {
  id: string
  title: string
  servings: number
  starred: boolean
  mealTypes: string[]
  nutrition: { calories: number; proteinG: number; carbG: number; fatG: number; sugarG?: number | null } | null
}

type SlotProfile = {
  profile: { id: string; name: string }
  servingFraction: number
  portionNote: string | null
  calories: number | null
  proteinG: number | null
  carbG: number | null
  fatG: number | null
}

type Slot = {
  id: string
  date: string
  mealType: MealType
  recipe: Recipe | null
  servingsOverride: number | null
  notes: string | null
  profiles: SlotProfile[]
}

type MealPlan = {
  id: string
  mealSlots: Slot[]
}

type WeekGridProps = {
  plan: MealPlan
  monday: Date
  singleDay?: Date
  onRefresh: () => void
}

export function WeekGrid({ plan, monday, singleDay, onRefresh }: WeekGridProps) {
  const { profiles } = useProfile()
  const days = getWeekDates(monday)

  const getSlot = (date: Date, mealType: MealType) =>
    plan.mealSlots.find(
      (s) => s.date.startsWith(toDateString(date)) && s.mealType === mealType
    )

  // Compute daily nutrition totals for a given profile
  const dailyNutritionFor = (date: Date, profileId: string) => {
    const totals = { calories: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0 }

    MEAL_TYPES.forEach((mt) => {
      const slot = getSlot(date, mt)
      if (!slot?.recipe?.nutrition) return

      const attending = slot.profiles.find((sp) => sp.profile.id === profileId)
      if (!attending) return

      const n =
        attending.calories !== null
          ? { calories: attending.calories, proteinG: attending.proteinG ?? 0, carbG: attending.carbG ?? 0, fatG: attending.fatG ?? 0, sugarG: null as number | null }
          : scaledNutrition(slot.recipe.nutrition, slot.recipe.servings, slot.servingsOverride, attending.servingFraction)

      totals.calories += n.calories
      totals.proteinG += n.proteinG
      totals.carbG += n.carbG
      totals.fatG += n.fatG
      if (n.sugarG != null) totals.sugarG += n.sugarG
    })
    return totals
  }

  if (singleDay) {
    return (
      <DayColumn
        day={singleDay}
        plan={plan}
        profiles={profiles}
        nutritionByProfile={profiles.map((p) => ({ profile: p, nutrition: dailyNutritionFor(singleDay, p.id) }))}
        onRefresh={onRefresh}
        showDateHeader={false}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile: stacked days */}
      <div className="block md:hidden space-y-6">
        {days.map((day) => (
          <DayColumn
            key={toDateString(day)}
            day={day}
            plan={plan}
            profiles={profiles}
            nutritionByProfile={profiles.map((p) => ({ profile: p, nutrition: dailyNutritionFor(day, p.id) }))}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="hidden md:grid grid-cols-7 gap-3">
        {days.map((day) => (
          <div key={toDateString(day)} className="space-y-2">
            <div className="text-center">
              <div className="text-xs font-medium text-muted-foreground">
                {day.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
              <div className="text-sm font-semibold">
                {day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
            </div>
            {MEAL_TYPES.map((mt) => {
              const slot = getSlot(day, mt)
              return (
                <div key={mt}>
                  <div className="text-xs text-muted-foreground mb-0.5">{MEAL_LABELS[mt]}</div>
                  <SlotCard
                    mealPlanId={plan.id}
                    date={toDateString(day)}
                    mealType={mt}
                    slotId={slot?.id}
                    recipe={slot?.recipe}
                    servingsOverride={slot?.servingsOverride}
                    notes={slot?.notes}
                    attendees={slot?.profiles.map((sp) => sp.profile) ?? []}
                    slotProfiles={slot?.profiles}
                    allProfiles={profiles}
                    onUpdate={onRefresh}
                  />
                </div>
              )
            })}
            <div className="space-y-2">
              {profiles.map((p) => (
                <DailyNutritionBar
                  key={p.id}
                  profileName={p.name}
                  planned={dailyNutritionFor(day, p.id)}
                  targets={p}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type ProfileTargets = {
  id: string
  name: string
  calorieTarget: number | null
  proteinTarget: number | null
  carbTarget: number | null
  fatTarget: number | null
  proteinCapG?: number | null
}

function DayColumn({
  day,
  plan,
  profiles,
  nutritionByProfile,
  onRefresh,
  showDateHeader = true,
}: {
  day: Date
  plan: MealPlan
  profiles: { id: string; name: string }[]
  nutritionByProfile: Array<{ profile: ProfileTargets; nutrition: { calories: number; proteinG: number; carbG: number; fatG: number } }>
  onRefresh: () => void
  showDateHeader?: boolean
}) {
  const dateStr = toDateString(day)
  const isToday = dateStr === toDateString(new Date())

  const getSlot = (mealType: MealType) =>
    plan.mealSlots.find((s) => s.date.startsWith(dateStr) && s.mealType === mealType)

  return (
    <div className="space-y-2">
      {showDateHeader && (
        <div className={`flex items-center gap-2 ${isToday ? "text-primary font-semibold" : ""}`}>
          <span className="text-sm">
            {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          </span>
          {isToday && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Today</span>
          )}
        </div>
      )}

      {MEAL_TYPES.map((mt) => {
        const slot = getSlot(mt)
        return (
          <div key={mt} className="flex gap-2 items-start">
            <span className="w-20 shrink-0 pt-2 text-xs text-muted-foreground">{MEAL_LABELS[mt]}</span>
            <div className="flex-1">
              <SlotCard
                mealPlanId={plan.id}
                date={dateStr}
                mealType={mt}
                slotId={slot?.id}
                recipe={slot?.recipe}
                servingsOverride={slot?.servingsOverride}
                notes={slot?.notes}
                attendees={slot?.profiles.map((sp) => sp.profile) ?? []}
                slotProfiles={slot?.profiles}
                allProfiles={profiles}
                onUpdate={onRefresh}
              />
            </div>
          </div>
        )
      })}

      <div className="space-y-2">
        {nutritionByProfile.map(({ profile, nutrition }) => (
          <DailyNutritionBar key={profile.id} profileName={profile.name} planned={nutrition} targets={profile} />
        ))}
      </div>
    </div>
  )
}
