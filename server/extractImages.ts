// Finds the images on a web page (DESIGN.md §6.1 item 4) with a small tag
// scanner, so it runs the same in Workers and in tests: <img> (largest
// srcset entry, lazy-load attributes), <picture><source>, og:image,
// twitter:image, <link rel="image_src">, inline CSS backgrounds and links
// straight to image files. Tiny images (icons) are dropped when the page
// says how big they are; the browser hides the rest once they load.

import type { FoundImage } from './apiTypes.ts';

/** Smaller than this on either side counts as an icon. */
export const MIN_IMAGE_SIDE = 64;
export const MAX_IMAGES = 60;

const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

export function parseAttributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of text.matchAll(ATTR)) {
    const name = m[1]!.toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** Every start tag in the HTML, skipping comments, scripts and style sheets. */
export function* scanTags(html: string): Generator<{ name: string; attrs: Record<string, string> }> {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  for (const m of cleaned.matchAll(TAG)) yield { name: m[1]!.toLowerCase(), attrs: parseAttributes(m[2] ?? '') };
}

export interface SrcsetCandidate {
  url: string;
  width?: number;
  density?: number;
}

/** Parses a srcset, keeping commas that belong inside URLs (e.g. "w_300,h_200"). */
export function parseSrcset(srcset: string): SrcsetCandidate[] {
  const out: SrcsetCandidate[] = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && /[\s,]/.test(srcset[i]!)) i++;
    if (i >= srcset.length) break;
    let end = i;
    while (end < srcset.length && !/\s/.test(srcset[end]!)) end++;
    let url = srcset.slice(i, end);
    i = end;
    let descriptor = '';
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      const comma = srcset.indexOf(',', i);
      descriptor = srcset.slice(i, comma === -1 ? srcset.length : comma).trim();
      i = comma === -1 ? srcset.length : comma + 1;
    }
    const w = /^(\d+)w$/i.exec(descriptor);
    const x = /^(\d*\.?\d+)x$/i.exec(descriptor);
    out.push({ url, width: w ? Number(w[1]) : undefined, density: x ? Number(x[1]) : descriptor ? undefined : 1 });
  }
  return out;
}

/** The biggest entry in a srcset (by width, else by pixel density). */
export function largestFromSrcset(srcset: string): SrcsetCandidate | null {
  const list = parseSrcset(srcset).filter((c) => c.url);
  if (!list.length) return null;
  return list.reduce((best, c) => ((c.width ?? 0) * 1000 + (c.density ?? 0) > (best.width ?? 0) * 1000 + (best.density ?? 0) ? c : best));
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)(?:$|[?#])/i;
const JUNK = /(favicon|apple-touch-icon|sprite|spacer|blank|pixel|tracking|\/emoji\/|gravatar\.com\/avatar|1x1|\/ads?\/)/i;
const TRACKERS = /(^|\.)(facebook\.com|doubleclick\.net|google-analytics\.com|googletagmanager\.com|scorecardresearch\.com|quantserve\.com)$/i;

/** Resolves an attribute value to an https URL we would fetch, or null. */
export function resolveImageUrl(raw: string | undefined, base: URL): string | null {
  const value = raw?.trim();
  if (!value || /^(data|blob|javascript|about):/i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (url.protocol === 'http:') url.protocol = 'https:'; // the proxy only fetches https
  if (url.protocol !== 'https:') return null;
  if (TRACKERS.test(url.hostname) || /\.(svg|ico)(?:$|[?#])/i.test(url.pathname)) return null;
  if (JUNK.test(url.pathname)) return null;
  url.hash = '';
  return url.toString();
}

const num = (v: string | undefined) => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const isTiny = (img: FoundImage) =>
  (img.width !== undefined && img.width < MIN_IMAGE_SIDE) || (img.height !== undefined && img.height < MIN_IMAGE_SIDE);

export interface ExtractedPage {
  title: string;
  images: FoundImage[];
}

export function extractImages(html: string, pageUrl: string | URL): ExtractedPage {
  let base = new URL(pageUrl);
  const meta: FoundImage[] = [];
  const body: FoundImage[] = [];
  let ogTitle = '';
  let docTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  let ogWidth: number | undefined;
  let ogHeight: number | undefined;
  let pictureSource: { url: string; width?: number } | null = null;

  const add = (list: FoundImage[], raw: string | undefined, hint: Partial<FoundImage> = {}) => {
    const url = resolveImageUrl(raw, base);
    if (url) list.push({ url, ...hint });
  };

  for (const { name, attrs } of scanTags(html)) {
    if (name === 'base' && attrs.href) {
      try {
        base = new URL(attrs.href, base);
      } catch {
        /* keep the page URL */
      }
    } else if (name === 'meta') {
      const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();
      const content = attrs.content;
      if (['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(key)) add(meta, content);
      else if (key === 'og:image:width') ogWidth = num(content);
      else if (key === 'og:image:height') ogHeight = num(content);
      else if (key === 'og:title' && content) ogTitle = content;
    } else if (name === 'link' && /\bimage_src\b/i.test(attrs.rel ?? '')) {
      add(meta, attrs.href);
    } else if (name === 'source' && (attrs.srcset || attrs['data-srcset'])) {
      // <picture> sources: remember the biggest, used for the <img> that follows.
      const best = largestFromSrcset(attrs.srcset || attrs['data-srcset']!);
      if (best && (!pictureSource || (best.width ?? 0) > (pictureSource.width ?? 0))) pictureSource = best;
    } else if (name === 'img') {
      const set = attrs['data-srcset'] || attrs['data-lazy-srcset'] || attrs.srcset;
      const fromSet = set ? largestFromSrcset(set) : null;
      const src =
        attrs['data-src'] || attrs['data-lazy-src'] || attrs['data-original'] || attrs['data-full-url'] || attrs['data-large-file'] || attrs.src;
      const candidate = pictureSource && (pictureSource.width ?? 0) > (fromSet?.width ?? 0) ? pictureSource : fromSet;
      pictureSource = null;
      const width = candidate?.width ?? num(attrs.width);
      const height = candidate?.width ? undefined : num(attrs.height);
      add(body, candidate?.url ?? src, { width, height, alt: attrs.alt?.trim() || undefined });
    } else if (name === 'a' && attrs.href && IMAGE_EXT.test(attrs.href)) {
      add(body, attrs.href);
    }
    if (attrs.style && /background/i.test(attrs.style)) {
      for (const m of attrs.style.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) add(body, m[2]);
    }
  }

  if (meta.length && (ogWidth || ogHeight)) Object.assign(meta[0]!, { width: ogWidth, height: ogHeight });

  // Page-level images (og:image etc.) first: they are usually the main picture.
  const seen = new Map<string, FoundImage>();
  for (const img of [...meta, ...body]) {
    const prev = seen.get(img.url);
    if (!prev) seen.set(img.url, { ...img });
    else {
      prev.width = Math.max(prev.width ?? 0, img.width ?? 0) || undefined;
      prev.height = Math.max(prev.height ?? 0, img.height ?? 0) || undefined;
      prev.alt ??= img.alt;
    }
  }
  const images = [...seen.values()].filter((i) => !isTiny(i)).slice(0, MAX_IMAGES);
  for (const img of images) for (const k of ['width', 'height', 'alt'] as const) if (img[k] === undefined) delete img[k];
  docTitle = decodeEntities(docTitle);
  return { title: (ogTitle || docTitle).replace(/\s+/g, ' ').trim().slice(0, 200), images };
}
