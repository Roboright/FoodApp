import { MealType } from "@prisma/client"

export const MEAL_TYPES: MealType[] = [
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK_1",
  "SNACK_2",
]

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK_1: "Snack 1",
  SNACK_2: "Snack 2",
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

export function formatWeekLabel(monday: Date): string {
  const end = new Date(monday)
  end.setDate(end.getDate() + 6)
  return `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
}

export function formatWeekRelativeLabel(monday: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisMonday = getMondayOfWeek(today)
  const diffWeeks = Math.round((monday.getTime() - thisMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  if (diffWeeks === 0) return "This week"
  if (diffWeeks === 1) return "Next week"
  if (diffWeeks === -1) return "Last week"
  if (diffWeeks > 1) return `In ${diffWeeks} weeks`
  return `${Math.abs(diffWeeks)} weeks ago`
}

export function formatDayRelativeLabel(day: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  if (diffDays > 1) return `In ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}

export function formatDaySubtitle(day: Date): string {
  return day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b)
}
