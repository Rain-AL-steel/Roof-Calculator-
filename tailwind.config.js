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
        "app-bg": "#ffffff",
        "app-surface": "#ffffff",
        "app-surface-raised": "#ffffff",
        "app-surface-soft": "#f7f7f7",
        "app-line": "#e5e7eb",
        "app-line-strong": "#d1d5db",
        "app-text": "#111827",
        "app-muted": "#6b7280",
        "app-primary": "#111827",
        "app-primary-dark": "#030712",
        "app-primary-soft": "#f3f4f6",
        "app-accent": "#4b5563",
        "app-danger": "#b42318",
        "app-danger-soft": "#fff0ee"
      },
      borderRadius: {
        app: "8px",
        "app-lg": "18px",
        "app-xl": "26px"
      },
      boxShadow: {
        app: "0 1px 2px rgba(0, 0, 0, 0.05)",
        "app-soft": "0 1px 3px rgba(0, 0, 0, 0.08)"
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
