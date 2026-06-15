import assert from "node:assert/strict";

import {
  createInitialState,
  computeStats,
  computeCarbonBudget,
  computeLevelFromXP,
  completePlanAction,
  sanitizeNumber,
  sanitizeText,
  updateProfileName,
  saveReflection,
  STORAGE_VERSION,
} from "../src/core.js";
import { deserializeState, serializeState } from "../src/persistence.js";
import { existsSync, readFileSync } from "node:fs";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("initial state does not hardcode the user name", () => {
  const state = createInitialState();
  assert.equal(state.profile.name, "EcoTrace User");
  assert.equal(state.profile.name.includes("EcoTrace User"), true);
});

test("initial state starts clean without demo progress", () => {
  const state = createInitialState();
  const stats = computeStats(state);
  assert.equal(state.entries.length, 0);
  assert.equal(state.xp, 0);
  assert.equal(state.completedWeeklyPlan.length, 0);
  assert.ok(stats.monthCO2 === 0);
  assert.ok(stats.carbonScore < 100);
});

test("profile name update is sanitized and persisted in state", () => {
  const state = createInitialState();
  const next = updateProfileName(state, "  <Ada> Climate  ");
  assert.equal(next.profile.name, "Ada Climate");
});

test("text and number sanitizers block unsafe user input", () => {
  assert.equal(
    sanitizeText(' javascript:<img onerror=alert(1)>"Ada"` ', 50),
    "img alert(1)Ada",
  );
  assert.equal(sanitizeNumber("12.5", 0, 20, 1), 12.5);
  assert.equal(sanitizeNumber("Infinity", 0, 20, 1), 1);
  assert.equal(sanitizeNumber("-4", 0, 20, 1), 0);
  assert.equal(sanitizeNumber("99", 0, 20, 1), 20);
});

test("stats and budget compute meaningful dashboard values", () => {
  const state = createInitialState();
  const stats = computeStats(state);
  const budget = computeCarbonBudget(state, stats);
  assert.equal(stats.monthCO2, 0);
  assert.ok(stats.carbonScore >= 1 && stats.carbonScore <= 100);
  assert.ok(budget.limit > 0);
  assert.ok(Object.hasOwn(budget, "remaining"));
});

test("plan completion persists avoided impact and XP", () => {
  const state = createInitialState();
  const stats = computeStats(state);
  const first = stats.weeklyPlan[0];
  const next = completePlanAction(state, first.id);
  assert.equal(next.completedWeeklyPlan.includes(first.id), true);
  assert.ok(next.entries.some((entry) => entry.note === "Weekly climate plan"));
  assert.ok(next.xp > state.xp);
});

test("reflection save replaces same-day reflection and earns XP once per save", () => {
  const state = createInitialState();
  const next = saveReflection(
    state,
    "curious",
    "Budget made the next action clear.",
  );
  const again = saveReflection(next, "steady", "Updated note.");
  assert.equal(again.reflections.length, 1);
  assert.equal(again.reflections[0].mood, "steady");
  assert.ok(again.xp > state.xp);
});

test("state serialization round trips with version metadata", () => {
  const state = updateProfileName(createInitialState(), "Ada Green");
  const encoded = serializeState(state);
  const parsed = JSON.parse(encoded);
  assert.equal(parsed.version, STORAGE_VERSION);
  const restored = deserializeState(encoded);
  assert.equal(restored.profile.name, "Ada Green");
  assert.deepEqual(
    computeLevelFromXP(restored.xp),
    computeLevelFromXP(state.xp),
  );
});

