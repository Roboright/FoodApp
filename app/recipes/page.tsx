"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatCalories, formatMacro } from "@/lib/nutrition"
import { cn } from "@/lib/utils"

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
}
const MEAL_TYPE_KEYS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const
type RecipeMealType = typeof MEAL_TYPE_KEYS[number]

type Recipe = {
  id: string
  title: string
  description: string | null
  servings: number
  prepMinutes: number | null
  cookMinutes: number | null
  tags: string[]
  mealTypes: string[]
  starred: boolean
  nutrition: { calories: number; proteinG: number; carbG: number; fatG: number } | null
}

type RecipeDetail = Recipe & {
  instructions: string
  recipeIngredients: {
    id: string
    quantity: number
    unit: string
    notes: string | null
    ingredient: { name: string }
  }[]
}

type RecipeFormData = {
  title: string
  description: string
  servings: string
  prepMinutes: string
  cookMinutes: string
  instructions: string
  tags: string
  calories: string
  proteinG: string
  carbG: string
  fatG: string
}

const emptyForm = (): RecipeFormData => ({
  title: "", description: "", servings: "2", prepMinutes: "", cookMinutes: "",
  instructions: "", tags: "", calories: "", proteinG: "", carbG: "", fatG: "",
})

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState("")
  const [starFilter, setStarFilter] = useState(false)
  const [mealTypeFilter, setMealTypeFilter] = useState<RecipeMealType | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<RecipeDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [starring, setStarring] = useState(false)

  const fetchRecipes = async () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (mealTypeFilter) params.set("mealType", mealTypeFilter)
    const res = await fetch(`/api/recipes${params.size ? `?${params}` : ""}`)
    setRecipes(await res.json())
  }

  useEffect(() => { fetchRecipes() }, [search, mealTypeFilter])

  const openDetail = async (recipe: Recipe) => {
    setDetailOpen(true)
    setLoadingDetail(true)
    setDetail(null)
    const res = await fetch(`/api/recipes/${recipe.id}`)
    setDetail(await res.json())
    setLoadingDetail(false)
  }

  const set = (key: keyof RecipeFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        servings: parseInt(form.servings) || 2,
        prepMinutes: form.prepMinutes ? parseInt(form.prepMinutes) : null,
        cookMinutes: form.cookMinutes ? parseInt(form.cookMinutes) : null,
        instructions: form.instructions,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        nutrition: form.calories ? {
          calories: parseFloat(form.calories),
          proteinG: parseFloat(form.proteinG) || 0,
          carbG: parseFloat(form.carbG) || 0,
          fatG: parseFloat(form.fatG) || 0,
        } : null,
      }),
    })
    setForm(emptyForm())
    setAddOpen(false)
    setSaving(false)
    await fetchRecipes()
  }

  const deleteRecipe = async (id: string) => {
    if (!confirm("Delete this recipe?")) return
    await fetch(`/api/recipes/${id}`, { method: "DELETE" })
    setDetailOpen(false)
    await fetchRecipes()
  }

  const toggleStar = async () => {
    if (!detail) return
    setStarring(true)
    const next = !detail.starred
    setDetail((d) => d ? { ...d, starred: next } : d)
    setRecipes((rs) => rs.map((r) => r.id === detail.id ? { ...r, starred: next } : r))
    await fetch(`/api/recipes/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    })
    setStarring(false)
  }

  const baseList = starFilter ? recipes.filter((r) => r.starred) : recipes

  // When no meal type filter: group by meal type (uncategorized at the end)
  const groups: { label: string; items: Recipe[] }[] = mealTypeFilter
    ? [{ label: MEAL_TYPE_LABELS[mealTypeFilter], items: baseList }]
    : (() => {
        const result: { label: string; items: Recipe[] }[] = []
        for (const key of MEAL_TYPE_KEYS) {
          const items = baseList.filter((r) => r.mealTypes.includes(key))
          if (items.length) result.push({ label: MEAL_TYPE_LABELS[key], items })
        }
        const uncategorized = baseList.filter((r) => r.mealTypes.length === 0)
        if (uncategorized.length) result.push({ label: "Uncategorized", items: uncategorized })
        return result
      })()

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recipes</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add recipe</Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New recipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Title *">
                <input className="input" value={form.title} onChange={set("title")} />
              </Field>
              <Field label="Description">
                <input className="input" value={form.description} onChange={set("description")} />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Servings">
                  <input className="input" type="number" value={form.servings} onChange={set("servings")} />
                </Field>
                <Field label="Prep (min)">
                  <input className="input" type="number" value={form.prepMinutes} onChange={set("prepMinutes")} />
                </Field>
                <Field label="Cook (min)">
                  <input className="input" type="number" value={form.cookMinutes} onChange={set("cookMinutes")} />
                </Field>
              </div>
              <Field label="Instructions">
                <textarea className="input min-h-[100px]" value={form.instructions} onChange={set("instructions")} />
              </Field>
              <Field label="Tags (comma separated)">
                <input className="input" value={form.tags} onChange={set("tags")} placeholder="breakfast, high-protein" />
              </Field>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nutrition (per full recipe)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Calories (kcal)">
                  <input className="input" type="number" value={form.calories} onChange={set("calories")} />
                </Field>
                <Field label="Protein (g)">
                  <input className="input" type="number" value={form.proteinG} onChange={set("proteinG")} />
                </Field>
                <Field label="Carbs (g)">
                  <input className="input" type="number" value={form.carbG} onChange={set("carbG")} />
                </Field>
                <Field label="Fat (g)">
                  <input className="input" type="number" value={form.fatG} onChange={set("fatG")} />
                </Field>
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? "Saving…" : "Save recipe"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + star filter */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setStarFilter((v) => !v)}
          title={starFilter ? "Show all recipes" : "Show starred only"}
          className={cn(
            "rounded-md border px-3 py-2 text-lg leading-none transition-colors",
            starFilter
              ? "border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-500/10"
              : "border-border text-muted-foreground/40 hover:text-amber-400"
          )}
        >
          ★
        </button>
      </div>

      {/* Meal type filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setMealTypeFilter(null)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
            mealTypeFilter === null
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          )}
        >
          All
        </button>
        {MEAL_TYPE_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setMealTypeFilter(mealTypeFilter === key ? null : key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
              mealTypeFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {MEAL_TYPE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Recipe grid — grouped when no filter active */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {starFilter ? "No starred recipes yet." : "No recipes yet. Add your first one!"}
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label} className="space-y-3">
              {!mealTypeFilter && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h2>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <Card
                    key={r.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => openDetail(r)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium leading-snug flex items-start justify-between gap-1">
                        <span>{r.title}</span>
                        {r.starred && <span className="text-amber-400 shrink-0 leading-none">★</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {r.nutrition && (
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">{formatCalories(r.nutrition.calories / r.servings)}/srv</Badge>
                          <Badge variant="outline" className="text-xs text-blue-600">P {formatMacro(r.nutrition.proteinG / r.servings)}</Badge>
                          <Badge variant="outline" className="text-xs text-yellow-600">C {formatMacro(r.nutrition.carbG / r.servings)}</Badge>
                          <Badge variant="outline" className="text-xs text-purple-600">F {formatMacro(r.nutrition.fatG / r.servings)}</Badge>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {r.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                      {(r.prepMinutes || r.cookMinutes) && (
                        <p className="text-xs text-muted-foreground">
                          {[r.prepMinutes && `${r.prepMinutes}m prep`, r.cookMinutes && `${r.cookMinutes}m cook`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail dialog — same layout as meals popup */}
      <Dialog open={detailOpen} onOpenChange={(v) => { if (!v) setDetailOpen(false) }}>
        <DialogContent className="max-w-none sm:max-w-none w-[95vw] lg:w-[90vw] xl:w-[80vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 pr-8">
              <DialogTitle className="flex-1">{detail?.title ?? "…"}</DialogTitle>
              {detail && (
                <button
                  onClick={toggleStar}
                  disabled={starring}
                  className={cn(
                    "text-2xl leading-none transition-colors shrink-0",
                    detail.starred ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"
                  )}
                  title={detail.starred ? "Unstar recipe" : "Star recipe"}
                >
                  ★
                </button>
              )}
            </div>
          </DialogHeader>

          {loadingDetail && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loadingDetail && detail && (
            <div className="space-y-4">
              {detail.description && (
                <p className="text-sm text-muted-foreground">{detail.description}</p>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {detail.prepMinutes != null && <span>Prep {detail.prepMinutes} min</span>}
                {detail.cookMinutes != null && <span>· Cook {detail.cookMinutes} min</span>}
                <span>· Makes {detail.servings} servings</span>
              </div>

              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}

              <Separator />

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                {detail.recipeIngredients.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ingredients (whole recipe)</p>
                    <ul className="text-sm space-y-0.5">
                      {detail.recipeIngredients.map((ri) => (
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

                {detail.instructions && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cooking instructions</p>
                    <ol className="text-sm space-y-1.5 list-decimal list-inside">
                      {detail.instructions.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => (
                        <li key={i} className="leading-snug">{line.replace(/^\d+[.)]\s*/, "")}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {detail.nutrition && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nutrition per serving</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                      {formatCalories(detail.nutrition.calories / detail.servings)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      P {formatMacro(detail.nutrition.proteinG / detail.servings)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300">
                      C {formatMacro(detail.nutrition.carbG / detail.servings)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                      F {formatMacro(detail.nutrition.fatG / detail.servings)}
                    </span>
                  </div>
                </div>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteRecipe(detail.id)}
              >
                Delete recipe
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
