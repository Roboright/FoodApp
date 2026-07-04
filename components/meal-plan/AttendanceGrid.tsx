"use client"

import { useMemo, useState } from "react"
import { MEAL_TYPES, MEAL_LABELS, getWeekDates, toDateString } from "@/lib/week"
import { cn } from "@/lib/utils"
import type { MealType } from "@prisma/client"

type Profile = { id: string; name: string }

type SlotInfo = {
  slotId?: string
  attendeeIds: string[]
}

type AttendanceGridProps = {
  planId: string
  monday: Date
  profiles: Profile[]
  slots: Array<{
    id: string
    date: string
    mealType: MealType
    recipeId?: string | null
    profiles: Array<{ profile: { id: string } }>
  }>
  onRefresh?: () => void
}

// One color per profile, cycling if there are more than 4
const PROFILE_COLORS = [
  { active: "bg-blue-500 text-white shadow-sm", inactive: "bg-blue-50 text-blue-400 border border-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30 dark:hover:bg-blue-500/20" },
  { active: "bg-rose-500 text-white shadow-sm", inactive: "bg-rose-50 text-rose-400 border border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30 dark:hover:bg-rose-500/20" },
  { active: "bg-violet-500 text-white shadow-sm", inactive: "bg-violet-50 text-violet-400 border border-violet-200 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30 dark:hover:bg-violet-500/20" },
  { active: "bg-amber-500 text-white shadow-sm", inactive: "bg-amber-50 text-amber-400 border border-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/20" },
]

const MEAL_COLORS: Record<MealType, string> = {
  BREAKFAST: "text-amber-600 dark:text-amber-400",
  LUNCH:     "text-emerald-600 dark:text-emerald-400",
  DINNER:    "text-indigo-600 dark:text-indigo-400",
  SNACK_1:   "text-orange-500 dark:text-orange-400",
  SNACK_2:   "text-rose-500 dark:text-rose-400",
}

function slotKey(date: string, mealType: MealType) {
  return `${date}:${mealType}`
}

