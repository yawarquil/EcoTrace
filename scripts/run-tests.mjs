import assert from 'node:assert/strict';

import {
  createInitialState,
  computeStats,
  computeCarbonBudget,
  computeLevelFromXP,
  completePlanAction,
  updateProfileName,
  saveReflection,
  STORAGE_VERSION
} from '../src/core.js';
import { deserializeState, serializeState } from '../src/persistence.js';
import { readFileSync } from 'node:fs';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('initial state does not hardcode the user name', () => {
  const state = createInitialState();
  assert.equal(state.profile.name, 'EcoTrace User');
  assert.equal(state.profile.name.includes('EcoTrace User'), true);
});

test('initial state starts clean without demo progress', () => {
  const state = createInitialState();
  const stats = computeStats(state);
  assert.equal(state.entries.length, 0);
  assert.equal(state.xp, 0);
  assert.equal(state.completedWeeklyPlan.length, 0);
  assert.ok(stats.monthCO2 === 0);
  assert.ok(stats.carbonScore < 100);
});

test('profile name update is sanitized and persisted in state', () => {
  const state = createInitialState();
  const next = updateProfileName(state, '  <Ada> Climate  ');
  assert.equal(next.profile.name, 'Ada Climate');
});

test('stats and budget compute meaningful dashboard values', () => {
  const state = createInitialState();
  const stats = computeStats(state);
  const budget = computeCarbonBudget(state, stats);
  assert.equal(stats.monthCO2, 0);
  assert.ok(stats.carbonScore >= 1 && stats.carbonScore <= 100);
  assert.ok(budget.limit > 0);
  assert.ok(Object.hasOwn(budget, 'remaining'));
});

test('plan completion persists avoided impact and XP', () => {
  const state = createInitialState();
  const stats = computeStats(state);
  const first = stats.weeklyPlan[0];
  const next = completePlanAction(state, first.id);
  assert.equal(next.completedWeeklyPlan.includes(first.id), true);
  assert.ok(next.entries.some((entry) => entry.note === 'Weekly climate plan'));
  assert.ok(next.xp > state.xp);
});

test('reflection save replaces same-day reflection and earns XP once per save', () => {
  const state = createInitialState();
  const next = saveReflection(state, 'curious', 'Budget made the next action clear.');
  const again = saveReflection(next, 'steady', 'Updated note.');
  assert.equal(again.reflections.length, 1);
  assert.equal(again.reflections[0].mood, 'steady');
  assert.ok(again.xp > state.xp);
});

test('state serialization round trips with version metadata', () => {
  const state = updateProfileName(createInitialState(), 'Ada Green');
  const encoded = serializeState(state);
  const parsed = JSON.parse(encoded);
  assert.equal(parsed.version, STORAGE_VERSION);
  const restored = deserializeState(encoded);
  assert.equal(restored.profile.name, 'Ada Green');
  assert.deepEqual(computeLevelFromXP(restored.xp), computeLevelFromXP(state.xp));
});

test('legacy small controls use in-place update helpers', () => {
  const html = readFileSync(new URL('../carbon-footprint-tracker.html', import.meta.url), 'utf8');
  [
    'function updateBudgetSurface',
    'function updateTipFilterSurface',
    'function updateLeaderboardSurface',
    'function updateDonutSurface',
    'function updateLogImpactSurface'
  ].forEach((needle) => assert.ok(html.includes(needle), `${needle} missing`));
  assert.ok(html.includes('updateBudgetSurface(event.target.value)'), 'budget input should patch budget panels in place');
  assert.ok(html.includes('updateTipFilterSurface(event.target.value)'), 'tip filter should patch the tip grid in place');
  assert.ok(html.includes('updateLeaderboardSurface()'), 'leaderboard tabs should patch the leaderboard view in place');
  assert.ok(html.includes('updateDonutSurface(donut.dataset.donut)'), 'donut selection should patch the donut in place');
  assert.ok(html.includes('updateLogImpactSurface(event.target)'), 'log inputs should patch live impact in place');
});

test('legacy XP actions keep reward toast and task surfaces in place', () => {
  const html = readFileSync(new URL('../carbon-footprint-tracker.html', import.meta.url), 'utf8');
  [
    'function updateRewardToastSurface',
    'function updateTaskSurface',
    'function updateDashboardActionSurfaces'
  ].forEach((needle) => assert.ok(html.includes(needle), `${needle} missing`));
  assert.ok(html.includes('updateTaskSurface(task.id)'), 'task completion should patch the task panel in place');
  assert.ok(html.includes('updateRewardToastSurface();'), 'XP award should update the floating reward toast directly');
  assert.ok(!html.includes("if (event.target.closest('[data-dismiss-toast]')) {\r\n        appState.rewardToast = null;\r\n        scheduleRender();"), 'toast dismiss should not full-render the app');
});

test('site metadata and success mark are polished', () => {
  const legacyHtml = readFileSync(new URL('../carbon-footprint-tracker.html', import.meta.url), 'utf8');
  const reactHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  [legacyHtml, reactHtml].forEach((html, index) => {
    const name = index === 0 ? 'legacy HTML' : 'React shell';
    assert.ok(html.includes('<title>EcoTrace - Personal Carbon Footprint Tracker</title>'), `${name} should use product title`);
    assert.ok(html.includes('name="theme-color" content="#081814"'), `${name} should define theme color`);
    assert.ok(html.includes('rel="icon" type="image/svg+xml"'), `${name} should include SVG favicon`);
    assert.ok(html.includes('property="og:title" content="EcoTrace"'), `${name} should include Open Graph title`);
  });
  assert.ok(legacyHtml.includes('.celebration-mark svg'), 'success mark should explicitly center SVG icon');
  assert.ok(legacyHtml.includes('transform: translateY(0);'), 'success mark SVG should not sit on a text baseline');
});

test('README includes animated product showcase assets', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  [
    './assets/readme/ecotrace-showcase.svg',
    './assets/readme/heatmap-showcase.svg',
    './assets/readme/product-loop.svg'
  ].forEach((asset) => {
    assert.ok(readme.includes(asset), `${asset} should be referenced in README`);
    const svg = readFileSync(new URL(`..${asset.slice(1)}`, import.meta.url), 'utf8');
    assert.ok(svg.includes('@keyframes') || svg.includes('<animate'), `${asset} should contain animation`);
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
