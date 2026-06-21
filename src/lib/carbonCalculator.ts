/**
 * @file Core carbon math: entry CO₂, scoring, weekly/category/budget/forecast
 * computations. All functions are pure and framework-free.
 *
 * Ported verbatim from the legacy EcoTrace core so every displayed number is
 * unchanged, then refactored to single-pass O(n) where the brief requires it
 * (weekly totals, category breakdown). Carbon score, level math, and budget
 * formulas are byte-for-byte identical to the legacy product.
 */

import {
  ACTIVITY_SUBTYPES,
  CATEGORIES,
  LEVELS,
  type EcoTraceCategory,
} from './carbonFactors';
import {
  addDays,
  clamp,
  daysInMonth,
  round,
  startOfToday,
  toDateKey,
} from './datetime';
import { sanitizeNumber, sanitizeText } from './sanitize';
import type {
  ActivityEntry,
  CarbonBudget,
  EcoState,
  PlanAction,
} from '@/types';

/** Result of a single entry's CO₂ calculation. */
export interface EntryImpact {
  co2kg: number;
  unit: string;
  avoidedKg: number;
}

/**
 * Look up the factor + unit for a subtype within a category.
 * Falls back to factor 0 / 'action' if unknown — never throws.
 */
function resolveSubtype(
  category: EcoTraceCategory,
  subtype: string,
): { factor: number; unit: string; avoidedFactor: number } {
  const subtypes = ACTIVITY_SUBTYPES[category];
  const found = subtypes.find((item) => item.subtype === subtype);
  if (found) {
    return {
      factor: found.factor,
      unit: found.unit,
      avoidedFactor: found.avoidedFactor ?? 0,
    };
  }
  return { factor: 0, unit: 'action', avoidedFactor: 0 };
}

/**
 * Calculate the CO₂ (and avoided CO₂) for a single activity draft.
 *
 * @param category - One of the 5 EcoTrace categories.
 * @param subtype - Subtype label registered in {@link ACTIVITY_SUBTYPES}.
 * @param quantity - Raw quantity (km, kWh, meal, m³, action count).
 * @returns Rounded CO₂ in kg, the display unit, and avoided kg.
 */
export function calculateEntryCO2(
  category: EcoTraceCategory,
  subtype: string,
  quantity: number,
): EntryImpact {
  const amount = sanitizeNumber(quantity, 0, 100000, 0);
  const { factor, unit, avoidedFactor } = resolveSubtype(category, subtype);
  return {
    co2kg: round(amount * factor, 1),
    unit,
    avoidedKg: round(amount * avoidedFactor, 1),
  };
}

/**
 * Build a sanitized activity entry from a loose draft, computing its CO₂.
 *
 * @param state - Current app state (entries appended to a copy).
 * @param draft - Raw user draft (category, subtype, quantity, optional date/note).
 */
export function addActivityEntry(
  state: EcoState,
  draft: {
    category: string;
    subtype: string;
    quantity: number;
    date?: string;
    note?: string;
  },
): EcoState {
  const category: EcoTraceCategory = CATEGORIES.includes(
    draft.category as EcoTraceCategory,
  )
    ? (draft.category as EcoTraceCategory)
    : 'Transport';
  const subtype = sanitizeText(draft.subtype, 80) || 'Train';
  const quantity = sanitizeNumber(draft.quantity, 0, 100000, 1);
  const impact = calculateEntryCO2(category, subtype, quantity);
  const entry: ActivityEntry = {
    id: `entry-${Date.now()}`,
    date: draft.date ?? toDateKey(startOfToday()),
    category,
    subtype,
    quantity,
    unit: impact.unit,
    co2kg: impact.co2kg,
    avoidedKg: impact.avoidedKg,
    note: sanitizeText(draft.note, 160),
    timestamp: new Date().toISOString(),
  };
  const reward = activityReward(impact.co2kg);
  return {
    ...state,
    entries: [...state.entries, entry],
    xp: state.xp + reward,
  };
}

/** XP awarded for a logged activity (≤2 kg CO₂ earns the "light choice" bonus). */
export function activityReward(co2kg: number): number {
  return co2kg <= 2 ? 42 : 30;
}

