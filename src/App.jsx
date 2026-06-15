import { useEffect } from 'react';

import legacyHtml from '../carbon-footprint-tracker.html?raw';

const styleMatch = legacyHtml.match(/<style>([\s\S]*?)<\/style>/);
const bodyMatch = legacyHtml.match(/<body[^>]*>([\s\S]*?)\n\s*<script>\s*'use strict';/);
const scriptMatch = legacyHtml.match(/<script>\s*('use strict';[\s\S]*?)<\/script>\s*<\/body>/);

const legacyStyle = styleMatch ? styleMatch[1] : '';
const legacyBody = bodyMatch ? bodyMatch[1] : '';
const legacyScript = scriptMatch
  ? scriptMatch[1].replace("document.addEventListener('DOMContentLoaded', init);", 'init();')
  : '';

function loadGoogleCharts() {
  if (document.querySelector('script[data-ecotrace-google-charts]')) return;
  const script = document.createElement('script');
  script.src = 'https://www.gstatic.com/charts/loader.js';
  script.async = true;
  script.dataset.ecotraceGoogleCharts = 'true';
  document.head.appendChild(script);
}

function bootLegacyEcoTrace() {
  if (window.__ECOTRACE_LEGACY_BOOTED__) {
    window.renderApp?.();
    return;
  }
  window.__ECOTRACE_LEGACY_BOOTED__ = true;
  loadGoogleCharts();
  const script = document.createElement('script');
  script.textContent = legacyScript;
  script.dataset.ecotraceLegacyRuntime = 'true';
  document.body.appendChild(script);
}

export default function App() {
  useEffect(() => {
    bootLegacyEcoTrace();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: legacyStyle }} />
      <div dangerouslySetInnerHTML={{ __html: legacyBody }} />
    </>
  );
}
