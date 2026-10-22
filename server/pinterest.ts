// Pinterest pin links (DESIGN.md §6.1 item 5). A pin page names its image in
// og:image at a reduced size (e.g. i.pinimg.com/736x/bb/2b/70/<hash>.jpg).
// The full-size copy lives under /originals/ with the same path, but its file
// type can differ (a .png original has .jpg previews), so we look for the
// exact originals URL in the page's own data first. Related pins appear on
// the same page, so only an originals URL with the same path counts.

import type { FoundImage } from './apiTypes.ts';
import { extractImages, resolveImageUrl, scanTags } from './extractImages.ts';

const PINTEREST_HOST = /^(?:[a-z0-9-]+\.)*pinterest\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/i;

export type PinterestKind = 'pin' | 'short' | 'other' | null;

/** What kind of Pinterest link this is, or null for any other site. */
export function pinterestKind(url: URL): PinterestKind {
  const host = url.hostname.toLowerCase();
  if (host === 'pin.it') return 'short';
  if (!PINTEREST_HOST.test(host)) return null;
  return /^\/pin\/[^/]+/.test(url.pathname) ? 'pin' : 'other';
}

/** "i.pinimg.com/736x/bb/2b/70/hash.jpg" → { path: "bb/2b/70/hash", ext: "jpg" }. */
export function pinimgParts(url: string): { path: string; ext: string } | null {
  const m = /^https:\/\/i\.pinimg\.com\/[^/]+\/((?:[0-9a-f]{2}\/){3}[0-9a-f]+)\.([a-z0-9]+)(?:$|[?#])/i.exec(url);
  return m ? { path: m[1]!, ext: m[2]!.toLowerCase() } : null;
}

/** The pin's main image, largest first; empty when the page has none. */
export function pinterestImages(html: string, pageUrl: string | URL): { title: string; images: FoundImage[] } {
  const page = extractImages(html, pageUrl);
  // Page data escapes slashes inside JSON ("https:\/\/i.pinimg.com\/…").
  const text = html.replace(/\\\//g, '/').replace(/\\u002F/gi, '/');
  const og = ogImage(html, new URL(pageUrl));
  const images: FoundImage[] = [];
  const parts = og ? pinimgParts(og.url) : null;
  if (parts) {
    const escaped = parts.path.replace(/\//g, '\\/');
    const original = new RegExp(`https://i\\.pinimg\\.com/originals/${escaped}\\.([a-z0-9]+)`, 'i').exec(text);
    if (original) images.push({ url: original[0] });
    // No originals URL in the page: guess it with the preview's file type.
    else images.push({ url: `https://i.pinimg.com/originals/${parts.path}.${parts.ext}` });
  } else if (!og) {
    // No og:image: fall back to the first "images_orig" in the page data.
    const orig = /"images_orig"\s*:\s*\{[^}]*?"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/.exec(text);
    if (orig) images.push({ url: orig[1]! });
  }
  if (og) images.push(og);
  const title = page.title.split(/\s+\|\s+/)[0]!.trim();
  return { title: /^pinterest$/i.test(title) ? '' : title, images: dedupe(images) };
}

/** The page's own og:image (never an image from a related pin further down). */
function ogImage(html: string, base: URL): FoundImage | null {
  for (const { name, attrs } of scanTags(html)) {
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (name !== 'meta' || (key !== 'og:image' && key !== 'og:image:secure_url')) continue;
    const url = resolveImageUrl(attrs.content, base);
    if (url) return { url };
  }
  return null;
}

function dedupe(images: FoundImage[]): FoundImage[] {
  const seen = new Set<string>();
  return images.filter((i) => !seen.has(i.url) && seen.add(i.url));
}
