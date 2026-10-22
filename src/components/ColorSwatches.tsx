import { useId, useState } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';
import { useRovingRadio } from './useRovingRadio';

const HEX = /^#[0-9a-f]{6}$/i;

/** Ready-made colour swatches plus a picker and hex box for any colour. */
export function ColorSwatches({
  label,
  helpId,
  value,
  swatches,
  onChange,
  onCommit,
}: {
  label: string;
  helpId: HelpId;
  value: string;
  swatches: readonly string[];
  onChange: (hex: string) => void;
  onCommit?: (hex: string) => void;
}) {
  const labelId = useId();
  const pickerId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const lower = value.toLowerCase();
  const pick = (hex: string) => {
    onChange(hex);
    onCommit?.(hex);
  };
  const { onKeyDown, itemProps } = useRovingRadio(
    swatches.map((s) => s.toLowerCase()),
    swatches.some((s) => s.toLowerCase() === lower) ? lower : undefined,
    pick,
  );

  const commitDraft = () => {
    if (draft === null) return;
    const hex = draft.startsWith('#') ? draft : `#${draft}`;
    setDraft(null);
    if (HEX.test(hex)) pick(hex.toLowerCase());
  };

  return (
    <div className="swatches" data-control="swatches" data-help-id={helpId}>
      <ControlLabel id={labelId} label={label} helpId={helpId} />
      <div className="swatches__row">
        <div className="swatches__list" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
          {swatches.map((s, i) => (
            <button
              key={s}
              type="button"
              className="swatch"
              style={{ background: s }}
              aria-label={s}
              title={s}
              {...itemProps(s.toLowerCase(), i)}
            />
          ))}
        </div>
        <label className="swatch swatch--picker" htmlFor={pickerId} title="Choose any colour">
          <span className="visually-hidden">Custom colour</span>
          <input
            id={pickerId}
            type="color"
            value={HEX.test(value) ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onCommit?.(e.target.value)}
          />
        </label>
        <input
          className="swatches__hex"
          type="text"
          aria-label={`${label} hex code`}
          spellCheck={false}
          maxLength={7}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
        />
      </div>
    </div>
  );
}
