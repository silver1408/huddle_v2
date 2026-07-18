"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Loader2, BookOpen, Users, ArrowRight } from "lucide-react"
import { Suspense } from "react"

interface Member {
  user_id: string
  highlight_color: string
  profiles: { display_name: string | null; avatar_url: string | null }
}

interface Room {
  id: string
  status: string
  invite_code: string
  books: {
    slug: string
    title: string
    author: string
    total_cycles: number
    description: string
  }
}

function LobbyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get("roomId")
  const supabase = createClient()

  const [room, setRoom] = useState<Room | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [readyToStart, setReadyToStart] = useState(false)

  useEffect(() => {
    if (!roomId) { router.push("/"); return }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return }
      setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchStatus = async () => {
    if (!roomId) return
    const res = await fetch(`/api/rooms/status?roomId=${roomId}`)
    if (!res.ok) return
    const data = await res.json()
    setRoom(data.room)
    setMembers(data.members ?? [])
    setLoading(false)

    if (data.room.status === "active" && data.members?.length === 2) {
      setReadyToStart(true)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [roomId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-inter text-muted-foreground">Room not found.</p>
      </div>
    )
  }

  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    amber: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
    emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    rose: "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
    violet: "bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30",
    orange: "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-6 right-8 z-50">
        <ThemeToggle />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-lg mx-auto w-full">
        {/* Book info */}
        <div className="text-center mb-12 animate-in fade-in duration-700">
          <p className="font-inter text-xs uppercase tracking-widest text-muted-foreground mb-3">ReadAlong</p>
          <h1 className="font-playfair text-4xl md:text-5xl italic text-foreground mb-2">{room.books.title}</h1>
          <p className="font-lora text-base text-muted-foreground">by {room.books.author}</p>
          <p className="font-inter text-xs text-muted-foreground/60 mt-1">{room.books.total_cycles} cycles</p>
        </div>

        {/* Members */}
        <div className="w-full space-y-3 mb-10">
          {members.map((m) => {
            const isMe = m.user_id === currentUserId
            const colorClass = colorMap[m.highlight_color] ?? colorMap.blue
            const name = m.profiles?.display_name ?? "Reader"
            const initial = name[0]?.toUpperCase() ?? "?"

            return (
              <div key={m.user_id} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center font-playfair text-lg font-medium ${colorClass}`}>
                  {initial}
                </div>
                <div className="flex-1">
                  <p className="font-inter text-sm font-medium text-foreground">{name}</p>
                  <p className="font-inter text-xs text-muted-foreground capitalize">{m.highlight_color} highlights</p>
                </div>
                {isMe && (
                  <span className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground bg-accent px-2 py-0.5 rounded-full">You</span>
                )}
              </div>
            )
          })}

          {/* Empty slot */}
          {members.length < 2 && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-dashed border-border/50">
              <div className="w-11 h-11 rounded-xl bg-muted/50 flex items-center justify-center">
                <Users className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-inter text-sm text-muted-foreground">Waiting for partner…</p>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
                </div>
                <p className="font-inter text-xs text-muted-foreground/50 mt-0.5">Share your invite code below</p>
              </div>
            </div>
          )}
        </div>

        {/* Invite code (shown while waiting) */}
        {room.status === "waiting" && (
          <div className="w-full p-5 rounded-2xl bg-card border border-border/50 text-center mb-6">
            <p className="font-inter text-xs uppercase tracking-widest text-muted-foreground mb-3">Invite Code</p>
            <p className="font-mono text-3xl font-bold tracking-[0.25em] text-foreground select-all">{room.invite_code}</p>
            <button
              onClick={() => navigator.clipboard.writeText(room.invite_code)}
              className="mt-2 font-inter text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Copy
            </button>
          </div>
        )}

        {/* Start button */}
        {readyToStart && (
          <Button
            id="start-reading-btn"
            className="w-full h-12 rounded-xl font-inter font-medium animate-in fade-in zoom-in-95 duration-500"
            onClick={() => router.push(`/read?roomId=${roomId}`)}
          >
            Begin Reading <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {!readyToStart && (
          <p className="font-inter text-xs text-muted-foreground text-center">
            <BookOpen className="h-3.5 w-3.5 inline mr-1" />
            Both readers need to be in the room to start.
          </p>
        )}
      </main>
    </div>
  )
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LobbyContent />
    </Suspense>
  )
}
