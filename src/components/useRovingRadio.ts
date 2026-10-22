import { useRef, type KeyboardEvent } from 'react';

/**
 * Keyboard support for a group of radio-style buttons (segmented buttons,
 * tile grid, image strip): arrow keys move and select, Home/End jump.
 * Only the selected item is in the Tab order.
 */
export function useRovingRadio<V>(values: readonly V[], selected: V | undefined, onSelect: (v: V) => void) {
  const refs = useRef<(HTMLElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent) => {
    const current = Math.max(0, values.indexOf(selected as V));
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % values.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + values.length) % values.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = values.length - 1;
    else return;
    e.preventDefault();
    onSelect(values[next] as V);
    refs.current[next]?.focus();
  };

  const itemProps = (v: V, i: number) => {
    const isSelected = v === selected || (selected === undefined && i === 0);
    return {
      ref: (el: HTMLElement | null) => {
        refs.current[i] = el;
      },
      role: 'radio' as const,
      'aria-checked': v === selected,
      tabIndex: isSelected ? 0 : -1,
      onClick: () => onSelect(v),
    };
  };

  return { onKeyDown, itemProps };
}
