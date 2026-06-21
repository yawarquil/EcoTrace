/**
 * @file Central Zustand store with persistence, validation, and migration.
 *
 * Persists ONLY the durable slice ({@link EcoState}) — transient UI (current
 * view, modals, toasts, AI loading) lives in-memory so refreshes always land on
 * a stable dashboard. Storage access is wrapped in try/catch and numerics are
 * validated before being committed. Versioned + migrated so future schema
 * changes are safe.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import {
  addActivityEntry,
  activityReward,
  calculateEntryCO2,
  computeStats,
  computeCarbonBudget,
  computeScenario,
  generateWeeklyPlan,
  updateBudget,
} from '@/lib/carbonCalculator';
import { cleanProfileName, planActionReward } from '@/lib/gamification';
import { createInitialState, STORAGE_VERSION } from '@/lib/initialState';
import { sanitizeText } from '@/lib/sanitize';
import { addDays, startOfToday, toDateKey } from '@/lib/datetime';
import type { ActivityEntry, ChatState, InsightState, Theme, Toast } from '@/types';
import type { EcoState } from '@/types';

/** Transient (non-persisted) UI + AI state. */
export interface TransientState {
  currentView: string;
  logModalOpen: boolean;
  scenarioOpen: boolean;
  reportOpen: boolean;
  toast: Toast | null;
  insight: InsightState;
  chat: ChatState;
}

