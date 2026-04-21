/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: {
          black: "#000000",
          950: "#030712",
          900: "#0B0F19",
          800: "#111827",
          700: "#1a2235",
          600: "#1e2d45",
          500: "#243352",
          accent: "#6366f1",
          "accent-light": "#818cf8",
          purple: "#7c3aed",
          "purple-light": "#a78bfa",
        },
      },
      backgroundImage: {
        "space-gradient": "linear-gradient(135deg, #0B0F19 0%, #111827 100%)",
        "card-gradient": "linear-gradient(135deg, #111827 0%, #1a2235 100%)",
        "accent-gradient": "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
