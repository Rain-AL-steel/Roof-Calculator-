/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/scripts/**/*.js"
  ],
  theme: {
    screens: {
      md: "760px",
      lg: "1120px"
    },
    extend: {
      colors: {
        "app-bg": "#f4f6f0",
        "app-surface": "#fffffc",
        "app-surface-raised": "rgba(255, 255, 252, 0.86)",
        "app-surface-soft": "#eef3eb",
        "app-line": "#d9e1d6",
        "app-line-strong": "#b9c8b7",
        "app-text": "#152018",
        "app-muted": "#647064",
        "app-primary": "#176f58",
        "app-primary-dark": "#0f5342",
        "app-primary-soft": "#dcece4",
        "app-accent": "#9a6a1b",
        "app-danger": "#b42318",
        "app-danger-soft": "#fff0ee"
      },
      borderRadius: {
        app: "8px",
        "app-lg": "18px",
        "app-xl": "26px"
      },
      boxShadow: {
        app: "0 18px 48px rgba(33, 48, 34, 0.11)",
        "app-soft": "0 10px 26px rgba(33, 48, 34, 0.08)"
      },
      transitionTimingFunction: {
        "app-out": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      fontFamily: {
        sans: ["Geist", "Satoshi", "Outfit", "Segoe UI", "Microsoft YaHei", "Noto Sans SC", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Geist Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      keyframes: {
        panelIn: {
          from: { opacity: "0", transform: "translate3d(0, 8px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" }
        },
        rowIn: {
          from: { opacity: "0", transform: "translate3d(0, 6px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" }
        }
      },
      animation: {
        "panel-in": "panelIn 0.34s cubic-bezier(0.16, 1, 0.3, 1) both",
        "row-in": "rowIn 0.34s cubic-bezier(0.16, 1, 0.3, 1) both"
      }
    }
  },
  plugins: []
};
