import { defineConfig } from "vitest/config";
export default defineConfig({test:{environment:"node",maxWorkers:1,cache:false,include:[".scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/benchmark.test.ts"]}});
