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

  if (!roomId) {
    return Response.json({ error: "roomId required" }, { status: 400 })
  }

  // Get room with book info
  const { data: room, error: roomError } = await supabase
    .from("reading_rooms")
    .select("id, status, invite_code, books(id, slug, title, author, total_cycles, description)")
    .eq("id", roomId)
    .single()

  if (roomError || !room) {
    return Response.json({ error: "Room not found" }, { status: 404 })
  }

  // Get members with their profiles
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, highlight_color, joined_at, profiles(display_name, avatar_url)")
    .eq("room_id", roomId)

  return Response.json({ room, members: members ?? [] })
}
