import { defaultConfig } from "./config/defaultConfig.js";

export const FIXED_WIDTH = defaultConfig.basics.fixedWidth;
export const PRESET_ACCESSORIES = defaultConfig.accessories.filter(function (item) {
  return item.common;
}).map(function (item) {
  return item.name;
});
export const UNCOMMON_ACCESSORIES = defaultConfig.accessories.filter(function (item) {
  return !item.common;
}).map(function (item) {
  return item.name;
});
export const STEEL_PRESETS = defaultConfig.steel.materials.map(function (item) {
  return item.name;
});
export const OTHER_TILE_PRESETS = defaultConfig.otherTiles.map(function (item) {
  return item.name;
});
