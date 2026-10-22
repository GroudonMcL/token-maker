// The label fonts (DESIGN.md §6.10): a curated set of fantasy-suitable fonts
// with open licences (SIL OFL), bundled with the site from @fontsource (never
// loaded from Google at runtime). This file is plain data so the renderer can
// name a font without loading anything; src/fonts/fontFiles.ts has the files
// and src/fonts/fontLoader.ts loads them.

export interface FontInfo {
  id: string;
  name: string;
  /** The family name the font is registered under. Our own name, so a copy installed on the computer is never used instead. */
  family: string;
  /** The kind of font to fall back to while it loads. */
  fallback: 'serif' | 'sans-serif' | 'cursive';
  /** True when the font has a real bold; otherwise the browser thickens it. */
  bold: boolean;
  /** True when the font has a real italic; otherwise the browser slants it. */
  italic: boolean;
  /** Its designer(s), for the credits. */
  by: string;
}

const font = (id: string, name: string, fallback: FontInfo['fallback'], bold: boolean, italic: boolean, by: string): FontInfo => ({
  id,
  name,
  family: `tm-${id}`,
  fallback,
  bold,
  italic,
  by,
});

export const FONTS: readonly FontInfo[] = [
  font('cinzel', 'Cinzel', 'serif', true, false, 'Natanael Gama'),
  font('cinzel-decorative', 'Cinzel Decorative', 'serif', true, false, 'Natanael Gama'),
  font('im-fell-english', 'IM Fell English', 'serif', false, true, 'Igino Marini'),
  font('medievalsharp', 'MedievalSharp', 'cursive', false, false, 'Wojciech Kalinowski'),
  font('pirata-one', 'Pirata One', 'cursive', false, false, 'Rodrigo Fuenzalida, Nicolas Massi'),
  font('unifrakturmaguntia', 'UnifrakturMaguntia', 'cursive', false, false, 'J. "Mach" Wust'),
  font('uncial-antiqua', 'Uncial Antiqua', 'cursive', false, false, 'Astigmatic'),
  font('almendra', 'Almendra', 'serif', true, true, 'Ana Sanfelippo'),
  font('metamorphous', 'Metamorphous', 'cursive', false, false, 'James Grieshaber'),
  font('grenze-gotisch', 'Grenze Gotisch', 'cursive', true, false, 'Omnibus-Type'),
  font('macondo', 'Macondo', 'cursive', false, false, 'John Vargas Beltrán'),
  font('alegreya-sc', 'Alegreya SC', 'serif', true, true, 'Juan Pablo del Peral, Huerta Tipográfica'),
  font('spectral', 'Spectral', 'serif', true, true, 'Production Type'),
  font('germania-one', 'Germania One', 'cursive', false, false, 'John Vargas Beltrán'),
  font('eagle-lake', 'Eagle Lake', 'cursive', false, false, 'Astigmatic'),
];

export const DEFAULT_FONT = 'cinzel';

export const fontInfo = (id: string): FontInfo | undefined => FONTS.find((f) => f.id === id);

/** Fonts the user uploads are "upload:<id>" in the document. */
export const UPLOAD_PREFIX = 'upload:';
export const isUploadedFont = (id: string) => id.startsWith(UPLOAD_PREFIX);
export const uploadedFontFamily = (uploadId: string) => `tm-upload-${uploadId.replace(/[^a-zA-Z0-9-]/g, '')}`;

/** The family a label font is drawn with. */
export function fontFamily(id: string): string {
  if (isUploadedFont(id)) return uploadedFontFamily(id.slice(UPLOAD_PREFIX.length));
  return (fontInfo(id) ?? fontInfo(DEFAULT_FONT)!).family;
}

/** A CSS font string for the canvas, e.g. `italic 700 24px "tm-cinzel", serif`. */
export function cssFont(id: string, px: number, bold: boolean, italic: boolean): string {
  const fallback = fontInfo(id)?.fallback ?? 'serif';
  return `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${px}px "${fontFamily(id)}", ${fallback}`;
}