test("legacy small controls use in-place update helpers", () => {
  const html = readFileSync(
    new URL("../carbon-footprint-tracker.html", import.meta.url),
    "utf8",
  );
  [
    "function updateBudgetSurface",
    "function updateTipFilterSurface",
    "function updateLeaderboardSurface",
    "function updateDonutSurface",
    "function updateLogImpactSurface",
  ].forEach((needle) => assert.ok(html.includes(needle), `${needle} missing`));
  assert.ok(
    html.includes("updateBudgetSurface(event.target.value)"),
    "budget input should patch budget panels in place",
  );
  assert.ok(
    html.includes("updateTipFilterSurface(event.target.value)"),
    "tip filter should patch the tip grid in place",
  );
  assert.ok(
    html.includes("updateLeaderboardSurface()"),
    "leaderboard tabs should patch the leaderboard view in place",
  );
  assert.ok(
    html.includes("updateDonutSurface(donut.dataset.donut)"),
    "donut selection should patch the donut in place",
  );
  assert.ok(
    html.includes("updateLogImpactSurface(event.target)"),
    "log inputs should patch live impact in place",
  );
});

test("legacy XP actions keep reward toast and task surfaces in place", () => {
  const html = readFileSync(
    new URL("../carbon-footprint-tracker.html", import.meta.url),
    "utf8",
  );
  [
    "function updateRewardToastSurface",
    "function updateTaskSurface",
    "function updateDashboardActionSurfaces",
  ].forEach((needle) => assert.ok(html.includes(needle), `${needle} missing`));
  assert.ok(
    html.includes("updateTaskSurface(task.id)"),
    "task completion should patch the task panel in place",
  );
  assert.ok(
    html.includes("updateRewardToastSurface();"),
    "XP award should update the floating reward toast directly",
  );
  assert.ok(
    !html.includes(
      "if (event.target.closest('[data-dismiss-toast]')) {\r\n        appState.rewardToast = null;\r\n        scheduleRender();",
    ),
    "toast dismiss should not full-render the app",
  );
});

test("site metadata and success mark are polished", () => {
  const legacyHtml = readFileSync(
    new URL("../carbon-footprint-tracker.html", import.meta.url),
    "utf8",
  );
  const reactHtml = readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  [legacyHtml, reactHtml].forEach((html, index) => {
    const name = index === 0 ? "legacy HTML" : "React shell";
    assert.ok(
      html.includes(
        "<title>EcoTrace - Personal Carbon Footprint Tracker</title>",
      ),
      `${name} should use product title`,
    );
    assert.ok(
      html.includes('name="theme-color" content="#081814"'),
      `${name} should define theme color`,
    );
    assert.ok(
      html.includes('rel="icon" type="image/svg+xml"'),
      `${name} should include SVG favicon`,
    );
    assert.ok(
      html.includes('property="og:title" content="EcoTrace"'),
      `${name} should include Open Graph title`,
    );
  });
  assert.ok(
    legacyHtml.includes(".celebration-mark svg"),
    "success mark should explicitly center SVG icon",
  );
  assert.ok(
    legacyHtml.includes("transform: translateY(0);"),
    "success mark SVG should not sit on a text baseline",
  );
});

