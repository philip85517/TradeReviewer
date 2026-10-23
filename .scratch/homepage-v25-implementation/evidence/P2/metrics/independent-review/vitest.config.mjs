import path from "node:path";
import { defineConfig } from "vitest/config";

const evidenceDirectory = import.meta.dirname;
export default defineConfig({
  root: process.cwd(),
  cacheDir: path.join(evidenceDirectory, ".vite-cache"),
  resolve: { alias: { "@": process.cwd(), "server-only": path.join(process.cwd(), "tests/server-only.ts") } },
  test: {
    environment: "jsdom", maxWorkers: 1, cache: false,
    setupFiles: [path.join(process.cwd(), "tests/setup.ts")],
    include: [path.join(evidenceDirectory, "currency-context-detail.test.tsx")],
  },
});
