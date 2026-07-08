"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useProfile } from "@/components/layout/ProfileContext"
import { calculateTargets } from "@/lib/nutrition"
import { cn } from "@/lib/utils"

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileData = {
  id: string
  name: string
  goal: "RECOMPOSITION" | "WEIGHT_LOSS" | "MAINTENANCE"
  sex: "MALE" | "FEMALE"
  weightKg: number | null
  heightCm: number | null
  age: number | null
  activityLevel: string
  proteinCapG: number | null
  sugarTarget: number | null
  fiberTarget: number | null
  notes: string | null
  calorieTarget: number | null
  proteinTarget: number | null
  carbTarget: number | null
  fatTarget: number | null
}

type Draft = {
  name: string
  goal: "RECOMPOSITION" | "WEIGHT_LOSS" | "MAINTENANCE"
  sex: "MALE" | "FEMALE"
  weightKg: string
  heightCm: string
  age: string
  activityLevel: string
  proteinCapG: string
  sugarTarget: string
  fiberTarget: string
  notes: string
  // Manual macro targets (calories is always derived)
  proteinTarget: string
  carbTarget: string
  fatTarget: string
}

type FoodItem = {
  id: string
  name: string
  brand: string | null
  unit: string
  quantity: number
  calories: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number | null
  fiberG: number | null
  source: "MANUAL" | "AI_ESTIMATED"
  notes: string | null
}

type FoodItemDraft = {
  name: string
  brand: string
  unit: string
  quantity: string
  calories: string
  proteinG: string
  carbG: string
  fatG: string
  sugarG: string
  fiberG: string
  notes: string
}

const EMPTY_FOOD_DRAFT: FoodItemDraft = {
  name: "", brand: "", unit: "g", quantity: "100",
  calories: "", proteinG: "", carbG: "", fatG: "",
  sugarG: "", fiberG: "", notes: "",
}

// ─── Profile settings ─────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  { value: "SEDENTARY", label: "Sedentary (desk job, no exercise)" },
  { value: "LIGHTLY_ACTIVE", label: "Lightly active (1–2×/week)" },
  { value: "MODERATELY_ACTIVE", label: "Moderately active (3–5×/week)" },
  { value: "VERY_ACTIVE", label: "Very active (hard exercise 6–7×/week)" },
  { value: "EXTREMELY_ACTIVE", label: "Extremely active (physical job + training)" },
]

const GOAL_OPTIONS = [
  { value: "WEIGHT_LOSS", label: "Lose weight" },
  { value: "RECOMPOSITION", label: "Lose fat, gain muscle" },
  { value: "MAINTENANCE", label: "Maintain weight" },
]

function toDraft(p: ProfileData): Draft {
  return {
    name: p.name,
    goal: p.goal,
    sex: p.sex,
    weightKg: p.weightKg?.toString() ?? "",
    heightCm: p.heightCm?.toString() ?? "",
    age: p.age?.toString() ?? "",
    activityLevel: p.activityLevel ?? "MODERATELY_ACTIVE",
    proteinCapG: p.proteinCapG?.toString() ?? "",
    sugarTarget: p.sugarTarget?.toString() ?? "",
    fiberTarget: p.fiberTarget?.toString() ?? "",
    notes: p.notes ?? "",
    proteinTarget: p.proteinTarget?.toString() ?? "",
    carbTarget: p.carbTarget?.toString() ?? "",
    fatTarget: p.fatTarget?.toString() ?? "",
  }
}

