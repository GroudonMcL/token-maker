import { render, screen, within } from '@testing-library/react';
import credits from '../../ASSETS-CREDITS.md?raw';
import { AboutPage } from './AboutPage';
import { CREDITS, parseCell, parseCredits } from './credits';
import { PrivacyPage } from './PrivacyPage';

describe('About page credits (DESIGN.md §12)', () => {
  it('reads every row of ASSETS-CREDITS.md', () => {
    const rows = credits.split('\n').filter((l) => /^\|(?!\s*-)/.test(l.trim())).length - 1; // minus the header
    expect(CREDITS.length).toBe(rows);
    expect(CREDITS.length).toBeGreaterThan(20);
  });

  it('turns links and code into parts, and keeps only https links', () => {
    expect(parseCell('Omnibus, via [@fontsource/grenze](https://fontsource.org/fonts/grenze)')).toEqual([
      { text: 'Omnibus, via ' },
      { text: '@fontsource/grenze', href: 'https://fontsource.org/fonts/grenze' },
    ]);
    expect(parseCell('Drawn by `scripts/x.ts`')).toEqual([{ text: 'Drawn by ' }, { text: 'scripts/x.ts', code: true }]);
    expect(parseCell('[bad](javascript:alert(1))')).toEqual([{ text: '[bad](javascript:alert(1))' }]);
    expect(parseCredits('| A | B | C |\n|---|---|---|\n| x | y | z |')).toHaveLength(1);
  });

  it('shows every credit, every font among them', () => {
    render(<AboutPage />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(CREDITS.length + 1);
    for (const font of ['Cinzel', 'Pirata One', 'Atkinson Hyperlegible', 'Lucide icons']) expect(within(table).getAllByText(new RegExp(font)).length).toBeGreaterThan(0);
    expect(within(table).getByRole('link', { name: '@fontsource/grenze' })).toHaveAttribute('href', 'https://fontsource.org/fonts/grenze');
  });
});

describe('Privacy page (DESIGN.md §13)', () => {
  it('says pictures stay on the device and there are no analytics or cookies', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText(/no analytics, no cookies/)).toBeInTheDocument();
    expect(screen.getByText(/never\s+sent to our server/)).toBeInTheDocument();
  });
});
