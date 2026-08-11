// Tick verification math — used by /tick and /votes endpoints to decide
// whether a pending checkin should flip to 'confirmed' or 'rejected' after
// a new vote lands.

export type Vote = 'approve' | 'reject';
export type ConfirmationState = 'pending' | 'confirmed' | 'rejected';

/** Resolve the final state for a checkin given the current vote tallies.
 *
 *  Threshold = strict majority of OTHER active participants. With 4 peers,
 *  3 approvals make it pass; with 1 peer, 1 approval is enough.
 *
 *  Returns the new state or 'pending' if neither side has won yet. */
export function resolveState(
  approves: number,
  rejects: number,
  otherActiveCount: number,
): ConfirmationState {
  if (otherActiveCount <= 0) return 'confirmed'; // solo — auto-pass
  const threshold = Math.ceil(otherActiveCount / 2);
  if (approves >= threshold && approves > rejects) return 'confirmed';
  if (rejects >= threshold && rejects > approves) return 'rejected';
  return 'pending';
}
