import { readFileSync } from "node:fs";
import postcss from "postcss";
import { JSDOM } from "jsdom";
const cssPath = "app/components/homepage-v25/contribution-bars.css";
const tsxPath = "app/components/homepage-v25/contribution-bars.tsx";
const sheet = postcss.parse(readFileSync(cssPath, "utf8"));
const flat = postcss.root({ nodes: sheet.nodes.filter(node => node.type === "rule").map(node => node.clone()) });
const dom = new JSDOM(`<style>${flat.toString()}</style><section class="hp-contribution-bars">${["pending", "pending hp-contribution-bars__status--updating", "error"].map(state => `<p class="hp-contribution-bars__status hp-contribution-bars__status--${state}">${state}</p>`).join("")}</section>`);
console.log("CB-M04/02 FLAT JSDOM CASCADE (not actual browser):");
for (const element of dom.window.document.querySelectorAll("p")) console.log(element.className, dom.window.getComputedStyle(element).color);
console.log("CB-M05 PARSED CSS SOURCE INVENTORY (not observed animation):");
sheet.walkRules(rule => {
  const declarations = rule.nodes.filter(node => node.type === "decl" && /^(transition|animation|animation-name|transform|opacity|pointer-events)$/.test(node.prop));
  if (declarations.length) console.log(JSON.stringify({ line: rule.source.start.line, context: rule.parent.type === "atrule" ? `${rule.parent.name} ${rule.parent.params}` : "base", selector: rule.selector, declarations: declarations.map(node => `${node.prop}: ${node.value}`) }));
});
console.log("CB-M05 TSX DATA/LIFETIME SOURCE INVENTORY (not runtime motion):");
readFileSync(tsxPath, "utf8").split("\n").forEach((line, index) => {
  if (/hasCommitted|prefers-reduced-motion|setTimeout|animation =|animation.cancel|aria-hidden=\{closing|inert=\{closing|setSelection\(null\).*setClosing/.test(line)) console.log(`${index + 1}: ${line.trim()}`);
});
console.log("No real paint, elapsed duration, movement, hover input or reduced-motion browser result is established. Those gates remain NOT VERIFIED.");
dom.window.close();
