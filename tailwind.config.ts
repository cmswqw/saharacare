import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: { DEFAULT: "#17615A", foreground: "#FFFFFF" },
        brand: {
          200: "#B3C9C7",
          300: "#71928F",
          500: "#2FA095",
          600: "#4A837C",
          700: "#17615A",
          900: "#13413D",
          950: "#083430",
        },
        surface: { mint: "#EAF6F4", soft: "#F6FBFA", white: "#FFFFFF" },
        blue: {
          50: "#EAF6F4",
          100: "#D8EEEA",
          200: "#B3DCD6",
          300: "#82C4BB",
          400: "#4EA79D",
          500: "#2F8C83",
          600: "#17615A",
          700: "#134F49",
          800: "#103F3B",
          900: "#0C3532",
          950: "#062522",
        },
        success: "#187A54",
        warning: "#A65F00",
        danger: "#C63F39",
        clinical: { info: "#17615A", allergy: "#9C2F2B" },
        card: "rgb(var(--card) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem", "3xl": "1.375rem" },
      boxShadow: { soft: "0 12px 32px rgba(8, 52, 48, 0.07)" },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-devanagari)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
