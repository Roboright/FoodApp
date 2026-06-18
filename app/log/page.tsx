"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { WeekLogGrid } from "@/components/meal-plan/WeekLogGrid"
import { LogExtraDialog } from "@/components/meal-plan/LogExtraDialog"
import { getMondayOfWeek, formatWeekLabel, formatWeekRelativeLabel, toDateString } from "@/lib/week"
import { useProfile } from "@/components/layout/ProfileContext"
import Link from "next/link"

type LogEntry = { id: string; profileId: string }

type Slot = {
  id: string
  date: string
  mealType: string
  recipe: { id: string; title: string } | null
  profiles: Array<{ profile: { id: string; name: string } }>
  logs: LogEntry[]
}

type MealPlan = {
  id: string
  weekStartDate: string
  mealSlots: Slot[]
}

export type ExtraLog = {
  id: string
  profileId: string
  loggedAt: string
  description: string | null
  caloriesOverride: number | null
  proteinOverride: number | null
  carbOverride: number | null
  fatOverride: number | null
  sugarOverride: number | null
}

export default function LogPage() {
  const { profiles, loading } = useProfile()
  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()))
  const [showLogExtra, setShowLogExtra] = useState(false)
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [extraLogs, setExtraLogs] = useState<ExtraLog[]>([])
  const [fetching, setFetching] = useState(false)
  const [eatenMap, setEatenMap] = useState<Record<string, string | null>>({})
  const [fetchVersion, setFetchVersion] = useState(0)

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

      let currentPlan: MealPlan | null = null
      if (existing) {
        const detail = await fetch(`/api/meal-plans/${existing.id}`)
        if (!cancelled) currentPlan = await detail.json()
      }

      const extrasRes = await fetch(`/api/meal-logs?weekStart=${mondayStr}&logType=AD_HOC`)
      const extras: ExtraLog[] = cancelled ? [] : await extrasRes.json()

      if (!cancelled) {
        setPlan(currentPlan)
        setExtraLogs(extras)
        const map: Record<string, string | null> = {}
        if (currentPlan) {
          for (const slot of currentPlan.mealSlots) {
            for (const sp of slot.profiles) {
              const log = slot.logs.find((l) => l.profileId === sp.profile.id)
              map[`${slot.id}:${sp.profile.id}`] = log?.id ?? null
            }
          }
        }
        setEatenMap(map)
        setFetching(false)
      }
    })

    return () => { cancelled = true }
  }, [monday, fetchVersion, loading])

  const toggle = async (slot: Slot, profileId: string) => {
    const key = `${slot.id}:${profileId}`
    const currentLogId = eatenMap[key]

    if (currentLogId && currentLogId !== "pending") {
      setEatenMap((prev) => ({ ...prev, [key]: null }))
      await fetch(`/api/meal-logs/${currentLogId}`, { method: "DELETE" })
    } else if (!currentLogId) {
      setEatenMap((prev) => ({ ...prev, [key]: "pending" }))
      const res = await fetch("/api/meal-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealSlotId: slot.id,
          profileId,
          recipeId: slot.recipe?.id ?? null,
          logType: "AS_PLANNED",
        }),
      })
      const log = await res.json()
      setEatenMap((prev) => ({ ...prev, [key]: log.id }))
    }
  }

  const createLog = async (slot: Slot, profileId: string): Promise<string> => {
    const res = await fetch("/api/meal-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealSlotId: slot.id,
        profileId,
        recipeId: slot.recipe?.id ?? null,
        logType: "AS_PLANNED",
      }),
    })
    const log = await res.json()
    return log.id
  }

  const toggleSlot = async (slot: Slot) => {
    const allEaten = slot.profiles.every((sp) => !!eatenMap[`${slot.id}:${sp.profile.id}`])
    if (allEaten) {
      const toDelete = slot.profiles
        .map((sp) => ({ key: `${slot.id}:${sp.profile.id}`, logId: eatenMap[`${slot.id}:${sp.profile.id}`] }))
        .filter(({ logId }) => logId && logId !== "pending")
      const updates = Object.fromEntries(toDelete.map(({ key }) => [key, null]))
      setEatenMap((prev) => ({ ...prev, ...updates }))
      await Promise.all(toDelete.map(({ logId }) => fetch(`/api/meal-logs/${logId}`, { method: "DELETE" })))
    } else {
      const toMark = slot.profiles.filter((sp) => !eatenMap[`${slot.id}:${sp.profile.id}`])
      const pendingUpdates = Object.fromEntries(toMark.map((sp) => [`${slot.id}:${sp.profile.id}`, "pending"]))
      setEatenMap((prev) => ({ ...prev, ...pendingUpdates }))
      const ids = await Promise.all(toMark.map((sp) => createLog(slot, sp.profile.id)))
      const finalUpdates = Object.fromEntries(toMark.map((sp, i) => [`${slot.id}:${sp.profile.id}`, ids[i]]))
      setEatenMap((prev) => ({ ...prev, ...finalUpdates }))
    }
  }

  const toggleDay = async (dateStr: string) => {
    if (!plan) return
    const daySlots = plan.mealSlots.filter(
      (s) => s.date.startsWith(dateStr) && s.profiles.length > 0 && s.recipe
    )
    const allEaten = daySlots.every((s) =>
      s.profiles.every((sp) => !!eatenMap[`${s.id}:${sp.profile.id}`])
    )
    if (allEaten) {
      const toDelete = daySlots.flatMap((slot) =>
        slot.profiles
          .map((sp) => ({ key: `${slot.id}:${sp.profile.id}`, logId: eatenMap[`${slot.id}:${sp.profile.id}`] }))
          .filter(({ logId }) => logId && logId !== "pending")
      )
      const updates = Object.fromEntries(toDelete.map(({ key }) => [key, null]))
      setEatenMap((prev) => ({ ...prev, ...updates }))
      await Promise.all(toDelete.map(({ logId }) => fetch(`/api/meal-logs/${logId}`, { method: "DELETE" })))
    } else {
      const toMark = daySlots.flatMap((slot) =>
        slot.profiles
          .filter((sp) => !eatenMap[`${slot.id}:${sp.profile.id}`])
          .map((sp) => ({ slot, profileId: sp.profile.id }))
      )
      const pendingUpdates = Object.fromEntries(toMark.map(({ slot, profileId }) => [`${slot.id}:${profileId}`, "pending"]))
      setEatenMap((prev) => ({ ...prev, ...pendingUpdates }))
      const ids = await Promise.all(toMark.map(({ slot, profileId }) => createLog(slot, profileId)))
      const finalUpdates = Object.fromEntries(toMark.map(({ slot, profileId }, i) => [`${slot.id}:${profileId}`, ids[i]]))
      setEatenMap((prev) => ({ ...prev, ...finalUpdates }))
    }
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
        <Link href="/onboarding"><Button size="lg">Set up profiles</Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showLogExtra && (
        <LogExtraDialog
          profiles={profiles}
          onClose={() => setShowLogExtra(false)}
          onSaved={() => { setShowLogExtra(false); refresh() }}
        />
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>← Prev</Button>
        <div className="text-center">
          <h1 className="text-base font-semibold">{formatWeekRelativeLabel(monday)}</h1>
          <p className="text-xs text-muted-foreground">{formatWeekLabel(monday)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>Next →</Button>
      </div>

      <Button variant="outline" className="w-full" onClick={() => setShowLogExtra(true)}>
        + Log extra
      </Button>

      {fetching ? (
        <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
      ) : !plan && extraLogs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">No meal plan for this week.</p>
          <Link href="/"><Button>Go to Planner</Button></Link>
        </div>
      ) : (
        <>
          {!plan && (
            <p className="text-xs text-muted-foreground text-center">No meal plan — showing logged extras only.</p>
          )}
          <WeekLogGrid
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plan={plan ? (plan as any) : { id: "", mealSlots: [] }}
            monday={monday}
            profiles={profiles}
            eatenMap={eatenMap}
            extraLogs={extraLogs}
            onToggle={toggle}
            onToggleSlot={toggleSlot}
            onToggleDay={toggleDay}
            onExtrasChanged={refresh}
          />
        </>
      )}
    </div>
  )
}
