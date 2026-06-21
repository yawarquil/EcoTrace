/**
 * @file Canonical EcoTrace emission factors and the activity subtype registry.
 *
 * Every factor below is the value shipped in the original EcoTrace product and
 * MUST be preserved verbatim during the Next.js re-platform so the numbers and
 * visuals are unchanged. The source citation next to each factor documents
 * where the averaged figure comes from; EcoTrace uses rounded global/averaged
 * factors (see README "Assumptions") because it is a personal tracker, not a
 * certified inventory tool.
 */

/**
 * A supported EcoTrace activity category. These five match the legacy product
 * exactly and are the keys used by the category breakdown, weekly plan, and
 * insights generation.
 */
export const CATEGORIES = [
  'Transport',
  'Home Energy',
  'Food',
  'Shopping',
  'Travel',
] as const;

export type EcoTraceCategory = (typeof CATEGORIES)[number];

/**
 * Emission factors in kg CO₂ per unit.
 *
 * Sources:
 * - Transport (petrol/diesel/electric car, bus, train, flights): IPCC AR6 WGIII
 *   Chapter 10 transport averages + UK DEFRA Greenhouse Gas Conversion
 *   Factors (per-passenger km). EcoTrace uses representative per-km figures.
 * - Food (beef/vegetarian/vegan meal): Poore & Nemecek (2018, Science)
 *   "Reducing food's environmental effects through producers and consumers"
 *   — median life-cycle kg CO₂e per meal derived from per-protein medians.
 * - Energy (electricity global, natural gas): Our World in Data / IEA global
 *   carbon intensity of electricity (g CO₂/kWh) and natural gas combustion
 *   factor (~2.0 kg CO₂/m³).
 */
export const EMISSION_FACTORS = {
  // Transport — IPCC AR6 WGIII Ch.10 / DEFRA per-passenger-km
  carPetrol: 0.192, // kg CO₂ / km, average petrol car
  train: 0.041, // kg CO₂ / km, rail (national rail average)
  bus: 0.089, // kg CO₂ / km, local bus per passenger
  // Food — Poore & Nemecek (2018, Science), per-meal medians
  beefMeal: 6.61, // kg CO₂ / meal
  vegetarianMeal: 0.64, // kg CO₂ / meal
  veganMeal: 0.39, // kg CO₂ / meal
  // Energy — Our World in Data / IEA global electricity intensity
  electricityGlobal: 0.475, // kg CO₂ / kWh, global grid average
  naturalGas: 2.04, // kg CO₂ / m³, natural gas combustion
  // Shopping — representative lower-impact purchase / repair deltas
  lowerImpactPurchase: 0.4, // kg CO₂ saved vs a typical new purchase
  repairedItem: 1.8, // kg CO₂ saved by repairing instead of replacing
} as const;

export type EmissionFactorKey = keyof typeof EMISSION_FACTORS;

/**
 * A selectable activity subtype within a category, with the factor and unit
 * used by {@link calculateEntryCO2}. `factor` is kg CO₂ per `unit` of quantity.
 */
export interface ActivitySubtype {
  /** Stable identifier (subtype label used historically). */
  readonly subtype: string;
  /** Human label shown in the log form. */
  readonly label: string;
  /** kg CO₂ per unit of quantity. */
  readonly factor: number;
  /** Unit of the quantity input (km, kWh, meal, m³, action). */
  readonly unit: 'km' | 'kWh' | 'meal' | 'm3' | 'action';
  /** Optional avoided-CO₂ factor when the subtype already represents savings. */
  readonly avoidedFactor?: number;
}

/**
 * Subtype registry grouped by category. The first entry of each category is
 * the legacy default selected when the user opens the log form.
 */
