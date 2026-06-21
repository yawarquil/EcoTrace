import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Next App Router structure', () => {
  it('ships a buildable app entry and Gemini API routes', () => {
    const requiredFiles = [
      'app/layout.tsx',
      'app/page.tsx',
      'app/legacy/route.ts',
      'app/api/gemini-chat/route.ts',
      'app/api/gemini-insights/route.ts',
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(root, file)), `${file} should exist`).toBe(true);
    }
  });
});
