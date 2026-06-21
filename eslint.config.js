import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextPlugin from "eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";

const unusedVarsRule = [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^(_|mulberry32|LEVELS|PLAN_LIBRARY)",
    caughtErrorsIgnorePattern: "^_",
  },
];

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      ".next/**",
      "playwright-report/**",
      "test-results/**",
      "carbon-footprint-tracker.html",
      "assets/readme/*.svg",
      "next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  js.configs.recommended,
  // Next.js recommended rules (lints ALL app/src source).
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-unused-vars": unusedVarsRule,
      "@typescript-eslint/no-unused-vars": unusedVarsRule,
      // Explicit: no escape-hatch any, no need for prop spreading warnings to block.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  prettierConfig,
];
