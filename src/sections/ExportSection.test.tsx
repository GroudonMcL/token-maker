import { act, fireEvent, render, screen } from '@testing-library/react';
import { setBatchMode } from '../batch/batch';
import { DEFAULT_EXPORT, exportSettings, getExportSettings } from '../export/exportSettings';
import { helpContent } from '../help/helpContent';
import { resetDoc, updateDoc } from '../state/tokenStore';
import { ExportSection } from './ExportSection';

beforeEach(() => {
  resetDoc();
  exportSettings.setState(DEFAULT_EXPORT);
  setBatchMode(false);
  localStorage.clear();
});

describe('Export section', () => {
  it('offers PNG and WebP only (no JPG), and remembers the choice', () => {
    render(<ExportSection />);
    expect(screen.queryByRole('radio', { name: 'JPG' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'WebP' }));
    expect(getExportSettings().format).toBe('webp');
    expect(screen.getByRole('button', { name: /Download WebP/ })).toBeInTheDocument();
    // The choice is remembered for next time.
    expect(JSON.parse(localStorage.getItem('tm.export')!)).toMatchObject({ format: 'webp' });
  });

  it('shows the final size for the creature and the cap', () => {
    updateDoc((d) => ({ ...d, size: { preset: 'large', squares: 2 } }));
    render(<ExportSection />);
    expect(screen.getByTestId('export-size')).toHaveTextContent('512 × 512 px');
    fireEvent.click(screen.getByRole('radio', { name: '400' }));
    expect(screen.getByTestId('export-size')).toHaveTextContent('800 × 800 px');
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const box = screen.getByLabelText('Custom pixels per square value');
    fireEvent.change(box, { target: { value: '3000' } });
    fireEvent.blur(box);
    expect(screen.getByTestId('export-size')).toHaveTextContent('4096 × 4096 px — capped');
  });

  it('the file name follows the token name, keeps only safe characters, and resets for a new name', () => {
    updateDoc((d) => ({ ...d, name: 'Goblin Boss' }));
    render(<ExportSection />);
    const input = screen.getByLabelText('File name') as HTMLInputElement;
    expect(input.value).toBe('Goblin-Boss');
    fireEvent.change(input, { target: { value: 'boss: final?' } });
    expect(input.value).toBe('boss final');
    act(() => updateDoc((d) => ({ ...d, name: 'Orc' })));
    expect((screen.getByLabelText('File name') as HTMLInputElement).value).toBe('Orc');
  });

  it('offers "Export all as ZIP" only in batch mode; every control has help', () => {
    const { container, rerender } = render(<ExportSection />);
    expect(screen.queryByRole('button', { name: /Export all as ZIP/ })).toBeNull();
    setBatchMode(true);
    rerender(<ExportSection />);
    expect(screen.getByRole('button', { name: /Export all as ZIP/ })).toBeInTheDocument();
    for (const el of container.querySelectorAll('[data-control]')) expect(Object.keys(helpContent)).toContain(el.getAttribute('data-help-id'));
  });
});
