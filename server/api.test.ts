// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handleFetchImage, handlePageImages, type ApiDeps } from './api.ts';
import type { ApiErrorBody, PageImagesResult } from './apiTypes.ts';
import { RateLimiter } from './rateLimit.ts';
import { sniffImageMime } from './sniff.ts';
import { fakeFetch, html, image, PNG_BYTES, type Route } from './testFetch.ts';

const pinPage = readFileSync(new URL('./fixtures/pinterest-pin.html', import.meta.url), 'utf8');
const artPage = readFileSync(new URL('./fixtures/art-page.html', import.meta.url), 'utf8');

function setup(routes: Record<string, Route>, limits = { image: new RateLimiter(100), page: new RateLimiter(100) }) {
  const f = fakeFetch(routes);
  const deps: ApiDeps = { fetchImpl: f.impl, limits };
  const call = (path: 'fetch-image' | 'page-images', url: string, headers: Record<string, string> = {}) => {
    const req = new Request(`https://tokens.example/api/${path}?url=${encodeURIComponent(url)}`, { headers });
    return (path === 'fetch-image' ? handleFetchImage : handlePageImages)(req, deps);
  };
  return { call, calls: f.calls };
}

const errorCode = async (res: Response) => ((await res.json()) as ApiErrorBody).error.code;

describe('GET /api/fetch-image', () => {
  it('returns image bytes with the type found by sniffing, not the one claimed', async () => {
    const { call } = setup({ 'https://img.example/a': image(PNG_BYTES, 'application/octet-stream') });
    const res = await call('fetch-image', 'https://img.example/a');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it('refuses things that are not images', async () => {
    const { call } = setup({
      'https://img.example/page': html('<html></html>'),
      'https://img.example/fake.png': image(new TextEncoder().encode('<script>alert(1)</script>'), 'image/png'),
    });
    expect(await errorCode(await call('fetch-image', 'https://img.example/page'))).toBe('not_image');
    expect(await errorCode(await call('fetch-image', 'https://img.example/fake.png'))).toBe('not_image');
  });

  it('turns site errors into friendly codes', async () => {
    const { call } = setup({
      'https://img.example/403': new Response('', { status: 403 }),
      'https://img.example/404': new Response('', { status: 404 }),
      'https://img.example/500': new Response('', { status: 500 }),
    });
    expect(await errorCode(await call('fetch-image', 'https://img.example/403'))).toBe('site_refused');
    expect(await errorCode(await call('fetch-image', 'https://img.example/404'))).toBe('not_found');
    expect(await errorCode(await call('fetch-image', 'https://img.example/500'))).toBe('site_error');
  });

  it('never contacts private addresses, even through a redirect', async () => {
    const { call, calls } = setup({ 'https://img.example/r': { redirect: 'https://169.254.169.254/latest' } });
    const direct = await call('fetch-image', 'https://192.168.0.1/a.png');
    expect(direct.status).toBe(400);
    expect(await errorCode(direct)).toBe('blocked');
    expect(await errorCode(await call('fetch-image', 'https://img.example/r'))).toBe('blocked');
    expect(calls).toEqual(['https://img.example/r']);
  });

  it('needs a url, and refuses other websites', async () => {
    const { call } = setup({ 'https://img.example/a.png': image() });
    expect(await errorCode(await call('fetch-image', ''))).toBe('bad_url');
    const res = await call('fetch-image', 'https://img.example/a.png', { 'Sec-Fetch-Site': 'cross-site' });
    expect(res.status).toBe(403);
    expect((await call('fetch-image', 'https://img.example/a.png', { 'Sec-Fetch-Site': 'same-origin' })).status).toBe(200);
  });

  it('rate-limits each visitor separately', async () => {
    const { call } = setup({ 'https://img.example/a.png': image() }, { image: new RateLimiter(2), page: new RateLimiter(2) });
    const a = { 'CF-Connecting-IP': '203.0.113.5' };
    expect((await call('fetch-image', 'https://img.example/a.png', a)).status).toBe(200);
    expect((await call('fetch-image', 'https://img.example/a.png', a)).status).toBe(200);
    const limited = await call('fetch-image', 'https://img.example/a.png', a);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await call('fetch-image', 'https://img.example/a.png', { 'CF-Connecting-IP': '198.51.100.7' })).status).toBe(200);
  });
});

