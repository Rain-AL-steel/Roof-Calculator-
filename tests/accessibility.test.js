import fs from "node:fs";
import { describe, expect, it } from "vitest";

var html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
var css = fs.readFileSync(new URL("../src/styles/tailwind.css", import.meta.url), "utf8");

function getElementStartTag(id) {
  var match = new RegExp("<[^>]+id=[\"']" + id + "[\"'][^>]*>").exec(html);
  return match ? match[0] : "";
}

function relativeLuminance(hex) {
  var channels = [1, 3, 5].map(function (start) {
    var value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  var lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  var darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("application accessibility structure", function () {
  it("provides a working skip target and a labelled main landmark for every application view", function () {
    expect(html).toContain('class="skip-link" href="#appMainContent"');
    expect(getElementStartTag("appMainContent")).toContain('tabindex="-1"');
    ["authView", "dashboardView", "historyView"].forEach(function (id) {
      expect(getElementStartTag(id)).toContain('role="main"');
      expect(getElementStartTag(id)).toMatch(/aria-labelledby="[^"]+"/);
    });
    ["content", "adminRoot"].forEach(function (id) {
      expect(getElementStartTag(id)).toMatch(/^<main\b/);
      expect(getElementStartTag(id)).toMatch(/aria-labelledby="[^"]+"/);
    });
  });

  it("connects tab controls, tab panels and dialog descriptions to existing elements", function () {
    var references = Array.from(html.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)).map(function (match) {
      return match[1];
    });
    references.forEach(function (idList) {
      idList.split(/\s+/).forEach(function (id) {
        expect(html, "Missing accessibility target #" + id).toMatch(new RegExp("id=[\"']" + id + "[\"']"));
      });
    });
    expect(getElementStartTag("mainPanelTab")).toContain('aria-selected="true"');
    expect(getElementStartTag("accessoryPanel")).toContain("hidden");
    expect(getElementStartTag("recordDetail")).toContain('role="dialog"');
  });

  it("gives data tables captions and scoped column headings", function () {
    expect(html).toContain('<caption class="sr-only">订单记录列表</caption>');
    expect((html.match(/<th scope="col">/g) || []).length).toBeGreaterThanOrEqual(7);
  });
});

describe("accessible CSS", function () {
  it("keeps small gold text above the WCAG AA contrast threshold", function () {
    expect(contrastRatio("#76551f", "#f7f5ef")).toBeGreaterThanOrEqual(4.5);
  });

  it("defines keyboard focus, increased contrast, forced colors and reduced motion behavior", function () {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-contrast: more)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the consolidated focus rule and removes known duplicate overrides", function () {
    expect((css.match(/button:focus-visible,/g) || [])).toHaveLength(0);
    expect((css.match(/\.dashboard-hero \.metric-card:last-child/g) || [])).toHaveLength(1);
  });
});
