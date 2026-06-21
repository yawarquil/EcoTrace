/**
 * @file Vitest setup: jsdom matchers, browser API mocks, and localStorage reset.
 *
 * Mocks matchMedia, requestAnimationFrame, ResizeObserver, and WebGL so that
 * Framer Motion, charts, and react-three-fiber can render in jsdom. Clears
 * localStorage between tests so persisted state never leaks across cases.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// matchMedia: Framer Motion + useReducedMotion read this.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// requestAnimationFrame fallback.
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(Date.now()), 16) as unknown as number;
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
}

// ResizeObserver: charts/r3f read dimensions.
class MockResizeObserver {
  observe(): void {
    // no-op
  }
  unobserve(): void {
    // no-op
  }
  disconnect(): void {
    // no-op
  }
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// WebGL: react-three-fiber probes for a GL context. Return null so the
// reduced-motion/static fallback path is exercised in tests.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

// Pointer/IntersectionObserver stubs for layout-driven components.
window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: () => undefined,
  unobserve: () => undefined,
  disconnect: () => undefined,
  takeRecords: () => [],
})) as unknown as typeof IntersectionObserver;

// requestIdleCallback fallback.
window.requestIdleCallback = ((cb: IdleRequestCallback) =>
  window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }) as IdleDeadline, 1)) as typeof window.requestIdleCallback;
window.cancelIdleCallback = ((handle: number) =>
  window.clearTimeout(handle)) as typeof window.cancelIdleCallback;
