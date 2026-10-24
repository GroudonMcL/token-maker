import { Circle, FolderOpen, Hexagon, RotateCcw, Square, SquareRoundCorner, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ColorSwatches, SegmentedButtons, Slider, TileGrid } from '../components';
import { updateFrameAndArt } from '../editor/artActions';
import { nudgeHole, pickImageFrame, uploadFrame } from '../editor/frameActions';
import { applyDesignFrame, openDesignFile } from '../editor/designActions';
import type { DesignFrame, FrameSettings, ImageFrame } from '../document/types';
import { refreshDesigns, removeDesign, useDesignLibrary } from '../state/designLibrary';
import { FRAME_LIBRARY, frameThumbUrl } from '../render/imageFrames';
import { libraryFrameName, refreshUploadedFrames, removeUploadedFrame, useUploadedFrames } from '../state/frameLibrary';
import { FRAME_PRESETS, framePresetById, SHAPES, type ShapeId } from '../render/catalog';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';
import { designThumbnail, frameThumbnails } from './frameThumbs';
import { createDocument } from '../document/defaults';
import { frameAccent } from '../render/frames';

const DEFAULTS = createDocument().frame;

const FRAME_SWATCHES = ['#d7671f', '#d4a64a', '#c9d2de', '#7a7f8a', '#8a5a32', '#6aa83a', '#3f6fd8', '#5b2d7a', '#b8322a', '#1c1c1c'];
const HIGHLIGHT_SWATCHES = ['#3d8c6a', '#c7e04a', '#f3d27a', '#d9ad4a', '#ffffff', '#3b6fd8', '#b8322a', '#9b59d0', '#1c1c1c'];
const BACKING_SWATCHES = ['#1d1f27', '#000000', '#ffffff', '#2b2118', '#1e2b22', '#2a1f33'];

const FlatHexIcon = () => <Hexagon size={16} style={{ transform: 'rotate(90deg)' }} />;
const SHAPE_ICONS: Record<ShapeId, ReactNode> = {
  circle: <Circle size={16} />,
  rounded: <SquareRoundCorner size={16} />,
  square: <Square size={16} />,
  hexagon: <Hexagon size={16} />,
  flatHex: <FlatHexIcon />,
};

/** Per-square values are shown as a percentage of one grid square (1 unit = half a square). */
const toPct = (v: number) => Math.round(v * 50 * 10) / 10;
const fromPct = (p: number) => p / 50;

/**
 * Frame & shape section (DESIGN.md §6.9, §6.12): shape, 27 frames drawn by
 * code (colour, thickness, spacing), a picture frame (built-in or your own,
 * with its hole) or a Frame Studio design (on the same band as a drawn
 * frame), and the backing.
 */
export function FrameSection() {
  const frame = useDoc((d) => d.frame);
  const kind = frame.kind === 'image' && frame.image ? 'image' : frame.kind === 'design' ? 'design' : 'code';
  return (
    <>
      <SegmentedButtons
        label="Frame type"
        helpId="frame.kind"
        value={kind}
        onChange={(k) => {
          if (k === 'code') updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, kind: 'code' } }));
          else if (k === 'design') updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, kind: 'design' } }));
          else if (frame.image) updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, kind: 'image' } }));
          else void pickImageFrame({ type: 'library', id: FRAME_LIBRARY[0]!.id }, FRAME_LIBRARY[0]!.name);
        }}
        options={[
          { value: 'code', label: 'Drawn' },
          { value: 'image', label: 'Picture' },
          { value: 'design', label: 'Frame Studio' },
        ]}
      />
      {kind === 'image' ? <PictureFrame image={frame.image!} /> : kind === 'design' ? <DesignFramePanel design={frame.design} /> : <DrawnFrame />}
      <ColorSwatches
        label="Backing colour"
        helpId="frame.backingColor"
        value={frame.backingColor}
        swatches={BACKING_SWATCHES}
        onChange={(c) => updateDoc((d) => ({ ...d, frame: { ...d.frame, backingColor: c } }), { transient: true })}
        onCommit={commitDoc}
      />
      <Slider
        label="Backing opacity"
        helpId="frame.backingOpacity"
        unit="%"
        defaultValue={100}
        min={0}
        max={100}
        value={Math.round(frame.backingOpacity * 100)}
        onChange={(v) => updateDoc((d) => ({ ...d, frame: { ...d.frame, backingOpacity: v / 100 } }), { transient: true })}
        onCommit={commitDoc}
      />
    </>
  );
}

