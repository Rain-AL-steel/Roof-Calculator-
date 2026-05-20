function fracPart(value) {
        var abs = Math.abs(value);
        return abs - Math.floor(abs);
      }

export function actualSegments(precise) {
        if (!Number.isFinite(precise)) return NaN;
        var fraction = fracPart(precise);
        var low = Math.floor(precise);
        var high = Math.ceil(precise);
        if (fraction <= 0.18) return low;
        if (fraction >= 0.19) return high;
        return low;
      }

export function computeSlopeLength(projectionLength, slopeMode, slopeValue) {
        if (!Number.isFinite(projectionLength) || projectionLength < 0) return NaN;
        if (slopeMode === "percent") {
          if (!Number.isFinite(slopeValue) || slopeValue < 0) return NaN;
          var ratio = slopeValue / 100;
          return projectionLength * Math.sqrt(1 + ratio * ratio);
        }
        if (!Number.isFinite(slopeValue) || slopeValue < 0 || slopeValue >= 90) return NaN;
        var radians = slopeValue * Math.PI / 180;
        var cosine = Math.cos(radians);
        return cosine > 0 ? projectionLength / cosine : NaN;
      }
