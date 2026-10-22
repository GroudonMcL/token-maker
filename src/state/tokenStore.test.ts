import { createDocument } from '../document/defaults';
import { commitDoc, docHistory, getDoc, redo, resetDoc, undo, updateDoc } from './tokenStore';

beforeEach(() => resetDoc());

describe('token store undo/redo (DESIGN.md §4.3)', () => {
  it('undoes and redoes document changes', () => {
    updateDoc((d) => ({ ...d, shape: 'hexagon' }));
    updateDoc((d) => ({ ...d, name: 'Owlbear' }));
    undo();
    expect(getDoc().name).toBe(createDocument().name);
    expect(getDoc().shape).toBe('hexagon');
    undo();
    expect(getDoc().shape).toBe('circle');
    redo();
    redo();
    expect(getDoc()).toMatchObject({ shape: 'hexagon', name: 'Owlbear' });
  });

  it('a slider drag is one undo step', () => {
    for (const t of [0.15, 0.2, 0.3]) updateDoc((d) => ({ ...d, frame: { ...d.frame, thickness: t } }), { transient: true });
    commitDoc();
    expect(docHistory.getState().past).toHaveLength(1);
    undo();
    expect(getDoc().frame.thickness).toBe(0.14);
  });

  it('undo during an unfinished drag goes back to before the drag', () => {
    updateDoc((d) => ({ ...d, frame: { ...d.frame, thickness: 0.3 } }), { transient: true });
    undo();
    expect(getDoc().frame.thickness).toBe(0.14);
  });

  it('starting a new token forgets history', () => {
    updateDoc((d) => ({ ...d, shape: 'square' }));
    resetDoc();
    expect(docHistory.getState().past).toHaveLength(0);
    expect(getDoc().shape).toBe('circle');
  });
});
