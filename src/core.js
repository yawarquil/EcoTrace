export const STORAGE_VERSION = 3;

export const CATEGORIES = [
  "Transport",
  "Home Energy",
  "Food",
  "Shopping",
  "Travel",
];

export const EMISSION_FACTORS = {
  carPetrol: 0.192,
  train: 0.041,
  bus: 0.089,
  beefMeal: 6.61,
  vegetarianMeal: 0.64,
  veganMeal: 0.39,
  electricityGlobal: 0.475,
  naturalGas: 2.04,
};

const LEVELS = [
  { level: 1, title: "Eco Starter", min: 0, next: 260 },
  { level: 2, title: "Conscious Chooser", min: 260, next: 700 },
  { level: 3, title: "Low-Carbon Explorer", min: 700, next: 1250 },
  { level: 4, title: "Climate Committed", min: 1250, next: 1950 },
  { level: 5, title: "Eco Hero", min: 1950, next: 2900 },
];

const PLAN_LIBRARY = {
  Transport: [
    [
      "Replace one short car trip",
      2.5,
      "Walk, cycle, or use transit for a local errand.",
    ],
    [
      "Plan a transit-first commute",
      1.8,
      "Set the route before the day gets busy.",
    ],
  ],
  Food: [
    [
      "Choose a plant-forward meal",
      5.9,
      "Use the beef-to-vegetarian swap as today's easy lever.",
    ],
    [
      "Make lunch vegetarian",
      3.2,
      "A repeatable lunch default keeps decisions light.",
    ],
  ],
  "Home Energy": [
    [
      "Trim heating or cooling for one hour",
      1.4,
      "Shorten one energy-heavy home window.",
    ],
    ["Switch off standby loads", 0.8, "Clear small devices before bedtime."],
  ],
  Shopping: [
    [
      "Delay one nonessential purchase",
      3.5,
      "Give the purchase 24 hours before deciding.",
    ],
    [
      "Repair or reuse one item",
      2.4,
      "Extend the life of something already owned.",
    ],
  ],
  Travel: [
    [
      "Check a rail alternative",
      6.8,
      "Compare one lower-carbon route before booking.",
    ],
    [
      "Replace a long errand locally",
      4.1,
      "Choose the closest useful option today.",
    ],
  ],
};

export function startOfToday(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function uid(prefix, index) {
  return `${prefix}-${index}`;
}

export function sanitizeText(value, max = 120) {
  return String(value ?? "")
    .replace(/javascript:/gi, "")
    .replace(/\bon\w+\s*=/gi, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, max);
}

export function sanitizeNumber(
  value,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fallback = min,
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, min, max);
}

function seedHabits() {
  return [
    {
      id: "bike-commute",
      title: "Bike commute",
      category: "Transport",
      completedDates: [],
      rewardXp: 28,
    },
    {
      id: "veg-lunch",
      title: "Vegetarian lunch",
      category: "Food",
      completedDates: [],
      rewardXp: 24,
    },
    {
      id: "no-shopping",
      title: "No impulse shopping",
      category: "Shopping",
      completedDates: [],
      rewardXp: 22,
    },
    {
      id: "energy-save",
      title: "Energy saving action",
      category: "Home Energy",
      completedDates: [],
      rewardXp: 20,
    },
  ];
}

export function createInitialState() {
  const todayKey = toDateKey(startOfToday());
  return {
    version: STORAGE_VERSION,
    entries: [],
    profile: {
      name: "EcoTrace User",
      location: "",
      commute: "mixed",
      diet: "flexitarian",
    },
    goals: [
      {
        id: "goal-transport",
        title: "Reduce transport emissions by 20%",
        category: "Transport",
        targetValue: 22,
        currentValue: 0,
        unit: "kg CO2",
        deadline: todayKey,
        rewardXp: 120,
      },
      {
        id: "goal-food",
        title: "Have 5 plant-based meals this week",
        category: "Food",
        targetValue: 5,
        currentValue: 0,
        unit: "meals",
        deadline: todayKey,
        rewardXp: 90,
      },
    ],
    habits: seedHabits(),
    completedWeeklyPlan: [],
    reflections: [],
    carbonBudget: { monthlyLimit: 160, revisedAt: todayKey },
    xp: 0,
    theme: "light",
    currentView: "dashboard",
    selectedReflectionMood: "steady",
    scenarioOpen: false,
    toast: null,
  };
}

export function computeLevelFromXP(xp) {
  const current =
    [...LEVELS].reverse().find((item) => xp >= item.min) || LEVELS[0];
  const nextThreshold = current.next ?? current.min + 1200;
  const progress = Math.round(
    clamp(((xp - current.min) / (nextThreshold - current.min)) * 100, 0, 100),
  );
  return {
    level: current.level,
    title: current.title,
    progress,
    toNext: Math.max(0, nextThreshold - xp),
  };
}

function sum(items, key) {
  return round(
    items.reduce((total, item) => total + Number(item[key] || 0), 0),
    1,
  );
}

