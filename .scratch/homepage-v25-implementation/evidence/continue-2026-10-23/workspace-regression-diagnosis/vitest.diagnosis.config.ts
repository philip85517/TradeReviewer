import { mergeConfig } from "vitest/config";
import base from "../../../../../vitest.config";
export default mergeConfig(base, {
  cacheDir: new URL("./.vite-cache", import.meta.url).pathname,
  test: {
    include: [new URL("./fixtures.diagnosis.test.ts", import.meta.url).pathname],
    maxWorkers: 1,
    fileParallelism: false,
    cache: false,
  },
});
