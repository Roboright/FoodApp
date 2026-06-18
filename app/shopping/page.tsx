"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getMondayOfWeek, formatWeekLabel, formatWeekRelativeLabel, toDateString } from "@/lib/week"
import { cn } from "@/lib/utils"

type ShoppingItem = { name: string; qty: number; unit: string }

type Category = {
  key: string
  label: string
  emoji: string
  isPantry: boolean
  items: ShoppingItem[]
}

function fmtQty(qty: number): string {
  const rounded = Math.round(qty * 10) / 10
  return rounded % 1 === 0 ? String(Math.round(rounded)) : String(rounded)
}

function fmtItem(item: ShoppingItem): string {
  const qty = fmtQty(item.qty)
  if (!item.unit || item.unit === "pcs" || item.unit === "whole") {
    return item.unit === "pcs" ? `${item.name} — ${qty}` : item.name
  }
  return `${item.name} — ${qty} ${item.unit}`
}

function buildCopyText(categories: Category[]): string {
  return categories
    .map((cat) => {
      const header = `${cat.emoji} ${cat.label.toUpperCase()}`
      const items = cat.items.map((i) => fmtItem(i)).join("\n")
      return `${header}\n${items}`
    })
    .join("\n\n")
}

export default function ShoppingPage() {
  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()))
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(async () => {
      setLoading(true)
      const res = await fetch(`/api/shopping?weekStart=${toDateString(monday)}`)
      const data = await res.json()
      if (!cancelled) { setCategories(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [monday])

  const copy = () => {
    const text = buildCopyText(categories)
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

  const shiftWeek = (dir: number) => {
    setMonday((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + dir * 7)
      return d
    })
  }

  const mainCategories = categories.filter((c) => !c.isPantry)
  const pantryCategories = categories.filter((c) => c.isPantry)
  const totalItems = categories.reduce((s, c) => s + c.items.length, 0)

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

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : totalItems === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-medium">No meals planned this week</p>
          <p className="text-sm text-muted-foreground">Assign recipes to your meal slots first.</p>
        </div>
      ) : (
        <>
          {/* Copy button */}
          <Button onClick={copy} className="w-full" variant={copied ? "outline" : "default"}>
            {copied ? "✓ Copied to clipboard" : "Copy list for Google Keep"}
          </Button>

          {/* Shopping list */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y">
            {mainCategories.map((cat) => (
              <CategorySection key={cat.key} cat={cat} />
            ))}

            {/* Pantry separator */}
            {pantryCategories.length > 0 && (
              <>
                <div className="px-4 py-2 bg-muted/60 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Check if stocked</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {pantryCategories.map((cat) => (
                  <CategorySection key={cat.key} cat={cat} />
                ))}
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {totalItems} ingredient{totalItems !== 1 ? "s" : ""} across {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </p>
        </>
      )}
    </div>
  )
}

function CategorySection({ cat }: { cat: Category }) {
  return (
    <div>
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 bg-muted/30",
        cat.isPantry && "bg-amber-50/40 dark:bg-amber-500/5"
      )}>
        <span className="text-base leading-none">{cat.emoji}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {cat.label}
        </span>
      </div>
      <ul className="divide-y">
        {cat.items.map((item) => (
          <li key={`${item.name}|||${item.unit}`} className="flex items-center justify-between px-4 py-2.5 gap-4">
            <span className="text-sm">{item.name}</span>
            {(item.qty > 0 && item.unit) && (
              <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                {fmtQty(item.qty)} {item.unit}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
