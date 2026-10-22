// Temporary Phase 1 export: a PNG at 256 px per square from the same
// renderer as the preview. The full Export panel arrives in Phase 9.

import { DEFAULT_PX_PER_SQUARE, outputSize } from '../document/sizing';
import type { TokenDocument } from '../document/types';
import { render, type AssetMap } from '../render/render';

/** A file name with only safe characters (DESIGN.md §6.11). */
export function safeFileName(name: string, ext: string): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 _-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'token';
  return `${base}.${ext}`;
}

export async function renderPng(doc: TokenDocument, assets: AssetMap, pxPerSquare = DEFAULT_PX_PER_SQUARE): Promise<Blob> {
  const size = outputSize(doc.size.squares, pxPerSquare);
  const canvas = render(doc, assets, size);
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the PNG.'))), 'image/png'),
  );
}

export async function downloadPng(doc: TokenDocument, assets: AssetMap): Promise<string> {
  const blob = await renderPng(doc, assets);
  const name = safeFileName(doc.name, 'png');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
