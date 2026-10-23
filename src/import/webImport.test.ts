import { webImportStore, importFromAddress, pickWebImage, clearWebImport } from './webImport';
import { importBackgroundFile, importImageFile } from './importImage';

vi.mock('./importImage', async (original) => {
  const real = await original<typeof import('./importImage')>();
  const importImageFile = vi.fn<(file: Blob, name?: string) => Promise<void>>(async () => {});
  const importBackgroundFile = vi.fn<(file: Blob, name?: string) => Promise<void>>(async () => {});
  return {
    ...real,
    importImageFile,
    importBackgroundFile,
    importTo: (target: 'art' | 'background', file: Blob, name?: string) => (target === 'art' ? importImageFile : importBackgroundFile)(file, name),
  };
});

const imported = vi.mocked(importImageFile);
const toBackground = vi.mocked(importBackgroundFile);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/** A pretend /api: maps the `url` parameter of each endpoint to an answer. */
function api(routes: { image?: Record<string, number>; page?: Record<string, unknown> }) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const u = new URL(input, 'https://tokens.example');
      const target = u.searchParams.get('url')!;
      calls.push(`${u.pathname} ${target}`);
      if (u.pathname === '/api/fetch-image') {
        const status = routes.image?.[target];
        if (status === 200) return new Response(new Blob([PNG], { type: 'image/png' }));
        return Response.json({ error: { code: status === 415 ? 'not_image' : 'not_found', message: '' } }, { status: status ?? 502 });
      }
      const page = routes.page?.[target];
      return page ? Response.json(page) : Response.json({ error: { code: 'site_refused', message: '' } }, { status: 502 });
    }),
  );
  return calls;
}

const settle = () => vi.waitFor(() => expect(webImportStore.getState().status).not.toBe('loading'));

beforeEach(() => {
  clearWebImport();
  imported.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('importing from a web address', () => {
  it('loads a direct image link straight away, naming the token from the file', async () => {
    const calls = api({ image: { 'https://cdn.example/goblin-boss.png': 200 } });
    expect(importFromAddress('cdn.example/goblin-boss.png')).toBe(true);
    await settle();
    expect(calls).toEqual(['/api/fetch-image https://cdn.example/goblin-boss.png']);
    expect(imported).toHaveBeenCalledWith(expect.anything(), 'Goblin Boss');
    expect(webImportStore.getState().status).toBe('idle');
  });

  it('shows the pictures on a page, then loads the one picked', async () => {
    api({
      page: {
        'https://blog.example/goblins': {
          kind: 'page',
          url: 'https://blog.example/goblins',
          title: 'Goblins | Blog',
          images: [{ url: 'https://cdn.example/a.jpg' }, { url: 'https://cdn.example/1234567890.jpg', alt: 'Hobgoblin captain' }],
        },
      },
      image: { 'https://cdn.example/1234567890.jpg': 200 },
    });
    importFromAddress('https://blog.example/goblins');
    await settle();
    expect(webImportStore.getState()).toMatchObject({ status: 'choosing', images: [{}, {}] });
    await pickWebImage('https://cdn.example/1234567890.jpg');
    expect(imported).toHaveBeenCalledWith(expect.anything(), 'Hobgoblin captain');
    expect(webImportStore.getState()).toMatchObject({ status: 'choosing', picked: 'https://cdn.example/1234567890.jpg' });
  });

  it("loads a Pinterest pin's original, falling back to the preview", async () => {
    const calls = api({
      page: {
        'https://pin.it/abc': {
          kind: 'pinterest',
          url: 'https://www.pinterest.com/pin/1/',
          title: 'Goblin Token',
          images: [{ url: 'https://i.pinimg.com/originals/aa/bb/cc/x.png' }, { url: 'https://i.pinimg.com/736x/aa/bb/cc/x.jpg' }],
        },
      },
      image: { 'https://i.pinimg.com/originals/aa/bb/cc/x.png': 404, 'https://i.pinimg.com/736x/aa/bb/cc/x.jpg': 200 },
    });
    importFromAddress('https://pin.it/abc');
    await settle();
    expect(calls.slice(1)).toEqual([
      '/api/fetch-image https://i.pinimg.com/originals/aa/bb/cc/x.png',
      '/api/fetch-image https://i.pinimg.com/736x/aa/bb/cc/x.jpg',
    ]);
    expect(imported).toHaveBeenCalledWith(expect.anything(), 'Goblin Token');
  });

  it('treats an "image" link that is really a page as a page', async () => {
    const calls = api({
      image: { 'https://wiki.example/File:Goblin.png': 415, 'https://upload.example/Goblin.png': 200 },
      page: { 'https://wiki.example/File:Goblin.png': { kind: 'page', url: 'https://wiki.example/File:Goblin.png', title: '', images: [{ url: 'https://upload.example/Goblin.png' }] } },
    });
    importFromAddress('https://wiki.example/File:Goblin.png');
    await settle();
    expect(calls).toHaveLength(3);
    expect(imported).toHaveBeenCalledWith(expect.anything(), 'Goblin');
  });

  it('explains what to do when a site blocks fetching', async () => {
    api({});
    importFromAddress('https://strict.example/gallery');
    await settle();
    expect(webImportStore.getState()).toMatchObject({ status: 'error' });
    expect(webImportStore.getState().error).toMatch(/Copy image address/);
  });

  it('ignores text that is not an address when pasted, but explains in the box', () => {
    api({});
    expect(importFromAddress('goblin boss', 'paste')).toBe(false);
    expect(webImportStore.getState().status).toBe('idle');
    expect(importFromAddress('goblin boss', 'box')).toBe(false);
    expect(webImportStore.getState().error).toMatch(/https:\/\//);
  });

  it('a link typed in the Background section becomes the background, not the art', async () => {
    api({ image: { 'https://cdn.example/goblin-boss.png': 200 } });
    importFromAddress('https://cdn.example/goblin-boss.png', 'box', 'background');
    await settle();
    expect(toBackground).toHaveBeenCalled();
    expect(imported).not.toHaveBeenCalled();
    expect(webImportStore.getState().target).toBe('background');
  });

  it.each([
    ['a Pinterest pin', 'https://uk.pinterest.com/pin/666392076130436411/'],
    ['a Pinterest image address', 'https://i.pinimg.com/1200x/ff/8d/8c/ff8d8cd84ec26e904d0e6c003d5e87e7.jpg'],
  ])('says the image server is missing when /api answers with the editor page (%s)', async (_name, address) => {
    // A static or Workers deploy without the image server: every /api/* address gets index.html.
    const page = '<!doctype html><html><body><div id="root"></div></body></html>';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    importFromAddress(address);
    await settle();
    expect(imported).not.toHaveBeenCalled();
    expect(webImportStore.getState()).toMatchObject({ status: 'error' });
    expect(webImportStore.getState().error).toMatch(/isn't running its image server/);
    expect(webImportStore.getState().error).not.toMatch(/Unexpected token|isn't an image/);
  });
});

