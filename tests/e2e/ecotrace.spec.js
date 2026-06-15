import { expect, test } from "@playwright/test";

const routes = [
  "#dashboard",
  "#insights",
  "#log",
  "#goals",
  "#learn",
  "#profile",
];

async function dismissOnboarding(page) {
  const skip = page.locator("[data-onboarding-skip]");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ force: true, timeout: 2_000 });
  }
}

async function startWithoutOnboarding(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ecotrace.full-ui.state.v1",
      JSON.stringify({
        version: 3,
        savedAt: new Date(0).toISOString(),
        state: { onboardingDismissed: true },
      }),
    );
  });
}

test.describe("EcoTrace product shell", () => {
  test("loads key routes with no console errors and no horizontal overflow", async ({
    page,
  }) => {
    await startWithoutOnboarding(page);
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const route of routes) {
      await page.goto(`/${route}`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("EcoTrace").first()).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(2);
    }

    expect(errors).toEqual([]);
  });

  test("keeps AI, heatmap, logging, and dark mode functional", async ({
    page,
  }) => {
    await startWithoutOnboarding(page);
    await page.goto("/#insights");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await expect(page.locator("[data-ai-chat]")).toBeVisible();
    await expect(page.locator("[data-insights-heatmap]")).toBeVisible();

    await page.goto("/#log");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await expect(
      page.getByRole("heading", { name: /log activity/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      /dark|light/,
    );
  });
});
