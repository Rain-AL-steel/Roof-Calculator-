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
        "app-bg": "#f7f5ef",
        "app-surface": "#fcfbf8",
        "app-surface-raised": "#ffffff",
        "app-surface-soft": "#f0ece3",
        "app-line": "#ddd7c9",
        "app-line-strong": "#c9bea9",
        "app-text": "#171613",
        "app-muted": "#716d64",
        "app-primary": "#191714",
        "app-primary-dark": "#0f0e0c",
        "app-primary-soft": "#f3ead5",
        "app-accent": "#c5a45d",
        "app-danger": "#2c2924",
        "app-danger-soft": "#f2ead8"
      },
      borderRadius: {
        app: "2px",
        "app-lg": "6px",
        "app-xl": "12px"
      },
      boxShadow: {
        app: "0 18px 42px -34px rgba(33, 29, 22, 0.34), 0 1px 2px rgba(33, 29, 22, 0.06)",
        "app-soft": "0 12px 28px -24px rgba(33, 29, 22, 0.24), 0 1px 2px rgba(33, 29, 22, 0.05)"
      },
      transitionTimingFunction: {
        "app-out": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      fontFamily: {
        sans: ["Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI Variable", "Segoe UI", "Noto Sans SC", "system-ui", "sans-serif"],
        mono: ["Bahnschrift", "JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"]
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
