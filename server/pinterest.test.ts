// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pinimgParts, pinterestImages, pinterestKind } from './pinterest.ts';

const pinPage = readFileSync(new URL('./fixtures/pinterest-pin.html', import.meta.url), 'utf8');
const PIN = 'https://www.pinterest.com/pin/571112796472578260/';

describe('recognising Pinterest links', () => {
  it.each([
    ['https://www.pinterest.com/pin/571112796472578260/', 'pin'],
    ['https://uk.pinterest.com/pin/571112796472578260/?nic=1', 'pin'],
    ['https://www.pinterest.co.uk/pin/571112796472578260/', 'pin'],
    ['https://pinterest.com.au/pin/goblins-mages--711216966176846703/', 'pin'],
    ['https://no.pinterest.com/pin/331718328822756238/', 'pin'],
    ['https://pin.it/4x2Yj8Yd', 'short'],
    ['https://nz.pinterest.com/someone/goblins/', 'other'],
    ['https://www.pinterest.com/search/pins/?q=goblin', 'other'],
    ['https://i.pinimg.com/736x/bb/2b/70/bb.jpg', null],
    ['https://notpinterest.com/pin/1/', null],
    ['https://pinterest.com.evil.example/pin/1/', null],
  ])('%s → %s', (url, kind) => {
    expect(pinterestKind(new URL(url))).toBe(kind);
  });

  it('splits a pinimg address into its path and file type', () => {
    expect(pinimgParts('https://i.pinimg.com/736x/bb/2b/70/bb2b70f7dd.jpg')).toEqual({ path: 'bb/2b/70/bb2b70f7dd', ext: 'jpg' });
    expect(pinimgParts('https://example.com/736x/bb/2b/70/bb2b70f7dd.jpg')).toBeNull();
  });
});

describe('reading a saved pin page', () => {
  const pin = pinterestImages(pinPage, PIN);

  it('prefers the full-size original, with its real file type, then the og:image', () => {
    expect(pin.images.map((i) => i.url)).toEqual([
      'https://i.pinimg.com/originals/bb/2b/70/bb2b70f7dd055929c8048dfe4527b96a.png',
      'https://i.pinimg.com/736x/bb/2b/70/bb2b70f7dd055929c8048dfe4527b96a.jpg',
    ]);
  });

  it("never picks a related pin's image", () => {
    expect(pin.images.some((i) => i.url.includes('2c7c58') || i.url.includes('d53b01'))).toBe(false);
  });

  it('uses the pin title without the keyword list', () => {
    expect(pin.title).toBe('Goblin Token');
  });

  it('guesses the originals address when the page data is missing', () => {
    const bare = '<meta property="og:image" content="https://i.pinimg.com/736x/aa/bb/cc/aabbcc.jpg"><title>Pinterest</title>';
    const result = pinterestImages(bare, PIN);
    expect(result.images.map((i) => i.url)).toEqual([
      'https://i.pinimg.com/originals/aa/bb/cc/aabbcc.jpg',
      'https://i.pinimg.com/736x/aa/bb/cc/aabbcc.jpg',
    ]);
    expect(result.title).toBe('');
  });

  it('falls back to the page data when there is no og:image', () => {
    const noOg = '<script>{"images_orig":{"url":"https:\\/\\/i.pinimg.com\\/originals\\/aa\\/bb\\/cc\\/x.png"}}</script>';
    expect(pinterestImages(noOg, PIN).images.map((i) => i.url)).toEqual(['https://i.pinimg.com/originals/aa/bb/cc/x.png']);
    expect(pinterestImages('<html></html>', PIN).images).toEqual([]);
  });
});
