import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const unusedVarsRule = [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^(_|mulberry32|LEVELS|PLAN_LIBRARY)",
    caughtErrorsIgnorePattern: "^_",
  },
];

const eslintConfig = [
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
  js.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  // Next.js recommended rules (lints ALL app/src source).
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
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
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "off",
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

export default eslintConfig;
