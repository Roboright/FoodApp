import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get("weekStart")
  if (!weekStart) return NextResponse.json([])

  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  const entries = await db.weightEntry.findMany({
    where: { date: { gte: start, lt: end } },
  })
  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const { profileId, date, weightKg } = await req.json()
  const entry = await db.weightEntry.upsert({
    where: { profileId_date: { profileId, date: new Date(date) } },
    update: { weightKg },
    create: { profileId, date: new Date(date), weightKg },
  })
  return NextResponse.json(entry, { status: 201 })
}
