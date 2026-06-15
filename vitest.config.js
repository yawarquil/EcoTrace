import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.js"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**", "tests/visual/**"],
    globals: true,
    css: false,
    coverage: {
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx,ts,tsx}", "server.mjs"],
      exclude: ["src/main.jsx"],
    },
  },
});
