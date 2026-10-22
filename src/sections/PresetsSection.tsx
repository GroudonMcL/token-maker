import { ClipboardCopy, Download, FileUp, Save, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ControlLabel } from '../components';
import { updateFrameAndArt } from '../editor/artActions';
import { selectDecoration } from '../editor/tools';
import { BUILT_IN_PRESETS } from '../presets/builtins';
import { applyLook, createPreset, PRESET_FILE_EXT, presetFileName, presetFromText, presetToCode, presetToJson, type TokenPreset } from '../presets/preset';
import { deletePreset, installSharedImages, refreshSavedPresets, savePreset, useSavedPresets, withSharedImages } from '../presets/presetStore';
import { assetStore } from '../state/assets';
import { getDoc, useDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';
import { presetThumbnail } from './presetThumbs';

/** Applies a preset's look as one undo step (the art, name and size stay). */
function apply(p: TokenPreset) {
  updateFrameAndArt((d) => applyLook(d, p.look));
  selectDecoration(null);
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Presets section (DESIGN.md §6.9): built-in looks, your own saved looks,
 * and sharing them as a file or a text code. Presets never hold your art.
 */
export function PresetsSection() {
  const { presets, loaded } = useSavedPresets();
  const tokenName = useDoc((d) => d.name);
  // Redraw thumbnails once frame pictures have loaded.
  useStore(assetStore, (s) => s.assets.size);
  const [name, setName] = useState('');
  const [code, setCode] = useState<{ id: string; text: string } | null>(null);
  const [pasted, setPasted] = useState('');
  const nameId = useId();
  const pasteId = useId();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void refreshSavedPresets();
  }, [loaded]);

  const save = async () => {
    const p = createPreset(getDoc(), name || `${tokenName} look`);
    try {
      await savePreset(p);
      setName('');
      toast(`Saved “${p.name}” to your presets.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The preset couldn't be saved.", 'error');
    }
  };

  const copyCode = async (p: TokenPreset) => {
    const text = await presetToCode(await withSharedImages(p));
    setCode({ id: p.id, text });
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied the code for “${p.name}”. Paste it anywhere to share it.`);
    } catch {
      toast('Copy the code from the box below the preset.');
    }
  };

  const exportFile = async (p: TokenPreset) => {
    download(presetFileName(p), presetToJson(await withSharedImages(p)));
    toast(`Downloaded ${presetFileName(p)}`);
  };

  const importText = async (text: string) => {
    try {
      const p = await presetFromText(text);
      await installSharedImages(p);
      await savePreset(p);
      apply(p);
      setPasted('');
      toast(`Added “${p.name}” to your presets and used it.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That preset couldn't be read.", 'error');
    }
  };

  return (
    <>
      <div className="tile-grid preset-tiles" data-control="preset-builtins" data-help-id="presets.builtIn">
        <ControlLabel label="Built-in presets" helpId="presets.builtIn" />
        <div className="tile-grid__tiles" role="group" aria-label="Built-in presets">
          {BUILT_IN_PRESETS.map((p) => {
            const thumb = presetThumbnail(p);
            return (
              <button key={p.id} type="button" className="tile" data-preset={p.id} onClick={() => apply(p)}>
                <span className="tile__preview" aria-hidden="true">
                  {thumb ? <img src={thumb} alt="" width={44} height={44} /> : <span className="tile__blank" />}
                </span>
                <span className="tile__label">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="control" data-control="preset-save" data-help-id="presets.save">
        <ControlLabel htmlFor={nameId} label="Save this look" helpId="presets.save" />
        <form
          className="preset-save"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input id={nameId} className="text-input" type="text" maxLength={60} placeholder={`${tokenName} look`} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn--primary btn--small">
            <Save size={14} aria-hidden="true" />
            Save
          </button>
        </form>
      </div>

      <div className="control" data-control="preset-list" data-help-id="presets.yours">
        <ControlLabel label="Your presets" helpId="presets.yours" />
        {presets.length === 0 ? (
          <p className="control__hint">Nothing saved yet. Style a token, then save its look above. Your art is never saved in a preset.</p>
        ) : (
          <ul className="preset-list" aria-label="Your presets">
            {presets.map((p) => {
              const thumb = presetThumbnail(p);
              return (
                <li key={p.id}>
                  <div className="preset-row" data-preset={p.id}>
                    {thumb ? <img className="preset-row__thumb" src={thumb} alt="" width={40} height={40} /> : <span className="preset-row__thumb" />}
                    <button type="button" className="preset-row__name" title={`Use “${p.name}”`} onClick={() => apply(p)}>
                      {p.name}
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Copy the code for ${p.name}`} title="Copy code" onClick={() => void copyCode(p)}>
                      <ClipboardCopy size={16} />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Download ${p.name} as a file`} title="Download file" onClick={() => void exportFile(p)}>
                      <Download size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${p.name}`}
                      title="Delete"
                      onClick={() => {
                        if (code?.id === p.id) setCode(null);
                        void deletePreset(p.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {code?.id === p.id && (
                    <textarea
                      className="preset-code"
                      readOnly
                      aria-label={`Preset code for ${p.name}`}
                      value={code.text}
                      onFocus={(e) => e.currentTarget.select()}
                      data-testid="preset-code"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="control" data-control="preset-import" data-help-id="presets.import">
        <ControlLabel htmlFor={pasteId} label="Add a shared preset" helpId="presets.import" />
        <textarea
          id={pasteId}
          className="preset-code"
          placeholder="Paste a preset code (it starts with TKP)"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          spellCheck={false}
        />
        <div className="control--row">
          <button type="button" className="btn btn--small" disabled={!pasted.trim()} onClick={() => void importText(pasted)}>
            Add the code
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => file.current?.click()}>
            <FileUp size={14} aria-hidden="true" />
            Open a preset file
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept={`${PRESET_FILE_EXT},.json,application/json`}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="preset-file-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) await importText(await f.text());
          }}
        />
      </div>
    </>
  );
}
