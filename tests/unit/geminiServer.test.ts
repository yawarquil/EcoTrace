import { describe, expect, it } from 'vitest';

import {
  GEMINI_MODEL,
  buildGeminiRequest,
  extractGeminiText,
} from '@/lib/geminiServer';

describe('Gemini server helpers', () => {
  it('uses the Flash-Lite model requested for production', () => {
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash-lite');
  });

  it('builds a JSON-only Gemini request without leaking the API key', () => {
    const request = buildGeminiRequest('Return JSON only.');

    expect(JSON.stringify(request)).toContain('Return JSON only.');
    expect(JSON.stringify(request)).toContain('application/json');
    expect(JSON.stringify(request)).not.toContain('GEMINI_API_KEY');
  });

  it('extracts text from Gemini candidate responses', () => {
    expect(
      extractGeminiText({
        candidates: [
          {
            content: {
              parts: [{ text: '{"reply":"Hello."}' }],
            },
          },
        ],
      }),
    ).toBe('{"reply":"Hello."}');
  });
});
