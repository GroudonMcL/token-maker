// Frame Studio designs in the Frame section (DESIGN.md §6.12): opening a
// .framestudio.json file, picking a design again from the ones kept in this
// browser, and sharing one in a preset.
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { helpContent } from '../help/helpContent';
import { createPreset, migratePreset } from '../presets/preset';
import { installSharedImages } from '../presets/presetStore';
import { designLibrary, hasDesign, refreshDesigns, removeDesign, saveDesign } from '../state/designLibrary';
import { getDoc, resetDoc, undo } from '../state/tokenStore';
import { FrameSection } from './FrameSection';

const jewelled = readFileSync('e2e/fixtures/designs/jewelled.framestudio.json', 'utf8');
const nightSky = readFileSync('e2e/fixtures/designs/night-sky.framestudio.json', 'utf8');
// jsdom's File has no text(); browsers' do.
const file = (text: string, name: string) => Object.assign(new File([text], name, { type: 'application/json' }), { text: async () => text });

beforeEach(async () => {
  resetDoc();
  await refreshDesigns();
  for (const d of designLibrary.getState().designs) await removeDesign(d.id);
});

describe('Frame Studio designs', () => {
  it('opens a design file as the frame, keeps it in this browser, and undo brings the drawn frame back', async () => {
    const { container } = render(<FrameSection />);
    fireEvent.click(screen.getByRole('radio', { name: 'Frame Studio' }));
    expect(getDoc().frame.kind).toBe('design');
    expect(await screen.findByText(/No designs yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('design-file-input'), { target: { files: [file(jewelled, 'jewelled.framestudio.json')] } });
    await waitFor(() => expect(getDoc().frame.design?.name).toBe('Jewelled'));
    expect(getDoc().frame.design?.project.layers.length).toBeGreaterThan(3);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Jewelled' })).toBeChecked());
    expect(designLibrary.getState().designs.map((d) => d.name)).toEqual(['Jewelled']);
    // The band controls of a drawn frame work for designs too.
    expect(screen.getByRole('slider', { name: /Thickness/ })).toBeEnabled();
    for (const el of container.querySelectorAll('[data-control]')) expect(Object.keys(helpContent)).toContain(el.getAttribute('data-help-id'));
    undo();
    expect(getDoc().frame.design).toBeNull();
  });

  it('picks another saved design, and refuses a file that is not a design', async () => {
    await saveDesign(jewelled, 'Jewelled');
    await saveDesign(nightSky, 'Night sky');
    render(<FrameSection />);
    fireEvent.click(screen.getByRole('radio', { name: 'Frame Studio' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Night sky' }));
    expect(getDoc().frame.design?.name).toBe('Night sky');
    fireEvent.change(screen.getByTestId('design-file-input'), { target: { files: [file('{"hello": 1}', 'oops.json')] } });
    await new Promise((r) => setTimeout(r, 50));
    expect(getDoc().frame.design?.name).toBe('Night sky');
    expect(designLibrary.getState().designs).toHaveLength(2);
  });

  it('a shared preset carries its design, which is kept in the other browser’s library', async () => {
    render(<FrameSection />);
    fireEvent.click(screen.getByRole('radio', { name: 'Frame Studio' }));
    fireEvent.change(screen.getByTestId('design-file-input'), { target: { files: [file(nightSky, 'night-sky.framestudio.json')] } });
    await waitFor(() => expect(getDoc().frame.design).not.toBeNull());
    const shared = migratePreset(JSON.parse(JSON.stringify(createPreset(getDoc(), 'Starry'))));
    expect(shared.look.frame).toMatchObject({ kind: 'design', design: { name: 'Night sky' } });
    // "Another browser": the design isn't kept here.
    const id = shared.look.frame.design!.id;
    await removeDesign(id);
    expect(await hasDesign(id)).toBe(false);
    await installSharedImages(shared);
    expect(await hasDesign(id)).toBe(true);
  });
});
