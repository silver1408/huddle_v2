import { createClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { roomId, cycleIndex, interpretation } = body

  if (!roomId || cycleIndex === undefined || !interpretation) {
    return Response.json({ error: "roomId, cycleIndex, and interpretation required" }, { status: 400 })
  }

  // Verify membership
  const { data: member } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  if (!member) {
    return Response.json({ error: "Not a member of this room" }, { status: 403 })
  }

  // Save the response (upsert in case of retry)
  const { error: respError } = await supabase
    .from("cycle_responses")
    .upsert({ room_id: roomId, user_id: user.id, cycle_index: cycleIndex, interpretation })

  if (respError) {
    return Response.json({ error: "Failed to save response" }, { status: 500 })
  }

  // Check if partner has also submitted this cycle
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .neq("user_id", user.id)

  const partnerId = members?.[0]?.user_id
  let partnerSubmitted = false

  if (partnerId) {
    const { data: partnerResp } = await supabase
      .from("cycle_responses")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", partnerId)
      .eq("cycle_index", cycleIndex)
      .single()
    partnerSubmitted = !!partnerResp
  }

  // Get room book for total cycles
  const { data: room } = await supabase
    .from("reading_rooms")
    .select("books(total_cycles)")
    .eq("id", roomId)
    .single()

  const totalCycles = (room?.books as unknown as { total_cycles: number } | null)?.total_cycles ?? 0

  let nextCycleIndex: number | null = null
  let unlockResult: { reason: string } | null = null

  if (partnerSubmitted) {
    // Advance both users to next cycle
    const next = cycleIndex + 1
    nextCycleIndex = next < totalCycles ? next : null

    // Update my progress
    await supabase
      .from("user_progress")
      .upsert({
        room_id: roomId,
        user_id: user.id,
        current_cycle_index: nextCycleIndex ?? cycleIndex,
        completed_cycle_index: cycleIndex,
        updated_at: new Date().toISOString(),
      })

    // Update partner's progress
    if (partnerId) {
      await supabase
        .from("user_progress")
        .upsert({
          room_id: roomId,
          user_id: partnerId,
          current_cycle_index: nextCycleIndex ?? cycleIndex,
          completed_cycle_index: cycleIndex,
          updated_at: new Date().toISOString(),
        })
    }

    if (nextCycleIndex === null) {
      // Book complete!
      await supabase.from("reading_rooms").update({ status: "completed" }).eq("id", roomId)
    }
  } else {
    // Just mark my completed_cycle_index — stay on current cycle until partner submits
    await supabase
      .from("user_progress")
      .upsert({
        room_id: roomId,
        user_id: user.id,
        current_cycle_index: cycleIndex,
        completed_cycle_index: cycleIndex,
        updated_at: new Date().toISOString(),
      })
    unlockResult = { reason: "Your response is sealed. Waiting for your partner to finish this cycle." }
  }

  return Response.json({
    success: true,
    nextCycleIndex,
    unlockResult,
  })
}
