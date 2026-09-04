/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", '"SF Mono"', '"JetBrains Mono"', "Menlo", "Consolas", '"Liberation Mono"', "monospace"],
      },
      colors: {
        canvas: "var(--bg)",
        panel: "var(--card)",
        edge: "var(--card-border)",
        surface: "var(--track)",
        chip: "var(--chip)",
        ink: "var(--text)",
        ink2: "var(--text-dim)",
        ink3: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        good: "var(--good)",
        warn: "var(--warn)",
        bad: "var(--bad)",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255, 255, 255, .03) inset, 0 12px 26px -20px var(--shadow)",
        "card-hover": "0 18px 34px -20px var(--shadow), 0 0 0 1px var(--glow)",
        now: "0 1px 0 rgba(255, 255, 255, .03) inset, 0 10px 20px -18px var(--shadow)",
        btn: "0 12px 22px -12px var(--glow)",
        drawer: "-16px 0 40px rgba(0, 0, 0, .35)",
        seg: "0 1px 0 rgba(255, 255, 255, .04) inset, 0 4px 10px -6px var(--shadow), inset 0 0 0 1px var(--accent)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { transform: "translateX(24px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          to: { backgroundPosition: "-200% 0" },
        },
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "14%": { transform: "scale(1.14)" },
          "28%": { transform: "scale(1)" },
          "42%": { transform: "scale(1.1)" },
          "70%": { transform: "scale(1)" },
        },
      },
      animation: {
        fade: "fadeIn .18s ease both",
        "slide-in": "slideIn .18s ease both",
        shimmer: "shimmer 1.2s ease infinite",
        heartbeat: "heartbeat 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
