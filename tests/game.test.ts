import { describe, expect, it } from 'vitest';
import { C, R } from '../src/engine/board';
import { NOMATCH, newGame, setTiles, types } from './helpers';

const rows = (...patch: [number, string][]) => { const r = [...NOMATCH]; patch.forEach(([i, s]) => r[i] = s); return r; };
const countType = (g: ReturnType<typeof newGame>['game'], t: number) => g.grid.flat().filter(c => c.t && c.t.type === t).length;

describe('start', () => {
  it('sets up moves, colours and goals from the level', () => {
    const { game } = newGame({ moves: 24, colors: 6, map: ['........','........','..kkkk..','.kKkkkk.','.kkkkkk.','..kkkk..','.s....S.','........'], goals: [{ kind:'kilim' }, { kind:'sandik' }, { kind:'tile', type:2, need:7 }] });
    expect(game.movesLeft).toBe(24);
    expect(game.board.colors).toBe(6);
    expect(game.goals.map(g => [g.kind, g.need, g.got])).toEqual([['kilim', 21, 0], ['sandik', 2, 0], ['tile', 7, 0]]);
    expect(game.board.findGroups()).toEqual([]);
  });
});

describe('trySwap', () => {
  it('bounces back a swap that makes no match and costs no move', async () => {
    const { game, log } = newGame();
    setTiles(game.board, NOMATCH);
    const before = types(game.board);
    await game.trySwap({ r:0, c:0 }, { r:0, c:1 });
    expect(types(game.board)).toEqual(before);
    expect(game.movesLeft).toBe(20);
    expect(game.busy).toBe(false);
    expect(log.sfx).toEqual(['swap', 'nope']);
  });

  it('a matching swap costs one move, clears the tiles and counts toward the goal', async () => {
    const { game } = newGame({ goals: [{ kind:'tile', type:4, need:30 }] });
    setTiles(game.board, rows([0,'44140123']));
    await game.trySwap({ r:0, c:3 }, { r:0, c:2 });
    expect(game.movesLeft).toBe(19);
    expect(game.goals[0].got).toBeGreaterThanOrEqual(3);
    expect(game.board.findGroups()).toEqual([]);
    game.grid.flat().forEach(cell => expect(cell.t).not.toBeNull());
    expect(game.busy).toBe(false);
  });

  it('ignores input while busy and swaps involving chests', async () => {
    const { game } = newGame({ map: ['s.......', ...Array(7).fill('........')] });
    const before = types(game.board);
    await game.trySwap({ r:0, c:0 }, { r:0, c:1 });
    expect(types(game.board)).toEqual(before);
    game.busy = true;
    await game.trySwap({ r:1, c:0 }, { r:1, c:1 });
    expect(types(game.board)).toEqual(before);
    expect(game.movesLeft).toBe(20);
  });

  it('a 4-match leaves a ferry on the swapped cell', async () => {
    const { game } = newGame({ colors: 4 });
    // Swapping (1,3)↔(0,3) completes 4444 on row 0 → horizontal ferry at (0,3).
    setTiles(game.board, rows([0,'44412301'],[1,'23042301']));
    const created: string[] = [];
    const orig = game.clearGroups.bind(game);
    game.clearGroups = (g, p) => { const r = orig(g, p); created.push(...r); return r; };
    await game.trySwap({ r:1, c:3 }, { r:0, c:3 });
    expect(created[0]).toBe('vh');
  });
});

