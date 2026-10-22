import { useEffect, useState } from 'react';
import { isImageFile } from '../import/decode';
import { toast } from '../ui/toast';
import { importWithMessage } from './importWithMessage';

const WEB_LINKS_LATER = 'Importing from web links arrives in a later update. For now, save the image and upload it.';

/**
 * Drag and drop anywhere on the page, and paste (DESIGN.md §6.1).
 * Returns true while files are being dragged over the page.
 */
export function useGlobalImport(): boolean {
  const [over, setOver] = useState(false);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].some((t) => t === 'Files' || t === 'text/uri-list');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setOver(false);
      if (!e.dataTransfer) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find((f) => isImageFile(f));
      if (file) void importWithMessage(file);
      else if (e.dataTransfer.files.length) toast("That isn't an image file. Try PNG, JPG, WebP, GIF, AVIF, BMP or SVG.", 'error');
      else if (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')) toast(WEB_LINKS_LATER, 'error');
    };
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;
      const item = [...data.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void importWithMessage(file, file.name && file.name !== 'image.png' ? file.name : '');
        return;
      }
      // Pasting text into a text box stays normal pasting.
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      const text = data.getData('text/plain').trim();
      if (/^https?:\/\//i.test(text)) toast(WEB_LINKS_LATER, 'error');
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  return over;
}
