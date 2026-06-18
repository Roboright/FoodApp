"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useProfile } from "@/components/layout/ProfileContext"
import { calculateTargets } from "@/lib/nutrition"

type ProfileDraft = {
  name: string
  goal: "RECOMPOSITION" | "WEIGHT_LOSS" | "MAINTENANCE"
  sex: "MALE" | "FEMALE"
  weightKg: string
  heightCm: string
  age: string
  activityLevel: string
  proteinCapG: string
  notes: string
}

const defaultDraft = (): ProfileDraft => ({
  name: "",
  goal: "WEIGHT_LOSS",
  sex: "MALE",
  weightKg: "",
  heightCm: "",
  age: "",
  activityLevel: "MODERATELY_ACTIVE",
  proteinCapG: "",
  notes: "",
})

const ACTIVITY_OPTIONS = [
  { value: "SEDENTARY", label: "Sedentary (desk job, no exercise)" },
  { value: "LIGHTLY_ACTIVE", label: "Lightly active (1-2x/week)" },
  { value: "MODERATELY_ACTIVE", label: "Moderately active (3-5x/week)" },
  { value: "VERY_ACTIVE", label: "Very active (hard exercise 6-7x/week)" },
  { value: "EXTREMELY_ACTIVE", label: "Extremely active (physical job + training)" },
]

const GOAL_OPTIONS = [
  { value: "WEIGHT_LOSS", label: "Lose weight" },
  { value: "RECOMPOSITION", label: "Lose fat, gain muscle" },
  { value: "MAINTENANCE", label: "Maintain weight" },
]

function ProfileForm({
  draft,
  onChange,
  label,
}: {
  draft: ProfileDraft
  onChange: (d: ProfileDraft) => void
  label: string
}) {
  const set = (key: keyof ProfileDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [key]: e.target.value })

  const preview =
    draft.weightKg && draft.heightCm && draft.age && draft.sex && draft.activityLevel
      ? calculateTargets({
          weightKg: parseFloat(draft.weightKg),
          heightCm: parseFloat(draft.heightCm),
          age: parseInt(draft.age),
          sex: draft.sex,
          activityLevel: draft.activityLevel,
          goal: draft.goal,
        })
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Name">
          <input className="input" value={draft.name} onChange={set("name")} placeholder="e.g. Rob" />
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

        <Field label="Protein cap (g/day, optional)">
          <input className="input" type="number" value={draft.proteinCapG} onChange={set("proteinCapG")} placeholder="e.g. 100" />
        </Field>

        <Field label="Notes (allergies, preferences)">
          <textarea className="input min-h-[60px]" value={draft.notes} onChange={set("notes")} placeholder="e.g. skin reacts to high protein" />
        </Field>

        {preview && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p className="font-medium">Calculated targets</p>
            <p className="text-muted-foreground">
              {preview.calories} kcal · {preview.proteinG}g protein · {preview.carbG}g carbs · {preview.fatG}g fat
            </p>
            <p className="text-xs text-muted-foreground">You can adjust these after saving.</p>
          </div>
        )}
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

export default function OnboardingPage() {
  const router = useRouter()
  const { refetch } = useProfile()
  const [profiles, setProfiles] = useState<ProfileDraft[]>([defaultDraft(), defaultDraft()])
  profiles[0].name = profiles[0].name || ""
  profiles[1].name = profiles[1].name || ""
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const update = (i: number) => (d: ProfileDraft) => {
    const next = [...profiles]
    next[i] = d
    setProfiles(next)
  }

  const save = async () => {
    setError("")
    for (const p of profiles) {
      if (!p.name.trim()) { setError("Both profiles need a name."); return }
    }
    setSaving(true)
    try {
      for (const p of profiles) {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name.trim(),
            goal: p.goal,
            sex: p.sex,
            weightKg: p.weightKg ? parseFloat(p.weightKg) : null,
            heightCm: p.heightCm ? parseFloat(p.heightCm) : null,
            age: p.age ? parseInt(p.age) : null,
            activityLevel: p.activityLevel,
            proteinCapG: p.proteinCapG ? parseInt(p.proteinCapG) : null,
            notes: p.notes || null,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Failed to save profile "${p.name.trim()}" (${res.status})`)
        }
      }
      await refetch()
      router.push("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Set up profiles</h1>
        <p className="text-muted-foreground mt-1">
          Enter details for both people. Calorie and macro targets will be calculated automatically.
        </p>
      </div>

      <ProfileForm draft={profiles[0]} onChange={update(0)} label="Profile 1" />
      <ProfileForm draft={profiles[1]} onChange={update(1)} label="Profile 2" />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save profiles and start planning"}
      </Button>
    </div>
  )
}
