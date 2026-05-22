export function parseNum(value) {
        if (value === "" || value === null || value === undefined) return NaN;
        var normalized = String(value).trim().replace(",", ".");
        if (!normalized) return NaN;
        var number = Number(normalized);
        return Number.isFinite(number) ? number : NaN;
      }

export function formatNum(number, digits) {
        if (!Number.isFinite(number)) return "—";
        return number.toFixed(digits);
      }

export function formatMoney(number) {
        return Number.isFinite(number) ? number.toFixed(2) : "0.00";
      }

export function formatTrimFixed(number, digits) {
        if (!Number.isFinite(number)) return "—";
        return String(parseFloat(number.toFixed(digits)));
      }

export function escapeHtml(text) {
        return String(text || "").replace(/[&<>"']/g, function (ch) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
        });
      }
