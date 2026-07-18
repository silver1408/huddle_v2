"use client"

import { useCallback, useEffect, useRef, useState, type MouseEvent, type TouchEvent } from "react"
import { createPortal } from "react-dom"
import { MessageSquarePlus, MessageSquareText, Search, Highlighter } from "lucide-react"
import { Highlight, parseHighlightedText } from "@/lib/highlight-utils"

interface ParagraphNote {
  id: string
  user_id: string
  content: string
}

interface InteractiveParagraphProps {
  text: string
  paragraphIndex: number
  cycleIndex: number
  currentUserId: string
  partnerName: string
  highlights: Highlight[]
  notes: ParagraphNote[]
  onAddHighlight: (startChar: number, endChar: number, textSnippet: string) => void
  onAddNote: (content: string) => void
  onDefine: (word: string) => void
}

interface ActiveSelection {
  start: number
  end: number
  text: string
}

interface SelectionRect {
  top: number
  left: number
  width: number
  height: number
}

export function InteractiveParagraph({
  text,
  paragraphIndex,
  cycleIndex,
  currentUserId,
  partnerName,
  highlights,
  notes,
  onAddHighlight,
  onAddNote,
  onDefine
}: InteractiveParagraphProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  
  // Selection toolbar state
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const [selectedRange, setSelectedRange] = useState<ActiveSelection | null>(null)
  
  const pRef = useRef<HTMLParagraphElement>(null)
  const selectedRangeRef = useRef<ActiveSelection | null>(null)
  const selectionTimerRef = useRef<any>(null)

  const clearStoredSelection = useCallback(() => {
    setSelectionRect(null)
    setSelectedRange(null)
    selectedRangeRef.current = null
  }, [])

  const getRangeOffset = useCallback((paragraph: HTMLParagraphElement, container: Node, offset: number) => {
    const rangeBeforeSelection = document.createRange()
    rangeBeforeSelection.selectNodeContents(paragraph)
    rangeBeforeSelection.setEnd(container, offset)
    return rangeBeforeSelection.toString().length
  }, [])

  const getSelectionRect = useCallback((range: Range, paragraph: HTMLParagraphElement): SelectionRect => {
    const clientRects = Array.from(range.getClientRects())
    const visibleRect = clientRects.find(rect => rect.width > 0 && rect.height > 0)
    const rect = visibleRect ?? range.getBoundingClientRect()

    if (rect.width > 0 || rect.height > 0) {
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }
    }

    const paragraphRect = paragraph.getBoundingClientRect()
    return {
      top: paragraphRect.top,
      left: paragraphRect.left,
      width: paragraphRect.width,
      height: paragraphRect.height,
    }
  }, [])

  const isInsideParagraph = useCallback((node: Node | null) => {
    if (!node || !pRef.current) return false
    const target = node.nodeType === Node.TEXT_NODE ? node.parentNode : node
    return !!target && pRef.current.contains(target)
  }, [])

  const readSelection = useCallback(() => {
    const selection = window.getSelection()
    const paragraph = pRef.current

    if (!selection || !paragraph || selection.rangeCount === 0 || selection.isCollapsed) {
      clearStoredSelection()
      return
    }

    const range = selection.getRangeAt(0)

    if (!isInsideParagraph(range.startContainer) || !isInsideParagraph(range.endContainer)) {
      clearStoredSelection()
      return
    }

    const rawSelectedText = selection.toString()
    const selectedText = rawSelectedText.trim()

    if (selectedText.length === 0) {
      clearStoredSelection()
      return
    }

    const leadingWhitespace = rawSelectedText.length - rawSelectedText.trimStart().length
    const trailingWhitespace = rawSelectedText.length - rawSelectedText.trimEnd().length
    const startOffset = getRangeOffset(paragraph, range.startContainer, range.startOffset) + leadingWhitespace
    const endExclusive = getRangeOffset(paragraph, range.endContainer, range.endOffset) - trailingWhitespace
    const startChar = Math.max(0, Math.min(text.length - 1, startOffset))
    const endChar = Math.max(startChar, Math.min(text.length - 1, endExclusive - 1))

    const selectionData = {
      start: startChar,
      end: endChar,
      text: text.slice(startChar, endChar + 1).trim() || selectedText,
    }

    selectedRangeRef.current = selectionData
    setSelectedRange(selectionData)
    setSelectionRect(getSelectionRect(range, paragraph))
  }, [clearStoredSelection, getRangeOffset, getSelectionRect, isInsideParagraph, text])

  const scheduleSelectionRead = useCallback((delayOrEvent: any = 80) => {
    const delay = typeof delayOrEvent === 'number' ? delayOrEvent : 80;
    if (selectionTimerRef.current) {
      window.clearTimeout(selectionTimerRef.current)
    }

    window.requestAnimationFrame(readSelection)
    selectionTimerRef.current = window.setTimeout(readSelection, delay)
  }, [readSelection])

  // Listen for selection changes globally
  useEffect(() => {
    document.addEventListener("selectionchange", scheduleSelectionRead)

    return () => {
      document.removeEventListener("selectionchange", scheduleSelectionRead)
      if (selectionTimerRef.current) {
        window.clearTimeout(selectionTimerRef.current)
      }
    }
  }, [scheduleSelectionRead])

  const clearNativeSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    clearStoredSelection()
  }, [clearStoredSelection])

  const handleHighlight = () => {
    const activeSelection = selectedRangeRef.current ?? selectedRange
    if (activeSelection) {
      onAddHighlight(activeSelection.start, activeSelection.end, activeSelection.text)
      clearNativeSelection()
    }
  }

  const handleDefine = () => {
    const activeSelection = selectedRangeRef.current ?? selectedRange
    if (activeSelection) {
      // Only define single words or short phrases
      const words = activeSelection.text.trim().split(/\s+/)
      if (words.length <= 3) {
        const word = words[0].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
        if (word) onDefine(word)
      }
      clearNativeSelection()
    }
  }

  const runToolbarAction = (
    event: any,
    action: () => void
  ) => {
    event.preventDefault()
    event.stopPropagation()
    action()
  }

  const submitNote = () => {
    if (noteContent.trim()) {
      onAddNote(noteContent.trim())
      setNoteContent("")
      setShowNoteForm(false)
    }
  }

  const spans = parseHighlightedText(text, highlights, currentUserId, cycleIndex)
  const isFirstParagraph = paragraphIndex === 0

  return (
    <div 
      className="relative mb-6 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id={`paragraph-${paragraphIndex}`}
    >
      <div className="relative pr-8 md:pr-0">
        <p 
          ref={pRef}
          onMouseUp={() => scheduleSelectionRead(0)}
          onTouchEnd={() => scheduleSelectionRead(180)}
          onKeyUp={() => scheduleSelectionRead(0)}
          className={`select-text ${isFirstParagraph ? "first-letter:float-left first-letter:text-6xl first-letter:pr-3 first-letter:font-playfair first-letter:text-foreground first-letter:mt-2 first-letter:font-medium" : ""}`}
          style={{ WebkitUserSelect: "text", userSelect: "text", WebkitTouchCallout: "default" }}
        >
          {spans.map((span, idx) => (
            <span key={idx} className={span.classes || undefined}>{span.text}</span>
          ))}
        </p>

        {/* Note Indicator / Add Note Button */}
        <div className={`absolute right-0 md:-right-12 top-1 transition-opacity duration-300 ${isHovered || notes.length > 0 || showNoteForm ? 'opacity-100' : 'opacity-30 md:opacity-0'}`}>
          {notes.length > 0 ? (
            <button 
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="p-1.5 text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
              title="View/Add notes"
            >
              <MessageSquareText className="h-4 w-4" />
            </button>
          ) : (
            <button 
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              title="Add a note to this paragraph"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Selection Toolbar */}
      {selectionRect && selectedRange && typeof document !== "undefined" && createPortal(
        <>
          {/* Mobile Sticky Bottom Bar */}
          <div className="md:hidden fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-card border border-border shadow-2xl rounded-full overflow-hidden animate-in slide-in-from-bottom-5">
            <button 
              onPointerDown={(event) => runToolbarAction(event, handleHighlight)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors border-r border-border touch-manipulation"
            >
              <Highlighter className="h-4 w-4 text-emerald-500 pointer-events-none" />
              <span className="pointer-events-none">Highlight</span>
            </button>
            {selectedRange.text.split(/\s+/).length <= 3 && (
              <button 
                onPointerDown={(event) => runToolbarAction(event, handleDefine)}
                className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors touch-manipulation"
              >
                <Search className="h-4 w-4 text-primary pointer-events-none" />
                <span className="pointer-events-none">Define</span>
              </button>
            )}
          </div>

          {/* Desktop Floating Bar */}
          <div 
            className="hidden md:flex fixed z-[100] items-center bg-card border border-border shadow-lg rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
              top: `${selectionRect.top - 50}px`,
              left: `${selectionRect.left + (selectionRect.width / 2)}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <button 
              onPointerDown={(event) => runToolbarAction(event, handleHighlight)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors border-r border-border"
            >
              <Highlighter className="h-4 w-4 text-emerald-500" />
              Highlight
            </button>
            {selectedRange.text.split(/\s+/).length <= 3 && (
              <button 
                onPointerDown={(event) => runToolbarAction(event, handleDefine)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Search className="h-4 w-4 text-primary" />
                Define
              </button>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Notes Container */}
      {(showNoteForm || notes.length > 0) && (
        <div className="mt-4 pl-6 border-l-2 border-border/50 space-y-4 font-inter">
          {notes.map(note => {
            const isMe = note.user_id === currentUserId
            return (
              <div key={note.id} className="text-sm">
                <span className={`font-semibold mr-2 ${isMe ? 'text-primary' : 'text-amber-600 dark:text-amber-500'}`}>
                  {isMe ? "You" : partnerName}:
                </span>
                <span className="text-muted-foreground/90 leading-relaxed">{note.content}</span>
              </div>
            )
          })}
          
          {showNoteForm && (
            <div className="flex gap-3 pt-2">
              <input 
                type="text"
                placeholder="Write a note about this paragraph..."
                className="flex-1 bg-transparent border-b border-border/50 focus:border-primary focus:outline-none py-1 text-sm text-foreground transition-colors placeholder:italic"
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitNote()}
                autoFocus
              />
              <button 
                onClick={submitNote}
                disabled={!noteContent.trim()}
                className="text-xs font-medium text-primary uppercase tracking-widest disabled:opacity-50 transition-opacity"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