describe('detonations', () => {
  it('ferry clears its row (vh) or column (vv)', async () => {
    const { game } = newGame();
    setTiles(game.board, NOMATCH);
    await game.detonate({ r:3, c:2, special:'vh' });
    expect(types(game.board)[3]).toBe('........');
    setTiles(game.board, NOMATCH);
    await game.detonate({ r:3, c:2, special:'vv' });
    expect(types(game.board).map(r => r[2]).join('')).toBe('........');
  });

  it('fire clears a 5×5 diamond-ish area (corners spared)', async () => {
    const { game } = newGame();
    setTiles(game.board, NOMATCH);
    await game.detonate({ r:3, c:3, special:'mangal' });
    const t = types(game.board);
    expect(t.flatMap((row, r) => [...row].map((ch, c) => ch === '.' ? `${r},${c}` : '')).filter(Boolean)).toHaveLength(21);
    expect(t[1][1]).not.toBe('.'); expect(t[1][5]).not.toBe('.'); expect(t[5][1]).not.toBe('.'); expect(t[5][5]).not.toBe('.');
  });

  it('crown removes every tile of the swapped colour', async () => {
    const { game } = newGame();
    setTiles(game.board, NOMATCH);
    await game.detonate({ r:0, c:0, special:'nazar', color:2 });
    expect(countType(game, 2)).toBe(0);
    expect(countType(game, 1)).toBe(16);
  });

  it('crown without a colour picks the most common one', async () => {
    const { game } = newGame();
    setTiles(game.board, rows([0,'33333331']));
    await game.detonate({ r:4, c:4, special:'nazar' });
    expect(countType(game, 3)).toBe(0);
  });

  it('dove clears a plus shape and flies to an extra target', async () => {
    const { game } = newGame();
    setTiles(game.board, NOMATCH);
    await game.detonate({ r:4, c:4, special:'marti' });
    const empty = types(game.board).join('').split('').filter(ch => ch === '.').length;
    expect(empty).toBe(6);
    expect(game.fx.some(f => f.k === 'gull')).toBe(true);
  });

  it('a special hit by a blast is queued, not destroyed outright (chain reaction)', async () => {
    const { game } = newGame();
    setTiles(game.board, rows([3,'230v2301']));
    await game.detonate({ r:3, c:0, special:'vh' });
    expect(game.queue.map(q => q.special)).toEqual(['vv']);
    await game.processQueue();
    expect(types(game.board).map(r => r[3]).join('')).toBe('........');
  });
});

describe('combos', () => {
  const comboGame = async (a: string, b: string) => {
    const { game, log } = newGame({ goals: [{ kind:'tile', type:0, need:999 }] });
    setTiles(game.board, rows([4, `2301${a}${b}01`]));
    const queued: string[] = [];
    const det = game.detonate.bind(game);
    game.detonate = q => { queued.push(q.special); return det(q); };
    await game.trySwap({ r:4, c:4 }, { r:4, c:5 });
    return { game, log, queued };
  };
  it('ferry + ferry → cross', async () => { expect((await comboGame('h','v')).queued[0]).toBe('cross'); });
  it('fire + ferry → big cross', async () => { expect((await comboGame('f','h')).queued[0]).toBe('bigcross'); });
  it('fire + fire → big fire', async () => { expect((await comboGame('f','f')).queued[0]).toBe('bigmangal'); });
  it('dove + dove → three doves', async () => { expect((await comboGame('m','m')).queued.slice(0,3)).toEqual(['marti','marti','marti']); });
  it('dove + ferry → dove carrying a ferry', async () => {
    const { queued } = await comboGame('m','h');
    expect(queued.slice(0,2)).toEqual(['marti','vh']);
  });
  it('crown + crown → whole board', async () => {
    const { queued, log, game } = await comboGame('n','n');
    expect(queued[0]).toBe('all');
    expect(log.floats).toContain('COMBO!');
    expect(game.movesLeft).toBe(19);
  });
  it('crown + ferry turns every tile of the main colour into ferries', async () => {
    const { queued } = await comboGame('n','h');
    expect(queued.filter(s => s === 'vh' || s === 'vv').length).toBeGreaterThanOrEqual(15);
  });
  it('special + normal tile detonates the special with that colour', async () => {
    const { game } = newGame();
    setTiles(game.board, rows([4,'2301n301']));
    const queued: { s: string; color?: number }[] = [];
    const det = game.detonate.bind(game);
    game.detonate = q => { queued.push({ s:q.special, color:q.color }); return det(q); };
    await game.trySwap({ r:4, c:5 }, { r:4, c:4 }); // drag the "3" onto the crown
    expect(queued[0]).toEqual({ s:'nazar', color:3 });
  });
});

