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
  const cycleIndexOverride = searchParams.get("cycleIndex")

  if (!roomId) {
    return Response.json({ error: "roomId required" }, { status: 400 })
  }

  // Get room + book info
  const { data: room, error: roomError } = await supabase
    .from("reading_rooms")
    .select("id, status, books(id, slug, title, author, total_cycles, gutenberg_id)")
    .eq("id", roomId)
    .single()

  if (roomError || !room) {
    return Response.json({ error: "Room not found" }, { status: 404 })
  }

  // Get members
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, highlight_color, profiles(display_name, avatar_url)")
    .eq("room_id", roomId)

  if (!members || members.length < 1) {
    return Response.json({ error: "No members found" }, { status: 404 })
  }

  const me = members.find((m) => m.user_id === user.id)
  const partner = members.find((m) => m.user_id !== user.id)

  if (!me) {
    return Response.json({ error: "Not a member of this room" }, { status: 403 })
  }

  // Get my progress
  const { data: myProgress } = await supabase
    .from("user_progress")
    .select("current_cycle_index, completed_cycle_index")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  // Get partner progress
  const { data: partnerProgress } = partner
    ? await supabase
        .from("user_progress")
        .select("current_cycle_index, completed_cycle_index")
        .eq("room_id", roomId)
        .eq("user_id", partner.user_id)
        .single()
    : { data: null }

  const myIdx = myProgress?.current_cycle_index ?? 0
  const requestedIdx = cycleIndexOverride !== null ? parseInt(cycleIndexOverride, 10) : myIdx

  const book = room.books as unknown as { id: string; slug: string; title: string; author: string; total_cycles: number; gutenberg_id: number | null } | null

  return Response.json({
    myProgress: myProgress ?? { current_cycle_index: 0, completed_cycle_index: -1 },
    partnerProgress: partnerProgress ?? { current_cycle_index: 0, completed_cycle_index: -1 },
    partnerName: (partner?.profiles as unknown as { display_name: string | null } | null)?.display_name ?? "Partner",
    partnerColor: partner?.highlight_color ?? "amber",
    myColor: me.highlight_color,
    totalCycles: book?.total_cycles ?? 0,
    book: book ? { id: book.id, slug: book.slug, title: book.title, author: book.author } : null,
    room: { id: room.id, status: room.status },
    // cycleIndex used by read page to fetch content from /api/books/[id]/cycle/[idx]
    cycleIndex: requestedIdx,
  })
}
