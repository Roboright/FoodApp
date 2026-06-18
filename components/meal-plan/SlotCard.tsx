"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { scaledNutrition, formatCalories, formatMacro } from "@/lib/nutrition"
import { cn } from "@/lib/utils"
import type { MealType } from "@prisma/client"

const MEAL_BORDER: Record<MealType, string> = {
  BREAKFAST: "border-l-amber-400",
  LUNCH:     "border-l-emerald-400",
  DINNER:    "border-l-indigo-400",
  SNACK_1:   "border-l-orange-400",
  SNACK_2:   "border-l-rose-400",
}

type Recipe = {
  id: string
  title: string
  servings: number
  starred: boolean
  nutrition: { calories: number; proteinG: number; carbG: number; fatG: number; sugarG?: number | null } | null
}

type RecipeDetail = Recipe & {
  description: string | null
  prepMinutes: number | null
  cookMinutes: number | null
  instructions: string | null
  tags: string[]
  recipeIngredients: {
    id: string
    quantity: number
    unit: string
    notes: string | null
    ingredient: { name: string }
  }[]
}

type Profile = { id: string; name: string }

type SlotProfile = {
  profile: Profile
  servingFraction: number
  portionNote: string | null
  calories: number | null
  proteinG: number | null
  carbG: number | null
  fatG: number | null
}

type SlotCardProps = {
  mealPlanId: string
  date: string
  mealType: MealType
  slotId?: string
  recipe?: Recipe | null
  servingsOverride?: number | null
  notes?: string | null
  attendees: Profile[]
  slotProfiles?: SlotProfile[]
  allProfiles: Profile[]
  onUpdate: () => void
}

