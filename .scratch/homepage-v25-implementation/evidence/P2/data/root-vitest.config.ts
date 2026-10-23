import { defineConfig } from "vitest/config";
import base from "../../../../../vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    maxWorkers: 1,
    include: [".scratch/homepage-v25-implementation/evidence/P2/data/root-boundary-oracles.test.ts"],
  },
});
