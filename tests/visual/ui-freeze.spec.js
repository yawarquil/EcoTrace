import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const routes = ["dashboard", "insights", "log", "goals", "learn", "profile"];
const themes = ["light", "dark"];
const outputDir = join(process.cwd(), "test-results", "ui-freeze");

function stateForTheme(theme) {
  return {
    version: 3,
    savedAt: new Date(0).toISOString(),
    state: {
      onboardingDismissed: true,
      theme,
    },
  };
}

test.describe("visual freeze snapshots", () => {
  test.beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  for (const theme of themes) {
    for (const route of routes) {
      test(`${route} ${theme} snapshot and DOM summary`, async ({
        page,
      }, testInfo) => {
        await page.addInitScript((storedState) => {
          localStorage.setItem(
            "ecotrace.full-ui.state.v1",
            JSON.stringify(storedState),
          );
        }, stateForTheme(theme));

        await page.goto(`/#${route}`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("#main")).toBeVisible();

        const filePrefix = `${testInfo.project.name}-${theme}-${route}`;
        await page.screenshot({
          path: join(outputDir, `${filePrefix}.png`),
          fullPage: true,
          animations: "disabled",
        });

        const domSummary = await page.evaluate(() => ({
          title: document.title,
          h1: Array.from(document.querySelectorAll("h1"), (node) =>
            node.textContent?.trim(),
          ).filter(Boolean),
          headings: Array.from(
            document.querySelectorAll("h1,h2,h3"),
            (node) => ({
              tag: node.tagName.toLowerCase(),
              text: node.textContent?.trim().replace(/\s+/g, " ").slice(0, 120),
            }),
          ).filter((item) => item.text),
          buttons: Array.from(document.querySelectorAll("button"), (node) =>
            (node.getAttribute("aria-label") || node.textContent || "")
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 80),
          ).filter(Boolean),
          activeRoute: location.hash.replace("#", "") || "dashboard",
          elementCount: document.querySelectorAll("*").length,
          horizontalOverflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        }));

        const ariaSnapshot =
          (await page
            .locator("#main")
            .ariaSnapshot()
            .catch((error) => `aria snapshot unavailable: ${error.message}`)) ||
          "";

        writeFileSync(
          join(outputDir, `${filePrefix}.dom.json`),
          `${JSON.stringify({ domSummary, ariaSnapshot }, null, 2)}\n`,
        );

        expect(domSummary.horizontalOverflow).toBeLessThanOrEqual(2);
        expect(domSummary.h1.length).toBeGreaterThanOrEqual(1);
      });
    }
  }
});
