"use client"

import { useCallback, useEffect, useSyncExternalStore, useState } from "react"
import { Button } from "@/components/ui/button"
import { WeekGrid } from "@/components/meal-plan/WeekGrid"
import {
  getMondayOfWeek,
  formatWeekLabel, formatWeekRelativeLabel,
  formatDayRelativeLabel, formatDaySubtitle,
  toDateString,
} from "@/lib/week"
import { useProfile } from "@/components/layout/ProfileContext"
import Link from "next/link"

type SlotForGen = {
  id: string
  date: string
  mealType: string
  recipeId?: string | null
  profiles: Array<{ profile: { id: string } }>
}

type MealPlan = {
  id: string
  weekStartDate: string
  status: string
  mealSlots: SlotForGen[]
}

async function generateInBatches(
  slots: SlotForGen[],
  planId: string,
  onProgress: (done: number) => void,
  concurrency = 3
) {
  let idx = 0
  let done = 0
  async function worker() {
    while (idx < slots.length) {
      const slot = slots[idx++]
      await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: slot.id,
          mealPlanId: planId,
          date: slot.date.split("T")[0],
          mealType: slot.mealType,
          profileIds: slot.profiles.map((sp) => sp.profile.id),
        }),
      })
      onProgress(++done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, slots.length) }, worker))
}

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)")
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  )
}

export default function MealsPage() {
  const { profiles, loading } = useProfile()
  const isDesktop = useIsDesktop()

  const [day, setDay] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [fetching, setFetching] = useState(false)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)
  const [fetchVersion, setFetchVersion] = useState(0)

  const refresh = useCallback(() => setFetchVersion((v) => v + 1), [])

  const monday = getMondayOfWeek(day)

  useEffect(() => {
    if (loading) return
    let cancelled = false
    const mondayStr = toDateString(monday)

    Promise.resolve().then(async () => {
      if (cancelled) return
      setFetching(true)
      const res = await fetch("/api/meal-plans")
      const plans: MealPlan[] = await res.json()
      const existing = plans.find((p) => p.weekStartDate.startsWith(mondayStr))
      if (cancelled) return
      let currentPlan: MealPlan | null = null
      if (existing) {
        const detail = await fetch(`/api/meal-plans/${existing.id}`)
        if (!cancelled) currentPlan = await detail.json()
      }
      if (!cancelled) { setPlan(currentPlan); setFetching(false) }
    })

    return () => { cancelled = true }
  }, [day, fetchVersion, loading])

  const dayStr = toDateString(day)

  const shiftDay = (n: number) => setDay((prev) => {
    const d = new Date(prev); d.setDate(d.getDate() + n); return d
  })

  const generate = async (scope: "day" | "week") => {
    if (!plan) return
    const toGenerate = plan.mealSlots.filter((s) =>
      s.profiles.length > 0 && !s.recipeId &&
      (scope === "week" || s.date.startsWith(dayStr))
    )
    if (toGenerate.length === 0) return
    setGenProgress({ done: 0, total: toGenerate.length })
    await generateInBatches(toGenerate, plan.id, (done) =>
      setGenProgress({ done, total: toGenerate.length })
    )
    setGenProgress(null)
    refresh()
  }

  const regenerate = async (scope: "day" | "week") => {
    if (!plan) return
    const toGenerate = plan.mealSlots.filter((s) =>
      s.profiles.length > 0 &&
      (scope === "week" || s.date.startsWith(dayStr))
    )
    if (toGenerate.length === 0) return
    const label = scope === "week" ? "this week" : "this day"
    if (!window.confirm(`Replace all ${toGenerate.length} planned meals for ${label} with freshly generated ones?`)) return
    setGenProgress({ done: 0, total: toGenerate.length })
    await generateInBatches(toGenerate, plan.id, (done) =>
      setGenProgress({ done, total: toGenerate.length })
    )
    setGenProgress(null)
    refresh()
  }

  if (loading) return null

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">No profiles yet</h1>
        <Link href="/onboarding"><Button size="lg">Set up profiles</Button></Link>
      </div>
    )
  }

  const scope = isDesktop ? "week" : "day"
  const missing = plan?.mealSlots.filter((s) =>
    s.profiles.length > 0 && !s.recipeId &&
    (isDesktop || s.date.startsWith(dayStr))
  ) ?? []
  const isGenerating = genProgress !== null

  return (
    <div className="space-y-4">
      {/* Nav — day on mobile, week on desktop */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => shiftDay(isDesktop ? -7 : -1)}>← Prev</Button>
        <div className="text-center">
          {isDesktop ? (
            <>
              <h1 className="text-base font-semibold">{formatWeekRelativeLabel(monday)}</h1>
              <p className="text-xs text-muted-foreground">{formatWeekLabel(monday)}</p>
            </>
          ) : (
            <>
              <h1 className="text-base font-semibold">{formatDayRelativeLabel(day)}</h1>
              <p className="text-xs text-muted-foreground">{formatDaySubtitle(day)}</p>
            </>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftDay(isDesktop ? 7 : 1)}>Next →</Button>
      </div>

      {fetching ? (
        <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
      ) : !plan ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">No meal plan for this week. Create one in the Planner first.</p>
          <Link href="/"><Button>Go to Planner</Button></Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            {isGenerating ? (
              <p className="text-sm text-muted-foreground">
                Generating recipes… {genProgress.done} / {genProgress.total}
              </p>
            ) : (
              <>
                <div>
                  {missing.length > 0 ? (
                    <Button onClick={() => generate(scope)}>
                      Generate ({missing.length} missing)
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">All active slots have recipes.</p>
                  )}
                </div>
                <Button variant="outline" onClick={() => regenerate(scope)}>↻ Regenerate</Button>
              </>
            )}
          </div>
          <WeekGrid
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plan={plan as any}
            monday={monday}
            singleDay={isDesktop ? undefined : day}
            onRefresh={refresh}
          />
        </>
      )}
    </div>
  )
}
