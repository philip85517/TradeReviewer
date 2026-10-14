import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(fixtureDirectory, "../../../..");
const fixturePath = resolve(fixtureDirectory, "p0-iwm-futu.xlsx");
const dispatcherPath = resolve(fixtureDirectory, "../dispatcher.ts");

const vite = await createServer({
  configFile: false,
  root: projectRoot,
  logLevel: "silent",
  appType: "custom",
  optimizeDeps: { disabled: true },
  server: { middlewareMode: true },
});

try {
  const { parseBrokerStatement } = await vite.ssrLoadModule(dispatcherPath);
  const bytes = new Uint8Array(readFileSync(fixturePath));
  const file = {
    name: "p0-iwm-futu.xlsx",
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };

  process.stdout.write("READY\n");
  process.stdout.write("BEFORE_DISPATCH\n");
  const result = await parseBrokerStatement(file);
  process.stdout.write(
    `AFTER_DISPATCH:${JSON.stringify({
      broker: result.broker,
      records: result.records.length,
      blocked: result.blocked,
    })}\n`,
  );
} finally {
  await vite.close();
}
