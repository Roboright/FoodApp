import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { slotId } = await params
  await db.mealSlot.delete({ where: { id: slotId } })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { slotId } = await params
  const body = await req.json()
  const { profileIds, ...rest } = body

  const slot = await db.mealSlot.update({
    where: { id: slotId },
    data: rest,
  })

  if (profileIds !== undefined) {
    await db.mealSlotProfile.deleteMany({ where: { mealSlotId: slotId } })
    if (profileIds.length > 0) {
      await db.mealSlotProfile.createMany({
        data: profileIds.map((profileId: string) => ({
          mealSlotId: slotId,
          profileId,
          servingFraction: 1.0,
        })),
      })
    }
  }

  const updated = await db.mealSlot.findUnique({
    where: { id: slot.id },
    include: { recipe: { include: { nutrition: true } }, profiles: { include: { profile: true } } },
  })
  return NextResponse.json(updated)
}
