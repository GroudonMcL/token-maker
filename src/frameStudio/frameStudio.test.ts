// @vitest-environment node
// src/frameStudio/ is Frame Studio's project reader and renderer, copied by
// Frame Studio's `npm run share:export` (DESIGN.md §6.12). Never edit these
// files here: change Frame Studio and export again. This test fails if a copy
// was edited, or a file is missing or extra.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const here = 'src/frameStudio';
const manifest = JSON.parse(readFileSync(join(here, 'SOURCE.json'), 'utf8')) as { commit: string; files: Record<string, string> };
const hash = (path: string) => createHash('sha256').update(readFileSync(path, 'utf8')).digest('hex');

describe('the Frame Studio copy', () => {
  it('matches SOURCE.json, file for file', () => {
    for (const [file, recorded] of Object.entries(manifest.files)) expect(hash(join(here, file)), file).toBe(recorded);
    const present = readdirSync(here)
      .filter((d) => statSync(join(here, d)).isDirectory())
      .flatMap((d) => readdirSync(join(here, d)).map((f) => `${d}/${f}`));
    expect(present.sort()).toEqual(Object.keys(manifest.files).sort());
  });
});
