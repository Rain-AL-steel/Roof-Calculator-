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
        "app-bg": "#fffaf3",
        "app-surface": "#fffdf9",
        "app-surface-raised": "#ffffff",
        "app-surface-soft": "#fff8ef",
        "app-line": "#ead8bd",
        "app-line-strong": "#ddb987",
        "app-text": "#21150a",
        "app-muted": "#7b6a58",
        "app-primary": "#b56500",
        "app-primary-dark": "#8a4a05",
        "app-primary-soft": "#fff3df",
        "app-accent": "#cf8b2e",
        "app-danger": "#d92d20",
        "app-danger-soft": "#fff1ed"
      },
      borderRadius: {
        app: "8px",
        "app-lg": "18px",
        "app-xl": "26px"
      },
      boxShadow: {
        app: "0 16px 42px -30px rgba(138, 74, 5, 0.42), 0 1px 2px rgba(92, 51, 6, 0.08)",
        "app-soft": "0 12px 26px -22px rgba(138, 74, 5, 0.48), 0 1px 2px rgba(92, 51, 6, 0.08)"
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
