import { addressFromDrop, friendlyError, nameFromImageUrl, nameFromTitle, normaliseAddress } from './webAddress';

describe('normaliseAddress', () => {
  it.each([
    ['https://example.com/a.png', 'https://example.com/a.png'],
    ['  http://example.com/a.png ', 'https://example.com/a.png'],
    ['example.com/goblin.jpg', 'https://example.com/goblin.jpg'],
    ['pin.it/4x2Yj8Yd', 'https://pin.it/4x2Yj8Yd'],
    ['//cdn.example.com/a.png', 'https://cdn.example.com/a.png'],
  ])('%s → %s', (input, out) => {
    expect(normaliseAddress(input)?.toString()).toBe(out);
  });

  it.each(['', 'goblin boss', 'hello', 'ftp://example.com/a.png', 'javascript:alert(1)', 'https://localhost/a.png', 'a b.com'])(
    'rejects %j',
    (input) => {
      expect(normaliseAddress(input)).toBeNull();
    },
  );
});

describe('addressFromDrop', () => {
  it('prefers the dragged <img> over the link around it', () => {
    const html = '<a href="https://site.example/post/1"><img alt="x" src="https://cdn.example/goblin.png?a=1&amp;b=2"></a>';
    expect(addressFromDrop({ html, uriList: 'https://site.example/post/1', text: '' })).toBe('https://cdn.example/goblin.png?a=1&b=2');
  });

  it('falls back to the uri-list (skipping comments), then plain text', () => {
    expect(addressFromDrop({ html: '', uriList: '# comment\r\nhttps://a.example/b.jpg', text: '' })).toBe('https://a.example/b.jpg');
    expect(addressFromDrop({ html: '', uriList: '', text: 'example.com/c.png' })).toBe('example.com/c.png');
    expect(addressFromDrop({ html: '', uriList: '', text: 'just some words' })).toBeNull();
  });
});

describe('token names from web addresses', () => {
  it.each([
    ['https://cdn.example/uploads/goblin-boss-1024x768.jpg', 'Goblin Boss'],
    ['https://cdn.example/art/Red_Dragon@2x.png', 'Red Dragon'],
    ['https://cdn.example/art/orc%20warchief-scaled.webp?v=3', 'Orc Warchief'],
    ['https://cdn.example/art/HillGiant.png', 'Hill Giant'],
    ['https://i.pinimg.com/originals/bb/2b/70/bb2b70f7dd055929c8048dfe4527b96a.png', ''],
    ['https://cdn.example/IMG_2041.jpg', ''],
    ['https://cdn.example/photos/1693847562831.jpg', ''],
    ['https://cdn.example/', ''],
  ])('%s → %j', (url, name) => {
    expect(nameFromImageUrl(url)).toBe(name);
  });

  it('uses the first part of a page title', () => {
    expect(nameFromTitle('Goblin Token | Ogre token dnd, Goblin boss token')).toBe('Goblin Token');
    expect(nameFromTitle('Goblin - Wikipedia')).toBe('Goblin');
    expect(nameFromTitle('owlbear')).toBe('Owlbear');
  });
});

describe('friendly errors', () => {
  it('suggests copying the image address or uploading when a site blocks fetching', () => {
    for (const code of ['site_refused', 'not_image', 'network', 'no_images'] as const) {
      expect(friendlyError(code)).toMatch(/Copy image address.*upload it/);
    }
  });
});
