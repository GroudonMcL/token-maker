import { Move, RotateCcw, Upload } from 'lucide-react';
import { useState } from 'react';
import { ColorSwatches, GradientEditor, SegmentedButtons, Slider, TileGrid } from '../components';
import { DEFAULT_BACKGROUND } from '../document/defaults';
import type { BackgroundKind, BackgroundLayer } from '../document/types';
import { setTool, useTool } from '../editor/tools';
import { UploadButton } from '../editor/UploadButton';
import { BACKGROUND_LIBRARY, libraryThumbUrl } from '../render/backgroundLibrary';
import { loadLibraryImage } from '../state/libraryAssets';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';
import { BackgroundRemovalControls } from './BackgroundRemovalControls';
import { WebAddress } from './ImportSection';

const COLOR_SWATCHES = ['#1d1f27', '#3a4a5c', '#2b3a22', '#4a2f22', '#5b2d7a', '#7a2e2e', '#c9b48a', '#e8e0d0', '#ffffff', '#000000'];

type Source = 'library' | 'asset' | 'art';

const setBackground = (patch: Partial<BackgroundLayer>, transient = false) =>
  updateDoc((d) => ({ ...d, background: { ...d.background, ...patch } }), { transient });

/** Background section (DESIGN.md §6.3): removing the art's own background (v8), then a colour, gradient or picture behind the art inside the frame. */
export function BackgroundSection() {
  const bg = useDoc((d) => d.background);
  const hasArt = useDoc((d) => d.art.assetId !== null);
  const tool = useTool((s) => s.tool);
  // "Your own" can be chosen before there is a picture, so remember the choice here too.
  const [chosen, setChosen] = useState<Source | null>(null);
  const source: Source = bg.image?.type ?? chosen ?? 'library';

  const pickLibrary = (id: string) => {
    setBackground({ kind: 'image', image: { type: 'library', id }, zoom: 1, offsetX: 0, offsetY: 0 });
    loadLibraryImage(id).catch(() => toast("That background couldn't be loaded. Check your connection and try again.", 'error'));
  };

  return (
    <>
      <BackgroundRemovalControls />
      <SegmentedButtons
        label="Background"
        helpId="background.kind"
        value={bg.kind}
        onChange={(kind: BackgroundKind) => setBackground({ kind })}
        options={[
          { value: 'none', label: 'None' },
          { value: 'color', label: 'Colour' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Picture' },
        ]}
      />

      {bg.kind === 'none' && <p className="control__hint">The backing colour (in Frame & shape) shows behind the art.</p>}

      {bg.kind === 'color' && (
        <ColorSwatches
          label="Colour"
          helpId="background.color"
          value={bg.color}
          swatches={COLOR_SWATCHES}
          onChange={(color) => setBackground({ color }, true)}
          onCommit={commitDoc}
        />
      )}

      {bg.kind === 'gradient' && (
        <GradientEditor
          value={bg.gradient}
          onChange={(gradient, transient) => setBackground({ gradient }, transient)}
          onCommit={commitDoc}
          helpIds={{ type: 'background.gradientType', angle: 'background.gradientAngle', colors: 'background.gradientColors', stops: 'background.gradientStops' }}
        />
      )}

      {bg.kind === 'image' && (
        <>
          <SegmentedButtons
            label="Picture from"
            helpId="background.source"
            value={source}
            onChange={(s: Source) => {
              setChosen(s);
              if (s === 'library') pickLibrary(bg.image?.type === 'library' ? bg.image.id : BACKGROUND_LIBRARY[0]!.id);
              else if (s === 'art') setBackground({ image: { type: 'art' }, zoom: 1.3, offsetX: 0, offsetY: 0, blur: Math.max(bg.blur, 40) });
              else setBackground({ image: bg.image?.type === 'asset' ? bg.image : null });
            }}
            options={[
              { value: 'library', label: 'Built-in' },
              { value: 'asset', label: 'Your own' },
              { value: 'art', label: "Token's art" },
            ]}
          />
          {source === 'library' && (
            <TileGrid
              label="Built-in pictures"
              helpId="background.library"
              value={bg.image?.type === 'library' ? bg.image.id : ''}
              onChange={pickLibrary}
              tiles={BACKGROUND_LIBRARY.map((b) => ({
                id: b.id,
                label: b.name,
                preview: <img src={libraryThumbUrl(b.id)} alt="" width={44} height={44} loading="lazy" />,
              }))}
            />
          )}
          {source === 'asset' && (
            <>
              <div className="control" data-control="background-upload" data-help-id="background.upload">
                <UploadButton className="btn btn--wide" target="background">
                  <Upload size={18} aria-hidden="true" />
                  Upload a background
                </UploadButton>
              </div>
              <WebAddress target="background" hint="Or paste a link to a picture or a page with one." />
            </>
          )}
          {source === 'art' && !hasArt && <p className="control__hint">Add an image first: its enlarged, blurred copy fills the background.</p>}
          <Slider
            label="Blur"
            helpId="background.blur"
            min={0}
            max={100}
            value={bg.blur}
            defaultValue={DEFAULT_BACKGROUND.blur}
            onChange={(blur) => setBackground({ blur }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Zoom"
            helpId="background.zoom"
            unit="%"
            min={50}
            max={400}
            step={5}
            value={Math.round(bg.zoom * 100)}
            defaultValue={100}
            onChange={(v) => setBackground({ zoom: v / 100 }, true)}
            onCommit={commitDoc}
          />
          <div className="control control--row" data-control="background-move" data-help-id="background.move">
            <button
              type="button"
              className="btn btn--small"
              aria-pressed={tool === 'background'}
              disabled={!hasArt}
              onClick={() => setTool(tool === 'background' ? 'move' : 'background')}
            >
              <Move size={14} aria-hidden="true" />
              Move on the canvas
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={bg.offsetX === 0 && bg.offsetY === 0 && bg.zoom === 1}
              onClick={() => setBackground({ zoom: 1, offsetX: 0, offsetY: 0 })}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reset position
            </button>
          </div>
        </>
      )}

      {bg.kind !== 'none' && (
        <Slider
          label="Opacity"
          helpId="background.opacity"
          unit="%"
          min={0}
          max={100}
          value={Math.round(bg.opacity * 100)}
          defaultValue={100}
          onChange={(v) => setBackground({ opacity: v / 100 }, true)}
          onCommit={commitDoc}
        />
      )}
    </>
  );
}
