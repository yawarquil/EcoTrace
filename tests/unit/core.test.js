import { describe, expect, it } from "vitest";

import {
  addActivityEntry,
  calculateEntryCO2,
  computeCarbonScore,
  computeLevelFromXP,
  computeStats,
  computeWeeklyData,
  createInitialState,
  EMISSION_FACTORS,
  sanitizeNumber,
  sanitizeText,
  updateProfileName,
} from "../../src/core.js";
import { deserializeState, serializeState } from "../../src/persistence.js";

describe("core carbon calculations", () => {
  it("keeps the required emission factors stable", () => {
    expect(EMISSION_FACTORS.carPetrol).toBe(0.192);
    expect(EMISSION_FACTORS.train).toBe(0.041);
    expect(EMISSION_FACTORS.bus).toBe(0.089);
    expect(EMISSION_FACTORS.beefMeal).toBe(6.61);
    expect(EMISSION_FACTORS.vegetarianMeal).toBe(0.64);
    expect(EMISSION_FACTORS.veganMeal).toBe(0.39);
    expect(EMISSION_FACTORS.electricityGlobal).toBe(0.475);
    expect(EMISSION_FACTORS.naturalGas).toBe(2.04);
  });

  it("calculates activity impact and score without seeded fake progress", () => {
    const state = createInitialState();
    expect(state.entries).toHaveLength(0);
    expect(state.xp).toBe(0);
    expect(
      computeCarbonScore({ monthCO2: 0, avoidedMonth: 0, streak: 0 }),
    ).toBe(50);
    expect(calculateEntryCO2("Transport", "Petrol car", 10)).toEqual({
      co2kg: 1.9,
      unit: "km",
    });
  });

  it("updates stats from real entries only", () => {
    const withEntry = addActivityEntry(createInitialState(), {
      category: "Food",
      subtype: "Vegan meal",
      quantity: 2,
      note: "Dinner",
    });
    const stats = computeStats(withEntry);
    expect(stats.monthCO2).toBe(0.8);
    expect(stats.topCategory).toBe("Food");
    expect(stats.weeklyData).toHaveLength(7);
  });

  it("keeps level, weekly data, persistence, and sanitizers deterministic", () => {
    expect(computeLevelFromXP(710)).toMatchObject({
      level: 3,
      title: "Low-Carbon Explorer",
    });
    expect(computeWeeklyData([])).toHaveLength(7);
    expect(sanitizeText(" <img onerror=alert(1)>Ada` ", 40)).toBe(
      "img alert(1)Ada",
    );
    expect(sanitizeNumber("999", 0, 20, 1)).toBe(20);
    const state = updateProfileName(createInitialState(), "  <Ada>  ");
    expect(deserializeState(serializeState(state)).profile.name).toBe("Ada");
  });
});
