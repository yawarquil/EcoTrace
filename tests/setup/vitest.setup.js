import "@testing-library/jest-dom/vitest";

const matchMediaMock = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

if (typeof Window !== "undefined") {
  Object.defineProperty(Window.prototype, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMediaMock,
  });
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMediaMock,
  });
  globalThis.matchMedia = matchMediaMock;
  window.scrollTo = window.scrollTo || (() => {});
  window.requestAnimationFrame =
    window.requestAnimationFrame ||
    ((callback) => window.setTimeout(callback, 16));
  window.cancelAnimationFrame =
    window.cancelAnimationFrame || ((id) => window.clearTimeout(id));
  delete window.__ECOTRACE_LEGACY_BOOTED__;
  document.head
    .querySelectorAll("[data-ecotrace-legacy-style]")
    .forEach((node) => node.remove());
  document.body
    .querySelectorAll("[data-ecotrace-legacy-runtime]")
    .forEach((node) => node.remove());
});
