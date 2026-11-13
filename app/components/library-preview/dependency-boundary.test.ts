import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('preview dependency boundary', () => {
  it('does not reach legacy storage, workspace, parser, xlsx or Recall', () => {
    const visited = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return; visited.add(file);
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\/api\/storage|(?:workspace|storage|parser|xlsx|recall)/i);
      const imports = source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g);
      for (const match of imports) {
        const target = match[1]; if (!target.startsWith('.')) continue;
        const base = resolve(dirname(file), target);
        const resolved = [base, ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + ext), ...['.ts', '.tsx', '.js', '.jsx'].map(ext => resolve(base, 'index' + ext))].find(path => existsSync(path) && /\.[jt]sx?$/.test(path));
        expect(resolved, `${file}: ${target}`).toBeTruthy(); if (resolved) visit(resolved);
      }
    }
    visit(resolve('app/library-preview/page.tsx'));
  });
});
