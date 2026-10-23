import { useId, useRef, type ReactNode } from 'react';
import { useBatch } from '../batch/batch';
import { ACCEPTED_TYPES } from '../import/decode';
import type { ImportTarget } from '../import/importImage';
import { importFiles, importWithMessage } from './importWithMessage';

/**
 * A button that opens the file picker and imports the chosen image (as the
 * art, unless `target` says otherwise). In batch mode, art uploads take
 * several pictures at once (DESIGN.md §6.1).
 */
export function UploadButton({
  children,
  className = 'btn btn--primary',
  target = 'art',
  multiple: wantsMany = false,
}: {
  children: ReactNode;
  className?: string;
  target?: ImportTarget;
  multiple?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const batchOn = useBatch((b) => b.on);
  const multiple = target === 'art' && (wantsMany || batchOn);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        id={id}
        type="file"
        accept={[...ACCEPTED_TYPES, '.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp,.svg'].join(',')}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        multiple={multiple}
        data-testid={target === 'art' ? 'file-input' : `${target}-file-input`}
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (multiple) await importFiles(files);
          else if (files[0]) await importWithMessage(files[0], undefined, target);
        }}
      />
    </>
  );
}
