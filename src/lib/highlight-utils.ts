export interface Highlight {
  id: string
  user_id: string
  paragraph_index: number
  start_char: number
  end_char: number
  color: string
  text_snippet?: string
}

export function parseHighlightedText(
  text: string,
  highlights: Highlight[],
  currentUserId: string,
  cycleIndex: number
) {
  // We need to know who is who. The DB will have different user IDs.
  // Instead of passing full user objects, we can just group highlights by user_id.
  
  if (highlights.length === 0) {
    return [{ text, classes: "" }]
  }

  // Get unique users who highlighted
  const userIds = Array.from(new Set(highlights.map(h => h.user_id)))
  
  // Sort user IDs to have a consistent order for determining "primary" vs "secondary" for styles
  // We can just use the cycle index to alternate styles.
  // If user A is the current user, their style is determined by cycle index.

  const chars = text.split("")
  const charData = chars.map((char, index) => {
    let classes = ""
    
    const activeHighlights = highlights.filter(
      h => index >= h.start_char && index <= h.end_char
    )

    if (activeHighlights.length > 0) {
      activeHighlights.forEach(h => {
        const isCurrentUser = h.user_id === currentUserId
        // Alternate styles based on cycle index
        // Cycle 1 (odd): current user = bg, partner = outline
        // Cycle 2 (even): current user = outline, partner = bg
        const isOddCycle = cycleIndex % 2 !== 0

        let styleType = "bg"
        if (isCurrentUser) {
          styleType = isOddCycle ? "bg" : "outline"
        } else {
          styleType = isOddCycle ? "outline" : "bg"
        }

        const colorBase = h.color // e.g., "blue" or "amber"

        if (styleType === "bg") {
          classes += ` bg-${colorBase}-500/20 text-${colorBase}-900 dark:text-${colorBase}-100`
        } else {
          classes += ` underline decoration-${colorBase}-500/50 decoration-wavy underline-offset-4`
        }
      })
    }

    return { char, classes: classes.trim() }
  })

  // Group adjacent identical classes
  const spans: { text: string; classes: string }[] = []
  let currentSpan = { text: charData[0].char, classes: charData[0].classes }

  for (let i = 1; i < charData.length; i++) {
    if (charData[i].classes === currentSpan.classes) {
      currentSpan.text += charData[i].char
    } else {
      spans.push(currentSpan)
      currentSpan = { text: charData[i].char, classes: charData[i].classes }
    }
  }
  spans.push(currentSpan)

  return spans
}
