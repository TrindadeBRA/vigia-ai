/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        canvas: "#101418",
        panel: "#182021",
        edge: "#393c42",
        surface: "#292c31",
        ink: "#f7f3ef",
        ink2: "#adaeb5",
        ink3: "#6b6d73",
        accent: "#e73831",
        good: "#8cbe94",
        warn: "#e7a65a",
        bad: "#de6d6b",
      },
    },
  },
  plugins: [],
};
