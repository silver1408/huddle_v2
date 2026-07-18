"use client"

import { useEffect, useState } from "react"
import { Loader2, X, Volume2 } from "lucide-react"

interface DictionaryModalProps {
  word: string
  onClose: () => void
}

export function DictionaryModal({ word, onClose }: DictionaryModalProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchDefinition = async () => {
      try {
        const res = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`)
        if (!res.ok) throw new Error("Not found")
        const json = await res.json()
        setData(json[0])
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchDefinition()
  }, [word])

  const playAudio = () => {
    if (data?.phonetics) {
      const phonetic = data.phonetics.find((p: any) => p.audio)
      if (phonetic?.audio) {
        new Audio(phonetic.audio).play()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden font-inter animate-in zoom-in-95 duration-300">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Looking up "{word}"...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2 text-center">
              <p className="font-playfair text-xl text-foreground">Definition not found</p>
              <p className="text-sm text-muted-foreground">We couldn't find a definition for "{word}".</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-playfair text-3xl font-medium text-foreground">{data.word}</h3>
                  {data.phonetics?.some((p: any) => p.audio) && (
                    <button onClick={playAudio} className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors">
                      <Volume2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {data.phonetic && (
                  <p className="text-sm text-muted-foreground">{data.phonetic}</p>
                )}
              </div>

              <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {data.meanings.map((meaning: any, i: number) => (
                  <div key={i} className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {meaning.partOfSpeech}
                    </p>
                    <ul className="space-y-4">
                      {meaning.definitions.slice(0, 3).map((def: any, j: number) => (
                        <li key={j} className="text-sm text-foreground/90 leading-relaxed">
                          <span className="text-muted-foreground/50 mr-2">{j + 1}.</span>
                          {def.definition}
                          {def.example && (
                            <p className="mt-1.5 text-muted-foreground italic font-lora">
                              "{def.example}"
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
