import { Link2, LoaderCircle, Upload, X } from 'lucide-react';
import { useId, useState } from 'react';
import { ControlLabel, ImageStrip } from '../components';
import { UploadButton } from '../editor/UploadButton';
import { MIN_IMAGE_SIDE } from '../../server/extractImages.ts';
import { clearWebImport, importFromAddress, pickWebImage, proxiedImageUrl, useWebImport } from '../import/webImport';
import type { ImportTarget } from '../import/importImage';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

/** Import section: upload, drop, paste, web addresses and Pinterest links (DESIGN.md §6.1). */
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
      <WebAddress />
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

/**
 * The web-address box, its messages, and the strip of pictures found on a
 * page. The Background section has its own box, which sends pictures to the
 * background instead; each box only shows what it asked for.
 */
export function WebAddress({ target = 'art', hint = 'Paste a link to a picture, a web page, or a Pinterest pin.' }: { target?: ImportTarget; hint?: string }) {
  const id = useId();
  const [text, setText] = useState('');
  const mine = useWebImport((s) => s.target === target);
  const status = useWebImport((s) => (mine ? s.status : 'idle'));
  const error = useWebImport((s) => (mine ? s.error : undefined));
  const images = useWebImport((s) => (mine ? s.images : NONE));
  const picked = useWebImport((s) => s.picked);
  const address = useWebImport((s) => s.address);
  const busy = status === 'loading';
  const lookingUp = busy && !images.length;

  return (
    <>
      <form
        className="control"
        data-control="web-address"
        data-help-id="import.web"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) importFromAddress(text, 'box', target);
        }}
      >
        <ControlLabel htmlFor={id} label="Web address" helpId="import.web" />
        <div className="web-address__row">
          <input
            id={id}
            className="text-input"
            type="text"
            inputMode="url"
            enterKeyHint="go"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Image, page or Pinterest link"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!text.trim() || lookingUp}>
            {lookingUp ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
            Get
          </button>
        </div>
        {lookingUp ? (
          <p className="control__hint" role="status">
            Fetching {hostOf(address)}…
          </p>
        ) : (
          <p className="control__hint">{hint}</p>
        )}
        {error && (
          <p className="control__error" role="alert">
            {error}
          </p>
        )}
      </form>
      {images.length > 0 && (
        <div className="web-pictures">
          <ImageStrip
            label={`Pictures on ${hostOf(address)}`}
            helpId="import.pagePictures"
            images={images.map((img) => ({ id: img.url, src: img.url, alt: img.alt ?? '', fallbackSrc: proxiedImageUrl(img.url) }))}
            value={picked}
            onChange={(url) => void pickWebImage(url)}
            minSide={MIN_IMAGE_SIDE}
            busyId={busy ? picked : undefined}
            emptyText="None of the pictures on that page could be shown."
          />
          <button type="button" className="btn btn--ghost web-pictures__close" onClick={clearWebImport}>
            <X size={16} aria-hidden="true" />
            Close
          </button>
        </div>
      )}
    </>
  );
}

const NONE: never[] = [];

function hostOf(address: string): string {
  try {
    return new URL(address).hostname.replace(/^www\./, '');
  } catch {
    return 'the page';
  }
}
