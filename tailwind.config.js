/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // OpSync dark theme palette
        bg: {
          primary: "#0f1117",     // main page background
          secondary: "#171923",   // sidebar, cards
          tertiary: "#1e2130",    // inputs, hover states
          elevated: "#252838",    // modals, dropdowns
        },
        text: {
          primary: "#f0f1f3",
          secondary: "#9a9eb5",
          muted: "#6b6f7e",
        },
        border: {
          default: "#2a2d3a",
          focus: "#4f6ff5",
        },
        accent: {
          blue: "#4f6ff5",
          blueHover: "#6b85f7",
          green: "#34d399",
          amber: "#fbbf24",
          red: "#f87171",
        },
      },
      fontFamily: {
        sans: ["'GeistSans'", "system-ui", "sans-serif"],
        mono: ["'GeistMono'", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.25)",
        modal: "0 8px 32px rgba(0,0,0,0.4)",
        glow: "0 0 16px rgba(79,111,245,0.25)",
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease",
        slideUp: "slideUp 0.25s ease",
        pulse: "pulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
