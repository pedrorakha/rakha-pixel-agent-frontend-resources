import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        pixel: {
          bg: "#1a1a2e",
          surface: "#16213e",
          panel: "#0f3460",
          accent: "#e94560",
          text: "#eaeaea",
          muted: "#7f8c8d",
          floor: "#2c2c54",
          "floor-alt": "#34345a",
          wall: "#474787",
          "wall-dark": "#2c2c54",
          desk: "#8b6914",
          "desk-dark": "#6b4f10",
          bed: "#5c3d2e",
          "bed-sheet": "#a8d8ea",
          coffee: "#6f4e37",
          green: "#2ecc71",
          yellow: "#f1c40f",
          red: "#e74c3c",
          gray: "#95a5a6",
          skin: "#ffccaa",
          "skin-shadow": "#e6a87c",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
      animation: {
        "pixel-bounce": "pixel-bounce 0.5s steps(4) infinite",
        "pixel-blink": "pixel-blink 1s steps(2) infinite",
        "pixel-float": "pixel-float 2s steps(8) infinite",
      },
      keyframes: {
        "pixel-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pixel-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "pixel-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
