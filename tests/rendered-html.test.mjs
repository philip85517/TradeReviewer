import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the historical trade review workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>TradeReview — 历史交易复盘<\/title>/i);
  assert.match(html, /逐笔复盘/);
  assert.match(html, /交易复盘图表工作区/);
  assert.match(html, /未来信息已锁定/);
  assert.match(html, /导入交易记录/);
  assert.match(html, /小鹏汽车/);
  assert.match(html, /尚未成交/);
  assert.doesNotMatch(html, /demo-buy-1|demo-buy-2|demo-sell-1/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("client bundle contains no unrevealed demo executions", () => {
  const clientDirectory = new URL("../dist/client/", import.meta.url);
  const files = readdirSync(clientDirectory, {
    recursive: true,
    withFileTypes: true,
  });
  const bundle = files
    .filter((entry) => entry.isFile() && /\.(?:js|html|json)$/.test(entry.name))
    .map((entry) =>
      readFileSync(join(entry.parentPath, entry.name), "utf8"),
    )
    .join("\n");

  assert.doesNotMatch(bundle, /demo-buy-1|demo-buy-2|demo-sell-1/);
});
