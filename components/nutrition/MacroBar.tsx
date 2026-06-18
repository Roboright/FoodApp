"use client"

import { cn } from "@/lib/utils"

type MacroBarProps = {
  label: string
  value: number
  target: number | null
  unit?: string
}

// Semantic status vs. target — green when on target, orange when under, red when over.
// A ±10% band counts as "on target" so small natural variance doesn't read as a problem.
type Status = "none" | "under" | "on" | "over"

function getStatus(value: number, target: number | null): Status {
  if (!target) return "none"
  const ratio = value / target
  if (ratio > 1.1) return "over"
  if (ratio < 0.9) return "under"
  return "on"
}

const BAR_COLOR: Record<Status, string> = {
  none: "bg-muted-foreground/30",
  under: "bg-orange-400",
  on: "bg-emerald-500",
  over: "bg-red-500",
}

const TEXT_COLOR: Record<Status, string> = {
  none: "",
  under: "text-orange-600 dark:text-orange-400",
  on: "text-emerald-600 dark:text-emerald-400",
  over: "text-red-600 dark:text-red-400",
}

export function MacroBar({ label, value, target, unit = "g" }: MacroBarProps) {
  const status = getStatus(value, target)
  const pct = target ? Math.min((value / target) * 100, 100) : 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", TEXT_COLOR[status])}>
          {Math.round(value)}{unit}
          {target ? ` / ${target}${unit}` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", BAR_COLOR[status])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

type DailyNutritionBarProps = {
  profileName?: string
  planned: { calories: number; proteinG: number; carbG: number; fatG: number; sugarG?: number | null }
  targets: { calorieTarget: number | null; proteinTarget: number | null; carbTarget: number | null; fatTarget: number | null; proteinCapG?: number | null; sugarTarget?: number | null }
}

export function DailyNutritionBar({ profileName, planned, targets }: DailyNutritionBarProps) {
  const proteinTarget = targets.proteinCapG
    ? Math.min(targets.proteinTarget ?? Infinity, targets.proteinCapG)
    : targets.proteinTarget

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {profileName && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{profileName}</p>
      )}
      <MacroBar label="Calories" value={planned.calories} target={targets.calorieTarget} unit=" kcal" />
      <MacroBar label="Protein" value={planned.proteinG} target={proteinTarget} />
      <MacroBar label="Carbs" value={planned.carbG} target={targets.carbTarget} />
      <MacroBar label="Fat" value={planned.fatG} target={targets.fatTarget} />
      {(planned.sugarG != null || targets.sugarTarget != null) && (
        <MacroBar label="Sugar" value={planned.sugarG ?? 0} target={targets.sugarTarget ?? null} />
      )}
    </div>
  )
}
