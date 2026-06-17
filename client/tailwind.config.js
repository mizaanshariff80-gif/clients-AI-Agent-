/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      colors: {
        navy: {
          900: "#050810",
          800: "#080d1a",
          700: "#0c1020",
          600: "#111827",
          500: "#1a2235",
          400: "#243050"
        }
      },
      animation: {
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "orb-pulse": "orb-pulse 3s ease-in-out infinite",
        "orb-spin": "orb-spin 8s linear infinite",
        "slide-in": "slide-in 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out"
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.85)" }
        },
        "orb-pulse": {
          "0%, 100%": { boxShadow: "0 0 40px 10px rgba(139,92,246,0.4), 0 0 80px 20px rgba(59,130,246,0.2)" },
          "50%": { boxShadow: "0 0 60px 20px rgba(139,92,246,0.6), 0 0 100px 30px rgba(59,130,246,0.3)" }
        },
        "orb-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        }
      }
    }
  },
  plugins: []
};
