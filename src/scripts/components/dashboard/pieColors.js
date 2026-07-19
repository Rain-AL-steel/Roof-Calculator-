var TILE_COLOR_PIE_COLORS = Object.freeze({
  "gray": "#73777d",
  "jujube-red": "#8f1d3a",
  "brick-red": "#c65a3a",
  "unknown-color": "#9a927f"
});

var OVERVIEW_PIE_COLORS = Object.freeze({
  "tile": "#a33a32",
  "accessory": "#c5a45d",
  "steel": "#cbd0d4"
});

var OVERVIEW_FALLBACK_COLORS = Object.freeze([
  "#9a927f",
  "#d6c59b",
  "#c4bfb5",
  "#b28d4f"
]);

export function getTileColorPieColor(key) {
  return TILE_COLOR_PIE_COLORS[key] || TILE_COLOR_PIE_COLORS["unknown-color"];
}

export function getOverviewPieColor(key, index) {
  if (OVERVIEW_PIE_COLORS[key]) return OVERVIEW_PIE_COLORS[key];
  var fallbackIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return OVERVIEW_FALLBACK_COLORS[fallbackIndex % OVERVIEW_FALLBACK_COLORS.length];
}
