/**
 * The OD-8 backlog levels: an operator is warned at 48 of the 60 global
 * slots, and again at capacity.
 *
 * Only the classification is here. Emitting the level-triggered attention
 * line and delivering it are later work (PR-E2 and OD-1), and nothing calls
 * this yet.
 */

import { BACKLOG_CAPACITY, BACKLOG_WARNING_THRESHOLD } from '../ledger/model';

export type BacklogAttention = 'normal' | 'warning' | 'full';

export function backlogAttention(count: number): BacklogAttention {
  if (count >= BACKLOG_CAPACITY) return 'full';
  if (count >= BACKLOG_WARNING_THRESHOLD) return 'warning';
  return 'normal';
}
