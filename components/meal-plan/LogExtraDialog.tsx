"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { toDateString, formatDayRelativeLabel } from "@/lib/week"
import { cn } from "@/lib/utils"
import { Camera, X } from "lucide-react"

type Profile = { id: string; name: string }

type AnalysedItem = {
  name: string
  quantity: number
  unit: string
  matchedFoodItemId: string | null
  matchedFoodItemName: string | null
  matchedFoodItemBrand: string | null
  matched: boolean
  calories: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number
}

type Analysis = {
  items: AnalysedItem[]
  totals: {
    calories: number
    proteinG: number
    carbG: number
    fatG: number
    sugarG: number
  }
}

type LabelData = {
  productName: string | null
  per100Unit: string
  calories: number
  proteinG: number
  carbG: number
  fatG: number
  sugarG: number | null
  fiberG: number | null
  servingSize: number | null
}

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxSide = 1024
      let { width, height } = img
      if (width > maxSide || height > maxSide) {
        const ratio = Math.min(maxSide / width, maxSide / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" })
    }
    img.src = url
  })
}

function makeDateOptions(): { label: string; sub: string; value: string }[] {
  const options = []
  for (let offset = -2; offset <= 2; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    options.push({
      label: formatDayRelativeLabel(d),
      sub: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      value: toDateString(d),
    })
  }
  return options
}

