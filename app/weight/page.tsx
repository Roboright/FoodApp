"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getMondayOfWeek, formatWeekLabel, formatWeekRelativeLabel, getWeekDates, toDateString } from "@/lib/week"
import { useProfile } from "@/components/layout/ProfileContext"
import { cn } from "@/lib/utils"

type Entry = { id: string; weightKg: number }
type EntryMap = Record<string, Entry | undefined>  // key: "profileId:dateStr"

type Profile = {
  id: string
  name: string
  weightKg?: number | null
}

export default function WeightPage() {
  const { profiles, loading } = useProfile()
  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()))
  const [entries, setEntries] = useState<EntryMap>({})
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(async () => {
      if (cancelled) return
      setFetching(true)
      const res = await fetch(`/api/weight?weekStart=${toDateString(monday)}`)
      const data: Array<{ id: string; profileId: string; date: string; weightKg: number }> = await res.json()
      if (cancelled) return
      const map: EntryMap = {}
      for (const e of data) {
        const dateStr = e.date.split("T")[0]
        map[`${e.profileId}:${dateStr}`] = { id: e.id, weightKg: e.weightKg }
      }
      setEntries(map)
      setFetching(false)
    })
    return () => { cancelled = true }
  }, [monday])

  const save = async (profileId: string, dateStr: string, weightKg: number | null) => {
    const key = `${profileId}:${dateStr}`
    if (weightKg === null) {
      const existing = entries[key]
      if (!existing) return
      setEntries((prev) => { const next = { ...prev }; delete next[key]; return next })
      await fetch(`/api/weight/${existing.id}`, { method: "DELETE" })
    } else {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, date: dateStr, weightKg }),
      })
      const entry = await res.json()
      setEntries((prev) => ({ ...prev, [key]: { id: entry.id, weightKg: entry.weightKg } }))
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

  const days = getWeekDates(monday)
  const todayStr = toDateString(new Date())

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
      ) : (
        <>
          {/* Mobile: stacked by day */}
          <div className="block md:hidden space-y-3">
            {days.map((day) => {
              const dateStr = toDateString(day)
              const isToday = dateStr === todayStr
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              return (
                <div
                  key={dateStr}
                  className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", isWeekend && "opacity-60")}
                >
                  <div className={cn(
                    "px-3 py-2 text-sm font-semibold border-b",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                  )}>
                    {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                    {isWeekend && <span className="ml-2 font-normal opacity-70 text-xs">weekend</span>}
                    {isToday && <span className="ml-2 font-normal opacity-80 text-xs">today</span>}
                  </div>
                  <div className="divide-y">
                    {(profiles as Profile[]).map((profile) => {
                      const key = `${profile.id}:${dateStr}`
                      return (
                        <div key={profile.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                          <span className="text-sm font-medium w-16 shrink-0">{profile.name}</span>
                          <div className="flex items-center gap-1.5 flex-1 justify-end">
                            <WeightInput
                              key={entries[key]?.id ?? `empty:${key}`}
                              savedValue={entries[key]?.weightKg ?? null}
                              onSave={(kg) => save(profile.id, dateStr, kg)}
                            />
                            <span className="text-xs text-muted-foreground shrink-0">kg</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="w-28 py-3 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Name
                  </th>
                  {days.map((day) => {
                    const dateStr = toDateString(day)
                    const isToday = dateStr === todayStr
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
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
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(profiles as Profile[]).map((profile) => (
                  <tr key={profile.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3 pl-4 pr-3 text-sm font-medium">{profile.name}</td>
                    {days.map((day) => {
                      const dateStr = toDateString(day)
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6
                      const key = `${profile.id}:${dateStr}`
                      return (
                        <td
                          key={dateStr}
                          className={cn("py-2 px-2", isWeekend && "opacity-50 bg-muted/20")}
                        >
                          <div className="flex items-center gap-1">
                            <WeightInput
                              key={entries[key]?.id ?? `empty:${key}`}
                              savedValue={entries[key]?.weightKg ?? null}
                              onSave={(kg) => save(profile.id, dateStr, kg)}
                            />
                            <span className="text-xs text-muted-foreground shrink-0">kg</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function WeightInput({
  savedValue,
  onSave,
}: {
  savedValue: number | null
  onSave: (kg: number | null) => Promise<void>
}) {
  const [value, setValue] = useState(savedValue != null ? String(savedValue) : "")
  const [saving, setSaving] = useState(false)

  const handleBlur = async () => {
    const trimmed = value.trim()
    const parsed = trimmed === "" ? null : parseFloat(trimmed)

    if (trimmed !== "" && (isNaN(parsed!) || parsed! <= 0)) {
      setValue(savedValue != null ? String(savedValue) : "")
      return
    }

    if (parsed === savedValue) return
    if (parsed === null && savedValue === null) return

    setSaving(true)
    await onSave(parsed)
    setSaving(false)
  }

  return (
    <input
      type="number"
      step="0.1"
      min="0"
      max="999"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="—"
      disabled={saving}
      className={cn(
        "w-16 rounded border px-2 py-1 text-sm text-center bg-background",
        "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary",
        "disabled:opacity-40 transition-opacity",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        savedValue != null && "font-medium"
      )}
    />
  )
}
