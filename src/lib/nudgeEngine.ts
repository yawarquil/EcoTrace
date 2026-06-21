/**
 * @file Real-time contextual nudge engine for the log-activity form.
 *
 * Pure and O(n) with early exits. A nudge fires when a real trigger condition
 * is met (high-impact subtype selected, quantity crosses a threshold, etc.) and
 * quantifies the kg CO₂ delta of the suggested swap. The log form calls
 * {@link selectNudge} on each debounced input change.
 */

import { BETTER_ALTERNATIVES, type EcoTraceCategory } from './carbonFactors';
import { round } from './datetime';
import { sanitizeNumber } from './sanitize';

/** A nudge card to render inside the log form. */
export interface Nudge {
  /** Stable id for animation keys. */
  readonly id: string;
  /** Short headline. */
  readonly title: string;
  /** One-line coaching copy. */
  readonly body: string;
  /** Estimated kg CO₂ saved by taking the suggestion (>= 0). */
  readonly savingKg: number;
  /** Suggested lower-impact subtype label, if a swap exists. */
  readonly betterSubtype?: string;
}

/** Input the form passes on each debounced change. */
export interface NudgeInput {
  readonly category: EcoTraceCategory;
  readonly subtype: string;
  readonly quantity: number;
}

const HIGH_IMPACT_SUBTYPES = new Set(['Beef meal', 'Petrol car', 'Natural gas']);

/**
 * Select the best contextual nudge for the current form input, or `null`.
 *
 * Algorithm (early-exit, O(1) lookups):
 *  1. Find a registered better-alternative for the subtype.
 *  2. Compute the kg delta vs the current quantity.
 *  3. Only surface the nudge when the delta is meaningful (≥ 0.1 kg) so we
 *     never nag about negligible swaps.
 *  4. Add a "high-impact" framing nudge when the subtype itself is heavy even
 *     if no swap exists.
 *
 * @returns The single best nudge, or `null` when nothing is worth surfacing.
 */
export function selectNudge(input: NudgeInput): Nudge | null {
  const quantity = sanitizeNumber(input.quantity, 0, 100000, 0);
  if (quantity <= 0) return null;

  const alternative = BETTER_ALTERNATIVES.find(
    (item) => item.fromSubtype === input.subtype,
  );

  if (alternative) {
    // Delta requires the from-subtype factor; resolve lazily via category.
    const fromFactor = lookupFactor(input.category, input.subtype);
    const savingKg = round(
      Math.max(0, (fromFactor - alternative.betterFactor) * quantity),
      1,
    );
    // Always suggest the swap when one exists, even if tiny, but only quantify
    // the saving when it is meaningful.
    if (savingKg >= 0.1) {
      return {
        id: `nudge-swap-${alternative.betterSubtype}`,
        title: `Try a ${alternative.betterSubtype.toLowerCase()}`,
        body: alternative.copy,
        savingKg,
        betterSubtype: alternative.betterSubtype,
      };
    }
  }

  if (HIGH_IMPACT_SUBTYPES.has(input.subtype)) {
    return {
      id: `nudge-impact-${input.subtype}`,
      title: 'High-impact choice',
      body: `${input.subtype} is one of the heavier options in ${input.category}. Small reductions add up fast.`,
      savingKg: 0,
    };
  }

  return null;
}

/** Resolve a subtype's kg/unit factor within a category (0 if unknown). */
function lookupFactor(category: EcoTraceCategory, subtype: string): number {
  // Avoid a circular import by re-deriving the factor table locally.
  const FACTORS: Record<string, number> = {
    'Petrol car': 0.192,
    Train: 0.041,
    Bus: 0.089,
    'Beef meal': 6.61,
    'Vegetarian meal': 0.64,
    'Vegan meal': 0.39,
    Electricity: 0.475,
    'Natural gas': 2.04,
  };
  void category;
  return FACTORS[subtype] ?? 0;
}
