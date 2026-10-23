import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const base = path.resolve(".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer");
const label = process.argv[2];
if (!["head", "freeze1", "freeze1-ready", "freeze1-cash-selector", "freeze1-alias", "freeze1-alias-unknown"].includes(label)) throw new Error("invalid label");
const directory = path.join(base, `workspace-three-${label}`);
if (fs.existsSync(directory)) throw new Error("diagnosis label already used");
fs.mkdirSync(directory);
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const originalPath = "app/components/trade-review-workspace.test.tsx";
const original = fs.readFileSync(originalPath, "utf8");
const files = ["app/components/trade-review-workspace.tsx", "app/components/homepage-v25/use-homepage-host.ts", "app/components/homepage-v25/session-model.ts", "app/components/homepage-v25/holdings-model.ts", "app/components/homepage-v25/home-surface.tsx", "app/components/homepage-v25/fx-adapter.ts", "app/lib/reviews/shared-scope.ts", "app/lib/trades/types.ts", "app/components/test-support/legacy-sqlite-client.ts", "app/components/data-management/cash-baseline-panel.tsx", "app/components/dashboard/room-allocation.tsx", originalPath];
const before = Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))]));
const overrides = {};
const captures = {};
for (const file of files) {
  const frozen = path.join(base, "p1-round1-source", file.replaceAll("/", "__") + ".txt");
  let bytes = fs.existsSync(frozen) ? fs.readFileSync(frozen, "utf8") : fs.readFileSync(file, "utf8");
  if (file === "app/components/trade-review-workspace.tsx" && label === "head") {
    const result = spawnSync("git", ["show", `${head}:${file}`], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr);
    bytes = result.stdout;
  }
  const target = path.join(directory, file.replaceAll("/", "__") + ".txt");
  fs.writeFileSync(target, bytes);
  captures[file] = { sha256: sha(bytes), source: file.endsWith("trade-review-workspace.tsx") && label === "head" ? `git HEAD ${head}` : fs.existsSync(frozen) ? "freeze1 copy" : "observed current", path: target };
  if (file.includes("homepage-v25/") || file.endsWith("trade-review-workspace.tsx")) overrides[path.resolve(file)] = bytes;
}
let test = original.replace(/(["'])(\.{1,2}\/[^"']+)\1/g, (_, quote, relative) => quote + path.resolve("app/components", relative).replaceAll("\\", "/") + quote);
test = test.replace("    cleanup();", `    console.log("PEER_DOM", JSON.stringify({ url: window.location.href, history: window.history.state, regions: [...document.querySelectorAll('section[aria-label], section[aria-labelledby], [role=region]')].map(node => ({name: node.getAttribute('aria-label') ?? document.getElementById(node.getAttribute('aria-labelledby') ?? '')?.textContent, hidden: Boolean(node.closest('[aria-hidden=true]'))})), alerts: [...document.querySelectorAll('[role=alert], [role=status]')].map(node => node.textContent), text: document.body.textContent?.replace(/\\s+/g,' ').slice(-9000), fetch: vi.mocked(fetch).mock.calls.map(([url, init]) => ({url: String(url), method: init?.method ?? 'GET'})) }));\n    cleanup();`);
if (label === "freeze1-ready") {
  // Change only the third test's timing, preserving its unknown execution nature.
  const marker = '  it("returns to the library with its expanded stock context after opening a library round", async () => {';
  const start = test.indexOf(marker);
  const end = test.indexOf('\n  it(', start + marker.length);
  const part = test.slice(start, end).replace('    await user.click(', '    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());\n    await user.click(');
  test = test.slice(0, start) + part + test.slice(end);
}
if (label === "freeze1-cash-selector") {
  test = test.replace('expect(screen.getByLabelText("现金状态")).toHaveTextContent(/已保存现金基准，摘要暂未刷新/);', 'expect(within(screen.getByRole("region", { name: "数据管理" })).getByText(/已保存现金基准，摘要暂未刷新/)).toBeInTheDocument();');
}
if (label === "freeze1-alias" || label === "freeze1-alias-unknown") {
  const marker = '  it("returns to the library with its expanded stock context after opening a library round", async () => {';
  const start = test.indexOf(marker);
  const end = test.indexOf('\n  it(', start + marker.length);
  let part = test.slice(start, end).replace('    render(<TradeReviewWorkspace', '    const fallbackFetch = vi.mocked(fetch).getMockImplementation()!;\n    vi.mocked(fetch).mockImplementation((input, init) => String(input).includes("/tradingview-account-migration/aliases") ? Promise.resolve(Response.json({ aliases: [] })) : fallbackFetch(input, init));\n    render(<TradeReviewWorkspace');
  if (label === "freeze1-alias-unknown") part = part.replace('    const stock =', '    await user.selectOptions(within(library).getByRole("combobox", { name: "交易性质" }), "unknown");\n    const stock =');
  test = test.slice(0, start) + part + test.slice(end);
}
const testPath = path.join(directory, "workspace.test.tsx");
fs.writeFileSync(testPath, test);
const config = `import { defineConfig } from "vitest/config";\nimport fs from "node:fs";\nconst overrides = ${JSON.stringify(overrides)};\nexport default defineConfig({plugins:[{name:"peer-frozen-source",enforce:"pre",transform(code,id){const key=id.split("?")[0];if(overrides[key])return {code:overrides[key],map:null};}}],resolve:{alias:{"@":${JSON.stringify(process.cwd())},"server-only":${JSON.stringify(path.resolve("tests/server-only.ts"))}}},test:{environment:"jsdom",maxWorkers:1,cache:false,setupFiles:["./tests/setup.ts"],include:[${JSON.stringify(path.relative(process.cwd(), testPath))}]}});\n`;
const configPath = path.join(directory, "vitest.config.ts");
fs.writeFileSync(configPath, config);
const testName = label === "freeze1-ready" || label.startsWith("freeze1-alias") ? "returns to the library with its expanded stock context" : label === "freeze1-cash-selector" ? "keeps a successful typed save observable" : "keeps the parent review mounted until a failed navigation save|keeps a successful typed save observable|returns to the library with its expanded stock context";
const args = ["node_modules/vitest/vitest.mjs", "run", "--config", configPath, "-t", testName];
const startedAt = new Date().toISOString();
const run = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: { ...process.env, DEBUG_PRINT_LIMIT: "700" } });
fs.writeFileSync(path.join(directory, "run.log"), (run.stdout ?? "") + (run.stderr ?? ""));
const after = Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))]));
fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify({ label, head, startedAt, completedAt: new Date().toISOString(), command: [process.execPath, ...args], node: process.version, originalTestSha256: sha(original), transformedTestSha256: sha(test), captures, before, after, changedWhileReading: files.filter(file => before[file] !== after[file]), exitCode: run.status, error: run.error ? String(run.error) : null, boundaries: "Only mocked fetch, in-process fake-indexeddb, jsdom and test-local local/sessionStorage; no browser, service or real database" }, null, 2) + "\n");
process.stdout.write(JSON.stringify({ label, directory, exitCode: run.status, changedWhileReading: files.filter(file => before[file] !== after[file]) }) + "\n");
process.exitCode = run.status ?? 1;
