import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  GEMINI_MODEL,
  buildGeminiRequest,
  extractGeminiText,
  toLegacyGeminiResponse,
} from '@/lib/geminiServer';

export const runtime = 'nodejs';

const insightsPayloadSchema = z
  .object({
    product: z.literal('EcoTrace').optional(),
    user: z.record(z.unknown()).optional(),
    profile: z.record(z.unknown()).optional(),
    metrics: z.record(z.unknown()),
    categoryBreakdown: z.array(z.record(z.unknown())).max(20),
    weeklyData: z.array(z.record(z.unknown())).max(40),
    heatmapSummary: z.record(z.unknown()).optional(),
    forecast: z.record(z.unknown()).optional(),
    recommendations: z.array(z.record(z.unknown())).max(20).optional(),
  })
  .passthrough()
  .refine((value) => JSON.stringify(value).length <= 30000, {
    message: 'Payload too large',
  });

function insightsPrompt(payload: z.infer<typeof insightsPayloadSchema>): string {
  return [
    'You are EcoTrace AI, a concise climate-action insights engine.',
    'Use only the supplied EcoTrace data. Do not invent logs, emissions, streaks, goals, or category patterns.',
    'If there are no entries, provide starter insights that invite the first real log.',
    'Return strict JSON: {"summary":"...","cards":[{"type":"...","title":"...","body":"...","action":"...","impact":"...","confidence":"High|Medium|Low"}, ...exactly 3 cards]}.',
    `Context: ${JSON.stringify(payload)}`,
  ].join('\n\n');
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured.' },
      { status: 503 },
    );
  }

  const parsed = insightsPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid insights payload.' }, { status: 400 });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGeminiRequest(insightsPrompt(parsed.data))),
    },
  );

  if (!response.ok) {
    return NextResponse.json({ error: 'Gemini request failed.' }, { status: 502 });
  }

  const text = extractGeminiText(await response.json());
  if (!text) {
    return NextResponse.json({ error: 'Gemini returned no text.' }, { status: 502 });
  }

  return NextResponse.json(toLegacyGeminiResponse(text));
}
