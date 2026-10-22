import { fireEvent, render, screen, within } from '@testing-library/react';
import { helpContent } from '../help/helpContent';
import { getDoc, resetDoc, undo } from '../state/tokenStore';
import { EffectsSection } from './EffectsSection';

describe('Effects section', () => {
  beforeEach(() => resetDoc());

  it('adds effects from the picker; the newest goes on top', () => {
    render(<EffectsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Frost$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Mist$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Bloodied$/ }));
    expect(getDoc().effects.map((e) => [e.kind, e.placement])).toEqual([
      ['frost', 'border'],
      ['mist', 'over'],
      ['bloodied', 'over'],
    ]);
    const cards = within(screen.getByRole('list', { name: 'Effects, top first' })).getAllByRole('listitem');
    expect(cards.map((c) => c.getAttribute('data-effect'))).toEqual(['bloodied', 'mist', 'frost']);
  });

  it('reorders, hides and removes effects, each one undo step', () => {
    render(<EffectsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Frost$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Mist$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Frost up' }));
    expect(getDoc().effects.map((e) => e.kind)).toEqual(['mist', 'frost']);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Mist' }));
    expect(getDoc().effects[0]!.visible).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Frost' }));
    expect(getDoc().effects.map((e) => e.kind)).toEqual(['mist']);
    undo();
    expect(getDoc().effects.map((e) => e.kind)).toEqual(['mist', 'frost']);
  });

  it('changes placement, and Shuffle picks a new layout', () => {
    render(<EffectsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Fire$/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Over art' }));
    expect(getDoc().effects[0]!.placement).toBe('over');
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const seed = getDoc().effects[0]!.seed;
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(getDoc().effects[0]!.seed).not.toBe(seed);
  });

  it('every control has a help entry', () => {
    const { container } = render(<EffectsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Charmed$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const ids = [...container.querySelectorAll('[data-control]')].map((el) => el.getAttribute('data-help-id'));
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(Object.keys(helpContent)).toContain(id);
    for (const el of container.querySelectorAll('[data-label-tip]')) expect(Object.keys(helpContent)).toContain(el.getAttribute('data-label-tip'));
  });
});