function entriesThisMonth(entries, today = startOfToday()) {
  return entries.filter((entry) => {
    const date = parseDateKey(entry.date);
    return (
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  });
}

export function getTopCategory(entries) {
  const totals = CATEGORIES.map((category) => ({
    category,
    total: sum(
      entries.filter((entry) => entry.category === category),
      "co2kg",
    ),
  })).sort((a, b) => b.total - a.total);
  return totals[0]?.category || "Transport";
}

export function computeCarbonScore({ monthCO2, avoidedMonth = 0, streak = 0 }) {
  if (monthCO2 === 0 && avoidedMonth === 0 && streak === 0) return 50;
  return Math.round(
    clamp(
      98 - monthCO2 * 0.26 + avoidedMonth * 0.2 + Math.min(10, streak * 0.45),
      18,
      100,
    ),
  );
}

export function computeWeeklyData(entries, today = startOfToday()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const key = toDateKey(date);
    const co2kg = sum(
      entries.filter((entry) => entry.date === key),
      "co2kg",
    );
    return {
      date: key,
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      co2kg,
      state: co2kg > 12 ? "high" : co2kg > 5 ? "moderate" : "good",
    };
  });
}

export function computeCategoryBreakdown(entries) {
  const total = Math.max(1, sum(entries, "co2kg"));
  return CATEGORIES.map((category) => {
    const kg = sum(
      entries.filter((entry) => entry.category === category),
      "co2kg",
    );
    return { category, kg, percent: Math.round((kg / total) * 100) };
  }).sort((a, b) => b.kg - a.kg);
}

export function generateWeeklyPlan(state, topCategory = "Transport") {
  const today = startOfToday();
  const categories = [
    topCategory,
    "Food",
    "Transport",
    "Home Energy",
    "Shopping",
    "Travel",
  ].filter(
    (category, index, list) => category && list.indexOf(category) === index,
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = toDateKey(addDays(today, index));
    const category = categories[index % categories.length];
    const template =
      PLAN_LIBRARY[category][index % PLAN_LIBRARY[category].length];
    const id = `plan-${date}-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`;
    return {
      id,
      date,
      category,
      title: template[0],
      impactKg: template[1],
      body: template[2],
      rewardXp: 18 + (index % 3) * 4,
      done: state.completedWeeklyPlan.includes(id),
    };
  });
}

export function computeStats(state) {
  const monthEntries = entriesThisMonth(state.entries);
  const monthCO2 = sum(monthEntries, "co2kg");
  const avoidedMonth = sum(monthEntries, "avoidedKg");
  const weeklyData = computeWeeklyData(state.entries);
  const topCategory = getTopCategory(monthEntries);
  const streak = Math.min(
    30,
    new Set(state.entries.map((entry) => entry.date)).size,
  );
  const carbonScore = computeCarbonScore({ monthCO2, avoidedMonth, streak });
  const weeklyPlan = generateWeeklyPlan(state, topCategory);
  return {
    monthCO2,
    avoidedMonth,
    weeklyData,
    weeklyTotal: sum(weeklyData, "co2kg"),
    categoryBreakdown: computeCategoryBreakdown(monthEntries),
    topCategory,
    carbonScore,
    streak,
    levelInfo: computeLevelFromXP(state.xp),
    weeklyPlan,
  };
}

export function computeCarbonBudget(state, stats = computeStats(state)) {
  const today = startOfToday();
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
  const limit = Math.max(40, Number(state.carbonBudget.monthlyLimit || 160));
  const remaining = round(limit - stats.monthCO2, 1);
  return {
    limit,
    used: stats.monthCO2,
    remaining,
    percent: Math.round(clamp((stats.monthCO2 / limit) * 100, 0, 100)),
    dailyAllowance: round(Math.max(0, remaining) / daysLeft, 1),
    projected: round(
      (stats.monthCO2 / Math.max(1, today.getDate())) * daysInMonth,
      1,
    ),
    status: remaining >= 0 ? "On budget" : "Over budget",
  };
}

export function computeScenario(state, stats = computeStats(state)) {
  const planSavings = sum(stats.weeklyPlan, "impactKg") / 2;
  const lowCarbonWeek = round(
    Math.max(stats.weeklyTotal * 0.38, stats.weeklyTotal - planSavings),
    1,
  );
  const weeklySavings = round(
    Math.max(0, stats.weeklyTotal - lowCarbonWeek),
    1,
  );
  return {
    currentWeek: stats.weeklyTotal,
    lowCarbonWeek,
    weeklySavings,
    monthlySavings: round(weeklySavings * 4, 1),
    scoreLift: Math.min(16, Math.max(1, Math.round((weeklySavings * 4) / 9))),
  };
}

export function updateProfileName(state, name) {
  const clean = sanitizeText(name, 72) || "EcoTrace User";
  return { ...state, profile: { ...state.profile, name: clean } };
}

export function updateBudget(state, value) {
  return {
    ...state,
    carbonBudget: {
      monthlyLimit: sanitizeNumber(value, 40, 800, 160),
      revisedAt: toDateKey(startOfToday()),
    },
  };
}

