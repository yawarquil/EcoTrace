import type { Config } from "tailwindcss";

/**
 * EcoTrace Tailwind configuration.
 *
 * No default Tailwind color palette is used — only the ported EcoTrace design
 * tokens (forest/moss/earth/accent families), surfaced as CSS variables so the
 * same token table in globals.css powers both light and dark themes. Spacing
 * follows the legacy 8px grid; typography reuses the clamp-based scale.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    // Disable the default color palette: only ported EcoTrace tokens are allowed.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      forest: {
        950: "var(--forest-950)",
        900: "var(--forest-900)",
        800: "var(--forest-800)",
        700: "var(--forest-700)",
        600: "var(--forest-600)",
      },
      moss: {
        500: "var(--moss-500)",
        300: "var(--moss-300)",
      },
      earth: {
        50: "var(--earth-50)",
        100: "var(--earth-100)",
        200: "var(--earth-200)",
        300: "var(--earth-300)",
      },
      accent: {
        DEFAULT: "var(--accent)",
        strong: "var(--accent-strong)",
        soft: "var(--accent-soft)",
      },
      chart: {
        teal: "var(--chart-teal)",
        orange: "var(--chart-orange)",
        gold: "var(--chart-gold)",
        blue: "var(--chart-blue)",
        purple: "var(--chart-purple)",
      },
      success: {
        DEFAULT: "var(--success)",
        soft: "var(--success-soft)",
      },
      warning: {
        DEFAULT: "var(--warning)",
        soft: "var(--warning-soft)",
      },
      danger: {
        DEFAULT: "var(--danger)",
        soft: "var(--danger-soft)",
      },
      surface: {
        DEFAULT: "var(--surface)",
        elevated: "var(--surface-elevated)",
        subtle: "var(--surface-subtle)",
        pressed: "var(--surface-pressed)",
        inverse: "var(--surface-inverse)",
      },
      ink: "var(--text)",
      "ink-muted": "var(--text-muted)",
      "ink-soft": "var(--text-soft)",
      "ink-inverse": "var(--text-inverse)",
      border: {
        DEFAULT: "var(--border)",
        strong: "var(--border-strong)",
      },
    },
    fontFamily: {
      display: ["var(--font-display)", "Georgia", "serif"],
      ui: ["var(--font-ui)", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "ui-monospace", "monospace"],
    },
    // 8px grid spacing scale (legacy).
    spacing: {
      px: "1px",
      0: "0",
      1: "var(--space-1)",
      2: "var(--space-2)",
      3: "var(--space-3)",
      4: "var(--space-4)",
      5: "var(--space-5)",
      6: "var(--space-6)",
      7: "var(--space-7)",
      8: "var(--space-8)",
      10: "var(--space-10)",
      12: "var(--space-12)",
      16: "var(--space-16)",
      20: "var(--space-20)",
      24: "var(--space-24)",
      32: "var(--space-32)",
    },
    fontSize: {
      xs: "var(--text-xs)",
      sm: "var(--text-sm)",
      base: "var(--text-base)",
      lg: "var(--text-lg)",
      xl: "var(--text-xl)",
      "2xl": "var(--text-2xl)",
    },
    borderRadius: {
      none: "0",
      sm: "var(--radius-sm)",
      DEFAULT: "var(--radius-md)",
      lg: "var(--radius-lg)",
      pill: "var(--radius-pill)",
    },
    boxShadow: {
      sm: "var(--shadow-sm)",
      md: "var(--shadow-md)",
      lg: "var(--shadow-lg)",
      focus: "var(--focus)",
    },
    extend: {
      transitionTimingFunction: {
        eco: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 240ms ease both",
        "slide-up": "slide-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