export function SlotCard({
  mealPlanId,
  date,
  mealType,
  slotId,
  recipe,
  servingsOverride,
  notes,
  attendees,
  slotProfiles,
  allProfiles,
  onUpdate,
}: SlotCardProps) {
  const [open, setOpen] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState("")
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(
    attendees.map((a) => a.id)
  )
  const [generatePrompt, setGeneratePrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState("")

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [details, setDetails] = useState<RecipeDetail | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [starring, setStarring] = useState(false)

  const nutrition =
    recipe?.nutrition
      ? scaledNutrition(recipe.nutrition, recipe.servings, servingsOverride ?? null)
      : null

  const openDetails = async () => {
    if (!recipe) return
    setDetailsOpen(true)
    setLoadingDetails(true)
    const res = await fetch(`/api/recipes/${recipe.id}`)
    setDetails(await res.json())
    setLoadingDetails(false)
  }

  const toggleStar = async () => {
    if (!details) return
    setStarring(true)
    const next = !details.starred
    setDetails((d) => d ? { ...d, starred: next } : d)
    await fetch(`/api/recipes/${details.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    })
    setStarring(false)
  }

  const openDialog = async () => {
    setOpen(true)
    setSelectedAttendees(attendees.map((a) => a.id))
    setGeneratePrompt("")
    setGenerateError("")
    if (recipes.length === 0) {
      setLoadingRecipes(true)
      const res = await fetch("/api/recipes")
      setRecipes(await res.json())
      setLoadingRecipes(false)
    }
  }

  const generateRecipe = async () => {
    setGenerating(true)
    setGenerateError("")
    try {
      const profileIds = selectedAttendees.length > 0 ? selectedAttendees : allProfiles.map((p) => p.id)
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealPlanId,
          slotId,
          date,
          mealType,
          profileIds,
          userPrompt: generatePrompt.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      setOpen(false)
      onUpdate()
    } catch {
      setGenerateError("Generation failed — please try again.")
    }
    setGenerating(false)
  }

  const assignRecipe = async (recipeId: string | null) => {
    await fetch(
      slotId
        ? `/api/meal-plans/${mealPlanId}/slots/${slotId}`
        : `/api/meal-plans/${mealPlanId}/slots`,
      {
        method: slotId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealType, recipeId, profileIds: selectedAttendees }),
      }
    )
    setOpen(false)
    onUpdate()
  }

  const clearSlot = async () => {
    if (slotId) {
      await fetch(`/api/meal-plans/${mealPlanId}/slots/${slotId}`, { method: "DELETE" })
      onUpdate()
    }
  }

  const toggleAttendee = async (profileId: string) => {
    const next = selectedAttendees.includes(profileId)
      ? selectedAttendees.filter((id) => id !== profileId)
      : [...selectedAttendees, profileId]
    setSelectedAttendees(next)

    if (slotId) {
      await fetch(`/api/meal-plans/${mealPlanId}/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: next }),
      })
      onUpdate()
    }
  }

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group relative rounded-lg border text-sm transition-colors",
          recipe
            ? `bg-card border-l-4 p-2 shadow-sm ${MEAL_BORDER[mealType]}`
            : "border-dashed bg-muted/20 hover:bg-muted/40 cursor-pointer p-2"
        )}
      >
        {recipe ? (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-1">
              <button
                className="font-medium leading-tight line-clamp-2 text-left hover:underline"
                onClick={openDetails}
              >
                {recipe.title}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={openDialog}
              >
                <PencilIcon />
              </Button>
            </div>

            {nutrition && (
              <div className="flex gap-1 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0 text-xs font-medium text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  {formatCalories(nutrition.calories)}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  P {formatMacro(nutrition.proteinG)}
                </span>
              </div>
            )}

            <div className="flex gap-1 flex-wrap">
              {allProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleAttendee(p.id)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                    selectedAttendees.includes(p.id)
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {notes && <p className="text-xs text-muted-foreground italic">{notes}</p>}
          </div>
        ) : (
          <button
            className="w-full h-full min-h-[3rem] flex items-center justify-center text-muted-foreground"
            onClick={openDialog}
          >
            <PlusIcon />
          </button>
        )}
      </div>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign recipe</DialogTitle>
        </DialogHeader>

        {/* AI generation */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Generate with AI</p>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Any requests? (optional — e.g. 'something with chicken')"
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !generating && generateRecipe()}
            disabled={generating}
          />
          <Button
            onClick={generateRecipe}
            disabled={generating}
            className="w-full"
          >
            {generating ? "Generating…" : "✨ Generate recipe"}
          </Button>
          {generateError && <p className="text-xs text-destructive">{generateError}</p>}
        </div>

        <Separator />

        {/* Browse existing */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Or browse existing</p>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {loadingRecipes && <p className="text-sm text-muted-foreground p-2">Loading…</p>}
            {!loadingRecipes && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground p-2">No recipes found.</p>
            )}
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => assignRecipe(r.id)}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  {r.starred && <span className="text-amber-400 shrink-0">★</span>}
                  <span className="truncate">{r.title}</span>
                </span>
                {r.nutrition && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {Math.round(r.nutrition.calories / r.servings)} kcal/srv
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {recipe && (
          <Button variant="destructive" size="sm" onClick={clearSlot}>
            Remove recipe
          </Button>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-w-none sm:max-w-none w-[95vw] lg:w-[90vw] xl:w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="flex-1">{recipe?.title}</DialogTitle>
            {details && (
              <button
                onClick={toggleStar}
                disabled={starring}
                className={cn(
                  "text-2xl leading-none transition-colors shrink-0",
                  details.starred ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"
                )}
                title={details.starred ? "Unstar recipe" : "Star recipe"}
              >
                ★
              </button>
            )}
          </div>
        </DialogHeader>

        {loadingDetails && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loadingDetails && details && (
          <div className="space-y-4">
            {details.description && <p className="text-sm text-muted-foreground">{details.description}</p>}

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {details.prepMinutes != null && <span>Prep {details.prepMinutes} min</span>}
              {details.cookMinutes != null && <span>· Cook {details.cookMinutes} min</span>}
              <span>· Makes {details.servings} servings</span>
            </div>

            {details.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {details.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              {/* Ingredients */}
              {details.recipeIngredients.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ingredients (whole recipe)</p>
                  <ul className="text-sm space-y-0.5">
                    {details.recipeIngredients.map((ri) => (
                      <li key={ri.id} className="flex justify-between gap-2">
                        <span>{ri.ingredient.name}{ri.notes ? ` (${ri.notes})` : ""}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {ri.quantity % 1 === 0 ? ri.quantity : ri.quantity.toFixed(1)} {ri.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cooking instructions */}
              {details.instructions && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cooking instructions</p>
                  <ol className="text-sm space-y-1.5 list-decimal list-inside">
                    {details.instructions.split("\n").map((line) => line.trim()).filter(Boolean).map((line, i) => (
                      <li key={i} className="leading-snug">{line.replace(/^\d+[.)]\s*/, "")}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Per-person nutrition (guidance text lives in the cooking instructions, not duplicated here) */}
            {slotProfiles && slotProfiles.some((sp) => sp.calories !== null) && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your portion</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {slotProfiles.map((sp) => (
                    <div key={sp.profile.id} className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
                      <p className="text-sm font-semibold">{sp.profile.name}</p>
                      {sp.calories !== null && (
                        <div className="flex gap-1 flex-wrap pt-0.5">
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0 text-xs font-medium text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                            {formatCalories(sp.calories)}
                          </span>
                          {sp.proteinG !== null && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                              P {formatMacro(sp.proteinG)}
                            </span>
                          )}
                          {sp.carbG !== null && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300">
                              C {formatMacro(sp.carbG)}
                            </span>
                          )}
                          {sp.fatG !== null && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0 text-xs font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                              F {formatMacro(sp.fatG)}
                            </span>
                          )}
                          {details.nutrition?.sugarG != null && (
                            <span className="inline-flex items-center rounded-full bg-pink-100 px-1.5 py-0 text-xs font-medium text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                              S {formatMacro(details.nutrition.sugarG / details.servings * sp.servingFraction)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 16H9v-3z" />
    </svg>
  )
}
