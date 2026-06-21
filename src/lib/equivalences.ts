/**
 * @file Personalized CO₂ equivalences.
 *
 * Converts the user's REAL entries into relatable comparisons ("your week of
 * driving = N coffees / phone charges / km cycled"). Equivalences rotate so the
 * same three are not always shown — driven entirely by actual entries, never
 * hardcoded per the personalization requirement.
 */

import { round } from './datetime';
import type { ActivityEntry } from '@/types';

/** Reference constants for the equivalence comparisons. */
export const EQUIVALENCE_FACTORS = {
  // kg CO₂ per unit of the relatable comparator.
  coffeeCup: 0.28, // ~0.28 kg per cup of coffee (farm-to-cup)
  phoneCharge: 0.0082, // ~8.2 g per full phone charge
  kmCycledSaved: 0.192, // avoided petrol-km equivalent
  treeYear: 21, // kg CO₂ absorbed by one mature tree per year
  boilingWater: 0.06, // kg per litre of water boiled
} as const;

type EquivalenceKind = keyof typeof EQUIVALENCE_FACTORS;

/** A computed equivalence comparison. */
export interface Equivalence {
  id: EquivalenceKind;
  label: string;
  /** Computed count (rounded, human-friendly). */
  count: number;
  /** The source kg the comparison was built from. */
  sourceKg: number;
}

const LABELS: Record<EquivalenceKind, (count: number) => string> = {
  coffeeCup: (c) => `${c} cups of coffee`,
  phoneCharge: (c) => `${c} phone charges`,
  kmCycledSaved: (c) => `${c} km of avoided driving`,
  treeYear: (c) => `${c} tree-year${c === 1 ? '' : 's'} of CO₂`,
  boilingWater: (c) => `${c} litres of boiled water`,
};

/**
 * Build a rotating set of equivalences from the user's actual monthly CO₂.
 *
 * @param monthCO2 - Real monthly CO₂ in kg.
 * @param seedOffset - Rotates which equivalences appear (e.g. day-of-month).
 * @returns Up to 3 equivalences, never fewer than 1 when monthCO2 > 0.
 */
export function buildEquivalences(
  monthCO2: number,
  seedOffset = 0,
): Equivalence[] {
  if (monthCO2 <= 0) return [];
  const kinds = Object.keys(EQUIVALENCE_FACTORS) as EquivalenceKind[];
  // Rotate the order by seedOffset so the displayed set varies day to day.
  const ordered = [
    ...kinds.slice(seedOffset % kinds.length),
    ...kinds.slice(0, seedOffset % kinds.length),
  ];
  return ordered.slice(0, 3).map((kind) => {
    const factor = EQUIVALENCE_FACTORS[kind];
    const count = Math.max(1, Math.round(monthCO2 / factor));
    return {
      id: kind,
      label: LABELS[kind](count),
      count,
      sourceKg: round(monthCO2, 1),
    };
  });
}

/**
 * Build an equivalence for a single entry's CO₂ (used in the log review step:
 * "this trip = N coffees").
 */
export function entryEquivalence(co2kg: number): Equivalence | null {
  if (co2kg <= 0) return null;
  const count = Math.max(1, Math.round(co2kg / EQUIVALENCE_FACTORS.coffeeCup));
  return {
    id: 'coffeeCup',
    label: LABELS.coffeeCup(count),
    count,
    sourceKg: round(co2kg, 1),
  };
}

/** Total CO₂ of a set of entries (helper for equivalence sourcing). */
export function totalEntriesCO2(entries: readonly ActivityEntry[]): number {
  return round(entries.reduce((sum, e) => sum + e.co2kg, 0), 1);
}
