import { newLabel } from '../document/defaults';
import { docHistory, getDoc, resetDoc, undo, updateDoc } from '../state/tokenStore';
import { addBatchItem, batchStore, docForItem, itemFromDoc, removeItem, selectItem, setBatchMode, styleKey, syncedItems } from './batch';

// Batch mode (DESIGN.md §6.1): one shared style, each picture keeps its own
// position, masks and name.

const stroke = { mode: 'erase' as const, size: 0.1, softness: 0.5, points: [0.5, 0.5, 1] };

/** Imports a picture the way importImageFile does. */
function importPicture(assetId: string, name: string) {
  addBatchItem({ assetId, width: 100, height: 100, name }, () =>
    updateDoc((d) => ({ ...d, name, art: { ...d.art, assetId, strokes: [], popOut: { ...d.art.popOut, strokes: [] } } })),
  );
}

const moveArt = (x: number) => updateDoc((d) => ({ ...d, art: { ...d.art, transform: { ...d.art.transform, offsetX: x } } }));

beforeEach(() => {
  resetDoc();
  setBatchMode(false);
  setBatchMode(true);
});

describe('batch mode', () => {
  it('the first picture is shown, later ones wait in the strip with their own name and position', () => {
    importPicture('asset:a', 'Goblin A');
    importPicture('asset:b', 'Goblin B');
    importPicture('asset:c', 'Goblin C');
    const s = batchStore.getState();
    expect(s.items.map((it) => it.name)).toEqual(['Goblin A', 'Goblin B', 'Goblin C']);
    expect(getDoc().art.assetId).toBe('asset:a');
    expect(s.activeId).toBe(s.items[0]!.id);
    expect(s.items[1]!.strokes).toEqual([]);
  });

  it('a style change applies to every token; position, masks and name stay per picture', () => {
    importPicture('asset:a', 'Goblin A');
    importPicture('asset:b', 'Goblin B');
    updateDoc((d) => ({ ...d, shape: 'hexagon', art: { ...d.art, adjust: { ...d.art.adjust, brightness: 40 }, strokes: [stroke] } }));
    moveArt(0.3);
    const [a, b] = syncedItems();
    const docA = docForItem(getDoc(), a!);
    const docB = docForItem(getDoc(), b!);
    expect(docB.shape).toBe('hexagon');
    expect(docB.art.adjust.brightness).toBe(40);
    expect(docA.art.transform.offsetX).toBe(0.3);
    expect(docB.art.transform.offsetX).not.toBe(0.3);
    expect(docA.art.strokes).toHaveLength(1);
    expect(docB.art.strokes).toHaveLength(0);
    expect(styleKey(docA)).toBe(styleKey(docB));
  });

  it('switching pictures keeps each one’s own crop and name', () => {
    importPicture('asset:a', 'Goblin A');
    importPicture('asset:b', 'Goblin B');
    moveArt(0.2);
    const [a, b] = batchStore.getState().items;
    selectItem(b!.id);
    expect(getDoc().name).toBe('Goblin B');
    expect(getDoc().art.assetId).toBe('asset:b');
    moveArt(-0.4);
    updateDoc((d) => ({ ...d, name: 'Goblin Archer' }));
    selectItem(a!.id);
    expect(getDoc().art.transform.offsetX).toBe(0.2);
    selectItem(b!.id);
    expect(getDoc()).toMatchObject({ name: 'Goblin Archer', art: { transform: { offsetX: -0.4 } } });
  });

  it('undo after switching undoes the last style change, never the switch', () => {
    importPicture('asset:a', 'Goblin A');
    importPicture('asset:b', 'Goblin B');
    updateDoc((d) => ({ ...d, shape: 'square' }));
    moveArt(0.25); // only picture A's own position
    selectItem(batchStore.getState().items[1]!.id);
    undo();
    expect(getDoc().art.assetId).toBe('asset:b');
    expect(getDoc().shape).toBe('circle');
    expect(docHistory.getState().future).toHaveLength(1);
  });

  it('labels keep their own words per picture but share their style', () => {
    importPicture('asset:a', 'Goblin A');
    importPicture('asset:b', 'Goblin B');
    updateDoc((d) => ({ ...d, label: { ...newLabel(), text: 'Boss' } }));
    const [a, b] = syncedItems();
    expect(docForItem(getDoc(), a!).label?.text).toBe('Boss');
    expect(docForItem(getDoc(), b!).label?.text).toBeNull();
    expect(docForItem(getDoc(), b!).label?.shape).toBe(getDoc().label?.shape);
  });

  it('removing the picture on screen shows its neighbour; removing the last empties the token', () => {
    importPicture('asset:a', 'Goblin A');
    importPicture('asset:b', 'Goblin B');
    removeItem(batchStore.getState().activeId!);
    expect(getDoc().art.assetId).toBe('asset:b');
    expect(batchStore.getState().items).toHaveLength(1);
    removeItem(batchStore.getState().activeId!);
    expect(getDoc().art.assetId).toBeNull();
    expect(batchStore.getState().items).toHaveLength(0);
  });

  it('switching batch mode on keeps the token on screen as the first picture; off keeps only it', () => {
    setBatchMode(false);
    updateDoc((d) => ({ ...d, name: 'Lich', art: { ...d.art, assetId: 'asset:l' } }));
    setBatchMode(true);
    expect(batchStore.getState().items).toEqual([itemFromDoc(getDoc(), batchStore.getState().activeId!)]);
    importPicture('asset:m', 'Mummy');
    setBatchMode(false);
    expect(batchStore.getState().items).toHaveLength(0);
    expect(getDoc().name).toBe('Lich');
  });
});
