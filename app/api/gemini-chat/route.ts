import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  GEMINI_MODEL,
  buildGeminiRequest,
  extractGeminiText,
  toLegacyGeminiResponse,
} from '@/lib/geminiServer';

export const runtime = 'nodejs';

const chatPayloadSchema = z
  .object({
    product: z.literal('EcoTrace').optional(),
    question: z.string().min(1).max(500),
    user: z.record(z.unknown()).optional(),
    profile: z.record(z.unknown()).optional(),
    entries: z.array(z.record(z.unknown())).max(60).optional(),
    insights: z.record(z.unknown()).optional(),
    metrics: z.record(z.unknown()).optional(),
    habits: z.array(z.record(z.unknown())).max(30).optional(),
    goals: z.array(z.record(z.unknown())).max(20).optional(),
    challenges: z.array(z.record(z.unknown())).max(20).optional(),
  })
  .passthrough()
  .refine((value) => JSON.stringify(value).length <= 30000, {
    message: 'Payload too large',
  });

function chatPrompt(payload: z.infer<typeof chatPayloadSchema>): string {
  return [
    'You are EcoTrace AI, a concise climate-action coach.',
    'Answer the user question using only the provided EcoTrace context.',
    'If there are no activity entries, still be helpful: give starter guidance, but do not invent personal footprint patterns.',
    'Return strict JSON: {"reply":"...","suggestions":["...","...","..."]}.',
    `Question: ${payload.question}`,
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

  const parsed = chatPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid chat payload.' }, { status: 400 });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGeminiRequest(chatPrompt(parsed.data))),
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
