import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useStore } from 'zustand';
import { ColorSwatches, HelpTip, ImageStrip, SegmentedButtons, Section, Slider, TileGrid, Toggle } from '.';
import { createHistoryStore } from '../state/history';

describe('Slider', () => {
  function Harness({ store }: { store: ReturnType<typeof createHistoryStore<number>> }) {
    const [v, setV] = useState(store.getState().present);
    return (
      <Slider
        label="Brightness"
        helpId="kit.slider"
        min={-100}
        max={100}
        value={v}
        onChange={(n) => {
          setV(n);
          store.getState().set(n, { transient: true });
        }}
        onCommit={() => store.getState().commit()}
      />
    );
  }

  it('turns one drag into one undo step', () => {
    const store = createHistoryStore(0);
    render(<Harness store={store} />);
    const range = screen.getByRole('slider', { name: 'Brightness' });
    fireEvent.pointerDown(range);
    for (const v of [5, 10, 20, 40]) fireEvent.change(range, { target: { value: String(v) } });
    fireEvent.pointerUp(window);
    expect(store.getState().present).toBe(40);
    expect(store.getState().past).toEqual([0]);
  });

  it('accepts a typed number, clamped to the range', async () => {
    const store = createHistoryStore(0);
    render(<Harness store={store} />);
    const box = screen.getByRole('textbox', { name: 'Brightness value' });
    await userEvent.clear(box);
    await userEvent.type(box, '250{Enter}');
    expect(store.getState().present).toBe(100);
    expect(store.getState().past).toEqual([0]);
  });

  it('shows the current value', () => {
    render(<Slider label="Hue" helpId="kit.slider" min={0} max={10} value={7} onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Hue value' })).toHaveValue('7');
  });

  it('marks the default value with a notch, and has no "?" button of its own', () => {
    const { container } = render(<Slider label="Hue" helpId="kit.slider" min={0} max={10} value={7} defaultValue={5} onChange={() => {}} />);
    expect(container.querySelector('.slider__notch')).toHaveStyle({ left: 'calc(var(--thumb) / 2 + (100% - var(--thumb)) * 0.5)' });
    // Its only button is the reset button.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Reset Hue']);
  });

  it('has a reset button that puts the default back as one undo step, and is off at the default', async () => {
    const store = createHistoryStore(7);
    const Wired = () => {
      const v = useStore(store, (s) => s.present);
      return <Slider label="Hue" helpId="kit.slider" min={0} max={10} value={v} defaultValue={5} onChange={(x) => store.getState().set(x, { transient: true })} onCommit={() => store.getState().commit()} />;
    };
    render(<Wired />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset Hue' }));
    expect(store.getState().present).toBe(5);
    expect(store.getState().past).toEqual([7]);
    expect(screen.getByRole('button', { name: 'Reset Hue' })).toBeDisabled();
  });

  it('has no reset button without a default value', () => {
    render(<Slider label="Hue" helpId="kit.slider" min={0} max={10} value={7} onChange={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Section', () => {
  it('collapses and expands, with a closed Advanced drop-down', async () => {
    render(
      <Section title="Image" helpId="section.image" advanced={<p>Hue stuff</p>}>
        <p>Main stuff</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: 'Image' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Main stuff')).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByText('Main stuff')).toBeVisible();
    expect(screen.getByText('Hue stuff')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByText('Hue stuff')).toBeVisible();
  });
});

describe('SegmentedButtons', () => {
  it('selects with click and arrow keys', async () => {
    function H() {
      const [v, setV] = useState<'a' | 'b' | 'c'>('a');
      return (
        <SegmentedButtons
          label="Shape"
          helpId="kit.segmented"
          value={v}
          onChange={setV}
          options={[
            { value: 'a', label: 'Circle' },
            { value: 'b', label: 'Hexagon' },
            { value: 'c', label: 'Square' },
          ]}
        />
      );
    }
    render(<H />);
    await userEvent.click(screen.getByRole('radio', { name: 'Hexagon' }));
    expect(screen.getByRole('radio', { name: 'Hexagon' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Square' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Square' })).toHaveFocus();
  });
});

describe('ColorSwatches', () => {
  it('picks a swatch and accepts a typed hex code', async () => {
    const onChange = vi.fn();
    render(<ColorSwatches label="Colour" helpId="kit.swatches" value="#111111" swatches={['#111111', '#222222']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '#222222' }));
    expect(onChange).toHaveBeenLastCalledWith('#222222');
    const hex = screen.getByRole('textbox', { name: 'Colour hex code' });
    await userEvent.clear(hex);
    await userEvent.type(hex, 'ABCDEF{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('#abcdef');
  });
});

describe('TileGrid and ImageStrip', () => {
  it('selects a tile', async () => {
    const onChange = vi.fn();
    render(
      <TileGrid
        label="Frame"
        helpId="kit.tiles"
        value="a"
        onChange={onChange}
        tiles={[
          { id: 'a', label: 'Stamped', preview: null, group: 'Classic' },
          { id: 'b', label: 'Oak', preview: null, group: 'Textures' },
        ]}
      />,
    );
    expect(screen.getByText('Textures')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Oak' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('shows an empty message with no images', () => {
    render(<ImageStrip label="Images" helpId="kit.strip" images={[]} value={undefined} onChange={() => {}} emptyText="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('is a switch', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Batch" helpId="topbar.batch" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Batch' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('HelpTip', () => {
  it('opens on click, describes the button for screen readers, and closes with Escape', async () => {
    render(<HelpTip id="section.image" />);
    const btn = screen.getByRole('button', { name: 'Help: Image' });
    expect(btn).toHaveAccessibleDescription(/Adjust brightness/);
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toBeVisible();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveFocus();
  });
});
