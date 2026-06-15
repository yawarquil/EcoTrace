export type EcoTraceCategory =
  | "Transport"
  | "Home Energy"
  | "Food"
  | "Shopping"
  | "Travel";

export interface EntryModel {
  id: string;
  date: string;
  category: EcoTraceCategory;
  subtype: string;
  quantity: number;
  unit: string;
  co2kg: number;
  avoidedKg?: number;
  note: string;
  timestamp: string;
}

export interface GoalModel {
  id: string;
  title: string;
  category: EcoTraceCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  rewardXp: number;
}

export interface HabitModel {
  id: string;
  title: string;
  category: EcoTraceCategory;
  completedDates: string[];
  rewardXp: number;
}

export interface GeminiInsightCard {
  type: "Priority lever" | "Pattern signal" | "Habit loop" | string;
  title: string;
  body: string;
  action: string;
  impact: string;
  confidence: "High" | "Medium" | "Low" | string;
}

export interface GeminiInsightResponse {
  summary: string;
  cards: [GeminiInsightCard, GeminiInsightCard, GeminiInsightCard];
}

export interface GeminiChatResponse {
  reply: string;
  suggestions: [string, string, string] | string[];
}

export const emissionFactorReferences = [
  {
    id: "transport-road",
    scope: "Passenger transport factors",
    note: "Fixed product factors used by EcoTrace for deterministic evaluation calculations.",
  },
  {
    id: "food-meals",
    scope: "Meal impact factors",
    note: "Fixed product factors used by EcoTrace for deterministic food comparisons.",
  },
  {
    id: "home-energy",
    scope: "Electricity and natural gas factors",
    note: "Fixed product factors used by EcoTrace for deterministic home-energy estimates.",
  },
] as const;

export function isEcoTraceCategory(value: string): value is EcoTraceCategory {
  return ["Transport", "Home Energy", "Food", "Shopping", "Travel"].includes(
    value,
  );
}

export function hasCompleteChatReply(value: GeminiChatResponse): boolean {
  const reply = value.reply.trim();
  return reply.length > 0 && /[.!?]$/.test(reply);
}
