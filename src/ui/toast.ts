import { createStore } from 'zustand/vanilla';

/** Short messages shown at the bottom of the screen (errors, "Downloaded"). */
export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export const toastStore = createStore<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let next = 1;

export function toast(text: string, tone: Toast['tone'] = 'info', ms = 4500): void {
  const id = next++;
  toastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => toastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}
