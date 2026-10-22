import { useId, useRef, type ReactNode } from 'react';
import { ACCEPTED_TYPES } from '../import/decode';
import type { ImportTarget } from '../import/importImage';
import { importWithMessage } from './importWithMessage';

/** A button that opens the file picker and imports the chosen image (as the art, unless `target` says otherwise). */
export function UploadButton({
  children,
  className = 'btn btn--primary',
  target = 'art',
}: {
  children: ReactNode;
  className?: string;
  target?: ImportTarget;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
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
        data-testid={target === 'art' ? 'file-input' : `${target}-file-input`}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) await importWithMessage(file, undefined, target);
        }}
      />
    </>
  );
}
