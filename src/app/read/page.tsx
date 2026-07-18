"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { HistorySidebar } from "@/components/history-sidebar"
import { InteractiveParagraph } from "@/components/interactive-paragraph"
import { DictionaryModal } from "@/components/dictionary-modal"
import { Highlight } from "@/lib/highlight-utils"
import {
  Send,
  Loader2,
  LogOut,
  Clock,
  Check,
  ChevronDown,
  Quote,
} from "lucide-react"

interface ParagraphNote {
  id: string
  user_id: string
  paragraph_index: number
  content: string
}

interface CycleData {
  content: string
  wordCount: number
  cycleIndex: number
  bookTitle: string
  bookAuthor: string
  totalCycles: number
}

interface ProgressData {
  current_cycle_index: number
  completed_cycle_index: number
}

const MIN_CHARS = 300
const MAX_CHARS = 840

function ReadPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryCycle = searchParams.get("cycle")
  const roomId = searchParams.get("roomId")
  const supabase = createClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [cycle, setCycle] = useState<CycleData | null>(null)
  const [bookSlug, setBookSlug] = useState<string | null>(null)

  // Interactive features state
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [notes, setNotes] = useState<ParagraphNote[]>([])
  const [wordToDefine, setWordToDefine] = useState<string | null>(null)
  const [myProgress, setMyProgress] = useState<ProgressData>({
    current_cycle_index: 0,
    completed_cycle_index: -1,
  })
  const [partnerProgress, setPartnerProgress] = useState<ProgressData>({
    current_cycle_index: 0,
    completed_cycle_index: -1,
  })
  const [partnerName, setPartnerName] = useState("Partner")
  const [myColor, setMyColor] = useState("blue")
  const [totalCycles, setTotalCycles] = useState(0)
  const [interpretation, setInterpretation] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState("")
  const [showContent, setShowContent] = useState(false)
  const [historicalResponses, setHistoricalResponses] = useState<{ myResponse: { interpretation: string } | null; partnerResponse: { interpretation: string } | null } | null>(null)
  const [viewingPartner, setViewingPartner] = useState(false)
  const [checkingUnlock, setCheckingUnlock] = useState(false)

  const fetchCycleContent = useCallback(async (slug: string, idx: number) => {
    const res = await fetch(`/api/books/${slug}/cycle/${idx}`)
    if (!res.ok) return null
    return await res.json() as CycleData & { cycleIndex: number }
  }, [])

  const fetchProgress = useCallback(async (cycleIndexOverride?: string | null) => {
    if (!roomId) return
    try {
      const url = `/api/progress?roomId=${roomId}` + (cycleIndexOverride ? `&cycleIndex=${cycleIndexOverride}` : "")
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      setMyProgress(data.myProgress)
      setPartnerProgress(data.partnerProgress)
      setPartnerName(data.partnerName)
      setMyColor(data.myColor ?? "blue")
      setTotalCycles(data.totalCycles ?? 0)

      const slug = data.book?.slug
      if (slug) setBookSlug(slug)

      const cycleIdx = cycleIndexOverride !== null && cycleIndexOverride !== undefined
        ? parseInt(cycleIndexOverride, 10)
        : data.myProgress.current_cycle_index

      // Fetch cycle content from Gutenberg loader
      if (slug) {
        const cycleData = await fetchCycleContent(slug, cycleIdx)
        if (cycleData) {
          setCycle({
            content: cycleData.content,
            wordCount: cycleData.wordCount,
            cycleIndex: cycleIdx,
            bookTitle: cycleData.bookTitle,
            bookAuthor: cycleData.bookAuthor,
            totalCycles: cycleData.totalCycles,
          })
          setTotalCycles(cycleData.totalCycles)
        }
      }

      if (data.myProgress.completed_cycle_index >= data.myProgress.current_cycle_index) {
        setSubmitted(true)
        if (data.myProgress.completed_cycle_index === data.myProgress.current_cycle_index) {
          const unlockRes = await fetch("/api/check-unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId }),
          })
          const unlockData = await unlockRes.json()
          if (!unlockData.unlocked) {
            setBlocked(true)
            setBlockReason(unlockData.unlockResult?.reason ?? "Waiting for partner...")
          }
        }
      } else {
        setSubmitted(false)
        setBlocked(false)
      }

      // Fetch highlights and notes
      if (slug) {
        const isHistorical = cycleIdx <= data.myProgress.completed_cycle_index && cycleIdx < data.myProgress.current_cycle_index

        const [highlightsRes, notesRes] = await Promise.all([
          fetch(`/api/highlights?roomId=${roomId}&cycleIndex=${cycleIdx}`),
          fetch(`/api/paragraph-notes?roomId=${roomId}&cycleIndex=${cycleIdx}`),
        ])
        if (highlightsRes.ok) {
          const hData = await highlightsRes.json()
          setHighlights([...hData.myHighlights, ...hData.partnerHighlights])
        }
        if (notesRes.ok) {
          const nData = await notesRes.json()
          setNotes([...nData.myNotes, ...nData.partnerNotes])
        }

        if (isHistorical) {
          const respRes = await fetch(`/api/responses?roomId=${roomId}&cycleIndex=${cycleIdx}`)
          if (respRes.ok) {
            const respData = await respRes.json()
            setHistoricalResponses(respData)
          }
        } else {
          setHistoricalResponses(null)
          setViewingPartner(false)
        }
      }

      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [roomId, fetchCycleContent])

  useEffect(() => {
    if (!roomId) { router.push("/"); return }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return }
      setCurrentUserId(data.user.id)
      fetchProgress(queryCycle)
    })
  }, [router, fetchProgress, queryCycle, roomId])

  // Poll for unlock while blocked
  useEffect(() => {
    if (!blocked || !roomId) return

    const interval = setInterval(async () => {
      setCheckingUnlock(true)
      try {
        const res = await fetch("/api/check-unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        })
        const data = await res.json()
        if (data.unlocked) {
          setBlocked(false)
          setSubmitted(false)
          setInterpretation("")
          setShowContent(false)
          fetchProgress(queryCycle)
        }
      } catch { /* ignore */ }
      setCheckingUnlock(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [blocked, roomId, fetchProgress])

  const handleSubmit = async () => {
    if (!currentUserId || !cycle || interpretation.length < MIN_CHARS || interpretation.length > MAX_CHARS) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, cycleIndex: cycle.cycleIndex, interpretation }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setSubmitted(true)
        if (data.nextCycleIndex !== null) {
          setTimeout(() => {
            setSubmitted(false)
            setInterpretation("")
            setShowContent(false)
            window.scrollTo({ top: 0, behavior: "smooth" })
            fetchProgress(queryCycle)
          }, 1500)
        } else {
          setBlocked(true)
          setBlockReason(data.unlockResult?.reason ?? "Waiting for partner...")
        }
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const handleAddHighlight = async (paragraphIndex: number, startChar: number, endChar: number, textSnippet: string) => {
    if (!currentUserId || !cycle || !roomId) return
    const optimisticHighlight: Highlight = {
      id: Math.random().toString(),
      user_id: currentUserId,
      paragraph_index: paragraphIndex,
      start_char: startChar,
      end_char: endChar,
      color: myColor,
      text_snippet: textSnippet,
    }
    setHighlights((prev) => [...prev, optimisticHighlight])

    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, cycleIndex: cycle.cycleIndex, paragraphIndex, startChar, endChar, textSnippet }),
      })
      if (!res.ok) {
        setHighlights((prev) => prev.filter((h) => h.id !== optimisticHighlight.id))
      } else {
        const data = await res.json()
        setHighlights((prev) => prev.map((h) => (h.id === optimisticHighlight.id ? data.highlight : h)))
      }
    } catch {
      setHighlights((prev) => prev.filter((h) => h.id !== optimisticHighlight.id))
    }
  }

  const handleAddNote = async (paragraphIndex: number, content: string) => {
    if (!currentUserId || !cycle || !roomId) return
    const optimisticNote = { id: Math.random().toString(), user_id: currentUserId, paragraph_index: paragraphIndex, content }
    setNotes((prev) => [...prev, optimisticNote])

    try {
      const res = await fetch("/api/paragraph-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, cycleIndex: cycle.cycleIndex, paragraphIndex, content }),
      })
      if (!res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== optimisticNote.id))
      } else {
        const data = await res.json()
        setNotes((prev) => prev.map((n) => (n.id === optimisticNote.id ? data.note : n)))
      }
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== optimisticNote.id))
    }
  }

  const scrollToParagraph = (index: number) => {
    const el = document.getElementById(`paragraph-${index}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("bg-accent/30", "transition-colors", "duration-500")
      setTimeout(() => el.classList.remove("bg-accent/30"), 1500)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const charCount = interpretation.length
  const charPercent = Math.min((charCount / MAX_CHARS) * 100, 100)
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS
  const progressPercent = totalCycles > 0 ? (myProgress.current_cycle_index / totalCycles) * 100 : 0
  const partnerIsAheadOrEqual = partnerProgress.completed_cycle_index >= myProgress.current_cycle_index

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isHistorical = historicalResponses !== null

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-primary/20 selection:text-primary">
      {wordToDefine && <DictionaryModal word={wordToDefine} onClose={() => setWordToDefine(null)} />}
      <HistorySidebar completedCycleIndex={myProgress.completed_cycle_index} currentCycleIndex={myProgress.current_cycle_index} roomId={roomId ?? ""} />

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1.5 bg-background">
        <div className="h-full bg-foreground transition-all duration-1000 ease-in-out" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Floating controls */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3 mix-blend-difference text-stone-300">
        <ThemeToggle />
        <button onClick={handleLogout} className="p-2 hover:text-white transition-colors" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <main className="flex-1 max-w-[70ch] mx-auto w-full px-6 md:px-12 pt-24">
        {/* Book info */}
        <div className="mb-16 text-center animate-in fade-in duration-1000">
          <h2 className="font-playfair text-xl md:text-2xl italic text-muted-foreground/80 mb-2">
            {cycle?.bookTitle ?? ""}
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground/50">
            <span>Cycle {cycle ? cycle.cycleIndex + 1 : myProgress.current_cycle_index + 1}</span>
            <span>·</span>
            <span>{totalCycles} Total</span>
            {isHistorical && (
              <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary rounded-full font-medium">Archive</span>
            )}
          </div>
        </div>

        {/* Reading Content */}
        {cycle ? (
          <>
            {!showContent && !isHistorical ? (
              <div className="flex flex-col items-center justify-center py-20 min-h-[40vh] animate-in fade-in zoom-in-95 duration-1000">
                <div className={`mb-12 px-5 py-3 rounded-2xl flex items-center gap-3 text-sm transition-all duration-500 shadow-sm border ${partnerIsAheadOrEqual ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"}`}>
                  {partnerIsAheadOrEqual ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  <span className="font-medium">
                    {partnerIsAheadOrEqual
                      ? `${partnerName} has completed this cycle.`
                      : `${partnerName} is on cycle ${partnerProgress.current_cycle_index + 1}.`}
                  </span>
                </div>
                <button
                  onClick={() => setShowContent(true)}
                  className="group relative px-8 py-4 rounded-full border border-border/60 bg-card hover:bg-accent/50 hover:border-border transition-all duration-500 hover:shadow-lg overflow-hidden"
                >
                  <div className="relative z-10 flex items-center gap-3 text-foreground">
                    <span className="font-playfair italic text-xl">Begin Reading</span>
                    <ChevronDown className="h-5 w-5 group-hover:translate-y-1 transition-transform duration-300" />
                  </div>
                </button>
              </div>
            ) : (
              <article className="reader-prose animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both">
                {cycle.content.split("\n").map((paragraph, i) =>
                  paragraph.trim() ? (
                    <InteractiveParagraph
                      key={i}
                      text={paragraph.trim()}
                      paragraphIndex={i}
                      cycleIndex={cycle.cycleIndex}
                      currentUserId={currentUserId ?? ""}
                      partnerName={partnerName}
                      highlights={highlights.filter((h) => h.paragraph_index === i)}
                      notes={notes.filter((n) => n.paragraph_index === i)}
                      onAddHighlight={(start, end, snippet) => handleAddHighlight(i, start, end, snippet)}
                      onAddNote={(content) => handleAddNote(i, content)}
                      onDefine={(word) => setWordToDefine(word)}
                    />
                  ) : null
                )}
              </article>
            )}
          </>
        ) : (
          <div className="text-center py-32 font-playfair italic text-2xl text-muted-foreground/40">
            No content available.
          </div>
        )}

        {/* Historical writeups */}
        {isHistorical && historicalResponses && (
          <div className="mt-32 pt-16 border-t border-border/30 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <h3 className="font-playfair text-3xl text-foreground">Writeups</h3>
              <div className="flex bg-accent rounded-full p-1 border border-border/50 shadow-inner w-full sm:w-auto">
                <button
                  onClick={() => setViewingPartner(false)}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${!viewingPartner ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
                >
                  My Version
                </button>
                <button
                  onClick={() => setViewingPartner(true)}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${viewingPartner ? "bg-card text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {partnerName}&apos;s Version
                </button>
              </div>
            </div>
            <div className="relative p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm min-h-[220px]">
              <p className="font-lora text-lg leading-relaxed whitespace-pre-wrap">
                {!viewingPartner
                  ? historicalResponses.myResponse?.interpretation || <span className="text-muted-foreground italic">No writeup found.</span>
                  : historicalResponses.partnerResponse?.interpretation || <span className="text-muted-foreground italic">No writeup found.</span>}
              </p>
            </div>
          </div>
        )}

        {/* Reflection section */}
        {showContent && !submitted && !isHistorical && (
          <div className="mt-32 pt-16 border-t border-border/30 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="mb-8">
              <h3 className="font-playfair text-3xl mb-3 text-foreground">Reflections</h3>
              <p className="font-inter text-sm text-muted-foreground/80 leading-relaxed max-w-md">
                Take a moment to write down your thoughts. Your partner will only see this once you both finish the cycle.
              </p>
            </div>

            {highlights.filter((h) => h.user_id === currentUserId).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {highlights.filter((h) => h.user_id === currentUserId).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => scrollToParagraph(h.paragraph_index)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:opacity-80 bg-${h.color}-500/10 border-${h.color}-500/30 text-${h.color}-700 dark:text-${h.color}-400`}
                  >
                    <Quote className="h-3 w-3" />
                    Ref: {h.text_snippet ? (h.text_snippet.length > 20 ? h.text_snippet.substring(0, 20) + "..." : h.text_snippet) : `Paragraph ${h.paragraph_index + 1}`}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-2xl -z-10 shadow-sm border border-border/50" />
              <Textarea
                placeholder="What stood out to you in this passage?"
                value={interpretation}
                onChange={(e) => setInterpretation(e.target.value)}
                className="min-h-[220px] resize-none font-lora text-lg leading-relaxed bg-transparent border-0 focus-visible:ring-0 p-6 sm:p-8 placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-playfair"
                maxLength={MAX_CHARS + 50}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-6 px-2">
              <div className="flex flex-col gap-1 w-full sm:w-1/2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Characters</span>
                  <span className={charCount < MIN_CHARS ? "text-amber-500/80" : charCount > MAX_CHARS ? "text-destructive/80" : "text-emerald-500/80"}>
                    {charCount} / {MAX_CHARS}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-border/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${charCount > MAX_CHARS ? "bg-destructive" : charCount >= MIN_CHARS ? "bg-emerald-500" : "bg-foreground/30"}`}
                    style={{ width: `${charPercent}%` }}
                  />
                </div>
                {charCount > 0 && charCount < MIN_CHARS && (
                  <p className="text-[10px] text-amber-500/80 mt-1">Need {MIN_CHARS - charCount} more characters</p>
                )}
              </div>
              <Button
                className="w-full sm:w-auto h-12 px-8 rounded-full font-inter font-medium tracking-wide transition-all duration-300 hover:shadow-md"
                onClick={handleSubmit}
                disabled={!isValidLength || submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Seal & Submit</span><Send className="h-3.5 w-3.5 ml-2.5" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* Submitted & waiting */}
        {submitted && (
          <div className="mt-32 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            {blocked ? (
              <div className="p-10 rounded-3xl bg-card border border-border/50 shadow-sm max-w-sm mx-auto">
                <Clock className="h-8 w-8 mx-auto text-amber-500/60 mb-6 animate-pulse" />
                <h4 className="font-playfair text-2xl mb-2 text-foreground">Waiting for {partnerName}</h4>
                <p className="font-inter text-sm text-muted-foreground/80 leading-relaxed mb-6">{blockReason}</p>
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {checkingUnlock ? <><Loader2 className="h-3 w-3 animate-spin" /> Checking...</> : <span>Auto-checking</span>}
                </div>
              </div>
            ) : (
              <div className="p-10 rounded-3xl bg-card border border-border/50 shadow-sm max-w-sm mx-auto">
                <div className="h-16 w-16 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <h4 className="font-playfair text-2xl mb-2 text-foreground">Submitted</h4>
                <p className="font-inter text-sm text-muted-foreground/80 mb-6">Preparing the next cycle...</p>
                <Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground/40" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ReadPageContent />
    </Suspense>
  )
}
