import { createClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

const COLORS = ["blue", "amber", "emerald", "rose", "violet", "orange"]

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous chars (0/O, 1/I)
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { bookSlug } = body

  if (!bookSlug) {
    return Response.json({ error: "bookSlug required" }, { status: 400 })
  }

  // Look up the book id by slug
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, total_cycles")
    .eq("slug", bookSlug)
    .single()

  if (bookError || !book) {
    return Response.json({ error: "Book not found" }, { status: 404 })
  }

  // Generate a unique invite code
  let inviteCode = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from("reading_rooms")
      .select("id")
      .eq("invite_code", inviteCode)
      .single()
    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  // Create the room
  const { data: room, error: roomError } = await supabase
    .from("reading_rooms")
    .insert({ book_id: book.id, invite_code: inviteCode, created_by: user.id, status: "waiting" })
    .select()
    .single()

  if (roomError || !room) {
    return Response.json({ error: "Failed to create room" }, { status: 500 })
  }

  // Add creator as first member with color[0]
  const { error: memberError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: user.id, highlight_color: COLORS[0] })

  if (memberError) {
    return Response.json({ error: "Failed to add member" }, { status: 500 })
  }

  // Create initial progress for creator
  await supabase
    .from("user_progress")
    .insert({ room_id: room.id, user_id: user.id, current_cycle_index: 0, completed_cycle_index: -1 })

  return Response.json({
    success: true,
    room: { id: room.id, inviteCode: room.invite_code, bookSlug, bookTitle: book.title },
  })
}
