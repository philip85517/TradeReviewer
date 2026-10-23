import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", maxWorkers: 1, cache: false, include: ["app/lib/reviews/homepage-v25-performance.test.ts"] } });