/** A picture frame: built-in or uploaded pictures, and the hole's nudge. */
function PictureFrame({ image }: { image: ImageFrame }) {
  const { frames: uploads, loaded } = useUploadedFrames();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!loaded) void refreshUploadedFrames();
  }, [loaded]);
  const value = `${image.source.type}:${image.source.id}`;
  const own = image.source.type === 'upload';
  const n = image.nudge;
  const nudged = n.x !== 0 || n.y !== 0 || n.scale !== 1;
  return (
    <>
      <TileGrid
        label="Picture frame"
        helpId="frame.picture"
        value={value}
        onChange={(v) => {
          const [type, ...rest] = v.split(':');
          const id = rest.join(':');
          if (type === 'library') void pickImageFrame({ type, id }, libraryFrameName(id));
          else void pickImageFrame({ type: 'upload', id }, uploads.find((f) => f.id === id)?.name ?? 'My frame');
        }}
        tiles={[
          ...FRAME_LIBRARY.map((f) => ({
            id: `library:${f.id}`,
            label: f.name,
            group: 'Built-in',
            preview: <img src={frameThumbUrl(f.id)} alt="" width={44} height={44} loading="lazy" />,
          })),
          ...uploads.map((f) => ({
            id: `upload:${f.id}`,
            label: f.name,
            group: 'Your frames',
            preview: <img src={f.url} alt="" width={44} height={44} />,
          })),
        ]}
      />
      <div className="control control--row" data-control="frame-upload" data-help-id="frame.upload">
        <button type="button" className="btn btn--small" onClick={() => input.current?.click()}>
          <Upload size={14} aria-hidden="true" />
          Upload a frame
        </button>
        {own && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              void removeUploadedFrame(image.source.id).then(() => pickImageFrame({ type: 'library', id: FRAME_LIBRARY[0]!.id }, FRAME_LIBRARY[0]!.name));
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            Remove this frame
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/webp,image/gif,image/avif,image/svg+xml,.png,.webp,.gif,.avif,.svg"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="frame-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void uploadFrame(file);
          }}
        />
      </div>
      <p className="control__hint">Use a PNG with a see-through middle; the art shows through the hole. Picture frames grow with the token.</p>
      <Slider
        label="Hole size"
        helpId="frame.holeSize"
        unit="%"
        defaultValue={100}
        min={50}
        max={150}
        value={Math.round(n.scale * 100)}
        onChange={(v) => nudgeHole({ scale: v / 100 }, true)}
        onCommit={commitDoc}
      />
      <Slider
        label="Move hole sideways"
        helpId="frame.holeX"
        unit="%"
        defaultValue={0}
        min={-25}
        max={25}
        step={0.5}
        value={Math.round(n.x * 500) / 10}
        onChange={(v) => nudgeHole({ x: v / 50 }, true)}
        onCommit={commitDoc}
      />
      <Slider
        label="Move hole up or down"
        helpId="frame.holeY"
        unit="%"
        defaultValue={0}
        min={-25}
        max={25}
        step={0.5}
        value={Math.round(n.y * 500) / 10}
        onChange={(v) => nudgeHole({ y: v / 50 }, true)}
        onCommit={commitDoc}
      />
      <div className="control" data-control="frame-hole-reset" data-help-id="frame.holeReset">
        <button type="button" className="btn btn--ghost btn--small" disabled={!nudged} onClick={() => nudgeHole({ x: 0, y: 0, scale: 1 })}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset the hole
        </button>
      </div>
    </>
  );
}

/**
 * A Frame Studio design: the designs opened in this browser, opening another
 * .framestudio.json file, and the band it sits on (shape, thickness and
 * spacing, as for a drawn frame).
 */
function DesignFramePanel({ design }: { design: DesignFrame | null }) {
  const shape = useDoc((d) => d.shape);
  const { designs, loaded } = useDesignLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!loaded) void refreshDesigns();
  }, [loaded]);
  useEffect(() => {
    // Drawn after the panel appears, so opening it stays snappy.
    const id = requestAnimationFrame(() => {
      const next = new Map<string, string>();
      for (const d of designs) {
        const url = designThumbnail(d.id, d.project, shape) ?? d.preview;
        if (url) next.set(d.id, url);
      }
      setThumbs(next);
    });
    return () => cancelAnimationFrame(id);
  }, [designs, shape]);
  // The design the token uses, even if it was removed from (or never saved in) this browser's library.
  const tiles = designs.some((d) => d.id === design?.id) || !design ? designs : [{ id: design.id, name: design.name, project: design.project, preview: null, added: 0 }, ...designs];
  return (
    <>
      <ShapeControl />
      {tiles.length > 0 ? (
        <TileGrid
          label="Frame Studio design"
          helpId="frame.design"
          value={design?.id ?? ''}
          onChange={(id) => {
            const d = tiles.find((t) => t.id === id);
            if (d) applyDesignFrame(d.id, d.name, d.project);
          }}
          tiles={tiles.map((d) => ({
            id: d.id,
            label: d.name,
            preview: thumbs.get(d.id) ? <img src={thumbs.get(d.id)} alt="" width={44} height={44} /> : <span className="tile__blank" />,
          }))}
        />
      ) : (
        <p className="control__hint">No designs yet. Make one in Frame Studio, save it, and open the .framestudio.json file here.</p>
      )}
      <div className="control control--row" data-control="frame-design-open" data-help-id="frame.designOpen">
        <button type="button" className="btn btn--small" onClick={() => input.current?.click()}>
          <FolderOpen size={14} aria-hidden="true" />
          Open a Frame Studio design
        </button>
        {design && designs.some((d) => d.id === design.id) && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => void removeDesign(design.id)}>
            <Trash2 size={14} aria-hidden="true" />
            Remove from this browser
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept=".framestudio.json,.json,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="design-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void openDesignFile(file);
          }}
        />
      </div>
      <p className="control__hint">The design follows the token's shape, thickness and spacing, and is lit from the direction it was made with.</p>
      <BandSliders />
    </>
  );
}

