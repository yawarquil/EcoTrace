import { createInitialState, STORAGE_VERSION } from "./core.js";

export const STORAGE_KEY = "ecotrace.react.state.v3";
export { STORAGE_VERSION };

export function serializeState(state) {
  return JSON.stringify({
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  });
}

export function mergeState(base, saved) {
  return {
    ...base,
    ...saved,
    profile: { ...base.profile, ...(saved.profile || {}) },
    carbonBudget: { ...base.carbonBudget, ...(saved.carbonBudget || {}) },
    goals: Array.isArray(saved.goals) ? saved.goals : base.goals,
    habits: Array.isArray(saved.habits) ? saved.habits : base.habits,
    entries: Array.isArray(saved.entries) ? saved.entries : base.entries,
    completedWeeklyPlan: Array.isArray(saved.completedWeeklyPlan)
      ? saved.completedWeeklyPlan
      : base.completedWeeklyPlan,
    reflections: Array.isArray(saved.reflections)
      ? saved.reflections
      : base.reflections,
  };
}

export function deserializeState(raw) {
  const base = createInitialState();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION || !parsed.state) return base;
    return mergeState(base, parsed.state);
  } catch {
    return base;
  }
}

export function loadState(storage = globalThis.localStorage) {
  if (!storage) return createInitialState();
  return deserializeState(storage.getItem(STORAGE_KEY));
}

export function saveState(state, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, serializeState(state));
}
