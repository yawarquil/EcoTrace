import { describe, expect, it } from 'vitest';

import { esc, sanitizeNumber, sanitizeText } from '@/lib/sanitize';

describe('sanitizeText', () => {
  it('trims and strips angle brackets and quotes', () => {
    expect(sanitizeText('  <b>hi</b> "you"  ')).toBe('bhi/b you');
  });

  it('removes javascript: and on* handlers', () => {
    expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeText('onclick=doStuff')).toBe('doStuff');
  });

  it('removes data:text/html payloads', () => {
    expect(sanitizeText('data:text/html,<script>')).toBe(',script');
  });

  it('truncates to the max length', () => {
    expect(sanitizeText('abcdefghij', 4)).toBe('abcd');
  });

  it('tolerates null/undefined/object input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText({ x: 1 })).toBe('[object Object]');
  });
});

describe('sanitizeNumber', () => {
  it('returns the fallback for NaN/Infinity', () => {
    expect(sanitizeNumber(Number.NaN)).toBe(0);
    expect(sanitizeNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeNumber('abc')).toBe(0);
  });

  it('clamps into the min/max range', () => {
    expect(sanitizeNumber(-5, 0, 10)).toBe(0);
    expect(sanitizeNumber(99, 0, 10)).toBe(10);
    expect(sanitizeNumber(5, 0, 10)).toBe(5);
  });

  it('respects a custom fallback', () => {
    expect(sanitizeNumber(Number.NaN, 0, 10, 1)).toBe(1);
  });

  it('parses numeric strings', () => {
    expect(sanitizeNumber('42', 0, 100)).toBe(42);
  });
});

describe('esc', () => {
  it('escapes all five HTML entities', () => {
    expect(esc('<div class="a">&\'b\'</div>')).toBe(
      '&lt;div class=&quot;a&quot;&gt;&amp;&#39;b&#39;&lt;/div&gt;',
    );
  });

  it('tolerates null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
