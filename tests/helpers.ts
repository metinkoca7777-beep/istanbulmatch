import { Game, type GameHooks } from '../src/engine/game';
import { Board, C, R } from '../src/engine/board';
import { defaultSave } from '../src/engine/save';
import type { Level } from '../src/engine/types';

/** Deterministic PRNG (mulberry32). */
export function seeded(seed = 1){
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Hooks that resolve instantly and record what the engine asked for. */
export function testHooks(){
  const log = { sfx: [] as string[], said: [] as string[], floats: [] as string[], win: [] as number[], lose: 0, lowMoves: 0, persist: 0 };
  const hooks: GameHooks = {
    sleep: () => Promise.resolve(),
    waitSettle: () => Promise.resolve(),
    now: () => 0,
    sfx: k => { log.sfx.push(k); },
    buzz: () => {},
    spark: () => {},
    floatText: t => { log.floats.push(t); },
    say: (_w, t) => { log.said.push(t); },
    quip: (_w, t) => { log.said.push(t); },
    stopTalk: () => {},
    lowMoves: () => { log.lowMoves++; },
    boostersChanged: () => {},
    persist: () => { log.persist++; },
    win: s => { log.win.push(s); },
    lose: () => { log.lose++; },
  };
  return { hooks, log };
}

export const level = (over: Partial<Level> = {}): Level => ({
  name: 'Test', district: 'Fatih', icon: 'ayasofya', pt: [0,0], badge: [0,0], sub: '', fact: '',
  moves: 20, colors: 5, goals: [{ kind:'tile', type:0, need:3 }], talk: [['H','a'],['K','b']], ...over,
});

export function newGame(over: Partial<Level> = {}, seed = 1){
  const { hooks, log } = testHooks();
  const save = defaultSave();
  const game = new Game(save, hooks, seeded(seed));
  game.start(0, level(over));
  game.busy = false;
  return { game, log, save };
}

/**
 * Overwrites the board's tiles from 8 strings: digits are colours, 'v'/'h'/'m'/'f'/'n' are
 * vertical ferry / horizontal ferry / dove / fire / crown, '.' leaves the cell empty.
 * Tiles are placed already settled in their cells.
 */
export function setTiles(board: Board, rows: string[]){
  const SP = { v:'vv', h:'vh', m:'marti', f:'mangal', n:'nazar' } as const;
  for (let r=0;r<R;r++) for (let c=0;c<C;c++){
    const ch = rows[r][c], cell = board.grid[r][c];
    if (ch === '.' || cell.b){ cell.t = null; continue; }
    const t = ch in SP ? board.newTile(-1, SP[ch as keyof typeof SP]) : board.newTile(+ch);
    t.x = c; t.y = r; cell.t = t;
  }
}

/** Board colours as strings ('.' empty, 'x' chest, '*' special). */
export function types(board: Board){
  return board.grid.map(row => row.map(cell => cell.b ? 'x' : !cell.t ? '.' : cell.t.special ? '*' : String(cell.t.type)).join(''));
}

/** A checkerboard-ish filler with no matches in 4 colours. */
export const NOMATCH = ['01230123','23012301','01230123','23012301','01230123','23012301','01230123','23012301'];