describe('blockers & goals', () => {
  it('a match next to a chest damages it; 2-hp chests need two hits', async () => {
    const { game } = newGame({ map: ['........','........','........','...S....','........','........','........','........'], goals: [{ kind:'sandik' }] });
    setTiles(game.board, NOMATCH);
    game.damageBlocker(3,3);
    expect(game.grid[3][3].b!.hp).toBe(1);
    expect(game.goals[0].got).toBe(0);
    game.damageBlocker(3,3);
    expect(game.grid[3][3].b).toBeNull();
    expect(game.goals[0].got).toBe(1);
  });

  it('blasts hit chests instead of the tile behind them', () => {
    const { game } = newGame({ map: ['........','........','........','...s....','........','........','........','........'], goals: [{ kind:'sandik' }] });
    game.hitCell(3,3);
    expect(game.grid[3][3].b).toBeNull();
    expect(game.goals[0].got).toBe(1);
  });

  it('double kilims need two hits, each layer counts toward the goal', () => {
    const { game } = newGame({ map: ['K.......', ...Array(7).fill('........')], goals: [{ kind:'kilim' }] });
    expect(game.goals[0].need).toBe(2);
    game.hitCell(0,0);
    expect(game.grid[0][0].k).toBe(1);
    game.board.grid[0][0].t = game.board.newTile(0);
    game.hitCell(0,0);
    expect(game.grid[0][0].k).toBe(0);
    expect(game.goals[0].got).toBe(2);
  });

  it('extra goal progress past the target is not counted', () => {
    const { game } = newGame({ goals: [{ kind:'tile', type:0, need:1 }] });
    setTiles(game.board, NOMATCH);
    game.hitCell(0,0); game.hitCell(0,4);
    expect(game.goals[0].got).toBe(1);
  });
});

describe('turn end', () => {
  it('wins when all goals are met; leftover moves turn into ferries; stars by moves left', async () => {
    const { game, log } = newGame({ moves: 20, goals: [{ kind:'tile', type:4, need:3 }] });
    setTiles(game.board, rows([0,'44140123']));
    await game.trySwap({ r:0, c:3 }, { r:0, c:2 });
    expect(log.win).toEqual([3]);
    expect(game.movesLeft).toBe(19 - 12); // celebration spends up to 12 moves
    expect(log.floats).toContain('Stop cleared!');
  });

  it('loses when moves run out with goals open', async () => {
    const { game, log } = newGame({ moves: 1, goals: [{ kind:'tile', type:4, need:99 }] });
    setTiles(game.board, rows([0,'44140123']));
    await game.trySwap({ r:0, c:3 }, { r:0, c:2 });
    expect(log.lose).toBe(1);
    expect(log.win).toEqual([]);
    expect(game.busy).toBe(true);
  });

  it('warns once at 3 moves left', async () => {
    const { game, log } = newGame({ moves: 4, goals: [{ kind:'tile', type:4, need:99 }] });
    setTiles(game.board, rows([0,'44140123']));
    await game.trySwap({ r:0, c:3 }, { r:0, c:2 });
    expect(game.movesLeft).toBe(3);
    expect(log.lowMoves).toBe(1);
  });

  it('+5 moves can be bought once', () => {
    const { game } = newGame();
    game.addExtraMoves();
    expect(game.movesLeft).toBe(25);
    expect(game.extraUsed).toBe(true);
  });

  it('reshuffles when the board has no moves left', async () => {
    const { game, log } = newGame({ goals: [{ kind:'tile', type:4, need:99 }] });
    setTiles(game.board, NOMATCH);
    await game.afterTurn();
    expect(log.said).toContain('The board is stuck, effendi. Let us shuffle.');
    expect(game.board.findMove()).not.toBeNull();
    expect(game.busy).toBe(false);
  });

  it('tapping a special fires it and costs a move', async () => {
    const { game } = newGame({ goals: [{ kind:'tile', type:4, need:99 }] });
    setTiles(game.board, rows([2,'0123h123']));
    await game.tapSpecial({ r:2, c:4 });
    expect(game.movesLeft).toBe(19);
  });
});

