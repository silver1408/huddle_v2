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

  const { data: notes, error } = await supabase
    .from("paragraph_notes")
    .select("id, user_id, paragraph_index, content, created_at")
    .eq("room_id", roomId)
    .eq("cycle_index", parseInt(cycleIndex, 10))
    .order("created_at", { ascending: true })

  if (error) {
    return Response.json({ error: "Failed to fetch notes" }, { status: 500 })
  }

  const myNotes = (notes ?? []).filter((n) => n.user_id === user.id)
  const partnerNotes = (notes ?? []).filter((n) => n.user_id !== user.id)

  return Response.json({ myNotes, partnerNotes })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { roomId, cycleIndex, paragraphIndex, content } = body

  if (!roomId || cycleIndex === undefined || paragraphIndex === undefined || !content) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data: note, error } = await supabase
    .from("paragraph_notes")
    .insert({
      room_id: roomId,
      user_id: user.id,
      cycle_index: cycleIndex,
      paragraph_index: paragraphIndex,
      content,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: "Failed to save note" }, { status: 500 })
  }

  return Response.json({ note })
}
