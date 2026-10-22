import 'fake-indexeddb/auto';
import { createDocument } from '../document/defaults';
import { addAsset, clearAssets } from './assets';
import { clearAutosave, restore, saveNow } from './autosave';
import { getDoc, resetDoc } from './tokenStore';

// Decoding needs a real browser; pretend every blob is a 10×10 image.
vi.mock('../import/decode', () => ({
  decodeImage: async () => ({ image: document.createElement('canvas'), width: 10, height: 10 }),
}));

beforeEach(async () => {
  await clearAutosave();
  clearAssets();
  resetDoc();
});

describe('autosave (DESIGN.md §4.4)', () => {
  it('restores the document and its image after a reload', async () => {
    const doc = createDocument('Lich');
    doc.art.assetId = 'asset:1';
    addAsset({ id: 'asset:1', blob: new Blob(['x'], { type: 'image/png' }), image: document.createElement('canvas'), width: 10, height: 10 });
    await saveNow(doc);
    clearAssets();
    resetDoc();
    expect(await restore()).toBe(true);
    expect(getDoc().name).toBe('Lich');
    expect(getDoc().art.assetId).toBe('asset:1');
  });

  it('drops the image reference if the image is missing', async () => {
    const doc = createDocument('Ghost');
    doc.art.assetId = 'asset:gone';
    await saveNow(doc);
    expect(await restore()).toBe(true);
    expect(getDoc().art.assetId).toBeNull();
  });

  it('has nothing to restore after "New"', async () => {
    await saveNow(createDocument('Temp'));
    await clearAutosave();
    expect(await restore()).toBe(false);
  });
});
