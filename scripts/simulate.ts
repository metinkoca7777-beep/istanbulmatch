// Level difficulty simulator: plays every level many times with bots on the real engine
// and prints win rates, stars and moves left. Run: npm run simulate [-- games-per-level]
import { Game, type GameHooks } from '../src/engine/game';
import { defaultSave } from '../src/engine/save';
import { LEVELS } from '../src/data/levels';
import type { Goal, Level, RC } from '../src/engine/types';
import { R, C } from '../src/engine/board';

function seeded(seed: number){
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

interface Outcome { won: boolean; stars: number; movesLeft: number; }

function hooks(out: { result?: Outcome; left?: number }, game: () => Game): GameHooks {
  const nop = () => {};
  return {
    sleep: () => Promise.resolve(), waitSettle: () => Promise.resolve(), now: () => 0,
    sfx: nop, buzz: nop, spark: nop,
    // 'Stop cleared!' is shown before the celebration spends the leftover moves.
    floatText: t => { if (t === 'Stop cleared!') out.left = game().movesLeft; }, say: nop, quip: nop, stopTalk: nop, lowMoves: nop, boostersChanged: nop, persist: nop,
    win: stars => { out.result = { won: true, stars, movesLeft: out.left ?? game().movesLeft }; },
    lose: () => { out.result = { won: false, stars: 0, movesLeft: 0 }; },
  };
}

/** Every legal action: swaps that match or involve a special, and taps on specials. */
function legalMoves(g: Game): RC[][] {
  const grid = g.grid, moves: RC[][] = [];
  for (let r=0;r<R;r++) for (let c=0;c<C;c++){
    const A = grid[r][c]; if (!A.t || A.b) continue;
    if (A.t.special) moves.push([[r,c]]);
    for (const [dr,dc] of [[0,1],[1,0]]){
      const r2 = r+dr, c2 = c+dc; if (r2 >= R || c2 >= C) continue;
      const B = grid[r2][c2]; if (!B.t || B.b) continue;
      if (A.t.special || B.t.special){ moves.push([[r,c],[r2,c2]]); continue; }
      [A.t, B.t] = [B.t, A.t];
      const ok = g.board.matchAt(r,c) || g.board.matchAt(r2,c2);
      [A.t, B.t] = [B.t, A.t];
      if (ok) moves.push([[r,c],[r2,c2]]);
    }
  }
  return moves;
}

async function play(g: Game, m: RC[]){
  if (m.length === 1) await g.tapSpecial({ r:m[0][0], c:m[0][1] });
  else await g.trySwap({ r:m[0][0], c:m[0][1] }, { r:m[1][0], c:m[1][1] });
}

/** Remaining goal units, weighting harder goals (chests, kilims) a bit more. */
function goalDebt(goals: Goal[]){ return goals.reduce((s, x) => s + Math.max(0, x.need - x.got) * (x.kind === 'tile' ? 1 : 1.5), 0); }
function specials(g: Game){ let n = 0; for (const row of g.grid) for (const cell of row) if (cell.t?.special) n++; return n; }

/** Copies a game mid-level so a move can be tried without touching the real one. */
function cloneGame(g: Game, rand: () => number){
  const out: { result?: Outcome } = {};
  let copy!: Game;
  copy = new Game(structuredClone(g.save), hooks(out, () => copy), rand);
  copy.level = g.level; copy.levelIdx = g.levelIdx; copy.movesLeft = g.movesLeft; copy.extraUsed = g.extraUsed;
  copy.goals = structuredClone(g.goals); copy.board.colors = g.board.colors; copy.board.grid = structuredClone(g.board.grid);
  copy.busy = false;
  return { copy, out };
}

type Bot = (g: Game, rand: () => number) => Promise<RC[] | null>;

const randomBot: Bot = async (g, rand) => { const ms = legalMoves(g); return ms.length ? ms[Math.floor(rand()*ms.length)] : null; };
const hintBot: Bot = async g => g.board.findMove();
/** One-ply lookahead: try every move on a copy (2 random refills each) and keep the one that pays off most. */
const smartBot: Bot = async (g, rand) => {
  const ms = legalMoves(g); if (!ms.length) return null;
  let best = ms[0], bestScore = -Infinity;
  const before = goalDebt(g.goals);
  for (const m of ms){
    let score = 0;
    for (let k = 0; k < 2; k++){
      const { copy, out } = cloneGame(g, seeded(Math.floor(rand()*1e9)));
      await play(copy, m);
      score += (out.result?.won ? 1000 : 0) + (before - goalDebt(copy.goals)) * 10 + specials(copy) * 3;
    }
    score += rand() * .01;
    if (score > bestScore){ bestScore = score; best = m; }
  }
  return best;
};

/** Plays one attempt. With `extra`, takes the free "+5 moves" offer once when out of moves. */
async function attempt(level: Level, idx: number, bot: Bot, seed: number, extra: boolean): Promise<Outcome & { usedExtra: boolean }> {
  const out: { result?: Outcome; left?: number } = {}, rand = seeded(seed);
  let game!: Game;
  game = new Game(defaultSave(), hooks(out, () => game), rand);
  game.start(idx, level); game.busy = false;
  let usedExtra = false;
  for (let guard = 0; guard < 200; guard++){
    if (out.result){
      if (!out.result.won && extra && !game.extraUsed){ out.result = undefined; game.addExtraMoves(); game.busy = false; usedExtra = true; continue; }
      return { ...out.result, usedExtra };
    }
    const m = await bot(game, rand);
    if (!m){ await game.afterTurn(); continue; }
    await play(game, m);
  }
  return { won: false, stars: 0, movesLeft: 0, usedExtra };
}

const pct = (n: number, d: number) => d ? `${(100*n/d).toFixed(0)}%`.padStart(5) : '   - ';

async function main(){
  const games = +(process.argv[2] || 200);
  const bots: [string, Bot, number][] = [['random', randomBot, games], ['hint', hintBot, games], ['smart', smartBot, Math.max(20, Math.round(games/4))]];
  const rows: string[] = [];
  const totals: Record<string, { w: number; wx: number; n: number }> = {};
  console.log(`Games per level: random/hint ${games}, smart ${bots[2][2]}. No boosters. "+5" = taking the free +5 moves once.\n`);
  console.log('Level                 | random    +5 | hint      +5 | smart     +5 | smart: 1★ 2★ 3★ | avg moves left');
  for (let i = 0; i < LEVELS.length; i++){
    const L = LEVELS[i], cells: string[] = [];
    let starLine = '', movesLine = '';
    for (const [name, bot, n] of bots){
      let w = 0, wx = 0; const stars = [0,0,0,0]; let ml = 0;
      for (let s = 0; s < n; s++){
        const a = await attempt(L, i, bot, 1000*i + s + 1, false);
        if (a.won){ w++; stars[a.stars]++; ml += a.movesLeft; }
        const b = await attempt(L, i, bot, 1000*i + s + 1, true);
        if (b.won) wx++;
      }
      (totals[name] ??= { w:0, wx:0, n:0 }); totals[name].w += w; totals[name].wx += wx; totals[name].n += n;
      cells.push(`${pct(w, n)} ${pct(wx, n)}`);
      if (name === 'smart'){ starLine = `${pct(stars[1], w)}${pct(stars[2], w)}${pct(stars[3], w)}`; movesLine = w ? (ml/w).toFixed(1) : '-'; }
    }
    const line = `${String(i+1).padStart(2)} ${L.name.padEnd(18)} | ${cells.join(' | ')} | ${starLine} | ${movesLine}`;
    rows.push(line); console.log(line);
  }
  console.log('\nOverall                | ' + bots.map(([n]) => `${pct(totals[n].w, totals[n].n)} ${pct(totals[n].wx, totals[n].n)}`).join(' | '));
}

main();