export function AttendanceGrid({ planId, monday, profiles, slots, onRefresh }: AttendanceGridProps) {
  const days = getWeekDates(monday)

  const [gridState, setGridState] = useState<Record<string, SlotInfo>>(() => {
    const s: Record<string, SlotInfo> = {}
    for (const slot of slots) {
      const dateStr = slot.date.split("T")[0]
      s[slotKey(dateStr, slot.mealType)] = {
        slotId: slot.id,
        attendeeIds: slot.profiles.map((sp) => sp.profile.id),
      }
    }
    return s
  })

  // Derived from the slots prop so it updates whenever the parent refreshes
  const recipeByKey = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const slot of slots) {
      const dateStr = slot.date.split("T")[0]
      m[slotKey(dateStr, slot.mealType)] = !!slot.recipeId
    }
    return m
  }, [slots])

  const toggle = async (date: string, mealType: MealType, profileId: string) => {
    const key = slotKey(date, mealType)
    const current = gridState[key] ?? { attendeeIds: [] }
    const hasRecipe = recipeByKey[key] ?? false

    const isOn = current.attendeeIds.includes(profileId)
    const nextIds = isOn
      ? current.attendeeIds.filter((id) => id !== profileId)
      : [...current.attendeeIds, profileId]

    setGridState((prev) => ({ ...prev, [key]: { ...current, attendeeIds: nextIds } }))

    if (nextIds.length === 0 && !hasRecipe && current.slotId) {
      await fetch(`/api/meal-plans/${planId}/slots/${current.slotId}`, { method: "DELETE" })
      setGridState((prev) => ({ ...prev, [key]: { slotId: undefined, attendeeIds: [] } }))
    } else {
      const res = await fetch(`/api/meal-plans/${planId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType, profileIds: nextIds }),
      })
      const slot = await res.json()
      setGridState((prev) => ({
        ...prev,
        [key]: { slotId: slot.id, attendeeIds: nextIds },
      }))
    }
    onRefresh?.()
  }

  const todayStr = toDateString(new Date())

  return (
    <div>
      {/* Mobile: stacked by day */}
      <div className="block md:hidden space-y-3">
        {days.map((day) => {
          const dateStr = toDateString(day)
          const isToday = dateStr === todayStr
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <div key={dateStr} className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", isWeekend && "opacity-60")}>
              <div className={cn(
                "px-3 py-2 text-sm font-semibold border-b",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
              )}>
                {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                {isWeekend && <span className="ml-2 font-normal opacity-70 text-xs">weekend</span>}
                {isToday && <span className="ml-2 font-normal opacity-80 text-xs">today</span>}
              </div>
              <div className="divide-y">
                {MEAL_TYPES.map((mealType) => {
                  const info = gridState[slotKey(dateStr, mealType)] ?? { attendeeIds: [] }
                  const hasRecipe = recipeByKey[slotKey(dateStr, mealType)] ?? false
                  return (
                    <div key={mealType} className="flex items-center justify-between px-3 py-2.5 gap-2">
                      <span className={cn("text-sm font-medium shrink-0", MEAL_COLORS[mealType])}>
                        {MEAL_LABELS[mealType]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {info.attendeeIds.length > 0 && (
                          <RecipeStatusDot hasRecipe={hasRecipe} />
                        )}
                        {profiles.map((p, idx) => (
                          <ProfileChip
                            key={p.id}
                            profile={p}
                            colorIdx={idx}
                            active={info.attendeeIds.includes(p.id)}
                            onToggle={() => toggle(dateStr, mealType, p.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: meal × day table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="w-24 py-3 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide" />
              {days.map((day) => {
                const dateStr = toDateString(day)
                const isToday = dateStr === todayStr
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <th
                    key={dateStr}
                    className={cn(
                      "py-3 px-2 text-center font-medium",
                      isWeekend && "opacity-50",
                      isToday && "text-primary"
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {day.toLocaleDateString("en-GB", { weekday: "short" })}
                    </div>
                    <div className={cn("text-sm font-semibold", isToday && "text-primary")}>
                      {day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                    {isToday && (
                      <div className="mt-0.5 h-1 w-4 mx-auto rounded-full bg-primary" />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {MEAL_TYPES.map((mealType) => (
              <tr key={mealType} className="hover:bg-muted/20 transition-colors">
                <td className={cn("py-3 pl-4 pr-3 text-xs font-semibold", MEAL_COLORS[mealType])}>
                  {MEAL_LABELS[mealType]}
                </td>
                {days.map((day) => {
                  const dateStr = toDateString(day)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const info = gridState[slotKey(dateStr, mealType)] ?? { attendeeIds: [] }
                  const hasRecipe = recipeByKey[slotKey(dateStr, mealType)] ?? false
                  return (
                    <td key={dateStr} className={cn("py-2.5 px-2", isWeekend && "opacity-50 bg-muted/20")}>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex gap-1.5 justify-center">
                          {profiles.map((p, idx) => (
                            <ProfileChip
                              key={p.id}
                              profile={p}
                              colorIdx={idx}
                              active={info.attendeeIds.includes(p.id)}
                              onToggle={() => toggle(dateStr, mealType, p.id)}
                            />
                          ))}
                        </div>
                        {info.attendeeIds.length > 0 && (
                          <RecipeStatusDot hasRecipe={hasRecipe} />
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecipeStatusDot({ hasRecipe }: { hasRecipe: boolean }) {
  return hasRecipe ? (
    <span className="text-[9px] leading-none text-emerald-500" title="Recipe assigned">●</span>
  ) : (
    <span className="text-[9px] leading-none text-amber-400" title="No recipe yet">○</span>
  )
}

function ProfileChip({
  profile,
  colorIdx,
  active,
  onToggle,
}: {
  profile: Profile
  colorIdx: number
  active: boolean
  onToggle: () => void
}) {
  const palette = PROFILE_COLORS[colorIdx % PROFILE_COLORS.length]
  return (
    <button
      onClick={onToggle}
      title={`${active ? "Remove" : "Add"} ${profile.name}`}
      className={cn(
        "w-8 h-8 rounded-full text-xs font-bold transition-all select-none",
        active ? palette.active : palette.inactive
      )}
    >
      {profile.name[0].toUpperCase()}
    </button>
  )
}