/**
 * Compute the user's level from XP. Ported verbatim from the legacy
 * `computeLevelFromXP`. `toNext` is XP remaining to the next threshold.
 */
export function computeLevelFromXP(xp: number): {
  level: number;
  title: string;
  progress: number;
  toNext: number;
} {
  const current =
    [...LEVELS].reverse().find((item) => xp >= item.min) ?? LEVELS[0]!;
  const nextThreshold = current.next;
  const span = nextThreshold - current.min;
  const progress = Math.round(
    clamp(((xp - current.min) / span) * 100, 0, 100),
  );
  return {
    level: current.level,
    title: current.title,
    progress,
    toNext: Math.max(0, nextThreshold - xp),
  };
}

/**
 * Compute the EcoTrace carbon score.
 *
 * Clean first run (no data) returns exactly 50. Otherwise the score rewards
 * low monthly CO₂, avoided CO₂, and a logging streak, clamped to [18, 100].
 * Ported verbatim.
 */
export function computeCarbonScore(input: {
  monthCO2: number;
  avoidedMonth?: number;
  streak?: number;
}): number {
  const { monthCO2, avoidedMonth = 0, streak = 0 } = input;
  if (monthCO2 === 0 && avoidedMonth === 0 && streak === 0) return 50;
  return Math.round(
    clamp(
      98 - monthCO2 * 0.26 + avoidedMonth * 0.2 + Math.min(10, streak * 0.45),
      18,
      100,
    ),
  );
}

/** Sum the CO₂ of entries matching a predicate, rounded to 1 decimal. */
function sumCO2(entries: readonly ActivityEntry[]): number {
  return round(
    entries.reduce((total, entry) => total + Number(entry.co2kg || 0), 0),
    1,
  );
}

/** Sum avoided CO₂ across entries, rounded to 1 decimal. */
function sumAvoided(entries: readonly ActivityEntry[]): number {
  return round(
    entries.reduce((total, entry) => total + Number(entry.avoidedKg || 0), 0),
    1,
  );
}

/** Entries dated within the same calendar month as `today`. */
export function entriesThisMonth(
  entries: readonly ActivityEntry[],
  today: Date = startOfToday(),
): ActivityEntry[] {
  return entries.filter((entry) => {
    const date = new Date(entry.date + 'T12:00:00');
    return (
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  });
}

/**
 * The category with the highest monthly CO₂. Ties break to the earlier
 * category in {@link CATEGORIES} order via stable sort. Defaults to Transport
 * when there is no data so the weekly plan always has a focus.
 */
export function getTopCategory(
  entries: readonly ActivityEntry[],
): EcoTraceCategory {
  const totals = CATEGORIES.map((category) => ({
    category,
    total: sumCO2(entries.filter((entry) => entry.category === category)),
  })).sort((a, b) => b.total - a.total);
  return totals[0]?.category ?? 'Transport';
}

/** Per-weekday bucket (last 7 days ending today) with a high/moderate/good band. */
export interface WeeklyDatum {
  date: string;
  label: string;
  co2kg: number;
  state: 'high' | 'moderate' | 'good';
}

/**
 * Last-7-days CO₂ per weekday. Single pass: build a date→sum map, then emit
 * 7 ordered buckets. Labels use the English short weekday, matching legacy.
 */
export function computeWeeklyData(
  entries: readonly ActivityEntry[],
  today: Date = startOfToday(),
): WeeklyDatum[] {
  const buckets = new Map<string, number>();
  for (const entry of entries) {
    buckets.set(entry.date, round((buckets.get(entry.date) ?? 0) + entry.co2kg, 1));
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const key = toDateKey(date);
    const co2kg = round(buckets.get(key) ?? 0, 1);
    return {
      date: key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      co2kg,
      state: co2kg > 12 ? 'high' : co2kg > 5 ? 'moderate' : 'good',
    } satisfies WeeklyDatum;
  });
}

/** One slice of the category donut/breakdown. */
export interface CategorySlice {
  category: EcoTraceCategory;
  kg: number;
  percent: number;
}

