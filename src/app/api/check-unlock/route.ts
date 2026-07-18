import { createClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { roomId } = body

  if (!roomId) {
    return Response.json({ error: "roomId required" }, { status: 400 })
  }

  // Get both members' progress
  const { data: progressRows } = await supabase
    .from("user_progress")
    .select("user_id, current_cycle_index, completed_cycle_index")
    .eq("room_id", roomId)

  const myProgress = progressRows?.find((p) => p.user_id === user.id)
  const partnerProgress = progressRows?.find((p) => p.user_id !== user.id)

  if (!myProgress) {
    return Response.json({ unlocked: false, unlockResult: { reason: "Progress not found" } })
  }

  const myCycle = myProgress.current_cycle_index
  const myDone = myProgress.completed_cycle_index

  // I haven't submitted yet for this cycle
  if (myDone < myCycle) {
    return Response.json({ unlocked: false, unlockResult: { reason: "You haven't submitted yet." } })
  }

  // Check if partner has also submitted this cycle
  const partnerDone = partnerProgress?.completed_cycle_index ?? -1

  if (partnerDone >= myCycle) {
    return Response.json({ unlocked: true })
  }

  return Response.json({
    unlocked: false,
    unlockResult: { reason: "Your response is sealed. Waiting for your partner to finish this cycle." },
  })
}
