/**
 * @file Pure initial-state factory for EcoTrace.
 *
 * Clean first run: no fake logs, no XP, no badges, no achievements. Seeded
 * goals/habits match the legacy defaults. Date-dependent defaults use an
 * injectable `now` so tests are deterministic.
 */

import { addDays, toDateKey, startOfToday } from './datetime';
import type { EcoState } from '@/types';

/** Seed goals (ported verbatim from legacy defaults). */
function seedGoals(todayKey: string): EcoState['goals'] {
  return [
    {
      id: 'goal-transport',
      title: 'Reduce transport emissions by 20%',
      category: 'Transport',
      targetValue: 22,
      currentValue: 0,
      unit: 'kg CO2',
      deadline: todayKey,
      rewardXp: 120,
    },
    {
      id: 'goal-food',
      title: 'Have 5 plant-based meals this week',
      category: 'Food',
      targetValue: 5,
      currentValue: 0,
      unit: 'meals',
      deadline: todayKey,
      rewardXp: 90,
    },
  ];
}

/** Seed habits (ported verbatim from legacy defaults). */
function seedHabits(): EcoState['habits'] {
  return [
    { id: 'bike-commute', title: 'Bike commute', category: 'Transport', completedDates: [], rewardXp: 28 },
    { id: 'veg-lunch', title: 'Vegetarian lunch', category: 'Food', completedDates: [], rewardXp: 24 },
    { id: 'no-shopping', title: 'No impulse shopping', category: 'Shopping', completedDates: [], rewardXp: 22 },
    { id: 'energy-save', title: 'Energy saving action', category: 'Home Energy', completedDates: [], rewardXp: 20 },
  ];
}

/**
 * Create a clean initial state. Pass `now` to pin date defaults in tests.
 *
 * @param now - Reference date for seeded deadlines (defaults to real now).
 */
export function createInitialState(now: Date = new Date()): EcoState {
  const todayKey = toDateKey(startOfToday(now));
  void addDays;
  return {
    version: 3,
    entries: [],
    profile: {
      name: 'EcoTrace User',
      location: '',
      commute: 'mixed',
      diet: 'flexitarian',
      goalFocus: 'reduce 20%',
    },
    goals: seedGoals(todayKey),
    habits: seedHabits(),
    completedWeeklyPlan: [],
    reflections: [],
    carbonBudget: { monthlyLimit: 160, revisedAt: todayKey },
    xp: 0,
    theme: 'light',
    onboardingDismissed: false,
    onboardingStep: 0,
    selectedReflectionMood: 'steady',
  };
}

/** The storage version; bumping triggers the persist `migrate` path. */
export const STORAGE_VERSION = 3;
