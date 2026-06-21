/**
 * Server-only Gemini helpers shared by App Router API handlers.
 *
 * The API key is never included here; handlers append it only to the outbound
 * Google request URL. Keeping model selection and parsing in a tested helper
 * prevents the chat and insights routes from drifting.
 */

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export interface GeminiGenerateContentRequest {
  contents: Array<{
    role: 'user';
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType: 'application/json';
  };
}

/** Build the minimal JSON-mode Gemini request body used by EcoTrace routes. */
export function buildGeminiRequest(prompt: string): GeminiGenerateContentRequest {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
    },
  };
}

/** Extract the first text part from a Gemini generateContent response. */
export function extractGeminiText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return '';
  for (const candidate of candidates) {
    const content = (candidate as { content?: unknown } | null)?.content;
    const parts = (content as { parts?: unknown } | null)?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const text = (part as { text?: unknown } | null)?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  return '';
}

/** Re-wrap extracted text in the shape the legacy client parser already knows. */
export function toLegacyGeminiResponse(text: string): {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
} {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}
