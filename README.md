# EcoTrace

EcoTrace is a polished personal carbon footprint tracker built as a React/Vite app that wraps a self-contained HTML/CSS/JS product experience. It helps users log emissions, understand footprint patterns, build sustainable habits, earn XP, complete challenges, compare progress, and get AI-assisted climate coaching.

## Highlights

- Personal carbon dashboard with score, XP, level, streaks, budget, trends, and heatmap
- Activity logging for transport, home energy, food, shopping, and travel
- Manual SVG/CSS visualizations: gauge, weekly bars, monthly line chart, donut, heatmap, map, rings, and progress bars
- Goals, habits, daily tasks, challenges, badges, achievements, and leaderboard mechanics
- Learn page with quiz flow and XP rewards
- Eco tips with filtering, effort/impact matrix, and recommendation rail
- Optional Gemini-backed AI insights and chat with resilient fallback responses
- Persistent browser state with versioned migration and clean first-run behavior
- Responsive, accessible UI with dark mode, custom scrollbar, polished metadata, and inline SVG favicon

## Tech Stack

- React 19
- Vite 8
- Plain HTML/CSS/JS runtime embedded from `carbon-footprint-tracker.html`
- No external charting framework
- Browser persistence through versioned app state

## Getting Started

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Set your Gemini API key in `.env` if you want live AI responses. Without a valid key, EcoTrace still works and uses local fallback insight messages.

```text
GEMINI_API_KEY=your_api_key_here
```

Do not commit `.env`; it is intentionally ignored.

## Project Structure

```text
carbon-footprint-tracker.html  Self-contained EcoTrace app runtime
src/App.jsx                    React wrapper that loads the HTML runtime
src/core.js                    Tested core state and computation helpers
src/persistence.js             Versioned state serialization
scripts/run-tests.mjs          Regression tests
index.html                     Vite shell metadata and favicon
vite.config.js                 Vite configuration and Gemini proxy endpoints
```

## Quality Checks

Current validation:

- Clean first-run state has no fake logs, XP, badges, or achievements
- Small UI updates avoid unnecessary full rerenders
- Reward toast persists through XP/task updates
- Metadata and favicon are present
- Production build completes successfully

## Notes

EcoTrace is designed as a portfolio-grade climate product prototype. Demo social data is used only for comparison surfaces such as the leaderboard; user progress, profile state, logs, XP, achievements, goals, and insights are driven by the current browser session.
