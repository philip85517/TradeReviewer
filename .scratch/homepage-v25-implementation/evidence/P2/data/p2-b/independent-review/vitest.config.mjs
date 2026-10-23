import path from "node:path";
import { defineConfig } from "vitest/config";

const evidenceDirectory = import.meta.dirname;
export default defineConfig({
  root: process.cwd(),
  cacheDir: path.join(evidenceDirectory, ".vite-cache"),
  resolve: { alias: { "@": process.cwd(), "server-only": path.join(process.cwd(), "tests/server-only.ts") } },
  test: {
    environment: "node", setupFiles: [], maxWorkers: 1, cache: false,
    include: [path.join(evidenceDirectory, "future-currency-isolation.test.ts")],
  },
});
