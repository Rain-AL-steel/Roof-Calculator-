import { describe, expect, it } from "vitest";
import { leaveAndRemove, shouldReduceMotion, updateTextWithPulse } from "../src/scripts/components/common/motion.js";

describe("motion helpers", function () {
  it("uses the reduced-motion path outside a browser", function () {
    expect(shouldReduceMotion()).toBe(true);
  });

  it("updates text only when the rendered value changes", function () {
    var element = { textContent: "0" };

    expect(updateTextWithPulse(element, "12.50")).toBe(true);
    expect(element.textContent).toBe("12.50");
    expect(updateTextWithPulse(element, "12.50")).toBe(false);
  });

  it("removes immediately on the reduced-motion path", function () {
    var removed = false;
    var element = { dataset: {} };

    leaveAndRemove(element, function () { removed = true; });

    expect(removed).toBe(true);
    expect(element.dataset.motionLeaving).toBe("true");
  });
});
