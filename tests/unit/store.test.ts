import { describe, expect, it, beforeEach } from 'vitest';

import { useEcoStore } from '@/store/useEcoStore';
import { createInitialState } from '@/lib/initialState';
import { computeStats } from '@/lib/carbonCalculator';

beforeEach(() => {
  useEcoStore.setState({ ...createInitialState(), ...({
    currentView: 'dashboard',
    logModalOpen: false,
    scenarioOpen: false,
    reportOpen: false,
    toast: null,
  }) });
});

describe('useEcoStore', () => {
  it('starts on the dashboard with no entries', () => {
    const state = useEcoStore.getState();
    expect(state.currentView).toBe('dashboard');
    expect(state.entries).toHaveLength(0);
    expect(state.xp).toBe(0);
  });

  it('navigates between views', () => {
    useEcoStore.getState().navigate('insights');
    expect(useEcoStore.getState().currentView).toBe('insights');
    useEcoStore.getState().navigate('dashboard');
    expect(useEcoStore.getState().currentView).toBe('dashboard');
  });

  it('toggles the theme', () => {
    expect(useEcoStore.getState().theme).toBe('light');
    useEcoStore.getState().toggleTheme();
    expect(useEcoStore.getState().theme).toBe('dark');
    useEcoStore.getState().toggleTheme();
    expect(useEcoStore.getState().theme).toBe('light');
  });

  it('sanitizes and stores a profile name', () => {
    useEcoStore.getState().setProfileName('<Maya>');
    expect(useEcoStore.getState().profile.name).toBe('Maya');
  });

  it('clamps the budget to [40, 800]', () => {
    useEcoStore.getState().setBudget(5);
    expect(useEcoStore.getState().carbonBudget.monthlyLimit).toBe(40);
    useEcoStore.getState().setBudget(99999);
    expect(useEcoStore.getState().carbonBudget.monthlyLimit).toBe(800);
  });

  it('adds an entry and awards XP + a success toast', () => {
    useEcoStore.getState().addEntry({
      category: 'Food',
      subtype: 'Beef meal',
      quantity: 1,
    });
    const state = useEcoStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.xp).toBe(30); // beef is heavy
    expect(state.toast?.tone).toBe('success');
  });

  it('previews entry CO₂ without mutating state', () => {
    const preview = useEcoStore.getState().previewEntry('Transport', 'Train', 100);
    expect(preview.co2kg).toBe(4.1);
    expect(preview.reward).toBe(30); // 4.1 kg > 2 -> heavier-choice reward
    expect(useEcoStore.getState().entries).toHaveLength(0);
  });

  it('completes a weekly-plan action once and awards XP', () => {
    const plan = useEcoStore.getState().completedWeeklyPlan;
    expect(plan).toHaveLength(0);
    // Find a real plan id via the stats selector path.
    const firstPlan = computeStats(useEcoStore.getState()).weeklyPlan[0];
    expect(firstPlan).toBeTruthy();
    useEcoStore.getState().completePlanAction(firstPlan!.id);
    const state = useEcoStore.getState();
    expect(state.completedWeeklyPlan).toContain(firstPlan!.id);
    expect(state.entries.some((e) => e.avoidedKg > 0)).toBe(true);
    // Completing the same action again is a no-op.
    useEcoStore.getState().completePlanAction(firstPlan!.id);
    expect(useEcoStore.getState().completedWeeklyPlan.filter((id) => id === firstPlan!.id)).toHaveLength(1);
  });

  it('toggles a habit on/off and adjusts XP', () => {
    const todayKey = '2024-01-15';
    const habit = useEcoStore.getState().habits[0]!;
    const startingXp = useEcoStore.getState().xp;
    useEcoStore.getState().toggleHabit(habit.id, todayKey);
    expect(useEcoStore.getState().xp).toBe(startingXp + habit.rewardXp);
    useEcoStore.getState().toggleHabit(habit.id, todayKey); // toggle off
    expect(useEcoStore.getState().xp).toBe(startingXp);
  });

  it('saves a daily reflection (replacing same-day) and awards XP', () => {
    useEcoStore.getState().setReflectionMood('hopeful');
    useEcoStore.getState().saveReflection('Felt good today.');
    const state = useEcoStore.getState();
    expect(state.reflections).toHaveLength(1);
    expect(state.reflections[0]?.mood).toBe('hopeful');
    expect(state.xp).toBeGreaterThan(0);
    // Saving again same day replaces, not duplicates.
    useEcoStore.getState().saveReflection('Evening update.');
    expect(useEcoStore.getState().reflections).toHaveLength(1);
  });

  it('applies a scenario and creates a goal', () => {
    useEcoStore.getState().applyScenario();
    const state = useEcoStore.getState();
    expect(state.goals.length).toBeGreaterThan(2); // seeded 2 + new
    expect(state.scenarioOpen).toBe(false);
    expect(state.currentView).toBe('goals');
  });

  it('controls transient UI flags', () => {
    useEcoStore.getState().setLogModalOpen(true);
    expect(useEcoStore.getState().logModalOpen).toBe(true);
    useEcoStore.getState().setScenarioOpen(true);
    expect(useEcoStore.getState().scenarioOpen).toBe(true);
    useEcoStore.getState().setReportOpen(true);
    expect(useEcoStore.getState().reportOpen).toBe(true);
    useEcoStore.getState().setToast({ id: 't1', title: 'X', body: 'Y', tone: 'info' });
    expect(useEcoStore.getState().toast?.id).toBe('t1');
    useEcoStore.getState().dismissToast();
    expect(useEcoStore.getState().toast).toBeNull();
  });

  it('completes onboarding and resets cleanly', () => {
    useEcoStore.getState().setOnboardingStep(2);
    expect(useEcoStore.getState().onboardingStep).toBe(2);
    useEcoStore.getState().completeOnboarding();
    expect(useEcoStore.getState().onboardingDismissed).toBe(true);
    useEcoStore.getState().resetAll();
    expect(useEcoStore.getState().entries).toHaveLength(0);
    expect(useEcoStore.getState().onboardingDismissed).toBe(false);
  });

  it('updates a profile field generically', () => {
    useEcoStore.getState().setProfileField('diet', 'vegan');
    expect(useEcoStore.getState().profile.diet).toBe('vegan');
  });
});
