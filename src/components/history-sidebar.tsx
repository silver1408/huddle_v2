"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { History, ChevronRight, X } from "lucide-react"

interface HistorySidebarProps {
  completedCycleIndex: number
  currentCycleIndex: number
  roomId: string
}

export function HistorySidebar({ completedCycleIndex, currentCycleIndex, roomId }: HistorySidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  // We can only revisit cycles that have been fully completed by the user
  const completedCycles = Array.from({ length: completedCycleIndex + 1 }, (_, i) => i)

  if (completedCycles.length === 0) return null

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-card border border-l-0 border-border shadow-lg p-2 rounded-r-xl text-muted-foreground hover:text-foreground transition-colors z-40 hidden md:block"
        title="View Past Cycles"
      >
        <History className="h-5 w-5" />
      </button>

      {/* Mobile button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground shadow-lg p-4 rounded-full z-40 md:hidden"
        title="View Past Cycles"
      >
        <History className="h-6 w-6" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-card border-r border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-playfair text-xl font-medium flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Archive
          </h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {completedCycles.map((idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsOpen(false)
                router.push(`/read?roomId=${roomId}&cycle=${idx}`)
              }}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-accent text-left transition-colors group"
            >
              <div>
                <div className="font-medium">Cycle {idx + 1}</div>
                <div className="text-xs text-muted-foreground mt-1">Revisit story & writeups</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
          
          <button
            onClick={() => {
              setIsOpen(false)
              router.push(`/read?roomId=${roomId}`)
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-left transition-colors mt-6"
          >
            <div className="font-medium">Return to Current</div>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}