/** Category breakdown as kg + share-of-total. Single pass over entries. */
export function computeCategoryBreakdown(
  entries: readonly ActivityEntry[],
): CategorySlice[] {
  const total = Math.max(1, sumCO2(entries));
  const byCategory = new Map<EcoTraceCategory, number>();
  for (const entry of entries) {
    byCategory.set(
      entry.category,
      round((byCategory.get(entry.category) ?? 0) + entry.co2kg, 1),
    );
  }
  return CATEGORIES.map((category) => {
    const kg = byCategory.get(category) ?? 0;
    return { category, kg, percent: Math.round((kg / total) * 100) };
  }).sort((a, b) => b.kg - a.kg);
}

/**
 * Full derived stats from state. Computed in one logical pass per metric so
 * insights, budget, and the dashboard all share the same numbers.
 */
export interface EcoStats {
  monthCO2: number;
  avoidedMonth: number;
  weeklyData: WeeklyDatum[];
  weeklyTotal: number;
  categoryBreakdown: CategorySlice[];
  topCategory: EcoTraceCategory;
  carbonScore: number;
  streak: number;
  levelInfo: ReturnType<typeof computeLevelFromXP>;
  weeklyPlan: PlanAction[];
  hasEntries: boolean;
}

/** Library of weekly-plan templates per category (ported verbatim). */
const PLAN_LIBRARY: Readonly<Record<EcoTraceCategory, readonly [string, number, string][]>> = {
  Transport: [
    ['Replace one short car trip', 2.5, 'Walk, cycle, or use transit for a local errand.'],
    ['Plan a transit-first commute', 1.8, 'Set the route before the day gets busy.'],
  ],
  Food: [
    ['Choose a plant-forward meal', 5.9, 'Use the beef-to-vegetarian swap as today’s easy lever.'],
    ['Make lunch vegetarian', 3.2, 'A repeatable lunch default keeps decisions light.'],
  ],
  'Home Energy': [
    ['Trim heating or cooling for one hour', 1.4, 'Shorten one energy-heavy home window.'],
    ['Switch off standby loads', 0.8, 'Clear small devices before bedtime.'],
  ],
  Shopping: [
    ['Delay one nonessential purchase', 3.5, 'Give the purchase 24 hours before deciding.'],
    ['Repair or reuse one item', 2.4, 'Extend the life of something already owned.'],
  ],
  Travel: [
    ['Check a rail alternative', 6.8, 'Compare one lower-carbon route before booking.'],
    ['Replace a long errand locally', 4.1, 'Choose the closest useful option today.'],
  ],
} as const;

/**
 * Generate a 7-day climate plan anchored to today, led by the user's top
 * category (not a fixed list) and rotating through remaining categories.
 * Ported verbatim; `done` reflects the user's completed-plan set.
 */
export function generateWeeklyPlan(
  state: EcoState,
  topCategory: EcoTraceCategory = 'Transport',
): PlanAction[] {
  const today = startOfToday();
  const uniqueCategories = [
    topCategory,
    'Food',
    'Transport',
    'Home Energy',
    'Shopping',
    'Travel',
  ].filter(
    (category, index, list) =>
      category && list.indexOf(category) === index,
  ) as EcoTraceCategory[];
  return Array.from({ length: 7 }, (_, index) => {
    const date = toDateKey(addDays(today, index));
    const category = uniqueCategories[index % uniqueCategories.length]!;
    const template = PLAN_LIBRARY[category][index % PLAN_LIBRARY[category].length]!;
    const id = `plan-${date}-${category.toLowerCase().replace(/[^a-z]+/g, '-')}`;
    return {
      id,
      date,
      category,
      title: template[0],
      impactKg: template[1],
      body: template[2],
      rewardXp: 18 + (index % 3) * 4,
      done: state.completedWeeklyPlan.includes(id),
    } satisfies PlanAction;
  });
}

/**
 * Compute all derived stats from state. This is the single source of truth for
 * the dashboard, insights, and coach panels.
 *
 * @param state - Full app state.
 * @param today - Reference "now" (defaults to real now; injectable for tests).
 */
