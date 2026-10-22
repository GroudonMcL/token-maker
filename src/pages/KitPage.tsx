import { Circle, Hexagon, Square } from 'lucide-react';
import { useState } from 'react';
import { useStore } from 'zustand';
import { Advanced, ColorSwatches, ImageStrip, SegmentedButtons, Section, Slider, TileGrid, Toggle } from '../components';
import { createHistoryStore } from '../state/history';
import { PageLayout } from './PageLayout';

/**
 * A gallery of the shared UI components, wired to a real undo/redo history so
 * you can check that one slider drag is one undo step. Linked from the footer
 * while running `npm run dev`; reachable at /kit on the live site.
 */
interface Demo {
  brightness: number;
  hue: number;
  colour: string;
  shape: 'circle' | 'hexagon' | 'square';
  frame: string;
  image: string | undefined;
  rim: boolean;
}

const store = createHistoryStore<Demo>({
  brightness: 0,
  hue: 0,
  colour: '#b88a3e',
  shape: 'circle',
  frame: 'stamped',
  image: undefined,
  rim: false,
});

const SWATCHES = ['#b88a3e', '#c9ccd1', '#7a2e2e', '#2f5d46', '#2b4c7e', '#4a3466', '#1c1c1c', '#f2efe8'];

const ring = (stroke: string, inner = 'transparent') => (
  <svg viewBox="0 0 40 40" width="100%" height="100%">
    <circle cx="20" cy="20" r="15" fill={inner} stroke={stroke} strokeWidth="5" />
  </svg>
);

const TILES = [
  { id: 'stamped', label: 'Stamped', group: 'Classic', preview: ring('#b88a3e') },
  { id: 'gilded', label: 'Gilded', group: 'Classic', preview: ring('#d6a24e', '#2a251f') },
  { id: 'double', label: 'Double line', group: 'Classic', preview: ring('#c9ccd1') },
  { id: 'oak', label: 'Oak', group: 'Textures', preview: ring('#7a5534') },
  { id: 'magma', label: 'Magma', group: 'Textures', preview: ring('#c2451e') },
  { id: 'starfield', label: 'Starfield', group: 'Textures', preview: ring('#2b4c7e') },
];

const swatchImage = (a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="60" height="60" fill="url(#g)"/></svg>`,
  )}`;

const IMAGES = [
  { id: 'a', src: swatchImage('#2b4c7e', '#d6a24e'), alt: 'Example image 1' },
  { id: 'b', src: swatchImage('#7a2e2e', '#f2efe8'), alt: 'Example image 2' },
  { id: 'c', src: swatchImage('#2f5d46', '#c9ccd1'), alt: 'Example image 3' },
  { id: 'd', src: swatchImage('#4a3466', '#e3b469'), alt: 'Example image 4' },
];

export function KitPage() {
  const doc = useStore(store, (s) => s.present);
  const steps = useStore(store, (s) => s.past.length);
  const redoSteps = useStore(store, (s) => s.future.length);
  const { set, commit, undo, redo } = store.getState();
  const live = (patch: Partial<Demo>) => set({ ...store.getState().present, ...patch }, { transient: true });
  const once = (patch: Partial<Demo>) => set({ ...store.getState().present, ...patch });
  const [stripEmpty, setStripEmpty] = useState(false);

  return (
    <PageLayout title="UI kit">
      <p>
        The shared controls every section is built from. Changes here go through the real undo history:{' '}
        <strong className="num">{steps}</strong> undo step{steps === 1 ? '' : 's'}.
      </p>
      <div className="kit__actions">
        <button type="button" className="btn" onClick={undo} disabled={steps === 0}>
          Undo
        </button>
        <button type="button" className="btn" onClick={redo} disabled={redoSteps === 0}>
          Redo
        </button>
      </div>
      <div className="kit">
        <Section
          title="Image"
          helpId="section.image"
          defaultOpen
          advanced={
            <Slider label="Hue" helpId="kit.slider" min={-180} max={180} unit="°" value={doc.hue} onChange={(v) => live({ hue: v })} onCommit={commit} />
          }
        >
          <Slider
            label="Brightness"
            helpId="kit.slider"
            min={-100}
            max={100}
            value={doc.brightness}
            onChange={(v) => live({ brightness: v })}
            onCommit={commit}
          />
          <Toggle label="Rim light" helpId="kit.toggle" checked={doc.rim} onChange={(v) => once({ rim: v })} />
        </Section>

        <Section title="Frame & shape" helpId="section.frame" defaultOpen>
          <SegmentedButtons
            label="Shape"
            helpId="kit.segmented"
            value={doc.shape}
            onChange={(v) => once({ shape: v })}
            options={[
              { value: 'circle', label: 'Circle', icon: <Circle size={16} /> },
              { value: 'hexagon', label: 'Hexagon', icon: <Hexagon size={16} /> },
              { value: 'square', label: 'Square', icon: <Square size={16} /> },
            ]}
          />
          <TileGrid label="Frame style" helpId="kit.tiles" tiles={TILES} value={doc.frame} onChange={(v) => once({ frame: v })} />
          <ColorSwatches
            label="Frame colour"
            helpId="kit.swatches"
            swatches={SWATCHES}
            value={doc.colour}
            onChange={(v) => live({ colour: v })}
            onCommit={commit}
          />
        </Section>

        <Section title="Import" helpId="section.import" defaultOpen>
          <ImageStrip
            label="Images on the page"
            helpId="kit.strip"
            images={stripEmpty ? [] : IMAGES}
            value={doc.image}
            onChange={(v) => once({ image: v })}
            emptyText="No images found on that page."
          />
          <button type="button" className="btn btn--ghost" onClick={() => setStripEmpty(!stripEmpty)}>
            {stripEmpty ? 'Show example images' : 'Show empty state'}
          </button>
          <Advanced>
            <p className="muted">Advanced drop-downs can also be used on their own.</p>
          </Advanced>
        </Section>
      </div>
    </PageLayout>
  );
}
