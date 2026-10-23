import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import postcss from "postcss";
import { JSDOM } from "jsdom";
const path = "app/components/homepage-v25/contribution-bars.css";
const sheet = postcss.parse(readFileSync(path, "utf8"), { from: path });
const desktop = postcss.root({ nodes: sheet.nodes.filter(node => node.type === "rule").map(node => node.clone()) });
const dom = new JSDOM(`<style>${desktop.toString()}</style><section class="hp-contribution-bars"><p class="hp-contribution-bars__status hp-contribution-bars__status--error">保留旧数据的错误原因</p><ul class="hp-contribution-bars__list"><li class="hp-contribution-bars__row"></li></ul></section>`);
function declarations(root, selector) {
  const values = {};
  root.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; }); });
  return values;
}
const checks = [
  ["CB-M02 error wins the generic status cascade", () => {
    const color = dom.window.getComputedStyle(dom.window.document.querySelector("p")).color;
    assert.equal(color, "rgb(255, 133, 146)", `error must use shared #FF8592, actual ${color}`);
  }],
  ["CB-M03 desktop has one full-height list axis, narrow keeps row axes", () => {
    const axis = declarations(desktop, ".hp-contribution-bars__list:not(:empty)::before");
    assert.equal(axis.content, '""', "desktop needs one list-level axis instead of separated row zero spans");
    assert.equal(axis.position, "absolute"); assert.equal(axis.top, "0"); assert.equal(axis.bottom, "0");
    assert.equal(axis.width, "1px"); assert.equal(axis["pointer-events"], "none");
    assert.equal(axis.left, "calc((100% - var(--hp-contribution-detail-size)) / 2)");
    assert.equal(declarations(desktop, ".hp-contribution-bars__list").position, "relative");
    assert.equal(declarations(desktop, ".hp-contribution-bars__zero").display, "none");
    let narrow;
    sheet.walkAtRules("container", rule => { if (rule.params === "(max-width: 735px)") narrow = rule; });
    assert.ok(narrow); assert.equal(declarations(narrow, ".hp-contribution-bars__list:not(:empty)::before").display, "none");
    assert.equal(declarations(narrow, ".hp-contribution-bars__zero").display, "block");
    assert.equal(declarations(desktop, ".hp-contribution-bars")["--hp-contribution-detail-size"], "36px");
    let coarse;
    sheet.walkAtRules("media", rule => { if (rule.params === "(pointer: coarse)") coarse = rule; });
    assert.ok(coarse); assert.equal(declarations(coarse, ".hp-contribution-bars")["--hp-contribution-detail-size"], "44px");
  }],
];
let failed = 0;
for (const [name, check] of checks) {
  try { check(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log("STATIC/SYNTHETIC ONLY: jsdom computes the flat declaration cascade; postcss checks desktop/narrow axis structure. No browser rendering, axis rect measurement, actual overflow or visual PASS.");
dom.window.close(); process.exitCode = failed ? 1 : 0;
