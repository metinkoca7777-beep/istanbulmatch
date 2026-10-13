import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { CHAPTERS, LEVELS } from '../src/data/levels';
import { LANDMARK } from '../src/map/landmarks';
import { goalNeeds } from '../src/engine/goals';
import MAPDATA from '../src/map/mapdata.json';

const images = new Set(readdirSync(new URL('../src/assets/img', import.meta.url)).map(f => f.replace(/\.png$/, '')));

describe('level data', () => {
  it('has the 12 stops of the tour in route order', () => {
    expect(LEVELS.map(l => l.name)).toEqual(['Sultanahmet','Topkapı Palace','Eminönü','Grand Bazaar','Süleymaniye','Fener & Balat','Galata','Beyoğlu','Dolmabahçe','Ortaköy','Üsküdar','Kadıköy']);
  });
  it.each(LEVELS.map((l, i) => [i + 1, l] as const))('level %i is well-formed', (_i, L) => {
    if (L.map){
      expect(L.map).toHaveLength(8);
      L.map.forEach(row => expect(row).toMatch(/^[.kKsS]{8}$/));
    }
    expect(L.colors).toBeGreaterThanOrEqual(5); expect(L.colors).toBeLessThanOrEqual(6);
    expect(L.moves).toBeGreaterThan(0);
    for (const g of goalNeeds(L)){
      expect(g.need).toBeGreaterThan(0);
      if (g.kind === 'tile') expect(g.type).toBeLessThan(L.colors);
    }
    expect(LANDMARK[L.icon]).toBeTruthy();
    expect(CHAPTERS[L.district]).toBeTruthy();
    expect(MAPDATA.districts.some(d => d.n === L.district)).toBe(true);
    if (L.npc) expect(images.has(L.npc.k)).toBe(true);
    expect(L.talk.length).toBeGreaterThanOrEqual(2);
  });
  it('ships every image the game draws', () => {
    for (const k of ['t0','t1','t2','t3','t4','t5','ferry','dove','fire','crown','slipper','bolt','broom','die']) expect(images.has(k)).toBe(true);
  });
});
