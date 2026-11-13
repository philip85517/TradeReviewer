import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const forbiddenImport = (target: string) => /(?:workspace|storage|parser|xlsx|recall)/i.test(target);
const importsOf = (source: string) => [...source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)].map(match => match[1]);

describe('preview dependency boundary', () => {
  it('recognizes side-effect imports in transitive modules', () => {
    const modules: Record<string, string> = { entry: "import './side'", './side': "import './storage'" };
    const visited = new Set<string>();
    const walk = (name: string) => { if (visited.has(name)) return; visited.add(name); for (const dep of importsOf(modules[name] ?? '')) walk(dep); };
    walk('entry'); expect(visited.has('./storage')).toBe(true);
  });
  it('allows browser session storage while rejecting legacy imports', () => {
    expect(importsOf('sessionStorage.getItem("key")')).toEqual([]);
    expect(importsOf("import './storage'").some(forbiddenImport)).toBe(true);
  });
  it('does not reach legacy storage, workspace, parser, xlsx or Recall', () => {
    const visited = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return; visited.add(file);
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\/api\/storage/i);
      const imports = importsOf(source);
      for (const target of imports) { expect(forbiddenImport(target), `${file}: ${target}`).toBe(false); if (!target.startsWith('.')) continue;
        if (target.endsWith('.css')) continue;
        const base = resolve(dirname(file), target);
        const resolved = [base, ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + ext), ...['.ts', '.tsx', '.js', '.jsx'].map(ext => resolve(base, 'index' + ext))].find(path => existsSync(path) && /\.[jt]sx?$/.test(path));
        expect(resolved, `${file}: ${target}`).toBeTruthy(); if (resolved) visit(resolved);
      }
    }
    visit(resolve('app/library-preview/page.tsx'));
  });
});