function ProfileCard({ profile, onSaved }: { profile: ProfileData; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const set = (key: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }))

  const calculated =
    draft.weightKg && draft.heightCm && draft.age
      ? calculateTargets({
          weightKg: parseFloat(draft.weightKg),
          heightCm: parseFloat(draft.heightCm),
          age: parseInt(draft.age),
          sex: draft.sex,
          activityLevel: draft.activityLevel,
          goal: draft.goal,
        })
      : null

  const p = parseFloat(draft.proteinTarget) || 0
  const c = parseFloat(draft.carbTarget) || 0
  const f = parseFloat(draft.fatTarget) || 0
  const derivedCalories = Math.round(p * 4 + c * 4 + f * 9)
  const hasTargets = p > 0 || c > 0 || f > 0

  const resetToCalculated = () => {
    if (!calculated) return
    setDraft((d) => ({
      ...d,
      proteinTarget: calculated.proteinG.toString(),
      carbTarget: calculated.carbG.toString(),
      fatTarget: calculated.fatG.toString(),
    }))
  }

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          goal: draft.goal,
          sex: draft.sex,
          weightKg: draft.weightKg ? parseFloat(draft.weightKg) : null,
          heightCm: draft.heightCm ? parseFloat(draft.heightCm) : null,
          age: draft.age ? parseInt(draft.age) : null,
          activityLevel: draft.activityLevel,
          proteinCapG: draft.proteinCapG ? parseInt(draft.proteinCapG) : null,
          sugarTarget: draft.sugarTarget ? parseInt(draft.sugarTarget) : null,
          fiberTarget: draft.fiberTarget ? parseInt(draft.fiberTarget) : null,
          notes: draft.notes || null,
          ...(hasTargets ? {
            proteinTarget: Math.round(p),
            carbTarget: Math.round(c),
            fatTarget: Math.round(f),
          } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch {
      setError("Something went wrong.")
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle>{profile.name}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Name">
          <input className="input" value={draft.name} onChange={set("name")} />
        </Field>
        <Field label="Goal">
          <select className="input" value={draft.goal} onChange={set("goal")}>
            {GOAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sex">
            <select className="input" value={draft.sex} onChange={set("sex")}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </Field>
          <Field label="Age">
            <input className="input" type="number" value={draft.age} onChange={set("age")} placeholder="30" />
          </Field>
          <Field label="Weight (kg)">
            <input className="input" type="number" value={draft.weightKg} onChange={set("weightKg")} placeholder="70" />
          </Field>
          <Field label="Height (cm)">
            <input className="input" type="number" value={draft.heightCm} onChange={set("heightCm")} placeholder="175" />
          </Field>
        </div>
        <Field label="Activity level">
          <select className="input" value={draft.activityLevel} onChange={set("activityLevel")}>
            {ACTIVITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Protein cap (g/day)">
          <input className="input" type="number" value={draft.proteinCapG} onChange={set("proteinCapG")} placeholder="e.g. 100" />
        </Field>
        <Field label="Notes">
          <textarea className="input min-h-[60px]" value={draft.notes} onChange={set("notes")} />
        </Field>
        {/* Macro targets */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium">Daily macro targets</label>
            {calculated && (
              <button
                type="button"
                onClick={resetToCalculated}
                className="text-xs text-primary hover:underline"
              >
                Reset to calculated ({calculated.proteinG}P · {calculated.carbG}C · {calculated.fatG}F)
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protein (g)">
              <input className="input" type="number" min="0" value={draft.proteinTarget} onChange={set("proteinTarget")} placeholder={calculated?.proteinG.toString() ?? "0"} />
            </Field>
            <Field label="Carbs (g)">
              <input className="input" type="number" min="0" value={draft.carbTarget} onChange={set("carbTarget")} placeholder={calculated?.carbG.toString() ?? "0"} />
            </Field>
            <Field label="Fat (g)">
              <input className="input" type="number" min="0" value={draft.fatTarget} onChange={set("fatTarget")} placeholder={calculated?.fatG.toString() ?? "0"} />
            </Field>
            <Field label="Sugar limit (g)">
              <input className="input" type="number" min="0" value={draft.sugarTarget} onChange={set("sugarTarget")} placeholder="e.g. 30" />
            </Field>
            <Field label="Fiber target (g)">
              <input className="input" type="number" min="0" value={draft.fiberTarget} onChange={set("fiberTarget")} placeholder="e.g. 30" />
            </Field>
          </div>
          {hasTargets && (
            <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Total calories</span>
              <span className="font-semibold tabular-nums">{derivedCalories} kcal</span>
            </div>
          )}
          {!hasTargets && calculated && (
            <p className="text-xs text-muted-foreground">
              No manual targets set — using calculated: {calculated.calories} kcal · {calculated.proteinG}g P · {calculated.carbG}g C · {calculated.fatG}g F
            </p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

// ─── Food items tab ───────────────────────────────────────────────────────────

function FoodItemRow({
  item,
  onUpdated,
  onDeleted,
}: {
  item: FoodItem
  onUpdated: (updated: FoodItem) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<FoodItemDraft>({
    name: item.name,
    brand: item.brand ?? "",
    unit: item.unit,
    quantity: item.quantity.toString(),
    calories: item.calories.toString(),
    proteinG: item.proteinG.toString(),
    carbG: item.carbG.toString(),
    fatG: item.fatG.toString(),
    sugarG: item.sugarG?.toString() ?? "",
    fiberG: item.fiberG?.toString() ?? "",
    notes: item.notes ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const n = (v: string) => v ? parseFloat(v) : null

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/food-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        brand: draft.brand.trim() || null,
        unit: draft.unit,
        quantity: n(draft.quantity),
        calories: n(draft.calories),
        proteinG: n(draft.proteinG),
        carbG: n(draft.carbG),
        fatG: n(draft.fatG),
        sugarG: n(draft.sugarG),
        fiberG: n(draft.fiberG),
        notes: draft.notes.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onUpdated(await res.json())
      setEditing(false)
    }
  }

  const del = async () => {
    if (!confirm(`Delete "${item.name}"?`)) return
    setDeleting(true)
    await fetch(`/api/food-items/${item.id}`, { method: "DELETE" })
    onDeleted(item.id)
  }

  const inp = (key: keyof FoodItemDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  if (editing) {
    return (
      <tr className="bg-muted/30">
        <td className="px-3 py-2" colSpan={10}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <input className="input text-sm" value={draft.name} onChange={inp("name")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Brand</label>
              <input className="input text-sm" value={draft.brand} onChange={inp("brand")} placeholder="optional" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Unit</label>
                <select className="input text-sm" value={draft.unit} onChange={inp("unit")}>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Qty</label>
                <input className="input text-sm" type="number" value={draft.quantity} onChange={inp("quantity")} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
            {(["calories", "proteinG", "carbG", "fatG", "sugarG", "fiberG"] as const).map((key) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground">
                  {key === "calories" ? "kcal" : key === "proteinG" ? "protein" : key === "carbG" ? "carbs" : key === "fatG" ? "fat" : key === "sugarG" ? "sugar" : "fiber"}
                </label>
                <input className="input text-sm" type="number" value={draft[key]} onChange={inp(key)} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-muted/20 group">
      <td className="px-3 py-2 font-medium text-sm">
        {item.name}
        {item.brand && <span className="ml-1 text-xs text-muted-foreground">({item.brand})</span>}
      </td>
      <td className="px-2 py-2 text-sm text-muted-foreground">{item.quantity}{item.unit}</td>
      <td className="px-2 py-2 text-sm tabular-nums text-right">{Math.round(item.calories)}</td>
      <td className="px-2 py-2 text-sm tabular-nums text-right text-blue-600 dark:text-blue-400">{Math.round(item.proteinG)}g</td>
      <td className="px-2 py-2 text-sm tabular-nums text-right text-amber-600 dark:text-amber-400">{Math.round(item.carbG)}g</td>
      <td className="px-2 py-2 text-sm tabular-nums text-right text-rose-600 dark:text-rose-400">{Math.round(item.fatG)}g</td>
      <td className="px-2 py-2 text-sm tabular-nums text-right text-pink-600 dark:text-pink-400">{item.sugarG != null ? `${Math.round(item.sugarG)}g` : "—"}</td>
      <td className="px-2 py-2 text-sm tabular-nums text-right text-green-600 dark:text-green-400">{item.fiberG != null ? `${Math.round(item.fiberG)}g` : "—"}</td>
      <td className="px-2 py-2 text-xs text-center">
        <span className={cn(
          "inline-block rounded-full px-1.5 py-0.5",
          item.source === "MANUAL"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        )}>
          {item.source === "MANUAL" ? "manual" : "AI"}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">Edit</button>
          <button onClick={del} disabled={deleting} className="text-xs px-2 py-1 rounded bg-muted hover:bg-destructive/10 text-destructive">Del</button>
        </div>
      </td>
    </tr>
  )
}

function AddFoodItemRow({ onAdded }: { onAdded: (item: FoodItem) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FoodItemDraft>(EMPTY_FOOD_DRAFT)
  const [saving, setSaving] = useState(false)

  const inp = (key: keyof FoodItemDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  const n = (v: string) => v ? parseFloat(v) : null

  const save = async () => {
    if (!draft.name.trim() || !draft.calories) return
    setSaving(true)
    const res = await fetch("/api/food-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        brand: draft.brand.trim() || null,
        unit: draft.unit,
        quantity: n(draft.quantity) ?? 100,
        calories: n(draft.calories) ?? 0,
        proteinG: n(draft.proteinG) ?? 0,
        carbG: n(draft.carbG) ?? 0,
        fatG: n(draft.fatG) ?? 0,
        sugarG: n(draft.sugarG),
        fiberG: n(draft.fiberG),
        notes: draft.notes.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onAdded(await res.json())
      setDraft(EMPTY_FOOD_DRAFT)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={9} className="px-3 py-2">
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-primary hover:underline"
          >
            + Add food item
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-primary/5 border-t border-border">
      <td className="px-3 py-2" colSpan={9}>
        <p className="text-xs font-medium text-muted-foreground mb-2">New food item</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Name *</label>
            <input className="input text-sm" value={draft.name} onChange={inp("name")} placeholder="e.g. Skyr Lidl" autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Brand</label>
            <input className="input text-sm" value={draft.brand} onChange={inp("brand")} placeholder="optional" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Unit</label>
              <select className="input text-sm" value={draft.unit} onChange={inp("unit")}>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ref qty</label>
              <input className="input text-sm" type="number" value={draft.quantity} onChange={inp("quantity")} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
          {(["calories", "proteinG", "carbG", "fatG", "sugarG", "fiberG"] as const).map((key) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground">
                {key === "calories" ? "kcal *" : key === "proteinG" ? "protein" : key === "carbG" ? "carbs" : key === "fatG" ? "fat" : key === "sugarG" ? "sugar" : "fiber"}
              </label>
              <input className="input text-sm" type="number" value={draft[key]} onChange={inp(key)} placeholder="0" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !draft.name.trim()}>{saving ? "Saving…" : "Add"}</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </td>
    </tr>
  )
}

function FoodItemsTab() {
  const [items, setItems] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [populating, setPopulating] = useState(false)
  const [populateResult, setPopulateResult] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const reload = () => fetch("/api/food-items").then((r) => r.json()).then(setItems)

  useEffect(() => {
    fetch("/api/food-items")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false) })
  }, [])

  const populate = async () => {
    setPopulating(true)
    setPopulateResult(null)
    const res = await fetch("/api/food-items/populate", { method: "POST" })
    const data = await res.json()
    await reload()
    const parts = []
    if (data.fromRecipes > 0) parts.push(`${data.fromRecipes} from recipes`)
    if (data.fromLogs > 0) parts.push(`${data.fromLogs} from logged items`)
    setPopulateResult(data.added > 0 ? `Added ${data.added} item${data.added !== 1 ? "s" : ""} (${parts.join(", ")}).` : "No new items found.")
    setPopulating(false)
  }

  const cleanup = async () => {
    setCleaning(true)
    setCleanResult(null)
    const res = await fetch("/api/food-items/cleanup", { method: "POST" })
    const data = await res.json()
    await reload()
    setCleanResult(`Cleaned up: ${data.corrections} correction${data.corrections !== 1 ? "s" : ""}, ${data.deletions} duplicate${data.deletions !== 1 ? "s" : ""} removed.`)
    setCleaning(false)
  }

  const [copied, setCopied] = useState(false)
  const copyToClipboard = () => {
    const header = ["Name", "Brand", "Unit", "Qty", "kcal", "Protein (g)", "Carbs (g)", "Fat (g)", "Sugar (g)", "Fiber (g)", "Source", "Notes"].join("\t")
    const rows = items.map((i) => [
      i.name,
      i.brand ?? "",
      i.unit,
      i.quantity,
      i.calories,
      i.proteinG,
      i.carbG,
      i.fatG,
      i.sugarG ?? "",
      i.fiberG ?? "",
      i.source,
      i.notes ?? "",
    ].join("\t"))
    const text = [header, ...rows].join("\n")
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => copyFallback(text))
    } else {
      copyFallback(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyFallback = (text: string) => {
    const el = document.createElement("textarea")
    el.value = text
    el.style.cssText = "position:fixed;opacity:0"
    document.body.appendChild(el)
    el.select()
    document.execCommand("copy")
    document.body.removeChild(el)
  }

  const filtered = items.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.brand ?? "").toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <p className="text-muted-foreground py-10 text-center text-sm">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-[160px]"
          placeholder="Search food items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" onClick={populate} disabled={populating || cleaning} className="shrink-0 gap-2">
          {populating && <Spinner />}
          {populating ? "Scanning…" : "Populate from recipes & logs"}
        </Button>
        <Button variant="outline" onClick={cleanup} disabled={cleaning || populating} className="shrink-0 gap-2">
          {cleaning && <Spinner />}
          {cleaning ? "Cleaning…" : "Clean up & deduplicate"}
        </Button>
        <Button variant="outline" onClick={copyToClipboard} disabled={items.length === 0} className="shrink-0">
          {copied ? "Copied ✓" : "Copy to clipboard"}
        </Button>
      </div>

      {populateResult && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{populateResult}</p>
      )}
      {cleanResult && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{cleanResult}</p>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground">Per</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground">kcal</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground">protein</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground">carbs</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground">fat</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground">sugar</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground">fiber</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground">source</th>
                <th className="w-20 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <FoodItemRow
                  key={item.id}
                  item={item}
                  onUpdated={(updated) => setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))}
                  onDeleted={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                />
              ))}
              <AddFoodItemRow onAdded={(item) => setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))} />
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {search ? "No items match your search." : "No food items yet. Add one below or scan from recipes."}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { profiles: ctxProfiles, refetch } = useProfile()
  const [profiles, setProfiles] = useState<ProfileData[]>([])
  const [tab, setTab] = useState<"profiles" | "food-items">("profiles")

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then(setProfiles)
  }, [])

  const reload = () => {
    fetch("/api/profiles").then((r) => r.json()).then(setProfiles)
    refetch()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        <button
          onClick={() => setTab("profiles")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
            tab === "profiles" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Profiles
        </button>
        <button
          onClick={() => setTab("food-items")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
            tab === "food-items" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Food items
        </button>
      </div>

      {tab === "profiles" ? (
        profiles.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center">No profiles found.</p>
        ) : (
          <div className="space-y-6">
            {profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} onSaved={reload} />
            ))}
          </div>
        )
      ) : (
        <FoodItemsTab />
      )}
    </div>
  )
}
