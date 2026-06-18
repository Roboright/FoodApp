"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AttendanceGrid } from "@/components/meal-plan/AttendanceGrid"
import { getMondayOfWeek, formatWeekLabel, formatWeekRelativeLabel, toDateString } from "@/lib/week"
import { useProfile } from "@/components/layout/ProfileContext"
import Link from "next/link"

type Slot = Parameters<typeof AttendanceGrid>[0]["slots"][number]

type MealPlan = {
  id: string
  weekStartDate: string
  status: string
  mealSlots: Slot[]
}

async function generateInBatches(
  slots: Slot[],
  planId: string,
  onProgress: (done: number, slot: Slot) => void,
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
      onProgress(++done, slot)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, slots.length) }, worker))
}

export default function HomePage() {
  const { profiles, loading } = useProfile()
  const [monday, setMonday] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return getMondayOfWeek(next)
  })
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [fetching, setFetching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchVersion, setFetchVersion] = useState(0)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)

  const refresh = useCallback(() => setFetchVersion((v) => v + 1), [])

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
      if (existing) {
        const detail = await fetch(`/api/meal-plans/${existing.id}`)
        if (!cancelled) setPlan(await detail.json())
      } else {
        setPlan(null)
      }
      if (!cancelled) setFetching(false)
    })

    return () => { cancelled = true }
  }, [monday, fetchVersion, loading])

  const deletePlan = async () => {
    if (!plan) return
    setDeleting(true)
    await fetch(`/api/meal-plans/${plan.id}`, { method: "DELETE" })
    setDeleting(false)
    refresh()
  }

  const createPlan = async () => {
    setCreating(true)
    await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStartDate: toDateString(monday) }),
    })
    setCreating(false)
    refresh()
  }

  const generateWeek = async () => {
    if (!plan) return
    const toGenerate = plan.mealSlots.filter((s) => s.profiles.length > 0 && !s.recipeId)
    if (toGenerate.length === 0) return
    setGenProgress({ done: 0, total: toGenerate.length })
    await generateInBatches(toGenerate, plan.id, (done, slot) => {
      setGenProgress({ done, total: toGenerate.length })
      // Mark the slot as having a recipe immediately so the dot turns green live
      setPlan((prev) => prev ? {
        ...prev,
        mealSlots: prev.mealSlots.map((s) =>
          s.id === slot.id ? { ...s, recipeId: "generated" } : s
        ),
      } : null)
    })
    setGenProgress(null)
    refresh()
  }

  const shiftWeek = (dir: number) => {
    setMonday((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + dir * 7)
      return d
    })
  }

  if (loading) return null

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Welcome to FoodPlanner</h1>
        <p className="text-muted-foreground max-w-sm">
          Set up your profiles first so we can track nutrition for each person.
        </p>
        <Link href="/onboarding">
          <Button size="lg">Set up profiles</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>← Prev</Button>
        <div className="text-center">
          <h1 className="text-base font-semibold">{formatWeekRelativeLabel(monday)}</h1>
          <p className="text-xs text-muted-foreground">{formatWeekLabel(monday)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>Next →</Button>
      </div>

      {fetching ? (
        <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
      ) : plan ? (
        <>
          {(() => {
            const missing = plan.mealSlots.filter((s) => s.profiles.length > 0 && !s.recipeId)
            return genProgress ? (
              <p className="text-sm text-muted-foreground text-center">
                Generating recipes… {genProgress.done} / {genProgress.total}
              </p>
            ) : missing.length > 0 ? (
              <Button onClick={generateWeek} className="w-full">
                ✨ Generate recipes for this week ({missing.length} missing)
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                All active slots have recipes. ✓
              </p>
            )
          })()}
          <AttendanceGrid
            planId={plan.id}
            monday={monday}
            profiles={profiles}
            slots={plan.mealSlots}
          />
          <div className="flex justify-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={deletePlan}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete plan for this week"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">No meal plan for this week yet.</p>
          <Button onClick={createPlan} disabled={creating}>
            {creating ? "Creating…" : "Create plan for this week"}
          </Button>
        </div>
      )}
    </div>
  )
}