export function computeStats(
  state: EcoState,
  today: Date = startOfToday(),
): EcoStats {
  const monthEntries = entriesThisMonth(state.entries, today);
  const monthCO2 = sumCO2(monthEntries);
  const avoidedMonth = sumAvoided(monthEntries);
  const weeklyData = computeWeeklyData(state.entries, today);
  const topCategory = getTopCategory(monthEntries);
  const streak = Math.min(
    30,
    new Set(state.entries.map((entry) => entry.date)).size,
  );
  const carbonScore = computeCarbonScore({ monthCO2, avoidedMonth, streak });
  return {
    monthCO2,
    avoidedMonth,
    weeklyData,
    weeklyTotal: round(
      weeklyData.reduce((total, day) => total + day.co2kg, 0),
      1,
    ),
    categoryBreakdown: computeCategoryBreakdown(monthEntries),
    topCategory,
    carbonScore,
    streak,
    levelInfo: computeLevelFromXP(state.xp),
    weeklyPlan: generateWeeklyPlan(state, topCategory),
    hasEntries: state.entries.length > 0,
  };
}

/** Carbon-budget projection (ported verbatim from legacy `computeCarbonBudget`). */
export interface BudgetStats {
  limit: number;
  used: number;
  remaining: number;
  percent: number;
  dailyAllowance: number;
  projected: number;
  status: 'On budget' | 'Over budget';
}

/**
 * Compute the monthly carbon-budget projection.
 *
 * @param state - Full app state.
 * @param stats - Precomputed stats (avoids recomputation).
 * @param today - Reference "now" (injectable for tests).
 */
export function computeCarbonBudget(
  state: EcoState,
  stats: EcoStats = computeStats(state),
  today: Date = startOfToday(),
): BudgetStats {
  const totalDays = daysInMonth(today);
  const daysLeft = Math.max(1, totalDays - today.getDate() + 1);
  const limit = Math.max(40, Number(state.carbonBudget.monthlyLimit || 160));
  const remaining = round(limit - stats.monthCO2, 1);
  return {
    limit,
    used: stats.monthCO2,
    remaining,
    percent: Math.round(clamp((stats.monthCO2 / limit) * 100, 0, 100)),
    dailyAllowance: round(Math.max(0, remaining) / daysLeft, 1),
    projected: round((stats.monthCO2 / Math.max(1, today.getDate())) * totalDays, 1),
    status: remaining >= 0 ? 'On budget' : 'Over budget',
  };
}

/** Weekly scenario comparison (ported verbatim from legacy `computeScenario`). */
export interface ScenarioStats {
  currentWeek: number;
  lowCarbonWeek: number;
  weeklySavings: number;
  monthlySavings: number;
  scoreLift: number;
}

/**
 * Compare the current week against a low-carbon week derived from plan savings.
 * Ported verbatim from legacy `computeScenario`.
 */
export function computeScenario(
  state: EcoState,
  stats: EcoStats = computeStats(state),
): ScenarioStats {
  const planSavings =
    stats.weeklyPlan.reduce((total, plan) => total + plan.impactKg, 0) / 2;
  const lowCarbonWeek = round(
    Math.max(stats.weeklyTotal * 0.38, stats.weeklyTotal - planSavings),
    1,
  );
  const weeklySavings = round(
    Math.max(0, stats.weeklyTotal - lowCarbonWeek),
    1,
  );
  return {
    currentWeek: stats.weeklyTotal,
    lowCarbonWeek,
    weeklySavings,
    monthlySavings: round(weeklySavings * 4, 1),
    scoreLift: Math.min(16, Math.max(1, Math.round((weeklySavings * 4) / 9))),
  };
}

/** Update the monthly carbon budget (sanitized, clamped 40–800). */
export function updateBudget(state: EcoState, value: unknown): EcoState {
  const budget: CarbonBudget = {
    monthlyLimit: sanitizeNumber(value, 40, 800, 160),
    revisedAt: toDateKey(startOfToday()),
  };
  return { ...state, carbonBudget: budget };
}