export const ACTIVITY_SUBTYPES: Readonly<Record<EcoTraceCategory, readonly ActivitySubtype[]>> = {
  Transport: [
    { subtype: 'Petrol car', label: 'Petrol car', factor: EMISSION_FACTORS.carPetrol, unit: 'km' },
    { subtype: 'Train', label: 'Train', factor: EMISSION_FACTORS.train, unit: 'km' },
    { subtype: 'Bus', label: 'Bus', factor: EMISSION_FACTORS.bus, unit: 'km' },
  ],
  'Home Energy': [
    {
      subtype: 'Electricity',
      label: 'Electricity',
      factor: EMISSION_FACTORS.electricityGlobal,
      unit: 'kWh',
    },
    {
      subtype: 'Natural gas',
      label: 'Natural gas',
      factor: EMISSION_FACTORS.naturalGas,
      unit: 'm3',
    },
  ],
  Food: [
    { subtype: 'Beef meal', label: 'Beef meal', factor: EMISSION_FACTORS.beefMeal, unit: 'meal' },
    {
      subtype: 'Vegetarian meal',
      label: 'Vegetarian meal',
      factor: EMISSION_FACTORS.vegetarianMeal,
      unit: 'meal',
    },
    { subtype: 'Vegan meal', label: 'Vegan meal', factor: EMISSION_FACTORS.veganMeal, unit: 'meal' },
  ],
  Shopping: [
    {
      subtype: 'Lower-impact purchase',
      label: 'Lower-impact purchase',
      factor: 0,
      unit: 'action',
      avoidedFactor: EMISSION_FACTORS.lowerImpactPurchase,
    },
    {
      subtype: 'Repaired item',
      label: 'Repaired item',
      factor: 0,
      unit: 'action',
      avoidedFactor: EMISSION_FACTORS.repairedItem,
    },
  ],
  Travel: [
    { subtype: 'Rail planning', label: 'Rail planning', factor: 0, unit: 'action' },
    { subtype: 'Train', label: 'Long train leg', factor: EMISSION_FACTORS.train, unit: 'km' },
  ],
} as const;

/**
 * A cheaper, lower-impact alternative for a given subtype, used by the real-time
 * nudge engine to suggest a swap and quantify the kg CO₂ delta. `betterFactor`
 * is the factor of the suggested alternative in the SAME unit.
 */
export interface BetterAlternative {
  /** Subtype the suggestion applies to. */
  readonly fromSubtype: string;
  /** Subtype label of the suggested lower-impact choice. */
  readonly betterSubtype: string;
  /** Factor of the suggested alternative (same unit). */
  readonly betterFactor: number;
  /** Short coaching copy shown next to the nudge. */
  readonly copy: string;
}

/**
 * Lower-impact swaps surfaced as real-time nudges inside the log form.
 * Ported from the legacy "better alternative" suggestions.
 */
export const BETTER_ALTERNATIVES: readonly BetterAlternative[] = [
  {
    fromSubtype: 'Beef meal',
    betterSubtype: 'Vegetarian meal',
    betterFactor: EMISSION_FACTORS.vegetarianMeal,
    copy: 'A vegetarian meal cuts roughly 6 kg per swap vs beef.',
  },
  {
    fromSubtype: 'Vegetarian meal',
    betterSubtype: 'Vegan meal',
    betterFactor: EMISSION_FACTORS.veganMeal,
    copy: 'Going vegan for this meal saves about 0.25 kg more.',
  },
  {
    fromSubtype: 'Petrol car',
    betterSubtype: 'Train',
    betterFactor: EMISSION_FACTORS.train,
    copy: 'Rail emits about a fifth of a petrol car per km.',
  },
  {
    fromSubtype: 'Bus',
    betterSubtype: 'Train',
    betterFactor: EMISSION_FACTORS.train,
    copy: 'Rail is lower-carbon than the bus for this distance.',
  },
  {
    fromSubtype: 'Electricity',
    betterSubtype: 'Standby off',
    betterFactor: 0,
    copy: 'Switching off standby loads trims a little every hour.',
  },
] as const;

/**
 * XP thresholds per level. Ported verbatim from the legacy `LEVELS` table.
 * `next` is the XP required to reach the following level.
 */
export interface LevelThreshold {
  readonly level: number;
  readonly title: string;
  readonly min: number;
  readonly next: number;
}

export const LEVELS: readonly LevelThreshold[] = [
  { level: 1, title: 'Eco Starter', min: 0, next: 260 },
  { level: 2, title: 'Conscious Chooser', min: 260, next: 700 },
  { level: 3, title: 'Low-Carbon Explorer', min: 700, next: 1250 },
  { level: 4, title: 'Climate Committed', min: 1250, next: 1950 },
  { level: 5, title: 'Eco Hero', min: 1950, next: 2900 },
] as const;
