import { Circle, Hexagon, Square, SquareRoundCorner } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ColorSwatches, SegmentedButtons, Slider, TileGrid } from '../components';
import { updateFrameAndArt } from '../editor/artActions';
import type { FrameSettings } from '../document/types';
import { FRAME_PRESETS, framePresetById, SHAPES, type ShapeId } from '../render/catalog';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';
import { frameThumbnails } from './frameThumbs';
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

/** Frame & shape section (DESIGN.md §6.9): shape, 27 frames, colour, thickness, spacing, backing. */
export function FrameSection() {
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
      <SegmentedButtons
        label="Shape"
        helpId="frame.shape"
        value={shape}
        onChange={(s) => updateFrameAndArt((d) => ({ ...d, shape: s }))}
        options={SHAPES.map((s) => ({ value: s.id, label: s.name, icon: SHAPE_ICONS[s.id], iconOnly: true }))}
      />
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
      <Slider
        label="Thickness"
        helpId="frame.thickness"
        unit="% of a square"
        defaultValue={toPct(DEFAULTS.thickness)}
        min={0}
        max={20}
        step={0.5}
        value={toPct(frame.thickness)}
        disabled={frame.style === 'none'}
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
      <ColorSwatches
        label="Backing colour"
        helpId="frame.backingColor"
        value={frame.backingColor}
        swatches={BACKING_SWATCHES}
        onChange={(c) => setFrame({ backingColor: c }, true)}
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
        onChange={(v) => setFrame({ backingOpacity: v / 100 }, true)}
        onCommit={commitDoc}
      />
    </>
  );
}
