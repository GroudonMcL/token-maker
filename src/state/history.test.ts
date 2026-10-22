import { createHistoryStore } from './history';

describe('createHistoryStore', () => {
  it('records one undo step per set', () => {
    const s = createHistoryStore(0);
    s.getState().set(1);
    s.getState().set(2);
    s.getState().undo();
    expect(s.getState().present).toBe(1);
    s.getState().undo();
    expect(s.getState().present).toBe(0);
    s.getState().redo();
    expect(s.getState().present).toBe(1);
  });

  it('turns a whole drag (transient sets + commit) into one step', () => {
    const s = createHistoryStore(10);
    for (const v of [11, 14, 20, 35]) s.getState().set(v, { transient: true });
    s.getState().commit();
    expect(s.getState().past).toEqual([10]);
    s.getState().undo();
    expect(s.getState().present).toBe(10);
  });

  it('ignores a drag that ends where it started', () => {
    const s = createHistoryStore(5);
    s.getState().set(8, { transient: true });
    s.getState().set(5, { transient: true });
    s.getState().commit();
    expect(s.getState().past).toEqual([]);
  });

  it('clears redo after a new change', () => {
    const s = createHistoryStore('a');
    s.getState().set('b');
    s.getState().undo();
    s.getState().set('c');
    expect(s.getState().future).toEqual([]);
  });

  it('caps history length', () => {
    const s = createHistoryStore(0, 3);
    for (let i = 1; i <= 10; i++) s.getState().set(i);
    expect(s.getState().past).toEqual([7, 8, 9]);
  });
});