describe('boosters', () => {
  it('slipper smashes one tile and uses one slipper, not a move', async () => {
    const { game, save, log } = newGame({ goals: [{ kind:'tile', type:0, need:99 }] });
    setTiles(game.board, NOMATCH);
    game.boosterMode = 'terlik';
    await game.useBooster({ r:0, c:0 });
    expect(save.boost.terlik).toBe(2);
    expect(game.movesLeft).toBe(20);
    expect(game.goals[0].got).toBeGreaterThanOrEqual(1);
    expect(log.persist).toBe(1);
    expect(game.boosterMode).toBeNull();
  });

  it('lightning clears a column and broom a row', async () => {
    const a = newGame({ goals: [{ kind:'tile', type:1, need:99 }] });
    setTiles(a.game.board, NOMATCH); a.game.boosterMode = 'oklava';
    await a.game.useBooster({ r:5, c:1 }); // column 1 holds 1,3,1,3,… → four 1s
    expect(a.save.boost.oklava).toBe(1);
    expect(a.game.goals[0].got).toBeGreaterThanOrEqual(4);
    const b = newGame({ goals: [{ kind:'tile', type:1, need:99 }] });
    setTiles(b.game.board, NOMATCH); b.game.boosterMode = 'supurge';
    await b.game.useBooster({ r:0, c:0 }); // row 0: 01230123 → two 1s
    expect(b.save.boost.supurge).toBe(1);
    expect(b.game.goals[0].got).toBeGreaterThanOrEqual(2);
  });

  it('does nothing when none are left', async () => {
    const { game, save } = newGame();
    save.boost.terlik = 0; game.boosterMode = 'terlik';
    const before = types(game.board);
    await game.useBooster({ r:0, c:0 });
    expect(types(game.board)).toEqual(before);
    expect(save.boost.terlik).toBe(0);
  });

  it('dice reshuffles without costing a move', async () => {
    const { game, save } = newGame();
    const ids = game.grid.flat().map(c => c.t!.id).sort();
    await game.useZar();
    expect(save.boost.zar).toBe(1);
    expect(game.movesLeft).toBe(20);
    expect(game.grid.flat().map(c => c.t!.id).sort()).toEqual(ids);
  });

  it('dice with none left only complains', async () => {
    const { game, save, log } = newGame();
    save.boost.zar = 0;
    await game.useZar();
    expect(log.said).toContain('No dice left! Win with three stars to earn more.');
  });
});

describe('board invariants after random play', () => {
  it('stays full, settled and match-free across many random swaps', async () => {
    for (let seed = 1; seed <= 5; seed++){
      const { game, log } = newGame({ moves: 60, colors: 6, goals: [{ kind:'tile', type:0, need:999 }], map: ['........','..s..s..','kkkkkkkk','kKkKkKkK','..S..S..','kk....kk','kk....kk','........'] }, seed);
      for (let i = 0; i < 40 && !log.lose && !log.win.length; i++){
        const m = game.board.findMove()!;
        if (m.length === 1) await game.tapSpecial({ r:m[0][0], c:m[0][1] });
        else await game.trySwap({ r:m[0][0], c:m[0][1] }, { r:m[1][0], c:m[1][1] });
        for (let r=0;r<R;r++) for (let c=0;c<C;c++){ const cell = game.grid[r][c]; if (cell.b) expect(cell.t).toBeNull(); else expect(cell.t).not.toBeNull(); }
        expect(game.board.findGroups()).toEqual([]);
        expect(game.queue).toEqual([]);
      }
    }
  });
});
