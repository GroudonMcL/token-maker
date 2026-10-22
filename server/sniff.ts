// Identify images from their bytes rather than trusting Content-Type (ported
// from the extension, plus BMP and SVG, which the editor also accepts).

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/avif' | 'image/bmp' | 'image/svg+xml';

function ascii(buf: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...buf.subarray(start, start + length));
}

export function sniffImageMime(buf: Uint8Array): ImageMime | null {
  if (buf.length >= 8 && buf[0] === 0x89 && ascii(buf, 1, 3) === 'PNG' && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(ascii(buf, 0, 6))) return 'image/gif';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && ascii(buf, 4, 4) === 'ftyp' && /^avi[fs]$/.test(ascii(buf, 8, 4))) return 'image/avif';
  if (buf.length >= 26 && ascii(buf, 0, 2) === 'BM' && [12, 40, 52, 56, 108, 124].includes(buf[14]! | (buf[15]! << 8))) return 'image/bmp';
  if (looksLikeSvg(buf)) return 'image/svg+xml';
  return null;
}

/** An SVG: optional BOM, XML declaration, comments or doctype, then an <svg> root. */
function looksLikeSvg(buf: Uint8Array): boolean {
  const head = new TextDecoder().decode(buf.subarray(0, 1024)).replace(/^\uFEFF/, '');
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(head);
}

/** True when a Content-Type says HTML. */
export function isHtmlType(contentType: string | null): boolean {
  return /^\s*(text\/html|application\/xhtml\+xml)\b/i.test(contentType ?? '');
}
