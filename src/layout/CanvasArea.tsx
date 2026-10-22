import { ImagePlus } from 'lucide-react';
import { FloatingToolbar } from './FloatingToolbar';

/** The central canvas well. Shows an empty state until the renderer arrives (later phase). */
export function CanvasArea() {
  return (
    <main className="canvas-area" aria-label="Token preview">
      <FloatingToolbar />
      <div className="canvas-area__stage">
        <div className="empty-token" aria-hidden="true">
          <div className="empty-token__ring" />
          <ImagePlus className="empty-token__icon" size={40} strokeWidth={1.4} />
        </div>
        <p className="canvas-area__hint">
          <strong>Drop, paste or upload an image</strong>
          <span>to start your token</span>
        </p>
      </div>
    </main>
  );
}
