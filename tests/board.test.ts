import { describe, expect, it } from 'vitest';
import { Board, C, R, groupSpecial, placeFor } from '../src/engine/board';
import { NOMATCH, seeded, setTiles, types } from './helpers';

const board = (rows = NOMATCH, map?: string[], seed = 1) => {
  const b = new Board(seeded(seed)); b.colors = 5; b.build(map); setTiles(b, rows); return b;
};
const rows = (...patch: [number, string][]) => { const r = [...NOMATCH]; patch.forEach(([i, s]) => r[i] = s); return r; };

describe('build', () => {
  it('parses kilims and chests from the level map', () => {
    const b = new Board(); b.build(['kK.sS...', ...Array(7).fill('........')]);
    const row = b.grid[0];
    expect(row.map(c => c.k)).toEqual([1,2,0,0,0,0,0,0]);
    expect(row[3].b).toEqual({ hp:1, shake:0 });
    expect(row[4].b).toEqual({ hp:2, shake:0 });
    expect(b.grid[1][0]).toEqual({ t:null, b:null, k:0 });
  });
  it('builds an empty 8×8 grid without a map', () => {
    const b = new Board(); b.build();
    expect(b.grid).toHaveLength(R); b.grid.forEach(r => expect(r).toHaveLength(C));
  });
});

describe('fillInitial', () => {
  it('deals a board with no ready-made match and at least one move', () => {
    for (let seed = 1; seed <= 30; seed++){
      const b = new Board(seeded(seed)); b.colors = 5 + seed % 2; b.build(); b.fillInitial();
      expect(b.findGroups()).toEqual([]);
      expect(b.findMove()).not.toBeNull();
    }
  });
  it('leaves chest cells empty and drops tiles in from above the board', () => {
    const b = new Board(seeded(3)); b.build(['........','...S....', ...Array(6).fill('........')]); b.fillInitial();
    expect(b.grid[1][3].t).toBeNull();
    expect(b.grid[0][0].t!.y).toBe(0 - R - 1);
  });
  it('only uses the level\'s colours', () => {
    const b = new Board(seeded(9)); b.colors = 5; b.build(); b.fillInitial();
    b.grid.flat().forEach(cell => expect(cell.t!.type).toBeLessThan(5));
  });
  it('is deterministic for a given random source', () => {
    const deal = () => { const b = new Board(seeded(42)); b.build(); b.fillInitial(); return types(b); };
    expect(deal()).toEqual(deal());
  });
});

describe('matching', () => {
  it('finds horizontal, vertical and 2×2 matches', () => {
    expect(board(rows([0,'44412301'])).matchAt(0,1)).toBe(true);
    const v = board(rows([0,'41230123'],[1,'43012301'],[2,'41230123']));
    expect(v.matchAt(2,0)).toBe(true);
    const sq = board(rows([0,'44230123'],[1,'44012301']));
    expect(sq.matchAt(1,1)).toBe(true);
    expect(board().matchAt(3,3)).toBe(false);
  });
  it('never matches special tiles', () => {
    const b = board(rows([0,'hhh30123']));
    expect(b.matchAt(0,0)).toBe(false);
    expect(b.findGroups()).toEqual([]);
  });
  it('merges an L into one group and classifies specials', () => {
    // L: row 2 cols 0-2 plus col 0 rows 0-2 → fire (mangal)
    const L = board(rows([0,'41230123'],[1,'43012301'],[2,'44430123']));
    const gs = L.findGroups();
    expect(gs).toHaveLength(1);
    expect(gs[0].cells.size).toBe(5);
    expect(groupSpecial(gs[0])).toBe('mangal');
    expect(placeFor(gs[0], null)).toBe(2*C + 0); // the crossing cell
  });
  it('5 in a row → crown, 4 → ferry with direction, 2×2 → dove, 3 → nothing', () => {
    expect(groupSpecial(board(rows([0,'44444123'])).findGroups()[0])).toBe('nazar');
    expect(groupSpecial(board(rows([0,'44441023'])).findGroups()[0])).toBe('vh');
    const v4 = board(rows([0,'41230123'],[1,'43012301'],[2,'41230123'],[3,'43012301']));
    expect(groupSpecial(v4.findGroups()[0])).toBe('vv');
    expect(groupSpecial(board(rows([0,'44230123'],[1,'44012301'])).findGroups()[0])).toBe('marti');
    expect(groupSpecial(board(rows([0,'44410123'])).findGroups()[0])).toBeNull();
  });
  it('places the special on the swapped cell when it is part of the group', () => {
    const g = board(rows([0,'44441023'])).findGroups()[0];
    expect(placeFor(g, [[0,3],[1,3]])).toBe(3);
    expect(placeFor(g, [[5,5]])).toBe(2); // fallback: middle of sorted cells
  });
});

describe('findMove', () => {
  it('returns a swap that creates a match', () => {
    const b = board(rows([0,'44140123']));
    const m = b.findMove()!;
    expect(m).toHaveLength(2);
    const [[r1,c1],[r2,c2]] = m;
    const A = b.grid[r1][c1], B = b.grid[r2][c2];
    [A.t, B.t] = [B.t, A.t];
    expect(b.matchAt(r1,c1) || b.matchAt(r2,c2)).toBe(true);
  });
  it('falls back to a special tile when there is no swap, else null', () => {
    expect(board().findMove()).toBeNull();
    expect(board(rows([3,'2301230f'])).findMove()).toEqual([[3,7]]);
  });
});

describe('applyGravity', () => {
  it('drops tiles into holes and refills from the top', () => {
    const b = board(rows([7,'........']));
    const above = b.grid[6][2].t;
    b.applyGravity();
    expect(b.grid[7][2].t).toBe(above);
    b.grid.flat().forEach(cell => expect(cell.t).not.toBeNull());
    // new tiles spawn above row 0 so they fall in
    expect(b.grid[0][2].t!.y).toBeLessThan(0);
  });
  it('tiles never fall through chests; holes under a chest fill diagonally', () => {
    const map = ['........','........','........','...s....','........','........','........','........'];
    const b = board(rows([4,'2301.301']), map);
    const chest = b.grid[3][3].b;
    b.applyGravity();
    expect(b.grid[3][3].b).toBe(chest);
    expect(b.grid[3][3].t).toBeNull();
    expect(b.grid[4][4].t).not.toBeNull(); // filled from a diagonal neighbour
    b.grid.flat().forEach(cell => { if (!cell.b) expect(cell.t).not.toBeNull(); });
  });
});

describe('shuffle', () => {
  it('reorders the same tiles, ends with a move and no match, and leaves specials in place', () => {
    for (let seed = 1; seed <= 10; seed++){
      const b = new Board(seeded(seed)); b.colors = 5; b.build(); b.fillInitial();
      const fire = b.newTile(-1, 'mangal'); b.grid[0][0].t = fire;
      const before = b.grid.flat().map(c => c.t!.id).sort();
      b.shuffle();
      expect(b.grid[0][0].t).toBe(fire);
      expect(b.grid.flat().map(c => c.t!.id).sort()).toEqual(before);
      expect(b.findGroups()).toEqual([]);
      expect(b.findMove()).not.toBeNull();
    }
  });
});

describe('mostCommonColor', () => {
  it('picks the most frequent colour, lowest index on ties', () => {
    expect(board().mostCommonColor()).toBe(0);
    expect(board(rows([0,'33333333'])).mostCommonColor()).toBe(3);
  });
});
