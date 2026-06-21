import { LegacyFrame } from './LegacyFrame';

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#ecotrace-app">
        Skip to EcoTrace app
      </a>
      <main className="legacy-shell" id="ecotrace-app">
        <h1 className="sr-only">EcoTrace personal carbon footprint tracker</h1>
        <LegacyFrame />
      </main>
    </>
  );
}