/** Durable persisted state (the EcoState) + actions. */
export interface EcoActions {
  navigate: (view: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setProfileName: (name: string) => void;
  setProfileField: <K extends keyof EcoState['profile']>(
    key: K,
    value: EcoState['profile'][K],
  ) => void;
  setBudget: (value: number) => void;
  addEntry: (draft: {
    category: string;
    subtype: string;
    quantity: number;
    date?: string;
    note?: string;
  }) => void;
  previewEntry: (category: string, subtype: string, quantity: number) => {
    co2kg: number;
    unit: string;
    avoidedKg: number;
    reward: number;
  };
  completePlanAction: (id: string) => void;
  setReflectionMood: (mood: string) => void;
  saveReflection: (note: string) => void;
  toggleHabit: (habitId: string, dateKey: string) => void;
  applyScenario: () => void;
  setLogModalOpen: (open: boolean) => void;
  setScenarioOpen: (open: boolean) => void;
  setReportOpen: (open: boolean) => void;
  setToast: (toast: Toast | null) => void;
  dismissToast: () => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  resetAll: () => void;
}

export type EcoStore = EcoState & TransientState & EcoActions;

/** Default AI insight state (deterministic, computed lazily in selectors). */
function defaultInsightState(): InsightState {
  return {
    status: 'idle',
    source: 'fallback',
    updatedAt: null,
    summary: '',
    cards: [],
  };
}

function defaultChatState(): ChatState {
  return { status: 'idle', draft: '', messages: [] };
}

const STORAGE_KEY = 'ecotrace.state.v3';

/** Validate a value parsed from storage; fall back to initial on failure. */
function safeStateFromStorage(persisted: unknown): Partial<EcoState> {
  try {
    if (!persisted || typeof persisted !== 'object') {
      return createInitialState();
    }
    const base = createInitialState();
    const saved = persisted as Partial<EcoState>;
    // Defensive: validate arrays and numerics before trusting them.
    return {
      ...base,
      ...saved,
      version: STORAGE_VERSION,
      entries: Array.isArray(saved.entries) ? (saved.entries as ActivityEntry[]) : [],
      goals: Array.isArray(saved.goals) ? saved.goals : base.goals,
      habits: Array.isArray(saved.habits) ? saved.habits : base.habits,
      completedWeeklyPlan: Array.isArray(saved.completedWeeklyPlan)
        ? saved.completedWeeklyPlan
        : [],
      reflections: Array.isArray(saved.reflections) ? saved.reflections : [],
      xp: Number.isFinite(saved.xp) ? saved.xp : 0,
      carbonBudget: saved.carbonBudget ?? base.carbonBudget,
      profile: { ...base.profile, ...(saved.profile ?? {}) },
      theme: saved.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return createInitialState();
  }
}

export const useEcoStore = create<EcoStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      ...({
        currentView: 'dashboard',
        logModalOpen: false,
        scenarioOpen: false,
        reportOpen: false,
        toast: null,
        insight: defaultInsightState(),
        chat: defaultChatState(),
      } satisfies TransientState),

      // --- Navigation + theme ---
      navigate: (view) => set({ currentView: view }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),

      // --- Profile ---
      setProfileName: (name) =>
        set((state) => ({
          profile: { ...state.profile, name: cleanProfileName(name) },
        })),
      setProfileField: (key, value) =>
        set((state) => ({
          profile: { ...state.profile, [key]: value },
        })),

      // --- Budget ---
      setBudget: (value) => set((state) => updateBudget(state, value)),

      // --- Entries ---
      addEntry: (draft) =>
        set((state) => {
          const next = addActivityEntry(state, draft);
          const reward = activityReward(
            next.entries[next.entries.length - 1]?.co2kg ?? 0,
          );
          return {
            ...next,
            toast: {
              id: `toast-${Date.now()}`,
              title: 'Progress saved',
              body: `+${reward} XP for logging activity`,
              tone: 'success',
            },
          };
        }),
      previewEntry: (category, subtype, quantity) => {
        const impact = calculateEntryCO2(
          category as never,
          subtype,
          quantity,
        );
        return {
          co2kg: impact.co2kg,
          unit: impact.unit,
          avoidedKg: impact.avoidedKg,
          reward: activityReward(impact.co2kg),
        };
      },

      // --- Weekly plan ---
      completePlanAction: (id) =>
        set((state) => {
          if (state.completedWeeklyPlan.includes(id)) return state;
          const plan = generateWeeklyPlan(state).find((p) => p.id === id);
          if (!plan) return state;
          const reward = planActionReward(plan.impactKg);
          const entry: ActivityEntry = {
            id: `entry-plan-${Date.now()}`,
            date: plan.date,
            category: plan.category,
            subtype: plan.title,
            quantity: 1,
            unit: 'plan action',
            co2kg: 0,
            avoidedKg: plan.impactKg,
            note: 'Weekly climate plan',
            timestamp: new Date().toISOString(),
          };
          return {
            ...state,
            entries: [...state.entries, entry],
            completedWeeklyPlan: [...state.completedWeeklyPlan, id],
            xp: state.xp + reward,
            toast: {
              id: `toast-${Date.now()}`,
              title: 'Progress saved',
              body: `+${reward} XP for ${plan.title.toLowerCase()}`,
              tone: 'success',
            },
          };
        }),

      // --- Reflection ---
      setReflectionMood: (mood) => set({ selectedReflectionMood: mood }),
      saveReflection: (note) =>
        set((state) => {
          const todayKey = toDateKey(startOfToday());
          const stats = computeStats(state);
          const reflection = {
            id: `reflection-${todayKey}`,
            date: todayKey,
            mood: sanitizeText(state.selectedReflectionMood, 32) || 'steady',
            note: sanitizeText(note, 160),
            category: stats.topCategory,
            timestamp: new Date().toISOString(),
          };
          return {
            ...state,
            reflections: [
              ...state.reflections.filter((r) => r.date !== todayKey),
              reflection,
            ],
            xp: state.xp + 22,
            toast: {
              id: `toast-${Date.now()}`,
              title: 'Progress saved',
              body: '+22 XP for saving a daily reflection',
              tone: 'success',
            },
          };
        }),

      // --- Habits ---
      toggleHabit: (habitId, dateKey) =>
        set((state) => {
          const habit = state.habits.find((h) => h.id === habitId);
          if (!habit) return state;
          const already = habit.completedDates.includes(dateKey);
          const completedDates = already
            ? habit.completedDates.filter((d) => d !== dateKey)
            : [...habit.completedDates, dateKey];
          const xpDelta = already ? -habit.rewardXp : habit.rewardXp;
          return {
            ...state,
            xp: Math.max(0, state.xp + xpDelta),
            habits: state.habits.map((h) =>
              h.id === habitId ? { ...h, completedDates } : h,
            ),
          };
        }),

      // --- Scenario ---
      applyScenario: () =>
        set((state) => {
          const stats = computeStats(state);
          const scenario = computeScenario(state, stats);
          return {
            ...state,
            scenarioOpen: false,
            xp: state.xp + 28,
            goals: [
              ...state.goals,
              {
                id: `goal-scenario-${Date.now()}`,
                title: `Low-carbon week: save ${scenario.weeklySavings} kg`,
                category: stats.topCategory,
                targetValue: scenario.weeklySavings,
                currentValue: 0,
                unit: 'kg CO2',
                deadline: toDateKey(addDays(startOfToday(), 7)),
                rewardXp: 140,
              },
            ],
            currentView: 'goals',
            toast: {
              id: `toast-${Date.now()}`,
              title: 'Progress saved',
              body: '+28 XP for applying a low-carbon scenario',
              tone: 'success',
            },
          };
        }),

      // --- Transient UI ---
      setLogModalOpen: (open) => set({ logModalOpen: open }),
      setScenarioOpen: (open) => set({ scenarioOpen: open }),
      setReportOpen: (open) => set({ reportOpen: open }),
      setToast: (toast) => set({ toast }),
      dismissToast: () => set({ toast: null }),

      // --- Onboarding ---
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      completeOnboarding: () => set({ onboardingDismissed: true }),

      // --- Reset ---
      resetAll: () =>
        set({
          ...createInitialState(),
          ...({
            currentView: 'dashboard',
            logModalOpen: false,
            scenarioOpen: false,
            reportOpen: false,
            toast: null,
            insight: defaultInsightState(),
            chat: defaultChatState(),
          } satisfies TransientState),
        }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // Only persist the durable EcoState slice.
      partialize: (state): Partial<EcoState> => ({
        version: state.version,
        entries: state.entries,
        profile: state.profile,
        goals: state.goals,
        habits: state.habits,
        completedWeeklyPlan: state.completedWeeklyPlan,
        reflections: state.reflections,
        carbonBudget: state.carbonBudget,
        xp: state.xp,
        theme: state.theme,
        onboardingDismissed: state.onboardingDismissed,
        onboardingStep: state.onboardingStep,
        selectedReflectionMood: state.selectedReflectionMood,
      }),
      storage: createJSONStorage(() => {
        // Guard against SSR / disabled storage.
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      migrate: (persisted, version) => {
        // Validate + upgrade persisted state from any prior version.
        const restored = safeStateFromStorage(persisted);
        void version;
        return restored;
      },
      // On rehydrate, re-merge defensively.
      merge: (persisted, current) => {
        const restored = safeStateFromStorage(persisted);
        return { ...current, ...restored };
      },
    },
  ),
);

/** Convenience selector hook for derived budget stats. */
export function useBudget() {
  return useEcoStore((s) => computeCarbonBudget(s, computeStats(s)));
}

export default useEcoStore;
