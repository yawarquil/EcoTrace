import { describe, expect, it } from 'vitest';

import { worldState, worldAriaLabel } from '@/lib/worldState';

describe('worldState', () => {
  it('reports a thriving world for zero CO₂ + long streak', () => {
    const ws = worldState(0, 14);
    expect(ws.mood).toBe('thriving');
    expect(ws.treeCount).toBe(20);
    expect(ws.hazeOpacity).toBeLessThanOrEqual(0.12);
    expect(ws.sunIntensity).toBeGreaterThan(0.9);
  });

  it('reports a critical world for very high CO₂', () => {
    const ws = worldState(400, 0);
    expect(ws.mood).toBe('critical');
    expect(ws.treeCount).toBeLessThanOrEqual(6);
    expect(ws.hazeOpacity).toBeGreaterThan(0.7);
  });

  it('rewards streak by lifting clarity', () => {
    const noStreak = worldState(120, 0);
    const withStreak = worldState(120, 14);
    expect(withStreak.clarity).toBeGreaterThan(noStreak.clarity);
  });

  it('clamps negative CO₂ to 0', () => {
    const ws = worldState(-50, 0);
    expect(ws.mood).not.toBe('critical');
  });

  it('emits a valid 6-digit hex sky color', () => {
    const ws = worldState(80, 2);
    expect(ws.skyColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps clarity in [0, 1]', () => {
    for (const co2 of [0, 40, 160, 320, 500]) {
      const ws = worldState(co2, 0);
      expect(ws.clarity).toBeGreaterThanOrEqual(0);
      expect(ws.clarity).toBeLessThanOrEqual(1);
    }
  });
});

describe('worldAriaLabel', () => {
  it('describes a thriving world', () => {
    expect(worldAriaLabel(worldState(0, 14))).toContain('thriving');
  });

  it('describes a critical world', () => {
    expect(worldAriaLabel(worldState(400, 0))).toContain('struggling');
  });
});