export function LogExtraDialog({
  profiles,
  onClose,
  onSaved,
}: {
  profiles: Profile[]
  onClose: () => void
  onSaved: () => void
}) {
  const dateOptions = makeDateOptions()
  const todayStr = toDateString(new Date())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id ?? "")
  const [text, setText] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [labelData, setLabelData] = useState<LabelData | null>(null)
  const [labelAmount, setLabelAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lock body scroll while modal is open (prevents background page from scrolling on mobile)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const canAnalyse = imageFile != null || text.trim().length > 0

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setAnalysis(null)
    setLabelData(null)
    setLabelAmount("")
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setAnalysis(null)
    setLabelData(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const analyse = async () => {
    if (!canAnalyse) return
    setAnalysing(true)
    setAnalysis(null)
    setLabelData(null)
    setError(null)
    try {
      if (imageFile) {
        const { base64, mimeType } = await compressImage(imageFile)
        const res = await fetch("/api/meal-logs/analyse-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType, context: text }),
        })
        if (!res.ok) throw new Error()
        const result = await res.json()
        if (result.type === "label") {
          setLabelData(result)
          if (result.servingSize) setLabelAmount(result.servingSize.toString())
        } else {
          setAnalysis(result)
        }
      } else {
        const res = await fetch("/api/meal-logs/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: text, profileName: selectedProfile?.name }),
        })
        if (!res.ok) throw new Error()
        setAnalysis(await res.json())
      }
    } catch {
      setError("Failed to analyse. Please try again.")
    } finally {
      setAnalysing(false)
    }
  }

  const confirmLabel = () => {
    if (!labelData) return
    const amount = parseFloat(labelAmount)
    if (!amount || amount <= 0) return
    const scale = amount / 100
    const item: AnalysedItem = {
      name: labelData.productName ?? "Product",
      quantity: amount,
      unit: labelData.per100Unit,
      matchedFoodItemId: null,
      matchedFoodItemName: null,
      matchedFoodItemBrand: null,
      matched: false,
      calories: Math.round(labelData.calories * scale * 10) / 10,
      proteinG: Math.round(labelData.proteinG * scale * 10) / 10,
      carbG: Math.round(labelData.carbG * scale * 10) / 10,
      fatG: Math.round(labelData.fatG * scale * 10) / 10,
      sugarG: Math.round((labelData.sugarG ?? 0) * scale * 10) / 10,
    }
    setAnalysis({
      items: [item],
      totals: {
        calories: Math.round(item.calories),
        proteinG: Math.round(item.proteinG),
        carbG: Math.round(item.carbG),
        fatG: Math.round(item.fatG),
        sugarG: Math.round(item.sugarG),
      },
    })
    setLabelData(null)
  }

  const save = async () => {
    if (!analysis) return
    setSaving(true)
    await fetch("/api/meal-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: selectedProfileId,
        logType: "AD_HOC",
        loggedAt: `${selectedDate}T12:00:00.000Z`,
        description: text || (imageFile ? "[photo]" : ""),
        caloriesOverride: analysis.totals.calories,
        proteinOverride: analysis.totals.proteinG,
        carbOverride: analysis.totals.carbG,
        fatOverride: analysis.totals.fatG,
        sugarOverride: analysis.totals.sugarG,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 overflow-y-auto overscroll-contain"
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      onClick={onClose}
    >
      <div className="flex min-h-full items-end sm:items-center justify-center p-3">
      <div
        className="w-full max-w-3xl bg-background rounded-2xl shadow-xl flex flex-col gap-5 p-6 my-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Log extra</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* Profile selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Who?</p>
          <div className="flex gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                  selectedProfileId === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Date selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">When?</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {dateOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedDate(opt.value)}
                className={cn(
                  "flex flex-col items-center shrink-0 px-3 py-2 rounded-xl border text-center transition-colors",
                  selectedDate === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                <span className="text-xs font-semibold whitespace-nowrap">{opt.label}</span>
                <span className={cn("text-[10px]", selectedDate === opt.value ? "opacity-80" : "text-muted-foreground")}>
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Input: text and/or image */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">What did you have?</p>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setAnalysis(null); setLabelData(null) }}
            placeholder={imageFile ? "Optional — add context if needed" : "e.g. 200g Greek yogurt with 50g granola and a banana"}
            rows={3}
            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Image area */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          {imagePreview ? (
            <div className="relative w-full rounded-xl overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Selected" className="w-full max-h-48 object-contain bg-muted/20" />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 rounded-full bg-background/80 border border-border p-1 hover:bg-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors w-full justify-center"
            >
              <Camera className="w-4 h-4" />
              Take photo or choose from library
            </button>
          )}
        </div>

        {/* Analyse button */}
        {!analysis && !labelData && (
          <Button onClick={analyse} disabled={!canAnalyse || analysing} className="w-full">
            {analysing ? "Analysing…" : "Analyse"}
          </Button>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        {/* Label detected — ask for consumed amount */}
        {labelData && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/40 border-b border-border px-4 py-3">
              <p className="text-sm font-medium">Nutritional label detected</p>
              {labelData.productName && (
                <p className="text-xs text-muted-foreground mt-0.5">{labelData.productName}</p>
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-2">Per 100{labelData.per100Unit}:</p>
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                {[
                  { label: "kcal", value: labelData.calories },
                  { label: "protein", value: `${labelData.proteinG}g` },
                  { label: "carbs", value: `${labelData.carbG}g` },
                  { label: "fat", value: `${labelData.fatG}g` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/50 py-2 px-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              {(labelData.sugarG != null || labelData.fiberG != null) && (
                <div className="flex gap-2 mb-4">
                  {labelData.sugarG != null && (
                    <div className="rounded-lg bg-muted/50 py-1.5 px-3 text-center">
                      <p className="text-xs text-muted-foreground">sugar</p>
                      <p className="text-sm font-semibold tabular-nums">{labelData.sugarG}g</p>
                    </div>
                  )}
                  {labelData.fiberG != null && (
                    <div className="rounded-lg bg-muted/50 py-1.5 px-3 text-center">
                      <p className="text-xs text-muted-foreground">fibre</p>
                      <p className="text-sm font-semibold tabular-nums">{labelData.fiberG}g</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm font-medium mb-2">How much did you consume?</p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={labelAmount}
                  onChange={(e) => setLabelAmount(e.target.value)}
                  placeholder="e.g. 250"
                  className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">{labelData.per100Unit}</span>
                <Button
                  onClick={confirmLabel}
                  disabled={!labelAmount || parseFloat(labelAmount) <= 0}
                  className="shrink-0"
                >
                  Calculate
                </Button>
              </div>
            </div>
            <div className="px-4 pb-3">
              <button
                onClick={() => { setLabelData(null) }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Breakdown */}
        {analysis && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Source</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">kcal</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">prot</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">carbs</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">fat</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">sugar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analysis.items.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <span className="font-medium">{item.name}</span>
                        {item.matchedFoodItemName && item.matchedFoodItemName.toLowerCase() !== item.name.toLowerCase() && (
                          <span className="ml-1 text-muted-foreground">→ {item.matchedFoodItemName}</span>
                        )}
                        {item.matchedFoodItemBrand && (
                          <span className="ml-1 text-muted-foreground">({item.matchedFoodItemBrand})</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {item.quantity}{item.unit}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {item.matched ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">✓ DB</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-medium">~ AI</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{Math.round(item.calories)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{Math.round(item.proteinG)}g</td>
                      <td className="px-2 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{Math.round(item.carbG)}g</td>
                      <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{Math.round(item.fatG)}g</td>
                      <td className="px-2 py-2 text-right tabular-nums text-pink-600 dark:text-pink-400">{Math.round(item.sugarG)}g</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-border font-semibold">
                    <td className="px-3 py-2 text-sm" colSpan={3}>Total</td>
                    <td className="px-2 py-2 text-right tabular-nums text-sm text-orange-600 dark:text-orange-400">{analysis.totals.calories}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-sm text-blue-600 dark:text-blue-400">{analysis.totals.proteinG}g</td>
                    <td className="px-2 py-2 text-right tabular-nums text-sm text-amber-600 dark:text-amber-400">{analysis.totals.carbG}g</td>
                    <td className="px-2 py-2 text-right tabular-nums text-sm text-rose-600 dark:text-rose-400">{analysis.totals.fatG}g</td>
                    <td className="px-2 py-2 text-right tabular-nums text-sm text-pink-600 dark:text-pink-400">{analysis.totals.sugarG}g</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      {analysis && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setAnalysis(null)}>
            Edit
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}
