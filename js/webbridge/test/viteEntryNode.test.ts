import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Vite loads a project's config in plain Node and leaves packages from node_modules to Node's own
 * ESM loader — no bundler resolves the `@omega/webbridge-js/vite` entry. Emit it as tsc does and load
 * it the same way.
 */
const VITE_SOURCES = join(__dirname, '../src/vite');

let outDir: string;

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const emitViteEntry = (): string => {
  outDir = mkdtempSync(join(tmpdir(), 'webbridge-vite-entry-'));
  writeFileSync(join(outDir, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const file of readdirSync(VITE_SOURCES).filter((name) => name.endsWith('.ts'))) {
    const { outputText } = ts.transpileModule(readFileSync(join(VITE_SOURCES, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    });
    writeFileSync(join(outDir, file.replace(/\.ts$/, '.js')), outputText);
  }
  return join(outDir, 'index.js');
};

describe('@omega/webbridge-js/vite', () => {
  it('loads in plain Node ESM, as a vite config imports it', () => {
    const entry = pathToFileURL(emitViteEntry()).href;

    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `const vite = await import(${JSON.stringify(entry)});
         if (typeof vite.localBuildServer !== 'function') throw new Error('localBuildServer is missing');`],
      { encoding: 'utf8' },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
