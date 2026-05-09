import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        paper: "#f7f4ed",
        "doodle-yellow": "#ffd166",
        "doodle-pink": "#ff6b9d",
        "doodle-teal": "#4ecdc4",
        "doodle-purple": "#b57bee",
        "doodle-orange": "#ff8c42",
        "doodle-green": "#06d6a0",
      },
      fontFamily: {
        caveat: ["var(--font-caveat)", "cursive"],
        courier: ["var(--font-courier)", "monospace"],
      },
      boxShadow: {
        ink: "4px 4px 0 #1a1a1a",
        "ink-sm": "3px 3px 0 #1a1a1a",
        "ink-lg": "5px 5px 0 #1a1a1a",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-1.5deg)" },
          "75%": { transform: "rotate(1.5deg)" },
        },
      },
      animation: {
        wiggle: "wiggle 0.3s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