test("React wrapper avoids dangerous HTML injection APIs", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(
    !app.includes("dangerouslySetInnerHTML"),
    "React wrapper should avoid dangerouslySetInnerHTML",
  );
  assert.ok(
    /document\.createElement\(["']template["']\)/.test(app),
    "React wrapper should prepare trusted body markup in a template",
  );
  assert.ok(
    app.includes("template.content.cloneNode(true)"),
    "React wrapper should mount a cloned template fragment",
  );
  assert.ok(
    app.includes("style.textContent = legacyStyle"),
    "React wrapper should install trusted CSS with textContent",
  );
});

test("README includes live deployment and security evidence", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const envExample = readFileSync(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  assert.ok(
    readme.includes("https://your-ecotrace-app.up.railway.app/"),
    "README should link the live Railway deployment",
  );
  assert.ok(
    readme.includes("npm audit"),
    "README should document dependency audit evidence",
  );
  assert.ok(
    envExample.includes("your_gemini_api_key_here"),
    ".env.example should use placeholder Gemini key",
  );
});

test("Railway deployment config is production ready", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const railwayJson = JSON.parse(
    readFileSync(new URL("../railway.json", import.meta.url), "utf8"),
  );
  const server = readFileSync(
    new URL("../server.mjs", import.meta.url),
    "utf8",
  );
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(packageJson.scripts.start, "node server.mjs");
  assert.equal(railwayJson.build.buildCommand, "npm run build");
  assert.equal(railwayJson.deploy.startCommand, "npm run start");
  assert.equal(railwayJson.deploy.healthcheckPath, "/health");
  assert.ok(
    server.includes("server.listen(PORT, HOST"),
    "server should bind to the Railway PORT",
  );
  assert.ok(
    /url\.pathname === ["']\/health["']/.test(server),
    "server should expose a health route",
  );
  assert.ok(
    /url\.pathname === ["']\/api\/gemini-insights["']/.test(server),
    "server should expose AI insights route",
  );
  assert.ok(
    /url\.pathname === ["']\/api\/gemini-chat["']/.test(server),
    "server should expose AI chat route",
  );
  assert.ok(
    readme.includes("## Deploy To Railway"),
    "README should document Railway deployment",
  );
  assert.ok(
    readme.includes("GEMINI_API_KEY"),
    "README should explain Railway Gemini variable",
  );
  assert.ok(
    !existsSync(
      new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
    ),
    "GitHub Pages workflow should be removed",
  );
});

test("README includes animated product showcase assets", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  [
    "./assets/readme/ecotrace-showcase.svg",
    "./assets/readme/heatmap-showcase.svg",
    "./assets/readme/product-loop.svg",
  ].forEach((asset) => {
    assert.ok(
      readme.includes(asset),
      `${asset} should be referenced in README`,
    );
    const svg = readFileSync(
      new URL(`..${asset.slice(1)}`, import.meta.url),
      "utf8",
    );
    assert.ok(
      svg.includes("@keyframes") || svg.includes("<animate"),
      `${asset} should contain animation`,
    );
  });
});

test("README heatmap showcase uses an aligned 12-week grid", () => {
  const svg = readFileSync(
    new URL("../assets/readme/heatmap-showcase.svg", import.meta.url),
    "utf8",
  );
  const height = Number(svg.match(/height="(\d+)"/)?.[1] || 0);
  const gridBottom = 198 + 6 * 70 + 56;
  assert.ok(
    svg.includes('data-weeks="12"'),
    "heatmap should mark a 12-week grid",
  );
  assert.ok(
    svg.includes('data-days="7"'),
    "heatmap should mark seven day rows",
  );
  assert.equal(
    (svg.match(/class="cell/g) || []).length,
    84,
    "heatmap should render 84 blocks",
  );
  assert.ok(
    height >= gridBottom + 40,
    "heatmap canvas should not clip the final row",
  );
  ["Mar", "Apr", "May", "Jun"].forEach((month) => {
    assert.ok(svg.includes(`>${month}</text>`), `${month} label missing`);
  });
});

test("README SVG transform animations do not override placement transforms", () => {
  const assets = [
    "../assets/readme/ecotrace-showcase.svg",
    "../assets/readme/heatmap-showcase.svg",
    "../assets/readme/product-loop.svg",
  ];
  assets.forEach((asset) => {
    const svg = readFileSync(new URL(asset, import.meta.url), "utf8");
    [
      ["node", "lift"],
      ["cursor", "scan"],
      ["tooltip", "tip"],
    ].forEach(([className, animationName]) => {
      const hasAnimatedClass = new RegExp(
        `\\.${className}\\s*\\{[^}]*animation:\\s*${animationName}`,
      ).test(svg);
      const placedElement = new RegExp(
        `class="[^"]*\\b${className}\\b[^"]*"[^>]*transform="translate`,
      ).test(svg);
      assert.ok(
        !(hasAnimatedClass && placedElement),
        `${asset} animates transform on placed .${className} elements`,
      );
    });
  });
});

let passed = 0;
for (const item of tests) {
  try {
    item.fn();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode !== 1) {
  console.log(`${passed}/${tests.length} tests passed`);
}
