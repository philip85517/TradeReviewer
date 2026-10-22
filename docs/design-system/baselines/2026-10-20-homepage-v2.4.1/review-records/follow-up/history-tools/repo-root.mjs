import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function ensureRepoRoot(moduleUrl = import.meta.url) {
  let current = path.dirname(fileURLToPath(moduleUrl));
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'docs'))) {
      process.chdir(current);
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('TradeReview repository root not found from history-tools');
}
