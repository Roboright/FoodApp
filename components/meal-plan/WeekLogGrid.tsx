"use client"

import { useState } from "react"
import { MEAL_TYPES, MEAL_LABELS, getWeekDates, toDateString } from "@/lib/week"
import { cn } from "@/lib/utils"
import type { MealType } from "@prisma/client"
import type { ExtraLog } from "@/app/log/page"

type LogEntry = { id: string; profileId: string }

type Slot = {
  id: string
  date: string
  mealType: MealType
  recipe: { id: string; title: string } | null
  profiles: Array<{ profile: { id: string; name: string } }>
  logs: LogEntry[]
}

type MealPlan = {
  id: string
  mealSlots: Slot[]
}

type Profile = { id: string; name: string }

type WeekLogGridProps = {
  plan: MealPlan
  monday: Date
  profiles: Profile[]
  eatenMap: Record<string, string | null>
  extraLogs: ExtraLog[]
  onToggle: (slot: Slot, profileId: string) => void
  onToggleSlot: (slot: Slot) => void
  onToggleDay: (dateStr: string) => void
  onExtrasChanged: () => void
}

const MEAL_COLORS: Record<MealType, string> = {
  BREAKFAST: "text-amber-600 dark:text-amber-400",
  LUNCH:     "text-emerald-600 dark:text-emerald-400",
  DINNER:    "text-indigo-600 dark:text-indigo-400",
  SNACK_1:   "text-orange-500 dark:text-orange-400",
  SNACK_2:   "text-rose-500 dark:text-rose-400",
}

function getActiveSlot(plan: MealPlan, date: Date, mealType: MealType): Slot | undefined {
  return plan.mealSlots.find(
    (s) =>
      s.date.startsWith(toDateString(date)) &&
      s.mealType === mealType &&
      s.profiles.length > 0 &&
      s.recipe
  )
}

function isSlotFullyEaten(slot: Slot, eatenMap: Record<string, string | null>): boolean {
  return slot.profiles.every((sp) => !!eatenMap[`${slot.id}:${sp.profile.id}`])
}

function isDayFullyEaten(plan: MealPlan, dateStr: string, eatenMap: Record<string, string | null>): boolean {
  const daySlots = plan.mealSlots.filter(
    (s) => s.date.startsWith(dateStr) && s.profiles.length > 0 && s.recipe
  )
  return daySlots.length > 0 && daySlots.every((s) => isSlotFullyEaten(s, eatenMap))
}

function extrasForDay(extraLogs: ExtraLog[], dateStr: string): ExtraLog[] {
  return extraLogs.filter((l) => l.loggedAt.startsWith(dateStr))
}

