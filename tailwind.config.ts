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
        primary: { DEFAULT: "#2563EB", foreground: "#FFFFFF" },
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
        card: "rgb(var(--card) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
      },
      borderRadius: { xl: "1.25rem", "2xl": "1.75rem", "3xl": "2.25rem" },
      boxShadow: { soft: "0 12px 35px rgba(15, 23, 42, 0.07)" },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-devanagari)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
