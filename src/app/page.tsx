"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import { BOOKS } from "@/lib/book-catalogue"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowRight,
  BookOpen,
  Users,
  Loader2,
  LogIn,
  ChevronLeft,
  X,
} from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { Suspense } from "react"

type View = "landing" | "choose" | "create-pick-book" | "create-code" | "join"

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>("landing")
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState("")

  // Create-room state
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Join-room state
  const [inviteInput, setInviteInput] = useState("")
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setError("Sign-in failed. Please try again.")
    }
  }, [searchParams])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
      if (data.user) setView("choose")
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setView("choose")
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Poll for partner joining when we have a created room code
  useEffect(() => {
    if (!createdRoomId) return

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/rooms/status?roomId=${createdRoomId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.room.status === "active") {
        clearInterval(pollRef.current!)
        router.push(`/lobby?roomId=${createdRoomId}`)
      }
    }, 3000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [createdRoomId, router])

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    setError("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setView("landing")
    setCreatedCode(null)
    setCreatedRoomId(null)
  }

  const handleCreateRoom = async () => {
    if (!selectedBook) return
    setCreatingRoom(true)
    setError("")
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookSlug: selectedBook }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreatedCode(data.room.inviteCode)
      setCreatedRoomId(data.room.id)
      setView("create-code")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create room")
    } finally {
      setCreatingRoom(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!inviteInput.trim()) return
    setJoining(true)
    setError("")
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteInput.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/lobby?roomId=${data.room.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to join room")
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="fixed top-6 right-8 z-50 flex items-center gap-3">
        {user && (
          <button
            onClick={handleSignOut}
            className="font-inter text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        )}
        <ThemeToggle />
      </div>

      {/* Left: Literary panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-16 relative overflow-hidden bg-stone-900 text-stone-50">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800/50 to-stone-950/80 pointer-events-none" />
        <div className="relative z-10">
          <p className="font-inter tracking-widest text-xs uppercase text-stone-400">ReadAlong</p>
        </div>
        <div className="relative z-10 max-w-lg">
          <h1 className="font-playfair text-6xl leading-[0.9] tracking-tight mb-6 text-stone-100">
            Read together.<br />
            <span className="italic text-stone-400">Think out loud.</span>
          </h1>
          <div className="h-px w-24 bg-stone-600 mb-6" />
          <p className="font-inter text-sm text-stone-400 leading-relaxed">
            Pick a book, invite your reading buddy, and discover the story cycle by cycle — sharing your interpretations as you go.
          </p>
          <div className="mt-10 flex flex-col gap-3 text-stone-500 text-xs font-inter">
            <div className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> 6 public domain classics</div>
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Private rooms, invite-only</div>
          </div>
        </div>
        <div className="relative z-10" />
      </div>

      {/* Right: Interaction panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-16 relative bg-background">

        {/* Landing: Sign in */}
        {view === "landing" && (
          <div className="w-full max-w-sm space-y-8 animate-in fade-in duration-500">
            <div className="lg:hidden text-center mb-8">
              <p className="font-inter tracking-widest text-[10px] uppercase text-muted-foreground mb-3">ReadAlong</p>
              <h1 className="font-playfair text-4xl italic text-foreground">Read together.</h1>
            </div>
            <div className="space-y-2">
              <h2 className="font-playfair text-3xl font-medium text-foreground">Welcome.</h2>
              <p className="font-inter text-sm text-muted-foreground">Sign in to start or join a reading room.</p>
            </div>
            {error && <p className="font-inter text-xs text-destructive">{error}</p>}
            <Button
              id="google-signin-btn"
              className="w-full h-12 rounded-xl font-inter font-medium gap-3"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
            >
              {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </div>
        )}

        {/* Choose: create or join */}
        {view === "choose" && (
          <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <p className="font-inter text-xs text-muted-foreground">
                Welcome, {user?.user_metadata?.full_name?.split(" ")[0] ?? "Reader"}
              </p>
              <h2 className="font-playfair text-3xl font-medium text-foreground">What would you like to do?</h2>
            </div>
            <div className="space-y-3">
              <button
                id="create-room-btn"
                onClick={() => setView("create-pick-book")}
                className="group w-full flex items-center gap-5 p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent/50 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-foreground/5 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-inter font-medium text-foreground">Start a reading room</p>
                  <p className="font-inter text-xs text-muted-foreground mt-0.5">Pick a book and share an invite code</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                id="join-room-btn"
                onClick={() => { setView("join"); setError("") }}
                className="group w-full flex items-center gap-5 p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent/50 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-foreground/5 flex items-center justify-center">
                  <Users className="h-5 w-5 text-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-inter font-medium text-foreground">Join with a code</p>
                  <p className="font-inter text-xs text-muted-foreground mt-0.5">Enter the 6-character code from your partner</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* Create: pick book */}
        {view === "create-pick-book" && (
          <div className="w-full max-w-lg space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4">
              <button onClick={() => setView("choose")} className="p-2 rounded-lg hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div>
                <h2 className="font-playfair text-2xl font-medium text-foreground">Choose a book</h2>
                <p className="font-inter text-xs text-muted-foreground">All titles are public domain classics</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {BOOKS.map((book) => (
                <button
                  key={book.slug}
                  id={`book-${book.slug}`}
                  onClick={() => setSelectedBook(book.slug)}
                  className={`relative p-4 rounded-2xl text-left transition-all duration-300 border overflow-hidden ${
                    selectedBook === book.slug
                      ? "border-foreground/50 ring-2 ring-foreground/20"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient} opacity-10`} />
                  <div className="relative z-10">
                    <p className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{book.era}</p>
                    <p className="font-playfair text-base font-medium text-foreground leading-tight">{book.title}</p>
                    <p className="font-inter text-xs text-muted-foreground mt-0.5">{book.author}</p>
                    <p className="font-inter text-[11px] text-muted-foreground/70 mt-2 leading-relaxed line-clamp-2">{book.description}</p>
                  </div>
                </button>
              ))}
            </div>
            {error && <p className="font-inter text-xs text-destructive">{error}</p>}
            <Button
              id="confirm-book-btn"
              className="w-full h-12 rounded-xl font-inter font-medium"
              disabled={!selectedBook || creatingRoom}
              onClick={handleCreateRoom}
            >
              {creatingRoom ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create room"}
            </Button>
          </div>
        )}

        {/* Create: show invite code */}
        {view === "create-code" && createdCode && (
          <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-700 text-center">
            <div className="space-y-2">
              <h2 className="font-playfair text-3xl font-medium text-foreground">Room created!</h2>
              <p className="font-inter text-sm text-muted-foreground">Share this code with your reading partner.</p>
            </div>
            <div className="p-8 rounded-3xl bg-card border border-border/50 shadow-sm">
              <p className="font-inter text-xs uppercase tracking-widest text-muted-foreground mb-4">Invite Code</p>
              <p className="font-mono text-5xl font-bold tracking-[0.2em] text-foreground select-all">{createdCode}</p>
              <button
                onClick={() => navigator.clipboard.writeText(createdCode)}
                className="mt-4 font-inter text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Copy to clipboard
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-inter">Waiting for your partner to join…</span>
            </div>
          </div>
        )}

        {/* Join: enter code */}
        {view === "join" && (
          <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4">
              <button onClick={() => { setView("choose"); setError(""); setInviteInput("") }} className="p-2 rounded-lg hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div>
                <h2 className="font-playfair text-2xl font-medium text-foreground">Join a room</h2>
                <p className="font-inter text-xs text-muted-foreground">Ask your partner for the 6-character code</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  id="invite-code-input"
                  type="text"
                  placeholder="e.g. XKTR72"
                  value={inviteInput}
                  onChange={(e) => { setInviteInput(e.target.value.toUpperCase()); setError("") }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                  maxLength={6}
                  autoFocus
                  className="h-14 text-center font-mono text-2xl tracking-[0.3em] bg-transparent border-0 border-b-2 border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary transition-all"
                />
                {inviteInput && (
                  <button onClick={() => setInviteInput("")} className="absolute right-0 top-1/2 -translate-y-1/2 p-1">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {error && <p className="font-inter text-xs text-destructive">{error}</p>}
              <Button
                id="join-room-submit"
                className="w-full h-12 rounded-xl font-inter font-medium"
                disabled={inviteInput.length !== 6 || joining}
                onClick={handleJoinRoom}
              >
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join room <LogIn className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
