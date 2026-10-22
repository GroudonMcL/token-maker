import { useId, useRef, type ReactNode } from 'react';
import { ACCEPTED_TYPES } from '../import/decode';
import { importWithMessage } from './importWithMessage';

/** A button that opens the file picker and imports the chosen image. */
export function UploadButton({ children, className = 'btn btn--primary' }: { children: ReactNode; className?: string }) {
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
        data-testid="file-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) await importWithMessage(file);
        }}
      />
    </>
  );
}
