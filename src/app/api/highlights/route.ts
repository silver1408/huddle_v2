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

  // Get all highlights for this cycle in this room
  const { data: highlights, error } = await supabase
    .from("highlights")
    .select("id, user_id, paragraph_index, start_char, end_char, text_snippet, color, created_at")
    .eq("room_id", roomId)
    .eq("cycle_index", idx)
    .order("created_at", { ascending: true })

  if (error) {
    return Response.json({ error: "Failed to fetch highlights" }, { status: 500 })
  }

  const myHighlights = (highlights ?? []).filter((h) => h.user_id === user.id)
  const partnerHighlights = (highlights ?? []).filter((h) => h.user_id !== user.id)

  return Response.json({ myHighlights, partnerHighlights })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { roomId, cycleIndex, paragraphIndex, startChar, endChar, textSnippet } = body

  if (!roomId || cycleIndex === undefined || paragraphIndex === undefined) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Get user's colour from room_members
  const { data: member } = await supabase
    .from("room_members")
    .select("highlight_color")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  const color = member?.highlight_color ?? "blue"

  const { data: highlight, error } = await supabase
    .from("highlights")
    .insert({
      room_id: roomId,
      user_id: user.id,
      cycle_index: cycleIndex,
      paragraph_index: paragraphIndex,
      start_char: startChar,
      end_char: endChar,
      text_snippet: textSnippet,
      color,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: "Failed to save highlight" }, { status: 500 })
  }

  return Response.json({ highlight })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const highlightId = searchParams.get("id")

  if (!highlightId) {
    return Response.json({ error: "id required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("id", highlightId)
    .eq("user_id", user.id) // RLS + extra safety check

  if (error) {
    return Response.json({ error: "Failed to delete highlight" }, { status: 500 })
  }

  return Response.json({ success: true })
}
