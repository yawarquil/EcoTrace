import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const unusedVarsRule = [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^(mulberry32|uid|_)",
    caughtErrorsIgnorePattern: "^_",
  },
];

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "carbon-footprint-tracker.html",
      "assets/readme/*.svg",
    ],
  },
  ...tseslint.configs.recommended,
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
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
    },
  },
  {
    files: ["tests/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
