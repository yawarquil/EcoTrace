/**
 * @file Pure mapping from the user's carbon state to the Living World scene.
 *
 * O(1): converts CO₂ + streak into the visual parameters the r3f scene and the
 * reduced-motion SVG fallback both consume. Low CO₂ / high streak → clear sky,
 * lush trees, bright sun; high CO₂ → haze/smog, bare trees. Smooth transitions
 * are applied by the scene (lerp/rAF), not here — this function is instant.
 */

/** Visual parameters for one frame of the Living World. */
export interface WorldState {
  /** 0 (smoggy/hazy) … 1 (crystal clear). Drives haze opacity inversely. */
  readonly clarity: number;
  /** 0 (heavy smog) … 1 (clear sky). Interpolated onto sky color. */
  readonly hazeOpacity: number;
  /** Sky hex color blended from grey-blue (bad) to bright teal-blue (good). */
  readonly skyColor: string;
  /** Ground/water tint. */
  readonly groundColor: string;
  /** Number of healthy trees to render (0..20). Bare beyond this count. */
  readonly treeCount: number;
  /** Sun brightness 0..1 (dim under smog, bright when clear). */
  readonly sunIntensity: number;
  /** Overall mood label for the aria-label. */
  readonly mood: 'thriving' | 'steady' | 'strained' | 'critical';
}

// Anchor colors for the sky lerp (hex → rgb once).
const SKY_CLEAR: readonly [number, number, number] = [133, 196, 215];
const SKY_HAZY: readonly [number, number, number] = [96, 100, 102];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbToHex(rgb: readonly [number, number, number]): string {
  const toHex = (n: number) =>
    Math.round(clamp01(n)).toString(16).padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Map monthly CO₂ + streak to a Living World state.
 *
 * Thresholds (documented so the scene is tunable):
 *  - monthCO2 ≤ 40 kg  → clarity ~1 (clear), full 20 trees, bright sun.
 *  - monthCO2 ≥ 320 kg → clarity ~0 (smoggy), few trees, dim sun.
 *  - streak lifts clarity slightly (reward for consistency).
 *
 * @param monthCO2 - Monthly CO₂ in kg (clamped to [0, 400] internally).
 * @param streak   - Logging streak in days (0..30), nudges clarity up.
 */
export function worldState(monthCO2: number, streak = 0): WorldState {
  const co2 = clamp01(Math.max(0, monthCO2) / 320); // 0 good … 1 bad
  const streakBoost = clamp01(Math.min(streak, 14) / 14) * 0.12;

  const clarity = clamp01(1 - co2 + streakBoost);
  const hazeOpacity = clamp01(co2 * 0.85);

  const skyRgb: [number, number, number] = [
    lerp(SKY_CLEAR[0], SKY_HAZY[0], co2),
    lerp(SKY_CLEAR[1], SKY_HAZY[1], co2),
    lerp(SKY_CLEAR[2], SKY_HAZY[2], co2),
  ];

  // Trees: lush (20) when clear, sparse (4) when smoggy.
  const treeCount = Math.round(lerp(4, 20, clarity));
  const sunIntensity = clamp01(lerp(0.35, 1, clarity));

  const groundColor = clarity > 0.6 ? '#5b8e64' : clarity > 0.3 ? '#7a8a6a' : '#8a8472';

  const mood: WorldState['mood'] =
    clarity > 0.66
      ? 'thriving'
      : clarity > 0.4
        ? 'steady'
        : clarity > 0.2
          ? 'strained'
          : 'critical';

  return {
    clarity,
    hazeOpacity,
    skyColor: rgbToHex(skyRgb),
    groundColor,
    treeCount,
    sunIntensity,
    mood,
  };
}

/** A human sentence describing the world for the scene's aria-label. */
export function worldAriaLabel(state: WorldState): string {
  const moodPhrase: Record<WorldState['mood'], string> = {
    thriving: 'a thriving living world with a clear sky and lush trees',
    steady: 'a steady living world with a calm sky and healthy trees',
    strained: 'a strained living world with hazy skies and thinning trees',
    critical: 'a struggling living world under heavy smog with bare trees',
  };
  return `EcoTrace living world: ${moodPhrase[state.mood]}.`;
}
