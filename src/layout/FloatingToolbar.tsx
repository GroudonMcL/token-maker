import { FlipHorizontal2, Lock, Maximize, Minimize, RotateCw, Undo2, ZoomIn } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { getHelp, type HelpId } from '../help/helpContent';
import { HelpTip } from '../components/HelpTip';

/**
 * The floating toolbar over the canvas (as in the extension): zoom, rotate,
 * flip, fit, fill, lock, undo. Disabled until an image is loaded (later phase).
 */
export function FloatingToolbar({ disabled = true }: { disabled?: boolean }) {
  const [zoom, setZoom] = useState(100);
  const [locked, setLocked] = useState(true);
  return (
    <div className="float-toolbar" role="toolbar" aria-label="Image tools">
      <div className="float-toolbar__zoom" data-control="zoom" data-help-id="toolbar.zoom">
        <ZoomIn size={16} aria-hidden="true" />
        <input
          type="range"
          min={10}
          max={400}
          value={zoom}
          aria-label="Zoom"
          disabled={disabled}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ '--fill': `${((zoom - 10) / 390) * 100}%` } as CSSProperties}
        />
        <HelpTip id="toolbar.zoom" />
      </div>
      <span className="float-toolbar__sep" aria-hidden="true" />
      <ToolButton helpId="toolbar.rotate" disabled={disabled} icon={<RotateCw size={18} />} />
      <ToolButton helpId="toolbar.flip" disabled={disabled} icon={<FlipHorizontal2 size={18} />} />
      <ToolButton helpId="toolbar.fit" disabled={disabled} icon={<Minimize size={18} />} />
      <ToolButton helpId="toolbar.fill" disabled={disabled} icon={<Maximize size={18} />} />
      <ToolButton
        helpId="toolbar.lock"
        disabled={disabled}
        icon={<Lock size={18} />}
        pressed={locked}
        onClick={() => setLocked(!locked)}
      />
      <span className="float-toolbar__sep" aria-hidden="true" />
      <button type="button" className="icon-btn" aria-label="Undo" title="Undo" disabled={disabled}>
        <Undo2 size={18} />
      </button>
    </div>
  );
}

function ToolButton({
  helpId,
  icon,
  disabled,
  pressed,
  onClick,
}: {
  helpId: HelpId;
  icon: ReactNode;
  disabled?: boolean;
  pressed?: boolean;
  onClick?: () => void;
}) {
  const h = getHelp(helpId);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={h.title}
      aria-pressed={pressed}
      title={`${h.title}: ${h.text}`}
      data-control="tool"
      data-help-id={helpId}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
