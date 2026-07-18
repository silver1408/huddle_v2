import { getCycle } from "@/lib/gutenberg-loader"
import { getBookBySlug } from "@/lib/book-catalogue"
import { NextRequest } from "next/server"

interface Params {
  params: Promise<{ bookId: string; cycleIndex: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { bookId, cycleIndex } = await params
  const idx = parseInt(cycleIndex, 10)

  if (isNaN(idx) || idx < 0) {
    return Response.json({ error: "Invalid cycle index" }, { status: 400 })
  }

  const book = getBookBySlug(bookId)
  if (!book) {
    return Response.json({ error: "Book not found" }, { status: 404 })
  }

  try {
    const cycle = await getCycle(book.slug, book.gutenbergId, idx)
    if (!cycle) {
      return Response.json({ error: "Cycle not found" }, { status: 404 })
    }

    return Response.json({
      cycleIndex: idx,
      content: cycle.content,
      wordCount: cycle.wordCount,
      totalCycles: book.totalCycles,
      bookTitle: book.title,
      bookAuthor: book.author,
    })
  } catch (err) {
    console.error("Failed to load book cycle:", err)
    return Response.json({ error: "Failed to load book content" }, { status: 500 })
  }
}
