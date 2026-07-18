import { createClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

const COLORS = ["blue", "amber", "emerald", "rose", "violet", "orange"]

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { inviteCode } = body

  if (!inviteCode) {
    return Response.json({ error: "inviteCode required" }, { status: 400 })
  }

  // Find the room by invite code
  const { data: room, error: roomError } = await supabase
    .from("reading_rooms")
    .select("id, book_id, status, invite_code, books(slug, title, total_cycles)")
    .eq("invite_code", inviteCode.toUpperCase().trim())
    .single()

  if (roomError || !room) {
    return Response.json({ error: "Room not found. Check the invite code." }, { status: 404 })
  }

  // Check room isn't already full (2 members)
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", room.id)

  if (members && members.length >= 2) {
    return Response.json({ error: "This room already has two readers." }, { status: 409 })
  }

  // Check user isn't already in this room
  const alreadyMember = members?.some((m) => m.user_id === user.id)
  if (alreadyMember) {
    // They're returning to their own room — just return it
    return Response.json({
      success: true,
      room: {
        id: room.id,
        inviteCode: room.invite_code,
        book: room.books,
      },
    })
  }

  // Assign the second colour (first member got COLORS[0])
  const usedColor = members?.[0] ? COLORS[0] : null
  const color = COLORS.find((c) => c !== usedColor) ?? COLORS[1]

  // Add joiner as second member
  const { error: memberError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: user.id, highlight_color: color })

  if (memberError) {
    return Response.json({ error: "Failed to join room" }, { status: 500 })
  }

  // Create initial progress for joiner
  await supabase
    .from("user_progress")
    .insert({ room_id: room.id, user_id: user.id, current_cycle_index: 0, completed_cycle_index: -1 })

  // Activate the room now that both members are in
  await supabase
    .from("reading_rooms")
    .update({ status: "active" })
    .eq("id", room.id)

  return Response.json({
    success: true,
    room: {
      id: room.id,
      inviteCode: room.invite_code,
      book: room.books,
    },
  })
}