export function WeekLogGrid({ plan, monday, profiles, eatenMap, extraLogs, onToggle, onToggleSlot, onToggleDay, onExtrasChanged }: WeekLogGridProps) {
  const days = getWeekDates(monday)
  const todayStr = toDateString(new Date())
  const [detailExtra, setDetailExtra] = useState<ExtraLog | null>(null)

  return (
    <div>
      {detailExtra && (
        <ExtraDetailPopup
          extra={detailExtra}
          onClose={() => setDetailExtra(null)}
          onDeleted={() => { setDetailExtra(null); onExtrasChanged() }}
        />
      )}

      {/* Mobile: stacked by day */}
      <div className="block md:hidden space-y-3">
        {days.map((day) => {
          const dateStr = toDateString(day)
          const isToday = dateStr === todayStr
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const daySlots = MEAL_TYPES
            .map((mt) => ({ mt, slot: getActiveSlot(plan, day, mt) }))
            .filter(({ slot }) => !!slot)
          const dayDone = isDayFullyEaten(plan, dateStr, eatenMap)
          const dayExtras = extrasForDay(extraLogs, dateStr)

          if (daySlots.length === 0 && dayExtras.length === 0) return null

          // Group extras by profileId
          const extrasByProfile: Record<string, ExtraLog[]> = {}
          for (const e of dayExtras) {
            if (!extrasByProfile[e.profileId]) extrasByProfile[e.profileId] = []
            extrasByProfile[e.profileId].push(e)
          }

          const profileNames = Object.fromEntries(profiles.map((p) => [p.id, p.name]))

          return (
            <div
              key={dateStr}
              className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", isWeekend && "opacity-60")}
            >
              <div className={cn(
                "flex items-center justify-between px-3 py-2 border-b",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
              )}>
                <span className="text-sm font-semibold">
                  {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                  {isWeekend && <span className="ml-2 font-normal opacity-70 text-xs">weekend</span>}
                  {isToday && <span className="ml-2 font-normal opacity-80 text-xs">today</span>}
                </span>
                {daySlots.length > 0 && (
                  <button
                    onClick={() => onToggleDay(dateStr)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all select-none ml-2 shrink-0",
                      dayDone
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : isToday
                          ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                          : "border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {dayDone ? "✓ Day" : "Check day"}
                  </button>
                )}
              </div>

              {daySlots.length === 0 && dayExtras.length === 0 ? null : (
                <div className="divide-y">
                  {daySlots.map(({ mt, slot }) => {
                    const allEaten = isSlotFullyEaten(slot!, eatenMap)
                    const multiProfile = slot!.profiles.length > 1
                    return (
                      <div
                        key={mt}
                        className={cn("px-3 py-2.5 space-y-1.5 transition-colors", allEaten && "bg-emerald-50/40 dark:bg-emerald-500/5")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={cn("text-xs font-semibold", MEAL_COLORS[mt])}>{MEAL_LABELS[mt]}</span>
                            <p className={cn("text-sm font-medium", allEaten && "line-through text-muted-foreground")}>
                              {slot!.recipe!.title}
                            </p>
                          </div>
                          {allEaten && <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0 pt-0.5">✓</span>}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {slot!.profiles.map((sp) => (
                            <EatButton
                              key={sp.profile.id}
                              name={sp.profile.name}
                              eaten={!!eatenMap[`${slot!.id}:${sp.profile.id}`]}
                              onToggle={() => onToggle(slot!, sp.profile.id)}
                            />
                          ))}
                          {multiProfile && (
                            <EatButton
                              name="Both"
                              eaten={allEaten}
                              onToggle={() => onToggleSlot(slot!)}
                              both
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Extras section */}
                  {dayExtras.length > 0 && (
                    <div className="px-3 py-2.5 space-y-2 bg-amber-50/30 dark:bg-amber-500/5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extras</p>
                      {Object.entries(extrasByProfile).map(([profileId, logs]) => (
                        <div key={profileId} className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {profileNames[profileId] ?? "Unknown"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {logs.map((log) => (
                              <button
                                key={log.id}
                                onClick={() => setDetailExtra(log)}
                                className="max-w-[180px] truncate rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 transition-colors text-left"
                              >
                                {log.description ? log.description.slice(0, 28) + (log.description.length > 28 ? "…" : "") : "Extra"}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="w-24 py-3 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide" />
              {days.map((day) => {
                const dateStr = toDateString(day)
                const isToday = dateStr === todayStr
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                const dayDone = isDayFullyEaten(plan, dateStr, eatenMap)
                const hasDaySlots = plan.mealSlots.some(
                  (s) => s.date.startsWith(dateStr) && s.profiles.length > 0 && s.recipe
                )
                return (
                  <th
                    key={dateStr}
                    className={cn("py-3 px-2 text-center font-medium", isWeekend && "opacity-50")}
                  >
                    <div className="text-xs text-muted-foreground">
                      {day.toLocaleDateString("en-GB", { weekday: "short" })}
                    </div>
                    <div className={cn("text-sm font-semibold", isToday && "text-primary")}>
                      {day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                    {isToday && <div className="mt-0.5 h-1 w-4 mx-auto rounded-full bg-primary" />}
                    {hasDaySlots && (
                      <button
                        onClick={() => onToggleDay(dateStr)}
                        className={cn(
                          "mt-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-all select-none",
                          dayDone
                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                            : "border bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {dayDone ? "✓ Day" : "Day"}
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {MEAL_TYPES.map((mealType) => (
              <tr key={mealType} className="hover:bg-muted/10 transition-colors">
                <td className={cn("py-3 pl-4 pr-3 text-xs font-semibold", MEAL_COLORS[mealType])}>
                  {MEAL_LABELS[mealType]}
                </td>
                {days.map((day) => {
                  const dateStr = toDateString(day)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const slot = getActiveSlot(plan, day, mealType)
                  const allEaten = slot ? isSlotFullyEaten(slot, eatenMap) : false
                  const multiProfile = (slot?.profiles.length ?? 0) > 1

                  return (
                    <td
                      key={dateStr}
                      className={cn(
                        "py-2 px-2 align-top",
                        isWeekend && "opacity-50 bg-muted/20",
                        allEaten && "bg-emerald-50/30 dark:bg-emerald-500/5"
                      )}
                    >
                      {slot ? (
                        <div className="space-y-1.5">
                          <p className={cn("text-xs leading-snug line-clamp-2", allEaten && "line-through text-muted-foreground")}>
                            {slot.recipe!.title}
                          </p>
                          <div className="flex flex-col gap-1">
                            {slot.profiles.map((sp) => (
                              <EatButton
                                key={sp.profile.id}
                                name={sp.profile.name}
                                eaten={!!eatenMap[`${slot.id}:${sp.profile.id}`]}
                                onToggle={() => onToggle(slot, sp.profile.id)}
                                compact
                              />
                            ))}
                            {multiProfile && (
                              <EatButton
                                name="Both"
                                eaten={allEaten}
                                onToggle={() => onToggleSlot(slot)}
                                compact
                                both
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Extras row */}
            {days.some((d) => extrasForDay(extraLogs, toDateString(d)).length > 0) && (
              <tr className="hover:bg-muted/10 transition-colors bg-amber-50/20 dark:bg-amber-500/5">
                <td className="py-3 pl-4 pr-3 text-xs font-semibold text-amber-600 dark:text-amber-400">Extras</td>
                {days.map((day) => {
                  const dateStr = toDateString(day)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const dayExtras = extrasForDay(extraLogs, dateStr)
                  return (
                    <td key={dateStr} className={cn("py-2 px-2 align-top", isWeekend && "opacity-50 bg-muted/20")}>
                      <div className="flex flex-col gap-1">
                        {dayExtras.map((log) => (
                          <button
                            key={log.id}
                            onClick={() => setDetailExtra(log)}
                            className="max-w-full truncate rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 transition-colors text-left"
                          >
                            {log.description ? log.description.slice(0, 20) + (log.description.length > 20 ? "…" : "") : "Extra"}
                          </button>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExtraDetailPopup({
  extra,
  onClose,
  onDeleted,
}: {
  extra: ExtraLog
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const del = async () => {
    setDeleting(true)
    await fetch(`/api/meal-logs/${extra.id}`, { method: "DELETE" })
    onDeleted()
  }

  const date = new Date(extra.loggedAt)
  const dateLabel = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background rounded-2xl shadow-xl flex flex-col gap-5 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
            <h2 className="text-base font-semibold mt-0.5">Extra meal</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0">✕</button>
        </div>

        {extra.description && (
          <p className="text-sm leading-relaxed">{extra.description}</p>
        )}

        {(extra.caloriesOverride !== null || extra.proteinOverride !== null) && (
          <div className="grid grid-cols-5 gap-3">
            <MacroPill label="kcal" value={Math.round(extra.caloriesOverride ?? 0)} color="text-orange-500" />
            <MacroPill label="protein" value={Math.round(extra.proteinOverride ?? 0)} unit="g" color="text-blue-500" />
            <MacroPill label="carbs" value={Math.round(extra.carbOverride ?? 0)} unit="g" color="text-amber-500" />
            <MacroPill label="fat" value={Math.round(extra.fatOverride ?? 0)} unit="g" color="text-rose-500" />
            <MacroPill label="sugar" value={Math.round(extra.sugarOverride ?? 0)} unit="g" color="text-pink-500" />
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={del}
            disabled={deleting}
            className="text-sm text-destructive hover:underline disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete this entry"}
          </button>
        </div>
      </div>
    </div>
  )
}

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border bg-muted/30 py-3 px-2")}>
      <span className={cn("text-xl font-bold tabular-nums", color)}>{value}{unit ?? ""}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  )
}

function EatButton({
  name,
  eaten,
  onToggle,
  compact = false,
  both = false,
}: {
  name: string
  eaten: boolean
  onToggle: () => void
  compact?: boolean
  both?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1 rounded-full font-medium transition-all select-none",
        compact ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-sm",
        both && !eaten && "border-dashed",
        eaten
          ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
          : "border bg-muted text-muted-foreground hover:bg-muted/60"
      )}
    >
      {eaten && <span className="leading-none">✓</span>}
      {name}
    </button>
  )
}