/** The token's shape. */
function ShapeControl() {
  const shape = useDoc((d) => d.shape);
  return (
    <SegmentedButtons
      label="Shape"
      helpId="frame.shape"
      value={shape}
      onChange={(s) => updateFrameAndArt((d) => ({ ...d, shape: s }))}
      options={SHAPES.map((s) => ({ value: s.id, label: s.name, icon: SHAPE_ICONS[s.id], iconOnly: true }))}
    />
  );
}

/** Thickness and spacing of the frame band (drawn frames and Frame Studio designs). */
function BandSliders() {
  const frame = useDoc((d) => d.frame);
  const setFrame = (patch: Partial<FrameSettings>, transient = false) =>
    updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, ...patch } }), { transient });
  return (
    <>
      <Slider
        label="Thickness"
        helpId="frame.thickness"
        unit="% of a square"
        defaultValue={toPct(DEFAULTS.thickness)}
        min={0}
        max={20}
        step={0.5}
        value={toPct(frame.thickness)}
        disabled={frame.kind !== 'design' && frame.style === 'none'}
        onChange={(v) => setFrame({ thickness: fromPct(v) }, true)}
        onCommit={commitDoc}
      />
      <Slider
        label="Outer spacing"
        helpId="frame.outerSpacing"
        unit="% of a square"
        defaultValue={toPct(DEFAULTS.outerSpacing)}
        min={0}
        max={15}
        step={0.5}
        value={toPct(frame.outerSpacing)}
        onChange={(v) => setFrame({ outerSpacing: fromPct(v) }, true)}
        onCommit={commitDoc}
      />
      <Slider
        label="Inner spacing"
        helpId="frame.innerSpacing"
        unit="% of a square"
        defaultValue={toPct(DEFAULTS.innerSpacing)}
        min={0}
        max={15}
        step={0.5}
        value={toPct(frame.innerSpacing)}
        onChange={(v) => setFrame({ innerSpacing: fromPct(v) }, true)}
        onCommit={commitDoc}
      />
    </>
  );
}

/** A frame drawn by code: shape, the 27 frames, colour, thickness and spacing. */
function DrawnFrame() {
  const shape = useDoc((d) => d.shape);
  const frame = useDoc((d) => d.frame);
  const accent = frameAccent(frame.style);
  const [thumbs, setThumbs] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    // Drawn after the panel appears, so opening it stays snappy.
    const id = requestAnimationFrame(() => setThumbs(frameThumbnails(shape)));
    return () => cancelAnimationFrame(id);
  }, [shape]);

  const setFrame = (patch: Partial<FrameSettings>, transient = false) =>
    updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, ...patch } }), { transient });

  return (
    <>
      <ShapeControl />
      <TileGrid
        label="Frame"
        helpId="frame.style"
        value={frame.presetId}
        onChange={(id) => {
          const p = framePresetById(id);
          if (p) setFrame({ presetId: p.id, style: p.style, color: p.color, highlightColor: null });
        }}
        tiles={FRAME_PRESETS.map((p) => ({
          id: p.id,
          label: p.name,
          group: p.group,
          preview: thumbs?.get(p.id) ? <img src={thumbs.get(p.id)} alt="" width={44} height={44} /> : <span className="tile__blank" />,
        }))}
      />
      <ColorSwatches
        label="Frame colour"
        helpId="frame.color"
        value={frame.color}
        swatches={FRAME_SWATCHES}
        onChange={(c) => updateDoc((d) => ({ ...d, frame: { ...d.frame, color: c } }), { transient: true })}
        onCommit={commitDoc}
      />
      {accent && (
        <ColorSwatches
          label="Frame highlights colour"
          helpId="frame.highlight"
          value={frame.highlightColor ?? accent}
          swatches={[accent, ...HIGHLIGHT_SWATCHES.filter((c) => c !== accent)]}
          onChange={(c) => setFrame({ highlightColor: c }, true)}
          onCommit={commitDoc}
        />
      )}
      <BandSliders />
    </>
  );
}
