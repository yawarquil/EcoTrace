/**
 * @file Gamification: XP awards, streaks, badges, achievements, leaderboard seed.
 *
 * Pure and deterministic. The leaderboard uses a seeded mulberry32 RNG so the
 * 16 comparison rows are identical across reloads and environments (ported
 * verbatim from the legacy product).
 */

import { LEVELS, type LevelThreshold } from './carbonFactors';
import { clamp } from './datetime';
import { sanitizeText } from './sanitize';
import type { EcoState, LeaderboardRow } from '@/types';

/** Sanitize and default a profile name (never empty). */
export function cleanProfileName(name: unknown): string {
  return sanitizeText(name, 72) || 'EcoTrace User';
}

/**
 * Compute the logging streak: the count of distinct days with at least one
 * entry, capped at 30 (matching the legacy streak ceiling).
 */
export function computeStreak(entries: EcoState['entries']): number {
  return Math.min(30, new Set(entries.map((entry) => entry.date)).size);
}

/** XP awarded for completing a plan action (low-impact = bigger reward). */
export function planActionReward(impactKg: number): number {
  return impactKg >= 3 ? 26 : 18;
}

/** A collectible badge. */
export interface Badge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

/** Derive the user's badge collection from current state (no hardcoded XP). */
export function computeBadges(state: EcoState): Badge[] {
  const streak = computeStreak(state.entries);
  const entries = state.entries.length;
  const avoided = state.entries.reduce(
    (total, entry) => total + entry.avoidedKg,
    0,
  );
  return [
    {
      id: 'first-signal',
      title: 'First Signal',
      description: 'Log your very first activity.',
      unlocked: entries >= 1,
    },
    {
      id: 'streak-3',
      title: 'Finding Rhythm',
      description: 'Log activities on 3 different days.',
      unlocked: streak >= 3,
    },
    {
      id: 'streak-7',
      title: 'Consistent Week',
      description: 'Log activities on 7 different days.',
      unlocked: streak >= 7,
    },
    {
      id: 'avoided-5',
      title: 'Avoided 5 kg',
      description: 'Avoid 5 kg of CO₂ through swaps and repairs.',
      unlocked: avoided >= 5,
    },
    {
      id: 'ten-logs',
      title: 'Ten Logs',
      description: 'Reach 10 logged activities.',
      unlocked: entries >= 10,
    },
    {
      id: 'level-3',
      title: 'Explorer',
      description: 'Reach Low-Carbon Explorer (level 3).',
      unlocked: state.xp >= 700,
    },
  ];
}

/** A progress-toward achievement milestone. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  progress: number; // 0..100
  complete: boolean;
}

/** Derive progress-based achievements from current state. */
export function computeAchievements(state: EcoState): Achievement[] {
  const streak = computeStreak(state.entries);
  const entries = state.entries.length;
  return [
    {
      id: 'log-streak',
      title: 'Logging streak',
      description: 'Reach a 7-day logging streak.',
      progress: clamp(Math.round((streak / 7) * 100), 0, 100),
      complete: streak >= 7,
    },
    {
      id: 'entries-20',
      title: 'Activity library',
      description: 'Log 20 activities.',
      progress: clamp(Math.round((entries / 20) * 100), 0, 100),
      complete: entries >= 20,
    },
    {
      id: 'eco-hero',
      title: 'Eco Hero',
      description: 'Reach 1950 XP (Eco Hero level).',
      progress: clamp(Math.round((state.xp / 1950) * 100), 0, 100),
      complete: state.xp >= 1950,
    },
  ];
}

/** The 16 seeded leaderboard names (ported verbatim, including "You"). */
export const LEADERBOARD_NAMES = [
  'Maya Chen',
  'Noah Silva',
  'Ava Patel',
  'Leo Morgan',
  'Sofia Reyes',
  'Iris Khan',
  'Theo Brooks',
  'Mina Okafor',
  'Jon Bell',
  'Priya Nair',
  'Owen Hart',
  'Lena Park',
  'Sam Rivera',
  'Nora Ali',
  'Max Ito',
  'You',
] as const;

/**
 * Build the deterministic 16-row seeded leaderboard.
 *
 * Non-"You" rows get a seeded XP via mulberry32 so the comparison data is
 * stable across reloads and environments. The user's row is inserted with
 * their real XP and re-sorted by XP desc, then ranked 1..16 with gold/silver/
 * bronze medals for the top three.
 *
 * @param userXp - The current user's real XP.
 * @param seed - RNG seed (default 20240601, ported from legacy).
 */
export function buildLeaderboard(userXp: number, seed = 20240601): LeaderboardRow[] {
  // Seeded base XP for the 15 comparison users (deterministic).
  const seeded = LEADERBOARD_NAMES.filter((name) => name !== 'You').map(
    (name, index) => {
      // Recompute a stable per-name RNG seed.
      let state = seed + index * 2654435761;
      const rand = () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), state | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
      return { name, xp: Math.round(180 + rand() * 2600) };
    },
  );
  const all = [...seeded, { name: 'You' as const, xp: userXp }].sort(
    (a, b) => b.xp - a.xp,
  );
  return all.map((row, index) => {
    const rank = index + 1;
    const medal: LeaderboardRow['medal'] =
      rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : undefined;
    return {
      rank,
      name: row.name,
      xp: row.xp,
      isYou: row.name === 'You',
      medal,
    };
  });
}

/** The next level threshold above the current XP (for "next unlock" copy). */
export function nextLevel(xp: number): LevelThreshold | null {
  return LEVELS.find((level) => xp < level.min) ?? null;
}
