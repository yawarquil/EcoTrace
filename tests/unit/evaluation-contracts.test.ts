import { describe, expect, it } from "vitest";

import {
  emissionFactorReferences,
  hasCompleteChatReply,
  isEcoTraceCategory,
} from "../../src/evaluation-contracts";

describe("typed evaluation contracts", () => {
  it("recognizes supported EcoTrace categories", () => {
    expect(isEcoTraceCategory("Transport")).toBe(true);
    expect(isEcoTraceCategory("Home Energy")).toBe(true);
    expect(isEcoTraceCategory("Crypto Mining")).toBe(false);
  });

  it("documents emission-factor source groups and complete AI replies", () => {
    expect(emissionFactorReferences).toHaveLength(3);
    expect(
      hasCompleteChatReply({
        reply: "Your food pattern is improving.",
        suggestions: ["A", "B", "C"],
      }),
    ).toBe(true);
    expect(
      hasCompleteChatReply({
        reply: "Your food pattern is improving,",
        suggestions: ["A", "B", "C"],
      }),
    ).toBe(false);
  });
});
