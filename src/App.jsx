import { useLayoutEffect, useRef } from "react";

import legacyHtml from "../carbon-footprint-tracker.html?raw";

const styleMatch = legacyHtml.match(/<style>([\s\S]*?)<\/style>/);
const bodyMatch = legacyHtml.match(
  /<body[^>]*>([\s\S]*?)\n\s*<script>\s*'use strict';/,
);
const scriptMatch = legacyHtml.match(
  /<script>\s*('use strict';[\s\S]*?)<\/script>\s*<\/body>/,
);

const legacyStyle = styleMatch ? styleMatch[1] : "";
const legacyBody = bodyMatch ? bodyMatch[1] : "";
const legacyScript = scriptMatch
  ? scriptMatch[1].replace(
      "document.addEventListener('DOMContentLoaded', init);",
      "init();",
    )
  : "";

function loadGoogleCharts() {
  if (document.querySelector("script[data-ecotrace-google-charts]")) return;
  const script = document.createElement("script");
  script.src = "https://www.gstatic.com/charts/loader.js";
  script.async = true;
  script.dataset.ecotraceGoogleCharts = "true";
  document.head.appendChild(script);
}

function ensureBrowserCompatibility() {
  if (typeof window.matchMedia === "function") return;
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

function bootLegacyEcoTrace() {
  if (window.__ECOTRACE_LEGACY_BOOTED__) {
    window.renderApp?.();
    return;
  }
  window.__ECOTRACE_LEGACY_BOOTED__ = true;
  ensureBrowserCompatibility();
  loadGoogleCharts();
  const script = document.createElement("script");
  script.textContent = legacyScript;
  script.dataset.ecotraceLegacyRuntime = "true";
  document.body.appendChild(script);
}

export default function App() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    let style = document.querySelector("style[data-ecotrace-legacy-style]");
    if (!style) {
      style = document.createElement("style");
      style.dataset.ecotraceLegacyStyle = "true";
      style.textContent = legacyStyle;
      document.head.appendChild(style);
    }
    const template = document.createElement("template");
    template.innerHTML = legacyBody;
    const fragment = template.content.cloneNode(true);
    rootRef.current.replaceChildren(fragment);
    bootLegacyEcoTrace();
  }, []);

  return <div ref={rootRef} />;
}
