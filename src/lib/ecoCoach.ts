/**
 * @file Eco coach: rule-based coaching grounded in real state, plus safe
 * parsing of Gemini responses and deterministic fallback chat replies.
 *
 * The coach never moralizes and always references the user's actual data.
 * Gemini output is validated and sanitized before use; malformed payloads fall
 * back to deterministic coaching so the app never breaks without a key.
 */

import type { EcoStats } from './carbonCalculator';
import { sanitizeText } from './sanitize';
import type { ChatMessage, InsightCard } from '@/types';
import type { EcoState } from '@/types';

/** A coach suggestion surfaced in the dashboard coach panel. */
export interface CoachMessage {
  title: string;
  body: string;
  action: string;
  tone: 'encouraging' | 'focus' | 'celebrate';
}

/**
 * Pick a single coach message from real state. The tone adapts: celebrate when
 * the user has avoided CO₂, focus when over budget, encouraging otherwise.
 */
export function coachMessage(state: EcoState, stats: EcoStats): CoachMessage {
  const name = state.profile.name && state.profile.name !== 'EcoTrace User'
    ? state.profile.name
    : '';

  if (state.entries.length === 0) {
    return {
      title: name ? `${name}, let's find your first lever` : 'Let’s find your first lever',
      body: 'Log one everyday choice and the coach will point you to the highest-impact swap for your week.',
      action: 'Log one everyday choice',
      tone: 'encouraging',
    };
  }

  if (stats.avoidedMonth >= 3) {
    return {
      title: 'Swaps are stacking up',
      body: `You've avoided ${stats.avoidedMonth} kg this month. Repeating your best swap keeps the trend going without adding friction.`,
      action: 'Repeat your best swap',
      tone: 'celebrate',
    };
  }

  if (stats.monthCO2 > 160) {
    return {
      title: `Focus on ${stats.topCategory.toLowerCase()}`,
      body: `${stats.topCategory} is leading your footprint at ${stats.monthCO2} kg. One repeatable swap there is worth more than several small ones elsewhere.`,
      action: `Plan a ${stats.topCategory.toLowerCase()} reduction`,
      tone: 'focus',
    };
  }

  return {
    title: name ? `Good rhythm, ${name}` : 'Good rhythm',
    body: `Your monthly footprint is ${stats.monthCO2} kg, led by ${stats.topCategory.toLowerCase()}. Keep the logging streak alive — consistency lifts your score.`,
    action: 'Log today’s activity',
    tone: 'encouraging',
  };
}

/**
 * Build a deterministic fallback chat reply for a user question.
 *
 * Grounded in real state: references the profile name, top category, monthly
 * CO₂, and streak. Always ends with terminal punctuation (the Gemini prompt
 * requires this; the fallback honors the same contract).
 */
export function buildChatFallback(
  question: string,
  state: EcoState,
  stats: EcoStats,
): { reply: string; suggestions: string[] } {
  const name = state.profile.name && state.profile.name !== 'EcoTrace User'
    ? state.profile.name
    : 'there';
  const q = question.toLowerCase();

  if (state.entries.length === 0) {
    return {
      reply: `${name}, I don't have any logged activities yet. Log your first everyday choice and I can give specific, data-grounded coaching on your biggest lever.`,
      suggestions: [
        'What should I log first?',
        'How is my score calculated?',
        'What is a good first goal?',
      ],
    };
  }

  if (q.includes('score')) {
    return {
      reply: `${name}, your carbon score is ${stats.carbonScore}. It rewards low monthly CO₂ (you're at ${stats.monthCO2} kg), avoided CO₂, and your ${stats.streak}-day logging streak. Keeping the streak up adds up to 10 points.`,
      suggestions: [
        'How do I raise my score?',
        'What is my biggest lever?',
        'How is my budget looking?',
      ],
    };
  }

  if (q.includes('budget') || q.includes('project')) {
    return {
      reply: `You're at ${stats.monthCO2} kg this month led by ${stats.topCategory.toLowerCase()}. Trimming that category by a quarter is usually the fastest projected improvement. Would you like a specific swap?`,
      suggestions: [
        'Suggest a swap for my top category',
        'How do I raise my score?',
        'What habit should I keep?',
      ],
    };
  }

  // Default: top-lever coaching.
  return {
    reply: `${name}, your strongest signal is ${stats.topCategory.toLowerCase()} at ${stats.monthCO2} kg. One repeatable swap there moves your score more than several small actions elsewhere. Your ${stats.streak}-day streak is already helping.`,
    suggestions: [
      'Suggest a swap for my top category',
      'How is my budget looking?',
      'What habit should I keep?',
    ],
  };
}

const DEFAULT_SUGGESTIONS = [
  'What is my biggest lever?',
  'How do I raise my score?',
  'What habit should I keep?',
] as const;

/** Validate + sanitize a parsed Gemini insight payload into safe cards. */
export function parseGeminiInsightCards(
  raw: unknown,
  fallback: InsightCard[],
): { summary: string; cards: InsightCard[]; source: 'gemini' | 'fallback' } {
  if (!raw || typeof raw !== 'object') {
    return { summary: fallback[0]?.title ?? '', cards: fallback, source: 'fallback' };
  }
  const obj = raw as Record<string, unknown>;
  const rawCards = obj.cards;
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return { summary: fallback[0]?.title ?? '', cards: fallback, source: 'fallback' };
  }
  const cards: InsightCard[] = rawCards.slice(0, 3).map((item) => {
    const card = (item ?? {}) as Record<string, unknown>;
    return {
      type: sanitizeText(card.type, 40) || 'Insight',
      title: sanitizeText(card.title, 80) || 'Insight',
      body: sanitizeText(card.body, 280),
      action: sanitizeText(card.action, 120) || 'Log today’s activity',
      impact: sanitizeText(card.impact, 40) || 'Estimated',
      confidence:
        card.confidence === 'High' || card.confidence === 'Low'
          ? (card.confidence as InsightCard['confidence'])
          : 'Medium',
    };
  });
  return {
    summary: sanitizeText(obj.summary, 200) || fallback[0]?.title || '',
    cards,
    source: 'gemini',
  };
}

/** Validate + sanitize a parsed Gemini chat reply into a safe assistant message. */
export function parseGeminiChatReply(
  raw: unknown,
  fallback: { reply: string; suggestions: string[] },
): { reply: string; suggestions: string[]; source: 'gemini' | 'fallback' } {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback, source: 'fallback' };
  }
  const obj = raw as Record<string, unknown>;
  let reply = sanitizeText(obj.reply, 600);
  // Strip trailing commas/colons/dashes so the reply ends cleanly.
  reply = reply.replace(/[\s,;:—\-]+$/, '');
  if (!reply) {
    return { ...fallback, source: 'fallback' };
  }
  const rawSuggestions = Array.isArray(obj.suggestions) ? obj.suggestions : [];
  const suggestions = rawSuggestions
    .map((s) => sanitizeText(s, 80))
    .filter((s) => s.length > 0)
    .slice(0, 3);
  return {
    reply,
    suggestions: suggestions.length > 0 ? suggestions : [...DEFAULT_SUGGESTIONS],
    source: 'gemini',
  };
}

/** Build the user-visible chat message list capped to the last 12. */
export function capChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-12);
}
