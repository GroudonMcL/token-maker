import { useId, type ReactNode } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';
import { useRovingRadio } from './useRovingRadio';

export interface Tile {
  id: string;
  label: string;
  /** A small preview: an <img>, a canvas, or any element. */
  preview: ReactNode;
  group?: string;
}

/** A grid of picture tiles with one chosen (like the frame picker). Tiles can be grouped. */
export function TileGrid({
  label,
  helpId,
  tiles,
  value,
  onChange,
}: {
  label: string;
  helpId: HelpId;
  tiles: readonly Tile[];
  value: string;
  onChange: (id: string) => void;
}) {
  const labelId = useId();
  const { onKeyDown, itemProps } = useRovingRadio(
    tiles.map((t) => t.id),
    value,
    onChange,
  );
  const groups: { name: string | undefined; tiles: { tile: Tile; index: number }[] }[] = [];
  tiles.forEach((tile, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === tile.group) last.tiles.push({ tile, index });
    else groups.push({ name: tile.group, tiles: [{ tile, index }] });
  });

  return (
    <div className="tile-grid" data-control="tiles" data-help-id={helpId}>
      <ControlLabel id={labelId} label={label} helpId={helpId} />
      <div role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} className="tile-grid__groups">
        {groups.map((g, gi) => (
          <div key={gi} className="tile-grid__group">
            {g.name && <div className="tile-grid__group-name">{g.name}</div>}
            <div className="tile-grid__tiles">
              {g.tiles.map(({ tile, index }) => (
                <button key={tile.id} type="button" className="tile" {...itemProps(tile.id, index)}>
                  <span className="tile__preview" aria-hidden="true">
                    {tile.preview}
                  </span>
                  <span className="tile__label">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
