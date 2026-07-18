import path from "path"
import fs from "fs/promises"

// ─── In-memory cache: slug → array of cycle texts ──────────────────────────
const bookCache = new Map<string, string[]>()

// Words per reading cycle
const WORDS_PER_CYCLE = 500

// ─── Gutenberg boilerplate markers ─────────────────────────────────────────
const START_MARKERS = [
  "*** START OF THE PROJECT GUTENBERG",
  "*** START OF THIS PROJECT GUTENBERG",
  "*END*THE SMALL PRINT",
  "End of the Project Gutenberg",
]
const END_MARKERS = [
  "*** END OF THE PROJECT GUTENBERG",
  "*** END OF THIS PROJECT GUTENBERG",
  "End of Project Gutenberg",
  "End of the Project Gutenberg",
]

function stripGutenbergBoilerplate(text: string): string {
  let start = 0
  let end = text.length

  for (const marker of START_MARKERS) {
    const idx = text.indexOf(marker)
    if (idx !== -1) {
      // Find the next newline after the marker line
      const newline = text.indexOf("\n", idx)
      if (newline !== -1) start = Math.max(start, newline + 1)
    }
  }

  for (const marker of END_MARKERS) {
    const idx = text.indexOf(marker)
    if (idx !== -1) end = Math.min(end, idx)
  }

  return text.slice(start, end).trim()
}

/**
 * Split raw text into chunks of approximately WORDS_PER_CYCLE words,
 * always breaking on double-newline (paragraph) boundaries.
 * This is deterministic: same input → same output always.
 */
function chunkText(text: string): string[] {
  // Split into paragraphs (double newline)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20) // drop very short / blank paragraphs

  const cycles: string[] = []
  let currentChunk: string[] = []
  let wordCount = 0

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length
    currentChunk.push(para)
    wordCount += paraWords

    if (wordCount >= WORDS_PER_CYCLE) {
      cycles.push(currentChunk.join("\n\n"))
      currentChunk = []
      wordCount = 0
    }
  }

  // Push any remaining paragraphs as the final cycle
  if (currentChunk.length > 0) {
    cycles.push(currentChunk.join("\n\n"))
  }

  return cycles
}

/**
 * Fetch raw text from Project Gutenberg.
 * Tries the cached mirror URL first.
 */
async function fetchFromGutenberg(gutenbergId: number): Promise<string> {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}.txt`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "ReadAlong/2.0 (educational reading app)" },
        // Cache at the fetch layer for 24h
        next: { revalidate: 86400 },
      } as RequestInit)
      if (res.ok) {
        return await res.text()
      }
    } catch {
      // try next URL
    }
  }

  throw new Error(`Could not fetch Gutenberg book #${gutenbergId}`)
}

/**
 * Load and chunk a book by its slug.
 * Results are cached in memory for the lifetime of the serverless instance.
 */
export async function loadBook(slug: string, gutenbergId: number | null): Promise<string[]> {
  if (bookCache.has(slug)) {
    return bookCache.get(slug)!
  }

  let rawText: string

  if (gutenbergId === null) {
    // Local file fallback (1984)
    const filePath = path.join(process.cwd(), "public", "1984.txt")
    rawText = await fs.readFile(filePath, "utf-8")
  } else {
    rawText = await fetchFromGutenberg(gutenbergId)
  }

  const cleaned = stripGutenbergBoilerplate(rawText)
  const chunks = chunkText(cleaned)

  bookCache.set(slug, chunks)
  return chunks
}

/**
 * Get a single cycle's text.
 */
export async function getCycle(
  slug: string,
  gutenbergId: number | null,
  cycleIndex: number
): Promise<{ content: string; wordCount: number } | null> {
  const cycles = await loadBook(slug, gutenbergId)
  const content = cycles[cycleIndex]
  if (!content) return null
  return {
    content,
    wordCount: content.split(/\s+/).length,
  }
}

/**
 * Get the total number of cycles for a book.
 * Used to validate the hardcoded totalCycles value.
 */
export async function getTotalCycles(slug: string, gutenbergId: number | null): Promise<number> {
  const cycles = await loadBook(slug, gutenbergId)
  return cycles.length
}
