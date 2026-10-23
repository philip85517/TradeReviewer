import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import postcss from "postcss";
import { JSDOM } from "jsdom";

const path = "app/components/homepage-v25/contribution-bars.css";
const sheet = postcss.parse(readFileSync(path, "utf8"), { from: path });
function value(selector, property) {
  const found = [];
  sheet.walkRules(selector, rule => rule.walkDecls(property, declaration => found.push(declaration.value)));
  return found;
}
assert.deepEqual(value(".hp-contribution-bars__segment", "height"), ["14px"]);
assert.deepEqual(value(".hp-contribution-bars__segment", "box-sizing"), ["border-box"]);
assert.deepEqual(value(".hp-contribution-bars__segment--hollow", "box-shadow"), ["inset 0 0 0 2px currentColor"]);
assert.deepEqual(value(".hp-contribution-bars__segment--positive", "color"), ["#53D7A0"]);
assert.deepEqual(value(".hp-contribution-bars__segment--negative", "color"), ["#EF7F89"]);
assert.deepEqual(value(".hp-contribution-bars__row", "min-height"), ["43px"]);
assert.deepEqual(value(".hp-contribution-bars__row--market", "min-height"), ["70px", "70px"]);
assert.deepEqual(value(".hp-contribution-bars__zero", "left"), ["50%"]);
assert.deepEqual(value(".hp-contribution-bars__detail", "width"), ["264px"]);
assert.deepEqual(value(".hp-contribution-bars__detail", "padding"), ["12px"]);
assert.deepEqual(value(".hp-contribution-bars__detail", "position"), ["fixed"]);
assert.deepEqual(value(".hp-contribution-bars__detail", "box-sizing"), ["border-box"]);
assert.ok(value(".hp-contribution-bars .hp-contribution-bars__action", "white-space").includes("normal"));
let narrow = false;
sheet.walkAtRules("container", rule => { if (rule.params === "(max-width: 735px)") narrow = true; });
assert.ok(narrow);
sheet.walkRules(rule => {
  if (rule.parent.type === "atrule" && rule.parent.name === "keyframes") {
    assert.ok(rule.parent.params.startsWith("hp-contribution-detail-")); return;
  }
  assert.ok(rule.selector.split(",").every(selector => selector.trim().startsWith(".hp-contribution-bars")), `unscoped selector ${rule.selector}`);
});
const style = new JSDOM().window.document.createElement("div").style;
sheet.walkDecls("font", declaration => { style.font = ""; style.font = declaration.value; assert.notEqual(style.font, "", `invalid font ${declaration.value}`); });
assert.equal(value(".hp-contribution-bars__segment", "min-width").length, 0);
console.log("PASS: parsed scoped CSS; 14px equal outer segments; inset hollow; signed colors; common 50% zero; 43/70px desktop pitch; fixed 264px/12px detail; explicit parent nowrap reset; local max735px fallback; no segment minimum width.");
console.log("STATIC ONLY: jsdom/postcss do not lay out container queries, measure browser overflow, viewport/DPR, pointer targets or visual fidelity. All actual geometry/visual gates remain NOT VERIFIED for root.");
