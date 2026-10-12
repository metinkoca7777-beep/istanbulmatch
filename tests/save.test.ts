import { describe, expect, it } from 'vitest';
import { SKEY, defaultSave, loadSave, persistSave, recordWin, starsFor } from '../src/engine/save';

const mem = (init?: string) => { const m = new Map<string, string>(); if (init !== undefined) m.set(SKEY, init); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };

describe('save', () => {
  it('starts with 3 slippers, 2 of each other booster and level 1 unlocked', () => {
    expect(loadSave(mem())).toEqual({ unlocked:1, stars:[], boost:{ terlik:3, supurge:2, oklava:2, zar:2 }, sound:true, music:true });
  });
  it('keeps the original storage key so existing players keep their progress', () => {
    expect(SKEY).toBe('tatli-kavga-v1');
  });
  it('merges a stored save over the defaults (old saves without new boosters still work)', () => {
    const s = loadSave(mem(JSON.stringify({ unlocked:5, stars:[3,2], boost:{ terlik:7 }, sound:false })));
    expect(s).toEqual({ unlocked:5, stars:[3,2], boost:{ terlik:7, supurge:2, oklava:2, zar:2 }, sound:false, music:true });
  });
  it('survives corrupt JSON and missing storage', () => {
    expect(loadSave(mem('{nope'))).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
    expect(loadSave({ getItem: () => { throw new Error('denied'); }, setItem: () => {} })).toEqual(defaultSave());
  });
  it('round-trips through storage', () => {
    const st = mem(), s = defaultSave(); s.unlocked = 4;
    persistSave(st, s);
    expect(loadSave(st)).toEqual(s);
    expect(() => persistSave({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, s)).not.toThrow();
  });
});

describe('stars', () => {
  it('3 stars at ≥30% moves left, 2 at ≥12%, else 1', () => {
    expect(starsFor(6, 20)).toBe(3);
    expect(starsFor(5, 20)).toBe(2);
    expect(starsFor(3, 25)).toBe(2);
    expect(starsFor(2, 25)).toBe(1);
    expect(starsFor(0, 20)).toBe(1);
  });
});

describe('recordWin', () => {
  it('unlocks the next stop, keeps best stars and gives a slipper', () => {
    const s = defaultSave();
    recordWin(s, 0, 2, 12);
    expect(s.unlocked).toBe(2); expect(s.stars).toEqual([2]);
    expect(s.boost).toEqual({ terlik:4, supurge:2, oklava:2, zar:2 });
    recordWin(s, 0, 1, 12);
    expect(s.stars).toEqual([2]); expect(s.unlocked).toBe(2);
  });
  it('3 stars also give broom, lightning and dice', () => {
    const s = defaultSave();
    recordWin(s, 3, 3, 12);
    expect(s.boost).toEqual({ terlik:4, supurge:3, oklava:3, zar:3 });
  });
  it('caps boosters at 9 and never unlocks past the last level', () => {
    const s = defaultSave(); s.boost = { terlik:9, supurge:9, oklava:9, zar:9 }; s.unlocked = 12;
    recordWin(s, 11, 3, 12);
    expect(s.boost).toEqual({ terlik:9, supurge:9, oklava:9, zar:9 });
    expect(s.unlocked).toBe(12);
  });
});
