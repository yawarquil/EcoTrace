import { describe, expect, it } from 'vitest';

import {
  buildChatFallback,
  capChatMessages,
  coachMessage,
  parseGeminiChatReply,
  parseGeminiInsightCards,
} from '@/lib/ecoCoach';
import { computeStats } from '@/lib/carbonCalculator';
import { createInitialState } from '@/lib/initialState';
import { toDateKey, startOfToday } from '@/lib/datetime';
import type { ActivityEntry, InsightCard } from '@/types';

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    date: toDateKey(startOfToday()),
    category: 'Food',
    subtype: 'Beef meal',
    quantity: 1,
    unit: 'meal',
    co2kg: 6.6,
    avoidedKg: 0,
    note: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const fallbackCards: InsightCard[] = [
  {
    type: 'Priority lever',
    title: 'Lead with food',
    body: 'Food is your biggest lever.',
    action: 'Plan a food reduction',
    impact: '6.6 kg scope',
    confidence: 'Medium',
  },
];

describe('coachMessage', () => {
  it('welcomes a new user with a first-lever message', () => {
    const state = createInitialState();
    const msg = coachMessage(state, computeStats(state));
    expect(msg.tone).toBe('encouraging');
    expect(msg.title.toLowerCase()).toContain('lever');
  });

  it('celebrates when avoided CO₂ is high', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({ avoidedKg: 5, co2kg: 0 })],
    };
    const msg = coachMessage(state, computeStats(state));
    expect(msg.tone).toBe('celebrate');
  });

  it('focuses when over budget', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({ co2kg: 200 })],
    };
    const msg = coachMessage(state, computeStats(state));
    expect(msg.tone).toBe('focus');
  });

  it('addresses the user by name when set', () => {
    const state = { ...createInitialState(), profile: { ...createInitialState().profile, name: 'Asha' } };
    const msg = coachMessage(state, computeStats(state));
    expect(msg.title).toContain('Asha');
  });
});

describe('buildChatFallback', () => {
  it('still gives useful starter coaching when there are no entries', () => {
    const state = createInitialState();
    const { reply, suggestions } = buildChatFallback(
      'what can I do today before logging?',
      state,
      computeStats(state),
    );
    expect(reply.toLowerCase()).toContain('you can still');
    expect(reply.toLowerCase()).toContain('today');
    expect(reply.toLowerCase()).not.toContain("don't have any logged activities yet");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(reply).toMatch(/[.!?]$/);
  });

  it('explains the score when asked', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({ co2kg: 5 })],
    };
    const { reply } = buildChatFallback('what is my score?', state, computeStats(state));
    expect(reply.toLowerCase()).toContain('score');
  });

  it('ends every reply with terminal punctuation', () => {
    const state = {
      ...createInitialState(),
      entries: [entry({})],
    };
    for (const q of ['budget', 'random question', 'how do I improve']) {
      expect(buildChatFallback(q, state, computeStats(state)).reply).toMatch(
        /[.!?]$/,
      );
    }
  });
});

describe('parseGeminiInsightCards', () => {
  it('accepts a well-formed payload', () => {
    const result = parseGeminiInsightCards(
      {
        summary: 'Food is your lever.',
        cards: [
          {
            type: 'Priority lever',
            title: 'Food',
            body: 'Trim beef.',
            action: 'Swap to vegetarian',
            impact: '6 kg',
            confidence: 'High',
          },
          {
            type: 'Pattern',
            title: 'Streak',
            body: 'Consistent.',
            action: 'Keep going',
            impact: '+5 score',
            confidence: 'Medium',
          },
          {
            type: 'Habit',
            title: 'Swaps',
            body: 'Working.',
            action: 'Repeat',
            impact: '3 kg',
            confidence: 'Low',
          },
        ],
      },
      fallbackCards,
    );
    expect(result.source).toBe('gemini');
    expect(result.cards).toHaveLength(3);
  });

  it('falls back when the payload is malformed', () => {
    expect(parseGeminiInsightCards(null, fallbackCards).source).toBe('fallback');
    expect(parseGeminiInsightCards({ cards: [] }, fallbackCards).source).toBe(
      'fallback',
    );
    expect(parseGeminiInsightCards('nope', fallbackCards).source).toBe(
      'fallback',
    );
  });

  it('sanitizes card text', () => {
    const result = parseGeminiInsightCards(
      { summary: 'ok', cards: [{ title: '<b>x</b>' }] },
      fallbackCards,
    );
    expect(result.cards[0]?.title).not.toContain('<');
  });
});

describe('parseGeminiChatReply', () => {
  it('accepts a clean reply', () => {
    const result = parseGeminiChatReply(
      { reply: 'Your lever is food.', suggestions: ['Swap?', 'More?'] },
      { reply: 'fallback', suggestions: [] },
    );
    expect(result.source).toBe('gemini');
    expect(result.suggestions).toHaveLength(2);
  });

  it('strips trailing commas/dashes from the reply', () => {
    const result = parseGeminiChatReply(
      { reply: 'Your lever is food -', suggestions: [] },
      { reply: 'fallback', suggestions: [] },
    );
    expect(result.reply).toBe('Your lever is food');
  });

  it('falls back when the reply is empty', () => {
    expect(
      parseGeminiChatReply({ reply: '' }, { reply: 'fallback', suggestions: [] })
        .source,
    ).toBe('fallback');
  });
});

describe('capChatMessages', () => {
  it('keeps only the last 12 messages', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      text: `m${i}`,
      timestamp: new Date().toISOString(),
    }));
    expect(capChatMessages(messages)).toHaveLength(12);
    expect(capChatMessages(messages)[0]?.text).toBe('m8');
  });
});
