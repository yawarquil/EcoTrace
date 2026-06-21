'use client';

import { useEffect, useState } from 'react';

function legacySrcFromHash(): string {
  if (typeof window === 'undefined') return '/legacy';
  return `/legacy${window.location.hash || ''}`;
}

/** Client bridge that lets top-level hashes open the matching legacy view. */
export function LegacyFrame() {
  const [src, setSrc] = useState('/legacy');

  useEffect(() => {
    const syncHash = () => setSrc(legacySrcFromHash());
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  return (
    <iframe
      className="legacy-frame"
      src={src}
      title="EcoTrace carbon footprint tracker"
    />
  );
}
