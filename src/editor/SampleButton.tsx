import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from '../ui/toast';
import { importWithMessage } from './importWithMessage';

/** The sample picture new visitors can try (public/sample/, drawn by `npm run make-fixture`). */
export const SAMPLE_URL = '/sample/goblin.png';

/** "Try a sample": loads a ready-made goblin picture, just as if it had been uploaded (Phase 10). */
export function SampleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(SAMPLE_URL);
          if (!res.ok) throw new Error(String(res.status));
          await importWithMessage(await res.blob(), 'Goblin.png');
        } catch {
          toast("The sample picture couldn't be loaded. Try uploading one of your own.", 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Sparkles size={18} aria-hidden="true" />
      Try a sample
    </button>
  );
}
