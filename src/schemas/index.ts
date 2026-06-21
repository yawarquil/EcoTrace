/**
 * @file Zod schemas for forms and API payloads, with inferred TS types.
 *
 * Every form and every Gemini request/response is validated through these.
 * The route handlers parse inbound bodies; the store parses drafts.
 */

import { z } from 'zod';
import { CATEGORIES, EMISSION_FACTORS } from '@/lib/carbonFactors';

const categoryEnum = z.enum(CATEGORIES as unknown as [string, ...string[]]);

/** Re-export the canonical factors shape for the API context payload. */
export const emissionFactorsSchema = z.object({
  carPetrol: z.literal(EMISSION_FACTORS.carPetrol),
  train: z.literal(EMISSION_FACTORS.train),
  bus: z.literal(EMISSION_FACTORS.bus),
  beefMeal: z.literal(EMISSION_FACTORS.beefMeal),
  vegetarianMeal: z.literal(EMISSION_FACTORS.vegetarianMeal),
  veganMeal: z.literal(EMISSION_FACTORS.veganMeal),
  electricityGlobal: z.literal(EMISSION_FACTORS.electricityGlobal),
  naturalGas: z.literal(EMISSION_FACTORS.naturalGas),
  lowerImpactPurchase: z.literal(EMISSION_FACTORS.lowerImpactPurchase),
  repairedItem: z.literal(EMISSION_FACTORS.repairedItem),
});

/** A log-activity draft (validated before entry creation). */
export const activityDraftSchema = z.object({
  category: categoryEnum,
  subtype: z.string().min(1).max(80),
  quantity: z.number().finite().min(0).max(100000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(160).optional(),
});
export type ActivityDraft = z.infer<typeof activityDraftSchema>;

/** Onboarding name field. */
export const onboardingNameSchema = z.object({
  name: z.string().min(1).max(72),
});

/** Gemini insights request body (the live app-state context). */
export const geminiInsightsRequestSchema = z
  .object({
    profile: z.object({
      name: z.string(),
      commute: z.string(),
      diet: z.string(),
      goalFocus: z.string(),
    }),
    metrics: z.object({
      carbonScore: z.number(),
      monthCO2: z.number(),
      avoidedMonth: z.number(),
      streak: z.number(),
      weeklyTotal: z.number(),
      topCategory: z.string(),
    }),
    categoryBreakdown: z
      .array(z.object({ category: z.string(), kg: z.number(), percent: z.number() }))
      .max(20),
    weeklyData: z
      .array(z.object({ date: z.string(), label: z.string(), co2kg: z.number() }))
      .max(40),
  })
  // Cap serialized size defensively; route handler also caps raw bytes.
  .refine((data) => JSON.stringify(data).length <= 30000, {
    message: 'Context payload too large',
  });

/** Gemini chat request body. */
export const geminiChatRequestSchema = z.object({
  question: z.string().min(1).max(500),
  profile: z.object({ name: z.string() }).passthrough(),
  metrics: z.object({
    carbonScore: z.number(),
    monthCO2: z.number(),
    avoidedMonth: z.number(),
    streak: z.number(),
    topCategory: z.string(),
  }),
});

/** Parsed Gemini insight card (single). */
export const insightCardSchema = z.object({
  type: z.string(),
  title: z.string(),
  body: z.string(),
  action: z.string(),
  impact: z.string(),
  confidence: z.enum(['High', 'Medium', 'Low']),
});

/** Parsed Gemini insights response. */
export const geminiInsightsResponseSchema = z.object({
  summary: z.string(),
  cards: z.array(insightCardSchema).length(3),
});

/** Parsed Gemini chat response. */
export const geminiChatResponseSchema = z.object({
  reply: z.string(),
  suggestions: z.array(z.string()),
});
