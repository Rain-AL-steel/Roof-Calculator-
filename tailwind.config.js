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
        "app-bg": "#f4f6f5",
        "app-surface": "#ffffff",
        "app-surface-raised": "#ffffff",
        "app-surface-soft": "#eef2f0",
        "app-line": "#d9e1de",
        "app-line-strong": "#c5d0cc",
        "app-text": "#17211e",
        "app-muted": "#66736f",
        "app-primary": "#176b57",
        "app-primary-dark": "#115645",
        "app-primary-soft": "#e3f0eb",
        "app-accent": "#176b57",
        "app-danger": "#b5473e",
        "app-danger-soft": "#fbeceb"
      },
      borderRadius: {
        app: "8px",
        "app-lg": "18px",
        "app-xl": "26px"
      },
      boxShadow: {
        app: "0 18px 42px -34px rgba(23, 33, 30, 0.42), 0 1px 2px rgba(23, 33, 30, 0.06)",
        "app-soft": "0 12px 28px -24px rgba(23, 33, 30, 0.3), 0 1px 2px rgba(23, 33, 30, 0.05)"
      },
      transitionTimingFunction: {
        "app-out": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      fontFamily: {
        sans: ["Geist", "Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", "system-ui", "sans-serif"],
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
