"use client"

import { useEffect, useState } from "react"
import { formatWeekLabel, formatWeekRelativeLabel } from "@/lib/week"
import { cn } from "@/lib/utils"

type TodayProfileStat = {
  profileId: string
  profileName: string
  date: string
  weightKg: number | null
  calories: number | null
  proteinG: number | null
  carbG: number | null
  fatG: number | null
  sugarG: number | null
  calorieTarget: number | null
  proteinTarget: number | null
  carbTarget: number | null
  fatTarget: number | null
  sugarTarget: number | null
}

type ProfileStat = {
  profileId: string
  profileName: string
  weightDays: number
  avgWeightKg: number | null
  weightDeltaKg: number | null
  avgCalories: number | null
  avgProteinG: number | null
  avgCarbG: number | null
  avgFatG: number | null
  avgSugarG: number | null
  calorieTarget: number | null
  proteinTarget: number | null
  carbTarget: number | null
  fatTarget: number | null
  sugarTarget: number | null
}

type WeekStat = {
  weekStart: string
  profileStats: ProfileStat[]
}

export default function StatsPage() {
  const [weeks, setWeeks] = useState<WeekStat[]>([])
  const [todayStats, setTodayStats] = useState<TodayProfileStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/stats?weeks=6").then((r) => r.json()),
      fetch("/api/stats/today").then((r) => r.json()),
    ]).then(([weekData, todayData]) => {
      setWeeks(weekData)
      setTodayStats(todayData)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
  }

  const hasAnyData = weeks.some((w) =>
    w.profileStats.some((p) => p.avgWeightKg !== null || p.avgCalories !== null)
  )
  const hasTodayData = todayStats.some((p) => p.weightKg !== null || p.calories !== null)

  if (!hasAnyData && !hasTodayData) {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-base font-medium">No data yet</p>
        <p className="text-sm text-muted-foreground">
          Start logging meals and tracking your weight to see weekly stats here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Weekly stats</h1>

      {/* Today card */}
      {hasTodayData && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden ring-1 ring-primary/20">
          <div className="px-4 py-2.5 border-b bg-primary/5 flex items-baseline gap-2">
            <span className="font-semibold text-sm text-primary">Today</span>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <div className={cn(
            "grid divide-y md:divide-y-0 md:divide-x",
            todayStats.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          )}>
            {todayStats.map((p) => (
              <TodayPanel key={p.profileId} stat={p} />
            ))}
          </div>
        </div>
      )}

      {weeks.map((week) => {
        const monday = new Date(week.weekStart)
        monday.setHours(0, 0, 0, 0)
        const hasData = week.profileStats.some(
          (p) => p.avgWeightKg !== null || p.avgCalories !== null
        )

        return (
          <div key={week.weekStart} className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", !hasData && "opacity-40")}>
            <div className="px-4 py-2.5 border-b bg-muted/40 flex items-baseline gap-2">
              <span className="font-semibold text-sm">{formatWeekRelativeLabel(monday)}</span>
              <span className="text-xs text-muted-foreground">{formatWeekLabel(monday)}</span>
            </div>

            {!hasData ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No data recorded.</p>
            ) : (
              <div className={cn(
                "grid divide-y md:divide-y-0 md:divide-x",
                week.profileStats.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
              )}>
                {week.profileStats.map((p) => (
                  <ProfilePanel key={p.profileId} stat={p} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TodayPanel({ stat }: { stat: TodayProfileStat }) {
  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm font-semibold">{stat.profileName}</p>

      {stat.weightKg !== null && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Weight</p>
          <p className="text-2xl font-bold tabular-nums">{stat.weightKg} kg</p>
        </div>
      )}

      {stat.calories !== null ? (
        <div className="space-y-2.5">
          <NutritionRow label="Calories" value={stat.calories}  target={stat.calorieTarget} unit=" kcal" />
          <NutritionRow label="Protein"  value={stat.proteinG}  target={stat.proteinTarget} unit="g" isMin />
          <NutritionRow label="Carbs"    value={stat.carbG}     target={stat.carbTarget}    unit="g" />
          <NutritionRow label="Fat"      value={stat.fatG}      target={stat.fatTarget}     unit="g" />
          <NutritionRow label="Sugar"    value={stat.sugarG}    target={stat.sugarTarget}   unit="g" isCap />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No meals planned or logged today.</p>
      )}
    </div>
  )
}

function ProfilePanel({ stat }: { stat: ProfileStat }) {
  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm font-semibold">{stat.profileName}</p>

      {/* Weight */}
      <div className="flex items-baseline gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Avg weight</p>
          <p className="text-2xl font-bold tabular-nums">
            {stat.avgWeightKg !== null ? `${stat.avgWeightKg} kg` : "—"}
          </p>
        </div>
        {stat.weightDeltaKg !== null && (
          <WeightDelta delta={stat.weightDeltaKg} />
        )}
        {stat.avgWeightKg === null && stat.weightDays === 0 && (
          <p className="text-xs text-muted-foreground">not tracked this week</p>
        )}
      </div>

      {/* Nutrition */}
      {stat.avgCalories !== null ? (
        <div className="space-y-2.5">
          <NutritionRow label="Calories" value={stat.avgCalories} target={stat.calorieTarget} unit=" kcal" />
          <NutritionRow label="Protein"  value={stat.avgProteinG} target={stat.proteinTarget} unit="g" isMin />
          <NutritionRow label="Carbs"    value={stat.avgCarbG}    target={stat.carbTarget}    unit="g" />
          <NutritionRow label="Fat"      value={stat.avgFatG}     target={stat.fatTarget}     unit="g" />
          <NutritionRow label="Sugar"    value={stat.avgSugarG}   target={stat.sugarTarget}   unit="g" isCap />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No meals planned this week.</p>
      )}
    </div>
  )
}

function NutritionRow({
  label, value, target, unit, isMin = false, isCap = false,
}: {
  label: string
  value: number | null
  target: number | null
  unit: string
  isMin?: boolean
  isCap?: boolean
}) {
  const pct = value !== null && target ? Math.round((value / target) * 100) : null
  const barPct = value !== null && target ? Math.min((value / target) * 100, 100) : 0

  const barColor = (() => {
    if (pct === null) return "bg-muted-foreground/30"
    if (isCap) {
      if (pct <= 85) return "bg-emerald-500"
      if (pct <= 100) return "bg-amber-400"
      return "bg-rose-500"
    }
    if (isMin) {
      if (pct >= 95) return "bg-emerald-500"
      if (pct >= 75) return "bg-amber-400"
      return "bg-rose-500"
    }
    if (pct >= 85 && pct <= 115) return "bg-emerald-500"
    if (pct >= 70) return "bg-amber-400"
    return "bg-rose-500"
  })()

  const pctLabel = pct !== null ? (
    <span className={cn(
      "text-xs tabular-nums font-medium",
      isCap && pct > 100 ? "text-rose-500" :
      isMin && pct < 75 ? "text-rose-500" :
      pct < 70 ? "text-rose-500" :
      "text-muted-foreground"
    )}>
      {pct}%
    </span>
  ) : null

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
        <div className="flex items-baseline gap-1.5 flex-1 justify-end">
          {value !== null ? (
            <span className="text-sm font-semibold tabular-nums">
              {value.toLocaleString()}{unit}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          {target && value !== null && (
            <span className="text-xs text-muted-foreground">
              / {target.toLocaleString()}{unit}
            </span>
          )}
          {pctLabel}
        </div>
      </div>
      {target && value !== null && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function WeightDelta({ delta }: { delta: number }) {
  const sign = delta > 0 ? "+" : ""
  const color = delta < 0 ? "text-emerald-600 dark:text-emerald-400" : delta > 0 ? "text-rose-500" : "text-muted-foreground"
  return (
    <span className={cn("text-sm font-medium", color)}>
      {delta === 0 ? "↔ no change" : `${sign}${delta} kg`}
    </span>
  )
}
