import { createClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("roomId")
  const cycleIndex = searchParams.get("cycleIndex")

  if (!roomId || cycleIndex === null) {
    return Response.json({ error: "roomId and cycleIndex required" }, { status: 400 })
  }

  const idx = parseInt(cycleIndex, 10)

  const { data: responses, error } = await supabase
    .from("cycle_responses")
    .select("user_id, interpretation, submitted_at")
    .eq("room_id", roomId)
    .eq("cycle_index", idx)

  if (error) {
    return Response.json({ error: "Failed to fetch responses" }, { status: 500 })
  }

  const myResponse = responses?.find((r) => r.user_id === user.id) ?? null
  const partnerResponse = responses?.find((r) => r.user_id !== user.id) ?? null

  return Response.json({ myResponse, partnerResponse })
}
