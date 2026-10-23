import { useEffect, useState } from 'react';
import { isBatchOn } from '../batch/batch';
import { isImageFile } from '../import/decode';
import { addressFromDrop, normaliseAddress } from '../import/webAddress';
import { importFromAddress, importManyAddresses, splitAddresses } from '../import/webImport';
import { toast } from '../ui/toast';
import { importFiles, importWithMessage } from './importWithMessage';

/**
 * Drag and drop anywhere on the page, and paste (DESIGN.md §6.1).
 * Returns true while files are being dragged over the page.
 */
export function useGlobalImport(): boolean {
  const [over, setOver] = useState(false);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      [...(e.dataTransfer?.types ?? [])].some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/html');
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
      // Batch mode takes every picture dropped at once (DESIGN.md §6.1).
      if (file && isBatchOn()) void importFiles([...e.dataTransfer.files]);
      else if (file) void importWithMessage(file);
      else if (e.dataTransfer.files.length) toast("That isn't an image file. Try PNG, JPG, WebP, GIF, AVIF, BMP or SVG.", 'error');
      else {
        // An image or link dragged from another browser tab (DESIGN.md §6.1 item 2).
        const dt = e.dataTransfer;
        const address = addressFromDrop({ html: dt.getData('text/html'), uriList: dt.getData('text/uri-list'), text: dt.getData('text/plain') });
        if (!address || !importFromAddress(address, 'drop')) toast("That isn't an image or a web address.", 'error');
      }
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
      // A pasted web address goes through the web import (DESIGN.md §6.1 item 3).
      const text = data.getData('text/plain').trim();
      const many = isBatchOn() ? splitAddresses(text) : [];
      if (many.length > 1) {
        e.preventDefault();
        void importManyAddresses(many, 'paste');
      } else if (/^https?:\/\//i.test(text) && normaliseAddress(text)) {
        e.preventDefault();
        importFromAddress(text, 'paste');
      } else if (/^data:image\//i.test(text)) {
        e.preventDefault();
        importFromAddress(text, 'paste');
      }
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
