import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createDocument } from '../document/defaults';
import { selectDecoration } from '../editor/tools';
import { helpContent } from '../help/helpContent';
import { createPreset, presetToCode } from '../presets/preset';
import { savedPresets } from '../presets/presetStore';
import { getDoc, resetDoc, undo } from '../state/tokenStore';
import { DecorationsSection } from './DecorationsSection';
import { FrameSection } from './FrameSection';
import { PresetsSection } from './PresetsSection';

// Picture frames need a real browser to decode; pretend every frame is a ring with a round hole.
vi.mock('../state/frameLibrary', async (original) => ({
  ...(await original<typeof import('../state/frameLibrary')>()),
  prepareImageFrame: async (source: { type: 'library' | 'upload'; id: string }, name: string) => ({
    source,
    name,
    hole: [0.7, 0, 0, 0.7, -0.7, 0, 0, -0.7],
    outer: 0.95,
    nudge: { x: 0, y: 0, scale: 1 },
    found: true,
    open: false,
  }),
}));

const helpIds = (container: HTMLElement) => {
  const ids = [...container.querySelectorAll('[data-control]')].map((el) => el.getAttribute('data-help-id'));
  expect(ids.length).toBeGreaterThan(3);
  for (const id of ids) expect(Object.keys(helpContent)).toContain(id);
};

beforeEach(() => {
  resetDoc();
  selectDecoration(null);
});

describe('Decorations section', () => {
  it('adds decorations snapped to the frame; horns start mirrored', () => {
    render(<DecorationsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Horn$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Gem$/ }));
    expect(getDoc().decorations.map((d) => [d.kind, d.place, d.mirror])).toEqual([
      ['horn', 'topRight', true],
      ['gem', 'top', false],
    ]);
    const cards = within(screen.getByRole('list', { name: 'Decorations, top first' })).getAllByRole('listitem');
    expect(cards.map((c) => c.getAttribute('data-decoration'))).toEqual(['gem', 'horn']);
  });

  it('moves it to another snap point or frees it, mirrors, removes, and undoes', () => {
    render(<DecorationsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Wing$/ }));
    const card = screen.getByRole('list', { name: 'Decorations, top first' });
    fireEvent.click(within(card).getByRole('radio', { name: 'Bottom left' }));
    expect(getDoc().decorations[0]!.place).toBe('bottomLeft');
    fireEvent.click(within(card).getByRole('switch', { name: 'Mirror on the other side' }));
    expect(getDoc().decorations[0]!.mirror).toBe(false);
    fireEvent.click(within(card).getByRole('radio', { name: 'Free' }));
    const d = getDoc().decorations[0]!;
    expect(d.place).toBe('free');
    expect(d.x).toBeLessThan(0); // stays where it was, on the bottom left
    expect(d.y).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Wing' }));
    expect(getDoc().decorations).toEqual([]);
    undo();
    expect(getDoc().decorations).toHaveLength(1);
  });

  it('every control has a help entry', () => {
    const { container } = render(<DecorationsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Skull$/ }));
    helpIds(container);
  });
});

describe('Frame section: picture frames', () => {
  it('switches to a picture frame and back, keeping the drawn frame’s settings', async () => {
    const { container } = render(<FrameSection />);
    const before = getDoc().frame.style;
    fireEvent.click(screen.getByRole('radio', { name: 'Picture' }));
    await waitFor(() => expect(getDoc().frame.kind).toBe('image'));
    expect(getDoc().frame.image?.source).toEqual({ type: 'library', id: 'gilded-laurel' });
    expect(screen.getByRole('button', { name: 'Upload a frame' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset the hole' })).toBeDisabled();
    helpIds(container);
    fireEvent.click(screen.getByRole('radio', { name: /^Rope$/ }));
    await waitFor(() => expect(getDoc().frame.image?.source.id).toBe('rope'));
    fireEvent.click(screen.getByRole('radio', { name: 'Drawn' }));
    expect(getDoc().frame.kind).toBe('code');
    expect(getDoc().frame.style).toBe(before);
  });
});

describe('Presets section', () => {
  beforeEach(() => savedPresets.setState({ presets: [], loaded: false }));

  it('applies a built-in preset as one undo step, keeping the art and name', () => {
    resetDoc({ ...createDocument('Goblin'), art: { ...createDocument().art, assetId: 'asset:g' } });
    render(<PresetsSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Fiend$/ }));
    expect(getDoc().frame.presetId).toBe('infernal');
    expect(getDoc().decorations.map((d) => d.kind)).toEqual(['horn']);
    expect(getDoc().name).toBe('Goblin');
    expect(getDoc().art.assetId).toBe('asset:g');
    undo();
    expect(getDoc().frame.presetId).toBe('stamped');
  });

  it('saves the look, copies its code, and adds a pasted code', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { container } = render(<PresetsSection />);
    helpIds(container);
    fireEvent.change(screen.getByLabelText('Save this look'), { target: { value: 'Blue thing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Your presets' });
    expect(within(list).getByRole('button', { name: 'Blue thing' })).toBeInTheDocument();
    await act(async () => fireEvent.click(within(list).getByRole('button', { name: 'Copy the code for Blue thing' })));
    await waitFor(() => expect(writes[0]).toMatch(/^TKP1\./));
    // The code also shows in a box, for browsers that can't copy.
    expect(((await screen.findByTestId('preset-code')) as HTMLTextAreaElement).value).toBe(writes[0]);

    const shared = createDocument();
    shared.shape = 'hexagon';
    const code = await presetToCode(createPreset(shared, 'Hex friend'));
    fireEvent.change(screen.getByPlaceholderText(/Paste a preset code/), { target: { value: code } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add the code' })));
    await waitFor(() => expect(getDoc().shape).toBe('hexagon'));
    expect(within(screen.getByRole('list', { name: 'Your presets' })).getByRole('button', { name: 'Hex friend' })).toBeInTheDocument();
  });
});
