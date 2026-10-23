import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { useRovingRadio } from '../components/useRovingRadio';
import { UploadButton } from '../editor/UploadButton';
import { artEdits } from '../image/process';
import { DRAFT_SIDE, peekProcessedArt, processedArt } from '../image/processedArt';
import { useProcessedVersion } from '../image/artWorker';
import { renderToken } from '../render/render';
import { assetStore } from '../state/assets';
import { useDoc } from '../state/tokenStore';
import { batchStore, docForItem, removeItem, selectItem, syncedItems, useBatch } from './batch';

/** Height the strip takes at the bottom of the canvas area. */
export const BATCH_STRIP_HEIGHT = 84;
const THUMB = 52;
/** Thumbnails use a small copy of each picture, so restyling a big batch stays quick. */
const THUMB_SIDE = 192;

/**
 * Batch mode's thumbnail strip (DESIGN.md §6.1): every token of the batch,
 * drawn with the shared style. Tap one to edit its position and name.
 */
export function BatchStrip({ place }: { place: { top: number } | { bottom: number } }) {
  const state = useBatch((b) => b);
  const doc = useDoc();
  const items = syncedItems(state, doc);
  const ids = items.map((it) => it.id);
  const { onKeyDown, itemProps } = useRovingRadio(ids, state.activeId ?? undefined, selectItem);
  const thumbs = useThumbnails();
  const active = items.find((it) => it.id === state.activeId);

  return (
    <div className="batch-strip" style={place} data-at={'top' in place ? 'top' : 'bottom'} data-control="batch-strip" data-help-id="batch.strip">
      {items.length ? (
        <div className="batch-strip__list" role="radiogroup" aria-label="Tokens in the batch" onKeyDown={onKeyDown}>
          {items.map((it, i) => (
            <button key={it.id} type="button" className="batch-strip__item" title={it.name} aria-label={it.name} {...itemProps(it.id, i)}>
              <canvas ref={(c) => thumbs.set(it.id, c)} className="batch-strip__thumb" aria-hidden="true" />
              <span className="batch-strip__name" aria-hidden="true">
                {it.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="batch-strip__empty">Batch mode: add several pictures. They all share one style.</p>
      )}
      <div className="batch-strip__actions">
        {items.length > 0 && (
          <span className="batch-strip__count num" aria-live="polite">
            {items.findIndex((it) => it.id === state.activeId) + 1} / {items.length}
          </span>
        )}
        <UploadButton className="btn batch-strip__add" multiple>
          <ImagePlus size={18} aria-hidden="true" />
          <span>Add</span>
        </UploadButton>
        {active && (
          <button type="button" className="icon-btn" aria-label={`Remove ${active.name} from the batch`} title="Remove from the batch" onClick={() => removeItem(active.id)}>
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Draws the strip's thumbnails shortly after changes settle, a few per frame
 * so a big batch never stalls the page. Each uses a quick copy of its
 * processed art (the full-size one only when it is ready already).
 */
function useThumbnails() {
  const canvases = useRef(new Map<string, HTMLCanvasElement>());
  const doc = useDoc();
  const batch = useBatch((b) => b);
  const assets = useStore(assetStore, (s) => s.assets);
  const version = useProcessedVersion();

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const timer = setTimeout(() => {
      const items = syncedItems(batchStore.getState(), doc);
      const px = Math.round(THUMB * Math.min(2, window.devicePixelRatio || 1));
      let i = 0;
      const step = () => {
        if (cancelled) return;
        const started = performance.now();
        while (i < items.length && performance.now() - started < 12) {
          const item = items[i++]!;
          const c = canvases.current.get(item.id);
          const ctx = c?.getContext('2d');
          const src = item.assetId ? assets.get(item.assetId) : undefined;
          if (!c || !ctx) continue;
          c.width = px;
          c.height = px;
          const d = docForItem(doc, item);
          const edits = artEdits(d);
          const art = src ? (peekProcessedArt(src, edits) ?? peekProcessedArt(src, edits, DRAFT_SIDE) ?? processedArt(src, edits, THUMB_SIDE)) : null;
          renderToken(ctx, d, assets, px, { processedArt: art?.source });
        }
        if (i < items.length) frame = requestAnimationFrame(step);
      };
      step();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [doc, batch, assets, version]);

  return {
    set(id: string, c: HTMLCanvasElement | null) {
      if (c) canvases.current.set(id, c);
      else canvases.current.delete(id);
    },
  };
}
