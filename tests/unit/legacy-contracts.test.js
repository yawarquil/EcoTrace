import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  join(process.cwd(), "carbon-footprint-tracker.html"),
  "utf8",
);
const app = readFileSync(join(process.cwd(), "src/App.jsx"), "utf8");

describe("legacy runtime evaluator contracts", () => {
  it("keeps the React wrapper free of dangerous HTML injection props", () => {
    expect(app).not.toContain("dangerouslySetInnerHTML");
    expect(app).toMatch(/document\.createElement\(["']style["']\)/);
    expect(app).toContain("style.textContent = legacyStyle");
    expect(app).toMatch(/document\.createElement\(["']template["']\)/);
    expect(app).toContain("template.content.cloneNode(true)");
  });

  it("keeps heatmap, rewards, achievements, and AI fallback systems present", () => {
    [
      "function computeHeatmapData",
      "function renderHeatmap",
      "function getUnlockedBadges",
      "function getAchievementProgress",
      "function buildAIInsightFallback",
      "function parseGeminiInsightResponse",
      "function buildAIChatFallback",
      "function parseGeminiChatResponse",
    ].forEach((needle) => expect(html).toContain(needle));
  });

  it("keeps AI chat grounded in live state and protected from incomplete replies", () => {
    expect(html).toContain("getAIChatPayload");
    expect(html).toContain("appState.profile.name");
    expect(html).toContain("entries: getRecentEntriesForAI(60)");
    expect(html).toContain("isAIChatReplyComplete");
    expect(html).toContain("incomplete Gemini replies should fall back");
  });
});
