import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function zIndexFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g"))];
  const match = matches.find((candidate) => candidate[1].match(/z-index:\s*(\d+)/));
  expect(match, `expected a CSS rule with z-index for ${selector}`).toBeDefined();

  const zIndex = match?.[1].match(/z-index:\s*(\d+)/)?.[1];
  expect(zIndex, `expected ${selector} to define z-index`).toBeDefined();
  return Number(zIndex);
}

describe("stock drawer layering", () => {
  it("keeps the drawer and backdrop above the responsive app sidebar", () => {
    const appSidebarZIndex = zIndexFor(".app-sidebar");
    const backdropZIndex = zIndexFor(".stock-drawer-backdrop");
    const drawerZIndex = zIndexFor(".stock-sidebar-shell.drawer-open");

    expect(backdropZIndex).toBeGreaterThan(appSidebarZIndex);
    expect(drawerZIndex).toBeGreaterThan(backdropZIndex);
  });
});
