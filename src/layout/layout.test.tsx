import { render, screen, within } from '@testing-library/react';
import { AdSlot } from './AdSlot';
import { AppShell } from './AppShell';
import { SECTIONS } from './sections';

describe('AppShell (desktop)', () => {
  it('shows the panel sections in the order the owner asked for', () => {
    render(<AppShell />);
    const panel = screen.getByRole('complementary', { name: 'Token settings' });
    const titles = within(panel)
      .getAllByRole('button', { expanded: undefined })
      .filter((b) => b.classList.contains('section__toggle'))
      .map((b) => b.textContent);
    expect(titles).toEqual(SECTIONS.map((s) => s.title));
    expect(titles).toEqual([
      'Import',
      'Image',
      'Background',
      'Frame & shape',
      'Pop-out',
      'Lighting & shadows',
      'Effects',
      'Decorations',
      'Size',
      'Label',
      'Presets',
      'Export',
    ]);
  });

  it('has the top bar, toolbar and Export button', () => {
    const { container } = render(<AppShell />);
    expect(screen.getByRole('switch', { name: 'Batch' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Undo' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('toolbar', { name: 'Image tools' })).toBeInTheDocument();
    const bottomBar = container.querySelector<HTMLElement>('.bottom-bar')!;
    expect(within(bottomBar).getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
  });
});

describe('AdSlot', () => {
  it('is hidden while the feature flag is off', () => {
    render(<AdSlot />);
    expect(screen.queryByTestId('ad-slot')).toBeNull();
  });
  it('appears with a notice when switched on', () => {
    render(<AdSlot enabled />);
    expect(screen.getByText(/keep Token Maker free/)).toBeInTheDocument();
  });
});
