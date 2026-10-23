import { defineConfig } from "vitest/config";
export default defineConfig({test:{environment:"node",maxWorkers:1,cache:false,include:[".scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/profile-opt-in.test.ts"]}});
