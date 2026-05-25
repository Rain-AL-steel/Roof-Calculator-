function isNonNegativeFinite(value) {
  return Number.isFinite(value) && value >= 0;
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function fracPart(value) {
  var abs = Math.abs(value);
  return abs - Math.floor(abs);
}

export function actualSegments(precise) {
  if (!isNonNegativeFinite(precise)) return NaN;
  var fraction = Number(fracPart(precise).toFixed(12));
  var low = Math.floor(precise);
  var high = Math.ceil(precise);
  if (fraction <= 0.18) return low;
  if (fraction >= 0.19) return high;
  return low;
}

export function computeSlopeLength(projectionLength, slopeMode, slopeValue) {
  if (!isNonNegativeFinite(projectionLength)) return NaN;
  if (slopeMode === "percent") {
    if (!isNonNegativeFinite(slopeValue)) return NaN;
    var ratio = slopeValue / 100;
    return projectionLength * Math.sqrt(1 + ratio * ratio);
  }
  if (!isNonNegativeFinite(slopeValue) || slopeValue >= 90) return NaN;
  var radians = slopeValue * Math.PI / 180;
  var cosine = Math.cos(radians);
  return cosine > 0 ? projectionLength / cosine : NaN;
}

export function segmentCountToLength(segmentCount, segmentLength) {
  if (!isNonNegativeFinite(segmentCount) || !isPositiveFinite(segmentLength)) return NaN;
  return Number((segmentCount * segmentLength).toFixed(3));
}

export function lengthToPreciseSegments(length, segmentLength) {
  if (!isNonNegativeFinite(length) || !isPositiveFinite(segmentLength)) return NaN;
  return length / segmentLength;
}

export function computeArea(length, qty, fixedWidth) {
  if (!isNonNegativeFinite(length) || !isNonNegativeFinite(qty) || !isPositiveFinite(fixedWidth)) return NaN;
  return length * qty * fixedWidth;
}

export function computeMainAmount(area, unitPrice) {
  if (!isNonNegativeFinite(area) || !isNonNegativeFinite(unitPrice)) return 0;
  return Math.round(area * unitPrice);
}

export function computeLineSubtotal(qty, price) {
  if (!isNonNegativeFinite(qty) || !isNonNegativeFinite(price)) return NaN;
  return qty * price;
}

export function sumFiniteAmounts(values) {
  return (Array.isArray(values) ? values : []).reduce(function (sum, value) {
    return isNonNegativeFinite(value) ? sum + value : sum;
  }, 0);
}

export function computeGrandAmount(mainAmount, accessoryAmount, steelAmount, otherTileAmount) {
  return sumFiniteAmounts([mainAmount, accessoryAmount, steelAmount, otherTileAmount]);
}
