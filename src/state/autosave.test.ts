import 'fake-indexeddb/auto';
import { createDocument } from '../document/defaults';
import { addAsset, clearAssets } from './assets';
import { clearAutosave, restore, saveNow } from './autosave';
import { getDoc, resetDoc, updateDoc } from './tokenStore';
import { addBatchItem, batchStore, selectItem, setBatchMode } from '../batch/batch';

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

  it('restores a batch: every picture, the one on screen, and their own positions', async () => {
    const pic = (id: string) =>
      addAsset({ id, blob: new Blob([id], { type: 'image/png' }), image: document.createElement('canvas'), width: 10, height: 10 });
    pic('asset:a');
    pic('asset:b');
    setBatchMode(true);
    updateDoc((d) => ({ ...d, name: 'Goblin A', art: { ...d.art, assetId: 'asset:a' } }));
    addBatchItem({ assetId: 'asset:a', width: 10, height: 10, name: 'Goblin A' }, () => {});
    addBatchItem({ assetId: 'asset:b', width: 10, height: 10, name: 'Goblin B' }, () => {});
    updateDoc((d) => ({ ...d, art: { ...d.art, transform: { ...d.art.transform, offsetX: 0.3 } } }));
    await saveNow(getDoc());
    clearAssets();
    resetDoc();
    setBatchMode(false);
    expect(await restore()).toBe(true);
    const b = batchStore.getState();
    expect(b.on).toBe(true);
    expect(b.items.map((it) => it.name)).toEqual(['Goblin A', 'Goblin B']);
    expect(getDoc().art.transform.offsetX).toBe(0.3);
    selectItem(b.items[1]!.id);
    expect(getDoc().art.assetId).toBe('asset:b');
    setBatchMode(false);
  });

  it('has nothing to restore after "New"', async () => {
    await saveNow(createDocument('Temp'));
    await clearAutosave();
    expect(await restore()).toBe(false);
  });
});
