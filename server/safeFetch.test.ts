// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from './ipRanges.ts';
import { isLocalHostname, readCapped, safeFetch, SafeFetchError, validateUrl } from './safeFetch.ts';
import { fakeFetch, image } from './testFetch.ts';

const reason = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (err) {
    return (err as SafeFetchError).reason;
  }
  return 'ok';
};

describe('SSRF rules: which addresses may be fetched', () => {
  it.each([
    'https://example.com/a.png',
    'https://cdn.example.co.uk/img/a.jpg?w=200',
    'https://8.8.8.8/a.png',
    'https://[2606:4700::1111]/a.png',
    'https://example.com:443/a.png',
  ])('allows %s', (url) => {
    expect(() => validateUrl(url)).not.toThrow();
  });

  it.each([
    ['http://example.com/a.png', 'blocked'], // https only
    ['ftp://example.com/a.png', 'blocked'],
    ['file:///etc/passwd', 'blocked'],
    ['data:image/png;base64,AAAA', 'blocked'],
    ['https://user:pass@example.com/a.png', 'blocked'],
    ['https://example.com:8080/a.png', 'blocked'],
    ['https://localhost/a.png', 'blocked'],
    ['https://app.localhost/a.png', 'blocked'],
    ['https://printer.local/a.png', 'blocked'],
    ['https://db.internal/a.png', 'blocked'],
    ['https://router.home.arpa/a.png', 'blocked'],
    ['https://intranet/a.png', 'blocked'], // no dot: a local name
    ['https://127.0.0.1/a.png', 'blocked'],
    ['https://10.1.2.3/a.png', 'blocked'],
    ['https://172.16.0.1/a.png', 'blocked'],
    ['https://192.168.1.1/a.png', 'blocked'],
    ['https://169.254.169.254/latest/meta-data', 'blocked'], // cloud metadata
    ['https://100.64.0.1/a.png', 'blocked'],
    ['https://0.0.0.0/a.png', 'blocked'],
    ['https://2130706433/a.png', 'blocked'], // 127.0.0.1 written as one number
    ['https://0x7f.1/a.png', 'blocked'],
    ['https://[::1]/a.png', 'blocked'],
    ['https://[fd00::1]/a.png', 'blocked'],
    ['https://[fe80::1]/a.png', 'blocked'],
    ['https://[::ffff:127.0.0.1]/a.png', 'blocked'], // IPv4-mapped
    ['not a url', 'bad_url'],
  ])('refuses %s', async (url, why) => {
    expect(await reason(() => validateUrl(url))).toBe(why);
  });

  it('knows private and public address ranges', () => {
    expect(isBlockedAddress('192.168.0.10')).toBe(true);
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
    expect(isBlockedAddress('2606:4700::1111')).toBe(false);
    expect(isLocalHostname('nas.lan')).toBe(true);
    expect(isLocalHostname('example.com')).toBe(false);
  });
});

describe('safeFetch', () => {
  it('follows https redirects and reports the final address', async () => {
    const f = fakeFetch({
      'https://a.example/1': { redirect: '/2' },
      'https://a.example/2': { redirect: 'https://b.example/img.png', status: 301 },
      'https://b.example/img.png': image(),
    });
    const { url, response } = await safeFetch('https://a.example/1', { accept: '*/*', fetchImpl: f.impl });
    expect(url.toString()).toBe('https://b.example/img.png');
    expect(response.status).toBe(200);
    expect(f.calls).toHaveLength(3);
  });

  it('checks every redirect hop', async () => {
    for (const target of ['http://b.example/img.png', 'https://127.0.0.1/img.png', 'https://localhost/x', 'https://[::1]/x']) {
      const f = fakeFetch({ 'https://a.example/1': { redirect: target } });
      expect(await reason(safeFetch('https://a.example/1', { accept: '*/*', fetchImpl: f.impl }))).toBe('blocked');
      expect(f.calls).toEqual(['https://a.example/1']); // never contacted
    }
  });

  it('gives up after too many redirects', async () => {
    const routes = Object.fromEntries([...Array(8)].map((_, i) => [`https://a.example/${i}`, { redirect: `/${i + 1}` }]));
    const f = fakeFetch(routes);
    expect(await reason(safeFetch('https://a.example/0', { accept: '*/*', fetchImpl: f.impl }))).toBe('too_many_redirects');
    expect(f.calls).toHaveLength(6); // the first request + 5 redirects
  });

  it('runs the extra host check on every hop', async () => {
    const seen: string[] = [];
    const f = fakeFetch({ 'https://a.example/1': { redirect: 'https://evil.example/x' } });
    const checkHost = async (h: string) => {
      seen.push(h);
      if (h === 'evil.example') throw new SafeFetchError('private', 'blocked');
    };
    expect(await reason(safeFetch('https://a.example/1', { accept: '*/*', fetchImpl: f.impl, checkHost }))).toBe('blocked');
    expect(seen).toEqual(['a.example', 'evil.example']);
  });

  it('reports error statuses, timeouts and unreachable sites', async () => {
    const f = fakeFetch({ 'https://a.example/403': new Response('no', { status: 403 }) });
    expect(await reason(safeFetch('https://a.example/403', { accept: '*/*', fetchImpl: f.impl }))).toBe('http_status');
    const slow = (async (_: unknown, init?: RequestInit) =>
      new Promise((_r, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason)))) as typeof fetch;
    expect(await reason(safeFetch('https://a.example/slow', { accept: '*/*', fetchImpl: slow, timeoutMs: 20 }))).toBe('timeout');
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await reason(safeFetch('https://a.example/', { accept: '*/*', fetchImpl: down }))).toBe('network');
  });

  it('caps the body size while reading, even without Content-Length', async () => {
    const big = new Response(new Uint8Array(2000));
    expect(await reason(readCapped(big, 1000))).toBe('too_large');
    const declared = new Response('x', { headers: { 'Content-Length': '5000' } });
    expect(await reason(readCapped(declared, 1000))).toBe('too_large');
    expect((await readCapped(new Response(new Uint8Array(10)), 1000)).byteLength).toBe(10);
  });
});
