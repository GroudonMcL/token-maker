import { MAX_SQUARES, MIN_SQUARES, SIZE_PRESETS } from '../document/defaults';
import { outputSize, squaresLabel } from '../document/sizing';
import type { SizePreset } from '../document/types';
import { SegmentedButtons, Slider } from '../components';
import { updateFrameAndArt } from '../editor/artActions';
import { commitDoc, useDoc } from '../state/tokenStore';
import { useExportSettings } from '../export/exportSettings';

/** Size section (DESIGN.md §6.9): creature size in grid squares. */
export function SizeSection() {
  const size = useDoc((d) => d.size);
  const pxPerSquare = useExportSettings((s) => s.pxPerSquare);
  const setPreset = (preset: SizePreset) => {
    const known = SIZE_PRESETS.find((s) => s.id === preset);
    updateFrameAndArt((d) => ({ ...d, size: { preset, squares: known ? known.squares : d.size.squares } }));
  };
  return (
    <>
      <SegmentedButtons
        label="Creature size"
        helpId="size.preset"
        value={size.preset}
        onChange={setPreset}
        options={[...SIZE_PRESETS.map((s) => ({ value: s.id, label: s.name })), { value: 'custom' as const, label: 'Custom' }]}
      />
      {size.preset === 'custom' && (
        <Slider
          label="Squares across"
          helpId="size.custom"
          min={MIN_SQUARES}
          max={MAX_SQUARES}
          step={0.5}
          defaultValue={1}
          value={size.squares}
          onChange={(v) => updateFrameAndArt((d) => ({ ...d, size: { preset: 'custom', squares: v } }), { transient: true })}
          onCommit={commitDoc}
        />
      )}
      <p className="control__hint">
        Covers {squaresLabel(size.squares)} on the map. Exports at{' '}
        <span className="num">
          {outputSize(size.squares, pxPerSquare)} × {outputSize(size.squares, pxPerSquare)} px
        </span>{' '}
        ({pxPerSquare} px per square).
      </p>
    </>
  );
}
