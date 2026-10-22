// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeEntities, extractImages, largestFromSrcset, parseSrcset } from './extractImages.ts';

const artPage = readFileSync(new URL('./fixtures/art-page.html', import.meta.url), 'utf8');

describe('srcset', () => {
  it('picks the widest entry, whatever the order', () => {
    expect(largestFromSrcset('a.jpg 400w, c.jpg 1600w, b.jpg 800w')?.url).toBe('c.jpg');
    expect(largestFromSrcset('a.jpg, b.jpg 2x, c.jpg 1.5x')?.url).toBe('b.jpg');
  });

  it('keeps commas that are part of a URL', () => {
    expect(parseSrcset('https://x.example/w_300,h_300/a.jpg 1x, https://x.example/w_600,h_600/a.jpg 2x').map((c) => c.url)).toEqual([
      'https://x.example/w_300,h_300/a.jpg',
      'https://x.example/w_600,h_600/a.jpg',
    ]);
    // As in browsers: without a space after it, a comma is part of the URL.
    expect(parseSrcset('a.jpg,b.jpg 2x').map((c) => c.url)).toEqual(['a.jpg,b.jpg']);
  });
});

describe('extractImages on a saved art blog page', () => {
  const page = extractImages(artPage, 'https://www.example-art.com/posts/goblins');
  const urls = page.images.map((i) => i.url);

  it('reads the title, decoding entities', () => {
    expect(page.title).toBe('Goblin Boss & Friends – Fantasy Art Blog');
  });

  it('puts og:image first with its size, and lists it once', () => {
    expect(page.images[0]).toEqual({ url: 'https://cdn.example-art.com/uploads/goblin-boss-hero.jpg', width: 1200, height: 630 });
    expect(urls.filter((u) => u.endsWith('goblin-boss-hero.jpg'))).toHaveLength(1);
  });

  it('uses the largest srcset image, resolved against <base href>', () => {
    expect(urls).toContain('https://cdn.example-art.com/blog/images/goblin-large.jpg');
    expect(urls).not.toContain('https://cdn.example-art.com/blog/images/goblin-small.jpg');
    expect(page.images.find((i) => i.url.endsWith('goblin-large.jpg'))).toMatchObject({ width: 1600, alt: 'A goblin boss with a cleaver' });
  });

  it('finds lazy-loaded images instead of their placeholders', () => {
    expect(urls).toContain('https://cdn.example-art.com/blog/lazy/orc-warchief.webp');
    expect(urls.some((u) => u.startsWith('data:'))).toBe(false);
  });

  it('prefers the biggest <picture> source', () => {
    expect(urls).toContain('https://cdn.example-art.com/blog/pictures/dragon-2000.avif');
    expect(urls).not.toContain('https://cdn.example-art.com/blog/pictures/dragon-800.jpg');
  });

  it('upgrades http to https and decodes &amp; in addresses', () => {
    expect(urls).toContain('https://legacy.example-art.com/old/kobold.png?size=large&v=2');
  });

  it('handles x descriptors and commas inside URLs', () => {
    expect(urls).toContain('https://res.cloudinary.example/image/upload/w_600,h_600/ogre.jpg');
  });

  it('finds CSS backgrounds, full-size links and <noscript> images', () => {
    expect(urls).toContain('https://cdn.example-art.com/blog/backgrounds/cavern.jpg');
    expect(urls).toContain('https://cdn.example-art.com/blog/full/goblin-boss-full.png');
    expect(urls).toContain('https://cdn.example-art.com/blog/thumbs/goblin-boss-thumb.png');
    expect(urls).toContain('https://cdn.example-art.com/blog/noscript/hobgoblin.jpg');
  });

  it('hides icons, trackers, favicons, SVG logos, and anything in scripts, styles or comments', () => {
    for (const bad of ['rss.png', 'facebook.com', 'favicon', 'apple-touch-icon', 'logo.svg', 'should-not-appear', 'stylesheet-bg', 'commented-out']) {
      expect(urls.some((u) => u.includes(bad)), bad).toBe(false);
    }
  });

  it('lists each image once', () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toHaveLength(10);
  });
});

describe('edge cases', () => {
  it('copes with odd markup', () => {
    const page = extractImages(
      `<IMG SRC=/a.png ALT=unquoted><img src='/b.jpg' data-x="a > b"><img src="/c.jpg" width="20"><img src="  "><meta name="twitter:image:src" content="/t.jpg">`,
      'https://ex.example/dir/page.html',
    );
    expect(page.images.map((i) => i.url)).toEqual(['https://ex.example/t.jpg', 'https://ex.example/a.png', 'https://ex.example/b.jpg']);
    expect(page.title).toBe('');
  });

  it('decodes numeric and named entities', () => {
    expect(decodeEntities('a&amp;b &#39;c&#x27; &lt;&gt; &bogus;')).toBe("a&b 'c' <> &bogus;");
  });
});
