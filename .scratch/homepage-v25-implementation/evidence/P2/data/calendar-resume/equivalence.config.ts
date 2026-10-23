import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({ root: process.cwd(), cacheDir: path.join(import.meta.dirname, ".vite-cache"), resolve: { alias: { "@": process.cwd(), "server-only": path.join(process.cwd(), "tests/server-only.ts") } }, test: { environment: "node", setupFiles: [], maxWorkers: 1, cache: false, include: [".scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/equivalence.test.ts"] } });
