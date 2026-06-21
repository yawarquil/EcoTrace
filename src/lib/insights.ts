/**
 * @file Insight generation from REAL user state.
 *
 * No hardcoded tips: every insight is derived from the user's actual entries,
 * top category, streak, and budget. O(n) with early exits. These power the
 * deterministic local insight cards (the fallback when Gemini is unavailable)
 * and the "reduction opportunities" list on the insights page.
 */

import type { CategorySlice, EcoStats } from './carbonCalculator';
import type { ActivityEntry, InsightCard } from '@/types';
import type { EcoState } from '@/types';

/** One personalized reduction opportunity. */
export interface ReductionOpportunity {
  category: string;
  title: string;
  body: string;
  potentialKg: number;
}

/**
 * Derive up to 3 deterministic insight cards from real stats.
 *
 * Step-by-step:
 *  1. If the user has no entries, return a welcoming "first signal" card.
 *  2. Otherwise lead with the top category as the priority lever.
 *  3. Add a streak signal if the user is consistent.
 *  4. Add a budget signal if they are projected over budget.
 *  5. Confidence is High when derived from >= 5 entries, else Medium.
 */
export function generateInsightCards(
  state: EcoState,
  stats: EcoStats,
): InsightCard[] {
  const confidence: InsightCard['confidence'] =
    state.entries.length >= 5 ? 'High' : 'Medium';

  if (state.entries.length === 0) {
    return [
      {
        type: 'Priority lever',
        title: 'Build your first signal',
        body: 'No activities logged yet. Log one everyday choice to reveal your top emissions lever.',
        action: 'Log one everyday choice',
        impact: 'Reveals your baseline',
        confidence: 'Low',
      },
    ];
  }

  const cards: InsightCard[] = [];

  cards.push({
    type: 'Priority lever',
    title: `Lead with ${stats.topCategory.toLowerCase()}`,
    body: `${stats.topCategory} is your strongest monthly signal at ${stats.monthCO2} kg. A repeatable swap here moves the score the most.`,
    action: `Plan a ${stats.topCategory.toLowerCase()} reduction`,
    impact: `${stats.monthCO2} kg scope`,
    confidence,
  });

  if (stats.streak >= 3) {
    cards.push({
      type: 'Habit loop',
      title: 'Your logging rhythm is paying off',
      body: `A ${stats.streak}-day streak is lifting your carbon score by up to ${Math.min(
        10,
        stats.streak * 0.45,
      ).toFixed(1)} points. Consistency beats perfection.`,
      action: 'Keep the streak alive today',
      impact: `+${Math.min(10, stats.streak * 0.45).toFixed(1)} score`,
      confidence,
    });
  }

  if (stats.avoidedMonth > 0) {
    cards.push({
      type: 'Pattern signal',
      title: 'Swaps are already working',
      body: `You've avoided ${stats.avoidedMonth} kg this month through lower-impact choices. That is real, measurable progress.`,
      action: 'Repeat your best swap',
      impact: `${stats.avoidedMonth} kg avoided`,
      confidence,
    });
  }

  return cards.slice(0, 3);
}

/** One-sentence summary used as the insights panel header. */
export function insightSummary(state: EcoState, stats: EcoStats): string {
  if (state.entries.length === 0) {
    return 'Log your first activity to start building personalized climate insights.';
  }
  return `Your strongest signal is ${stats.topCategory.toLowerCase()} at ${stats.monthCO2} kg this month.`;
}

/**
 * Derive reduction opportunities from the category breakdown.
 *
 * Ranks categories by kg and suggests a per-category reduction target equal to
 * a quarter of that category's footprint (a realistic first lever).
 */
export function reductionOpportunities(
  breakdown: CategorySlice[],
  entries: ActivityEntry[],
): ReductionOpportunity[] {
  if (entries.length === 0) return [];
  return breakdown
    .filter((slice) => slice.kg > 0)
    .slice(0, 4)
    .map((slice) => ({
      category: slice.category,
      title: `Trim ${slice.category.toLowerCase()} by a quarter`,
      body: `Cutting ${slice.category.toLowerCase()} by 25% removes about ${(slice.kg * 0.25).toFixed(
        1,
      )} kg this month.`,
      potentialKg: Math.round(slice.kg * 0.25),
    }));
}
