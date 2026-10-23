import { safeFileName } from '../export/exportSettings';
import { tidyName } from './importImage';

describe('token names from file names', () => {
  it.each([
    ['goblin_boss.png', 'Goblin Boss'],
    ['red-dragon-ADULT.webp', 'red dragon ADULT'],
    ['OwlbearCub.jpg', 'Owlbear Cub'],
    ['  mind  flayer .jpeg', 'Mind Flayer'],
    ['image.png', ''],
    ['Screenshot 2024.png', ''],
  ])('%s → "%s"', (file, name) => {
    expect(tidyName(file)).toBe(name);
  });
});

describe('safe file names', () => {
  it.each([
    ['Goblin Boss', 'Goblin-Boss.png'],
    ['Zoë the Bard!', 'Zoe-the-Bard.png'],
    ['../../etc/passwd', 'etcpasswd.png'],
    ['', 'token.png'],
    ['???', 'token.png'],
  ])('%s → %s', (name, file) => {
    expect(safeFileName(name, 'png')).toBe(file);
  });
});
