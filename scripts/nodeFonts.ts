// Registers the bundled label fonts with @napi-rs/canvas, so scripts and
// renderer tests draw labels in the same fonts as the site.
import { GlobalFonts } from '@napi-rs/canvas';
import { existsSync, readFileSync } from 'node:fs';
import { FONTS } from '../src/fonts/catalog';

let done = false;

export function registerBundledFonts(): void {
  if (done) return;
  done = true;
  for (const f of FONTS) {
    for (const face of ['400-normal', '700-normal', '400-italic', '700-italic']) {
      const file = `node_modules/@fontsource/${f.id}/files/${f.id}-latin-${face}.woff2`;
      if (existsSync(file)) GlobalFonts.register(readFileSync(file), f.family);
    }
  }
}
