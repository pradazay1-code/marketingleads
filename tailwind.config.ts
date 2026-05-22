import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f5ff",
          100: "#dde7ff",
          200: "#c2d3ff",
          300: "#9bb5ff",
          400: "#728eff",
          500: "#5168fa",
          600: "#3a48ee",
          700: "#2f37d1",
          800: "#2932a8",
          900: "#252b85",
          950: "#171a4d",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
