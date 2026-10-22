// Images used by documents, kept outside the document (DESIGN.md §4.1).
// Every asset stays in memory for the session so undo can bring it back.

import { createStore } from 'zustand/vanilla';
import type { AssetMap, RenderSource } from '../render/render';

export interface Asset extends RenderSource {
  id: string;
  /** The original file, kept for autosave. */
  blob: Blob;
}

interface AssetState {
  assets: ReadonlyMap<string, Asset>;
}

export const assetStore = createStore<AssetState>(() => ({ assets: new Map() }));

export function addAsset(asset: Asset): void {
  const next = new Map(assetStore.getState().assets);
  next.set(asset.id, asset);
  assetStore.setState({ assets: next });
}

export function clearAssets(): void {
  assetStore.setState({ assets: new Map() });
}

export function getAssets(): AssetMap {
  return assetStore.getState().assets;
}

export function newAssetId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `asset:${rnd}`;
}