describe('GET /api/page-images', () => {
  const result = async (res: Response) => {
    expect(res.status).toBe(200);
    return (await res.json()) as PageImagesResult;
  };

  it('lists the images on a normal page', async () => {
    const { call } = setup({ 'https://art.example/post': html(artPage) });
    const out = await result(await call('page-images', 'https://art.example/post'));
    expect(out.kind).toBe('page');
    if (out.kind !== 'page') return;
    expect(out.title).toContain('Goblin Boss');
    expect(out.images[0]!.url).toBe('https://cdn.example-art.com/uploads/goblin-boss-hero.jpg');
  });

  it('says when the address is really an image (by type or by its bytes)', async () => {
    const { call } = setup({
      'https://img.example/i': image(),
      'https://img.example/unlabelled': new Response(PNG_BYTES),
    });
    expect(await result(await call('page-images', 'https://img.example/i'))).toEqual({ kind: 'image', url: 'https://img.example/i' });
    expect(await result(await call('page-images', 'https://img.example/unlabelled'))).toMatchObject({ kind: 'image' });
  });

  it('follows a pin.it short link to the pin and returns its full-size image', async () => {
    const { call } = setup({
      'https://pin.it/4x2Yj8Yd': { redirect: 'https://api.pinterest.com/url_shortener/4x2Yj8Yd/redirect/', status: 308 },
      'https://api.pinterest.com/url_shortener/4x2Yj8Yd/redirect/': { redirect: 'https://www.pinterest.com/pin/571112796472578260/sent/?invite_code=x' },
      'https://www.pinterest.com/pin/571112796472578260/sent/?invite_code=x': html(pinPage),
    });
    const out = await result(await call('page-images', 'https://pin.it/4x2Yj8Yd'));
    expect(out).toMatchObject({ kind: 'pinterest', title: 'Goblin Token' });
    if (out.kind === 'image') return;
    expect(out.images[0]!.url).toBe('https://i.pinimg.com/originals/bb/2b/70/bb2b70f7dd055929c8048dfe4527b96a.png');
  });

  it('explains that boards cannot be read, without fetching them', async () => {
    const { call, calls } = setup({});
    expect(await errorCode(await call('page-images', 'https://www.pinterest.com/someone/goblins/'))).toBe('pinterest_board');
    expect(calls).toEqual([]);
  });

  it('reports pages with no images, and files that are neither pages nor images', async () => {
    const { call } = setup({
      'https://a.example/empty': html('<p>Nothing here</p>'),
      'https://a.example/file.zip': new Response('PK', { headers: { 'Content-Type': 'application/zip' } }),
    });
    expect(await errorCode(await call('page-images', 'https://a.example/empty'))).toBe('no_images');
    expect(await errorCode(await call('page-images', 'https://a.example/file.zip'))).toBe('not_page');
  });
});

describe('sniffing', () => {
  const bytes = (s: string) => new TextEncoder().encode(s);
  it.each([
    [PNG_BYTES, 'image/png'],
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    [bytes('GIF89a......'), 'image/gif'],
    [bytes('RIFF....WEBPVP8 '), 'image/webp'],
    [bytes('....ftypavif....'), 'image/avif'],
    [bytes('<?xml version="1.0"?>\n<!-- art -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'],
    [bytes('<html><body><svg></svg></body></html>'), null],
    [bytes('hello'), null],
  ])('%#', (input, mime) => {
    expect(sniffImageMime(input as Uint8Array)).toBe(mime);
  });
});
