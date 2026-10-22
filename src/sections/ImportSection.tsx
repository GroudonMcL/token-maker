import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { ControlLabel } from '../components';
import { UploadButton } from '../editor/UploadButton';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

/** Import section (Phase 1: upload, drop, paste; web links in Phase 2). */
export function ImportSection() {
  const name = useDoc((d) => d.name);
  const id = useId();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      <div className="control" data-control="upload" data-help-id="import.upload">
        <UploadButton className="btn btn--wide">
          <Upload size={18} aria-hidden="true" />
          Upload image
        </UploadButton>
        <p className="control__hint">Or drag an image anywhere onto the page, or paste it with Ctrl+V.</p>
      </div>
      <div className="control" data-control="name" data-help-id="import.name">
        <ControlLabel htmlFor={id} label="Token name" helpId="import.name" />
        <input
          id={id}
          className="text-input"
          type="text"
          maxLength={120}
          value={editing ?? name}
          onChange={(e) => {
            setEditing(e.target.value);
            updateDoc((d) => ({ ...d, name: e.target.value }), { transient: true });
          }}
          onBlur={() => {
            setEditing(null);
            commitDoc();
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </>
  );
}
