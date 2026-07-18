/**
 * Async Unlock Logic — State Machine
 *
 * Rule: The gap between completed cycles of two partners can never exceed 1.
 *
 * canUnlockNextCycle(myCompleted, partnerCompleted):
 *   - I must have completed my current cycle
 *   - Partner must have completed at least (myCompleted - 1)
 *   - i.e., I can be at most 1 completed cycle ahead
 */

export interface UserProgress {
  user_id: string
  current_cycle_index: number
  completed_cycle_index: number
}

export interface UnlockResult {
  canProceed: boolean
  reason?: string
  partnerName?: string
  waitingForCycle?: number
}

export function canUnlockNextCycle(
  myProgress: UserProgress,
  partnerProgress: UserProgress,
  partnerName: string,
  totalCycles: number
): UnlockResult {
  // If I haven't completed my current cycle yet, I can't proceed
  if (myProgress.completed_cycle_index < myProgress.current_cycle_index) {
    return {
      canProceed: false,
      reason: "Submit your interpretation to continue",
    }
  }

  const nextCycle = myProgress.completed_cycle_index + 1

  // If we've finished all cycles
  if (nextCycle >= totalCycles) {
    return {
      canProceed: false,
      reason: "You've completed the book! 🎉",
    }
  }

  // Partner must have completed at least (nextCycle - 2)
  // This means the gap between my completed and partner's completed is at most 1
  if (partnerProgress.completed_cycle_index < nextCycle - 2) {
    const waitingForCycle = partnerProgress.completed_cycle_index + 1
    return {
      canProceed: false,
      reason: `Waiting for ${partnerName} to finish Cycle ${waitingForCycle + 1}`,
      partnerName,
      waitingForCycle,
    }
  }

  return { canProceed: true }
}

export function getPartnerStatusMessage(
  partnerProgress: UserProgress,
  partnerName: string
): string {
  if (partnerProgress.completed_cycle_index === -1) {
    return `${partnerName} hasn't started yet`
  }
  return `${partnerName} is on Cycle ${partnerProgress.current_cycle_index + 1}`
}