export function awardXP(state, amount, reason) {
  return {
    ...state,
    xp: state.xp + amount,
    toast: {
      title: "Progress saved",
      body: `+${amount} XP${reason ? ` for ${reason}` : ""}`,
    },
  };
}

export function completePlanAction(state, id) {
  if (state.completedWeeklyPlan.includes(id)) return state;
  const stats = computeStats(state);
  const item = stats.weeklyPlan.find((planItem) => planItem.id === id);
  if (!item) return state;
  const entry = {
    id: `entry-plan-${Date.now()}`,
    date: item.date,
    category: item.category,
    subtype: item.title,
    quantity: 1,
    unit: "plan action",
    co2kg: 0,
    avoidedKg: item.impactKg,
    note: "Weekly climate plan",
    timestamp: new Date().toISOString(),
  };
  return awardXP(
    {
      ...state,
      entries: [...state.entries, entry],
      completedWeeklyPlan: [...state.completedWeeklyPlan, id],
    },
    item.rewardXp,
    item.title.toLowerCase(),
  );
}

export function saveReflection(state, mood, note) {
  const todayKey = toDateKey(startOfToday());
  const reflection = {
    id: `reflection-${todayKey}`,
    date: todayKey,
    mood: sanitizeText(mood, 32) || "steady",
    note: sanitizeText(note, 160),
    category: getTopCategory(entriesThisMonth(state.entries)),
    timestamp: new Date().toISOString(),
  };
  return awardXP(
    {
      ...state,
      reflections: [
        ...state.reflections.filter((item) => item.date !== todayKey),
        reflection,
      ],
      selectedReflectionMood: reflection.mood,
    },
    22,
    "saving a daily reflection",
  );
}

export function calculateEntryCO2(category, subtype, quantity) {
  const amount = sanitizeNumber(quantity, 0, 100000, 0);
  const factors = {
    "Petrol car": EMISSION_FACTORS.carPetrol,
    Train: EMISSION_FACTORS.train,
    Bus: EMISSION_FACTORS.bus,
    "Beef meal": EMISSION_FACTORS.beefMeal,
    "Vegetarian meal": EMISSION_FACTORS.vegetarianMeal,
    "Vegan meal": EMISSION_FACTORS.veganMeal,
    Electricity: EMISSION_FACTORS.electricityGlobal,
    "Natural gas": EMISSION_FACTORS.naturalGas,
    "Lower-impact purchase": 0.4,
    "Rail planning": 0,
  };
  const factor = factors[subtype] ?? 0;
  const unit =
    category === "Food"
      ? "meal"
      : category === "Home Energy"
        ? subtype === "Natural gas"
          ? "m3"
          : "kWh"
        : category === "Transport"
          ? "km"
          : "action";
  return { co2kg: round(amount * factor, 1), unit };
}

export function addActivityEntry(state, draft) {
  const category = CATEGORIES.includes(draft.category)
    ? draft.category
    : "Transport";
  const subtype = sanitizeText(draft.subtype, 80) || "Train";
  const quantity = sanitizeNumber(draft.quantity, 0, 100000, 1);
  const impact = calculateEntryCO2(category, subtype, quantity);
  const entry = {
    id: `entry-${Date.now()}`,
    date: draft.date || toDateKey(startOfToday()),
    category,
    subtype,
    quantity,
    unit: impact.unit,
    co2kg: impact.co2kg,
    avoidedKg: 0,
    note: sanitizeText(draft.note, 160),
    timestamp: new Date().toISOString(),
  };
  return awardXP(
    { ...state, entries: [...state.entries, entry] },
    impact.co2kg <= 2 ? 42 : 30,
    "logging activity",
  );
}

export function appReducer(state, action) {
  switch (action.type) {
    case "navigate":
      return { ...state, currentView: action.view };
    case "theme":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };
    case "profileName":
      return updateProfileName(state, action.name);
    case "budget":
      return updateBudget(state, action.value);
    case "completePlan":
      return completePlanAction(state, action.id);
    case "mood":
      return { ...state, selectedReflectionMood: action.mood };
    case "reflection":
      return saveReflection(state, state.selectedReflectionMood, action.note);
    case "addEntry":
      return addActivityEntry(state, action.entry);
    case "scenario":
      return { ...state, scenarioOpen: action.open };
    case "applyScenario": {
      const stats = computeStats(state);
      const scenario = computeScenario(state, stats);
      return awardXP(
        {
          ...state,
          scenarioOpen: false,
          goals: [
            ...state.goals,
            {
              id: `goal-scenario-${Date.now()}`,
              title: `Low-carbon week: save ${scenario.weeklySavings} kg`,
              category: stats.topCategory,
              targetValue: scenario.weeklySavings,
              currentValue: 0,
              unit: "kg CO2",
              deadline: toDateKey(addDays(startOfToday(), 7)),
              rewardXp: 140,
            },
          ],
          currentView: "goals",
        },
        28,
        "applying a low-carbon scenario",
      );
    }
    case "toast":
      return { ...state, toast: action.toast };
    case "reset":
      return createInitialState();
    default:
      return state;
  }
}
