/**
 * @file Shared EcoTrace domain types.
 *
 * Discriminated unions model activities and AI responses so narrowing is
 * exhaustively checked by the compiler. No `any` anywhere in the codebase.
 */

import type { EcoTraceCategory } from '@/lib/carbonFactors';

/** A user-commute preference chosen during onboarding. */
export type CommuteProfile = 'mixed' | 'car' | 'transit' | 'remote';

/** A user-diet baseline chosen during onboarding. */
export type DietProfile = 'flexitarian' | 'meat-heavy' | 'vegetarian' | 'vegan';

/** The onboarding goal the user picked first. */
export type GoalFocus = 'reduce 20%' | 'build habits' | 'learn first' | 'compete';

/** Persisted user profile derived from onboarding. */
export interface Profile {
  name: string;
  location: string;
  commute: CommuteProfile;
  diet: DietProfile;
  goalFocus: GoalFocus;
}

/**
 * The complete persisted app state. Transient UI (modals, toasts, current view)
 * is intentionally EXCLUDED so refreshes always land on a stable dashboard.
 * See {@link useEcoStore} `partialize`.
 */
export interface EcoState {
  version: number;
  entries: ActivityEntry[];
  profile: Profile;
  goals: Goal[];
  habits: Habit[];
  completedWeeklyPlan: string[];
  reflections: Reflection[];
  carbonBudget: CarbonBudget;
  xp: number;
  theme: Theme;
  onboardingDismissed: boolean;
  onboardingStep: number;
  selectedReflectionMood: string;
}

/** A logged activity entry (transport, energy, food, shopping, travel). */
export interface ActivityEntry {
  id: string;
  date: string; // YYYY-MM-DD
  category: EcoTraceCategory;
  subtype: string;
  quantity: number;
  unit: string;
  co2kg: number;
  avoidedKg: number;
  note: string;
  timestamp: string; // ISO
}

/** A user-set carbon-reduction goal. */
export interface Goal {
  id: string;
  title: string;
  category: EcoTraceCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  rewardXp: number;
}

/** A repeatable habit the user tracks daily. */
export interface Habit {
  id: string;
  title: string;
  category: EcoTraceCategory;
  completedDates: string[];
  rewardXp: number;
}

/** A daily reflection check-in. */
export interface Reflection {
  id: string;
  date: string;
  mood: string;
  note: string;
  category: EcoTraceCategory;
  timestamp: string;
}

/** Monthly carbon budget config. */
export interface CarbonBudget {
  monthlyLimit: number;
  revisedAt: string;
}

/** One day of the generated weekly climate plan. */
export interface PlanAction {
  id: string;
  date: string;
  category: EcoTraceCategory;
  title: string;
  impactKg: number;
  body: string;
  rewardXp: number;
  done: boolean;
}

/** Toast severity, used to pick the correct ARIA live region. */
export type ToastTone = 'success' | 'info' | 'error';

/** A transient reward/status toast (not persisted). */
export interface Toast {
  id: string;
  title: string;
  body: string;
  tone: ToastTone;
}

/** Theme chosen by the user. */
export type Theme = 'light' | 'dark';

/** Source of an AI response: live Gemini or deterministic local fallback. */
export type AiSource = 'gemini' | 'fallback';

/** AI loading state machine. */
export type AiStatus = 'idle' | 'loading' | 'ready' | 'fallback';

/** One AI insight card (live or fallback). */
export interface InsightCard {
  type: string;
  title: string;
  body: string;
  action: string;
  impact: string;
  confidence: 'High' | 'Medium' | 'Low';
}

/** Full AI insight payload (live or fallback). */
export interface InsightState {
  status: AiStatus;
  source: AiSource;
  updatedAt: string | null;
  summary: string;
  cards: InsightCard[];
}

/** One AI chat message. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  source?: AiSource;
  suggestions?: string[];
  timestamp: string;
}

/** AI chat panel state. */
export interface ChatState {
  status: AiStatus;
  draft: string;
  messages: ChatMessage[];
}

/** One leaderboard row. */
export interface LeaderboardRow {
  rank: number;
  name: string;
  xp: number;
  isYou: boolean;
  medal?: 'gold' | 'silver' | 'bronze';
}
