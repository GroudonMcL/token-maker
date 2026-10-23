// Pure helpers for importing from the web (DESIGN.md §6.1 items 2–5): tidying
// what the user typed, pulling a link out of a drag from another tab, naming
// the token, and friendly error messages.

import type { ApiErrorCode } from '../../server/apiTypes.ts';
import { tidyName } from './importImage';

/**
 * Turns typed or pasted text into an https URL, or null if it isn't a web
 * address. "example.com/a.png" gets https:// added; http:// is upgraded
 * because the proxy only fetches https.
 */
export function normaliseAddress(text: string): URL | null {
  let value = text.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^\/\//.test(value)) value = `https:${value}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    if (!/^[^/?#]+\.[a-z]{2,}(?:[:/?#]|$)/i.test(value)) return null;
    value = `https://${value}`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
  return url;
}

/** True for text that is an image as a data: URL (e.g. dragged from some pages). */
export function isDataImageUrl(text: string): boolean {
  return /^data:image\/[a-z0-9.+-]+(;[^,]*)?,/i.test(text.trim());
}

/** Does the address end like an image file? Then we try it as an image first. */
export function looksLikeImageUrl(url: URL): boolean {
  return /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(url.pathname) || url.hostname === 'i.pinimg.com';
}

/**
 * The address carried by a drag from another browser tab. When an image is
 * dragged, its <img src> (in the HTML) is the picture; the uri-list may be
 * the link around it instead.
 */
export function addressFromDrop(data: { html: string; uriList: string; text: string }): string | null {
  const img = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(data.html);
  if (img) return decodeHtml(img[1] ?? img[2] ?? img[3] ?? '');
  const uri = data.uriList
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  if (uri) return uri;
  const text = data.text.trim();
  return normaliseAddress(text) || isDataImageUrl(text) ? text : null;
}

function decodeHtml(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/**
 * A token name from an image address, e.g. ".../goblin-boss-1024x768.jpg" →
 * "Goblin Boss". Returns '' for meaningless names like hashes or "IMG_2041".
 */
export function nameFromImageUrl(url: string): string {
  let segment: string;
  try {
    segment = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    return '';
  }
  const base = segment
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/([-_.]?(\d+x\d+|@\dx|scaled|thumb(nail)?|large|medium|small|full|original|min|e\d{6,}))+$/i, '');
  const letters = base.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return '';
  if (/^[0-9a-f]{12,}$/i.test(base) || /\d{6,}/.test(base)) return '';
  if (/^(img|dsc|pxl|image|photo|file|download)[-_ ]?\d*$/i.test(base)) return '';
  return tidyName(base);
}

/** The first part of a page title, e.g. "Goblin Boss | Art Blog" → "Goblin Boss". */
export function nameFromTitle(title: string): string {
  const first = title.split(/\s+[|–—·•:-]\s+/)[0] ?? '';
  return tidyName(first.trim().slice(0, 60));
}

const SUGGESTION = 'Try right-clicking the picture and choosing “Copy image address”, or save the picture and upload it.';

/** What to tell the user when a web import fails. */
export function friendlyError(code: ApiErrorCode | 'offline' | 'no_server' | 'unknown', message?: string): string {
  switch (code) {
    case 'bad_url':
      return "That doesn't look like a web address. It should start with https://.";
    case 'blocked':
      return "That address can't be fetched (only public https:// sites work).";
    case 'site_refused':
      return `That site doesn't let other sites fetch its pictures. ${SUGGESTION}`;
    case 'not_found':
      return "The site says that picture or page doesn't exist any more. Check the address.";
    case 'site_error':
    case 'network':
    case 'too_many_redirects':
      return `We couldn't get anything from that site. ${SUGGESTION}`;
    case 'timeout':
      return `That site took too long to answer. Try again in a moment. ${SUGGESTION}`;
    case 'too_large':
      return 'That picture is too large (over 20 MB). Save a smaller copy and upload it.';
    case 'not_image':
      return `That address isn't a picture we can open. ${SUGGESTION}`;
    case 'not_page':
      return "That address isn't a web page or a picture.";
    case 'no_images':
      return `No pictures were found on that page. Some sites load their pictures in a way we can't see. ${SUGGESTION}`;
    case 'pinterest_board':
      return 'Open a single pin on Pinterest and copy its link (Share → Copy link). Boards and searches can’t be read.';
    case 'rate_limited':
      return message ?? 'Too many requests in a short time. Wait a minute and try again.';
    case 'forbidden':
      return 'Web imports only work on the Token Maker site itself.';
    case 'offline':
      return "Couldn't reach the Token Maker server. Check your internet connection and try again.";
    case 'no_server':
      return "This copy of Token Maker isn't running its image server, so web links can't be fetched. Save the picture and upload it instead.";
    default:
      return `Something went wrong fetching that address. ${SUGGESTION}`;
  }
}
