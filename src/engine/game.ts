import { Board, C, D4, R, groupSpecial, inb, placeFor, type Group } from './board';
import { allDone, goalOpen, goalOpenTile, makeGoals, progress } from './goals';
import { starsFor, type SaveData } from './save';
import type { Blast, BoosterKind, Fx, Goal, Level, Pos, QueueItem, RC, Special, Speaker, Tile } from './types';
import { CHAIN_Q, CHAIN_TXT, SP_Q, WIN_K } from '../data/dialogue';

export type Sfx = 'swap' | 'nope' | 'pop' | 'boom' | 'wood' | 'chest' | 'cloth' | 'spawn' | 'combo' | 'slap' | 'zap' | 'broom' | 'dice' | 'win' | 'lose';

/**
 * Everything the engine needs from the outside world. The browser wires these to timers,
 * the render loop, audio and the speech toast; tests resolve them instantly.
 */
export interface GameHooks {
  sleep(ms: number): Promise<void>;
  /** Resolves once every tile has finished sliding into its cell. */
  waitSettle(): Promise<void>;
  now(): number;
  /** f: pitch hint in Hz for pops; blast: which special went off, for 'boom'. */
  sfx(k: Sfx, f?: number, blast?: Blast): void;
  buzz(ms: number): void;
  spark(r: number, c: number, col: string, n: number): void;
  /** A goal just counted one unit cleared at (r,c); lets the UI fly an icon to the goal. */
  collect?(kind: Goal['kind'], type: number | undefined, r: number, c: number): void;
  floatText(txt: string, c: number, r: number): void;
  say(who: Speaker, text: string): void;
  /** Speech that is throttled and cancels the queued dialogue. */
  quip(who: Speaker, text: string): void;
  /** Cancels queued dialogue lines. */
  stopTalk(): void;
  /** Fired once when the player is down to 3 moves. */
  lowMoves(): void;
  boostersChanged(): void;
  persist(): void;
  win(stars: number): void;
  lose(): void;
}

const TCOL = ['#efe6d2','#ffd23f','#ff5fa8','#e8433a','#f2c14e','#3fb0ff'];
const isV = (x: string) => x === 'vh' || x === 'vv';

/** One level in play: board, goals, moves, the detonation queue and the turn flow. */
export class Game {
  readonly board: Board;
  level: Level | null = null;
  levelIdx = 0;
  movesLeft = 0;
  goals: Goal[] = [];
  extraUsed = false;

  busy = true;
  selected: Pos | null = null;
  boosterMode: Exclude<BoosterKind, 'zar'> | null = null;
  /** Suggested move: cells to highlight, 0 when none was found, null when not computed yet. */
  hint: RC[] | 0 | null = null;
  lastInput = 0;
  hudDirty = false;
  /** Screen shake timer (seconds). */
  shakeT = 0;

  queue: QueueItem[] = [];
  /** Tiles shrinking away (render state). */
  dying: { t: Tile; life: number; max: number }[] = [];
  fx: Fx[] = [];

  constructor(public save: SaveData, public hooks: GameHooks, rand: () => number = Math.random) {
    this.board = new Board(rand);
  }

  get grid() { return this.board.grid; }

  /** Builds the level's board and goals. The caller decides when to unlock input (busy=false). */
  start(idx: number, level: Level) {
    this.levelIdx = idx; this.level = level; this.board.colors = level.colors; this.movesLeft = level.moves; this.extraUsed = false;
    this.queue = []; this.dying = []; this.fx = []; this.selected = null; this.boosterMode = null; this.hint = null; this.busy = true;
    this.board.build(level.map);
    this.goals = makeGoals(level, this.grid);
    this.board.fillInitial();
  }

  /** The "+5 moves" offer after losing; usable once per attempt. */
  addExtraMoves() { this.extraUsed = true; this.movesLeft += 5; this.hudDirty = true; }

  // ---------------- hits ----------------
  private progress(kind: Goal['kind'], type: number | undefined, r: number, c: number) {
    if (progress(this.goals, kind, type)){ this.hudDirty = true; this.hooks.collect?.(kind, type, r, c); }
  }

  private removeTile(r: number, c: number) {
    const t = this.grid[r][c].t; if (!t) return;
    this.grid[r][c].t = null; this.dying.push({ t, life:.2, max:.2 });
    if (t.type >= 0){ this.progress('tile', t.type, r, c); this.hooks.spark(r,c,TCOL[t.type],6); }
  }

  damageBlocker(r: number, c: number) {
    const cell = this.grid[r][c]; if (!cell.b) return;
    cell.b.hp--; cell.b.shake = .25; this.hooks.spark(r,c,'#a86d34',10); this.hooks.sfx('wood');
    if (cell.b.hp <= 0){ cell.b = null; this.progress('sandik', undefined, r, c); this.hooks.spark(r,c,'#e6b23a',12); this.hooks.sfx('chest'); }
  }

  /** Hits one cell: damages a chest, else peels a kilim layer and clears/queues the tile on it. */
  hitCell(r: number, c: number) {
    if (!inb(r,c)) return;
    const cell = this.grid[r][c];
    if (cell.b){ this.damageBlocker(r,c); return; }
    if (cell.k > 0){ cell.k--; this.progress('kilim', undefined, r, c); this.hooks.spark(r,c,'#e6b23a',5); this.hooks.sfx('cloth'); }
    const t = cell.t; if (!t) return;
    if (t.special){ if (!t.fired){ t.fired = true; this.queue.push({ r, c, special:t.special, tile:t }); } return; }
    this.removeTile(r,c);
  }

  /** Clears matched groups, damages adjacent chests and drops in the specials they earn. Returns the specials created. */
  clearGroups(groups: Group[], pref: readonly RC[] | null) {
    const created: Special[] = [];
    for (const g of groups){
      const sp = groupSpecial(g);
      const place = sp ? placeFor(g, pref) : -1;
      const adj = new Set<number>();
      for (const i of g.cells){
        const r = Math.floor(i/C), c = i%C;
        D4.forEach(([dr,dc]) => { const y = r+dr, x = c+dc; if (inb(y,x) && this.grid[y][x].b) adj.add(y*C+x); });
        this.hitCell(r,c);
        if (i === place && sp){ const nt = this.board.newTile(-1, sp); nt.x = c; nt.y = r; nt.sc = .2; this.grid[r][c].t = nt; created.push(sp); }
      }
      adj.forEach(i => this.damageBlocker(Math.floor(i/C), i%C));
    }
    return created;
  }

  /** Dove target priority: chests (if a goal) → kilims (if a goal) → goal-colour tiles → anything. */
  pickTarget(ex: Set<number>): RC | null {
    const tiers: RC[][] = [[],[],[],[]];
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      if (ex.has(r*C+c)) continue;
      const cell = this.grid[r][c];
      if (cell.b){ if (goalOpen(this.goals, 'sandik')) tiers[0].push([r,c]); continue; }
      if (!cell.t || cell.t.special) continue;
      if (cell.k > 0 && goalOpen(this.goals, 'kilim')) tiers[1].push([r,c]);
      else if (goalOpenTile(this.goals, cell.t.type)) tiers[2].push([r,c]);
      else tiers[3].push([r,c]);
    }
    for (const t of tiers) if (t.length) return this.board.pick(t);
    return null;
  }

  async detonate(q: QueueItem) {
    const { r, c } = q, grid = this.grid, h = this.hooks;
    if (q.tile){ const p = this.board.findTile(q.tile); if (p){ grid[p[0]][p[1]].t = null; this.dying.push({ t:q.tile, life:.15, max:.15 }); } }
    const sp = q.special, cells = new Map<number, RC>();
    const add = (y: number, x: number) => { if (inb(y,x)) cells.set(y*C+x, [y,x]); };
    h.sfx('boom', undefined, q.special); h.buzz(15); this.shakeT = .18;
    switch (sp){
      case 'vh': for (let i=0;i<C;i++) add(r,i); this.fx.push({ k:'sweep', r, c, dir:'h', t:0, d:.34 }); break;
      case 'vv': for (let i=0;i<R;i++) add(i,c); this.fx.push({ k:'sweep', r, c, dir:'v', t:0, d:.34 }); break;
      case 'cross': for (let i=0;i<C;i++){ add(r,i); add(i,c); } this.fx.push({ k:'sweep', r, c, dir:'h', t:0, d:.34 }, { k:'sweep', r, c, dir:'v', t:0, d:.34 }); break;
      case 'bigcross': for (let d=-1; d<=1; d++) for (let i=0;i<C;i++){ add(r+d,i); add(i,c+d); this.fx.push({ k:'sweep', r:r+d, c:c+d, dir:'h', t:0, d:.36 }, { k:'sweep', r:r+d, c:c+d, dir:'v', t:0, d:.36 }); } break;
      case 'mangal': for (let dr=-2;dr<=2;dr++) for (let dc=-2;dc<=2;dc++) if (!(Math.abs(dr)===2 && Math.abs(dc)===2)) add(r+dr,c+dc); this.fx.push({ k:'ring', r, c, rad:2.6, t:0, d:.4 }); break;
      case 'bigmangal': for (let dr=-3;dr<=3;dr++) for (let dc=-3;dc<=3;dc++) add(r+dr,c+dc); this.fx.push({ k:'ring', r, c, rad:4, t:0, d:.5 }); break;
      case 'all': for (let y=0;y<R;y++) for (let x=0;x<C;x++) add(y,x); this.fx.push({ k:'ring', r, c, rad:9, t:0, d:.6 }); break;
      case 'nazar': {
        const col = (q.color !== undefined && q.color >= 0) ? q.color : this.board.mostCommonColor();
        const pts: RC[] = [];
        for (let y=0;y<R;y++) for (let x=0;x<C;x++) if (this.board.typeAt(y,x) === col){ add(y,x); pts.push([y,x]); }
        this.fx.push({ k:'rays', r, c, pts, t:0, d:.45 }); break;
      }
      case 'marti': add(r,c); D4.forEach(([dr,dc]) => add(r+dr,c+dc)); break;
    }
    cells.forEach(([y,x]) => this.hitCell(y,x));
    if (sp === 'marti'){
      const tgt = this.pickTarget(new Set(cells.keys()));
      if (tgt){
        this.fx.push({ k:'gull', x0:c, y0:r, x1:tgt[1], y1:tgt[0], t:0, d:.4 });
        await h.sleep(400);
        if (q.carry) this.queue.unshift({ r:tgt[0], c:tgt[1], special:q.carry }); else { this.hitCell(tgt[0], tgt[1]); h.spark(tgt[0],tgt[1],'#ffffff',8); }
      }
    }
    await h.sleep(sp === 'nazar' ? 380 : 120);
  }

  async processQueue() { while (this.queue.length) await this.detonate(this.queue.shift()!); }

  /** Detonate → fall → match, repeated until the board is quiet. */
  async cascade(pref: readonly RC[] | null) {
    const h = this.hooks;
    let chain = 0;
    for (let guard=0; guard<80; guard++){
      await this.processQueue();
      this.board.applyGravity();
      await h.waitSettle();
      const groups = this.board.findGroups();
      if (!groups.length){ if (this.queue.length) continue; break; }
      chain++;
      const created = this.clearGroups(groups, pref); pref = null;
      h.sfx('pop', 440 + chain*90); h.buzz(8);
      if (chain >= 2) h.floatText(CHAIN_TXT[Math.min(chain,5)-2], (C-1)/2, (R-1)/2);
      if (created.length){ h.sfx('spawn'); const q = SP_Q[created[0]]; h.quip(q[0], q[1]); }
      else if (chain >= 3) h.quip('K', this.board.pick(CHAIN_Q));
      await h.sleep(130);
    }
  }

  async shuffleBoard(silent?: boolean) {
    if (!silent) this.hooks.quip('H','The board is stuck, effendi. Let us shuffle.');
    this.board.shuffle();
    await this.hooks.waitSettle();
  }

  // ---------------- turn flow ----------------
  private useMove() {
    this.movesLeft--; this.hudDirty = true;
    if (this.movesLeft === 3) this.hooks.lowMoves();
  }

  async trySwap(a: Pos, b: Pos) {
    if (this.busy) return;
    const A = this.grid[a.r][a.c], B = this.grid[b.r][b.c];
    if (A.b || B.b || !A.t || !B.t) return;
    this.busy = true; this.selected = null; this.hint = null;
    [A.t, B.t] = [B.t, A.t]; this.hooks.sfx('swap');
    await this.hooks.waitSettle();
    const moved = B.t!, other = A.t!; // moved: tile dragged from a, now at b
    if (moved.special || other.special){
      this.useMove();
      if (moved.special && other.special) await this.combo(moved, other, b);
      else {
        const sp = moved.special ? moved : other, pos = moved.special ? b : a, nrm = moved.special ? other : moved;
        sp.fired = true; this.queue.push({ r:pos.r, c:pos.c, special:sp.special!, tile:sp, color:nrm.type });
      }
      await this.cascade(null);
    } else if (this.board.matchAt(a.r,a.c) || this.board.matchAt(b.r,b.c)){
      this.useMove(); await this.cascade([[b.r,b.c],[a.r,a.c]]);
    } else {
      [A.t, B.t] = [B.t, A.t]; this.hooks.sfx('nope'); await this.hooks.waitSettle(); this.busy = false; return;
    }
    await this.afterTurn();
  }

  /** Two specials swapped together. */
  async combo(t1: Tile, t2: Tile, pos: Pos) {
    const h = this.hooks;
    for (const t of [t1,t2]){ t.fired = true; const p = this.board.findTile(t); if (p){ this.grid[p[0]][p[1]].t = null; this.dying.push({ t, life:.22, max:.22 }); } }
    const s = [t1.special!, t2.special!], has = (x: Special) => s.includes(x);
    const { r, c } = pos;
    h.floatText('COMBO!', c, r); h.sfx('combo'); h.quip('K','What a combo, Hacivat!');
    if (has('nazar')){
      if (s[0] === 'nazar' && s[1] === 'nazar') this.queue.push({ r, c, special:'all' });
      else {
        const oth = s[0] === 'nazar' ? s[1] : s[0], col = this.board.mostCommonColor(), pts: RC[] = [];
        for (let y=0;y<R;y++) for (let x=0;x<C;x++) if (this.board.typeAt(y,x) === col) pts.push([y,x]);
        this.fx.push({ k:'rays', r, c, pts, t:0, d:.5 }); await h.sleep(350);
        pts.forEach(([y,x]) => { const t = this.grid[y][x].t; if (!t) return; t.special = isV(oth) ? (this.board.rand() < .5 ? 'vh' : 'vv') : oth; t.type = -1; t.sc = .3; t.fired = true; this.queue.push({ r:y, c:x, special:t.special, tile:t }); });
        await h.sleep(300);
      }
    } else if (has('marti')){
      const oth = s[0] === 'marti' ? s[1] : s[0];
      if (oth === 'marti') for (let i=0;i<3;i++) this.queue.push({ r, c, special:'marti' });
      else this.queue.push({ r, c, special:'marti', carry:oth });
    } else if (isV(s[0]) && isV(s[1])) this.queue.push({ r, c, special:'cross' });
    else if (has('mangal') && (isV(s[0]) || isV(s[1]))) this.queue.push({ r, c, special:'bigcross' });
    else this.queue.push({ r, c, special:'bigmangal' });
  }

  async tapSpecial(p: Pos) {
    const t = this.grid[p.r][p.c].t; if (!t || !t.special || this.busy) return;
    this.busy = true; this.selected = null; this.hint = null; this.useMove(); t.fired = true;
    this.queue.push({ r:p.r, c:p.c, special:t.special, tile:t });
    await this.cascade(null); await this.afterTurn();
  }

  async afterTurn() {
    if (allDone(this.goals)){
      const stars = starsFor(this.movesLeft, this.level!.moves);
      await this.celebrate(); this.hooks.win(stars); return;
    }
    if (this.movesLeft <= 0){ this.hooks.lose(); return; }
    if (!this.board.findMove()){ await this.shuffleBoard(); await this.cascade(null); }
    this.busy = false; this.lastInput = this.hooks.now();
  }

  /** Level cleared: every remaining move (max 12) turns a random tile into a ferry, then they all go off. */
  async celebrate() {
    const h = this.hooks;
    h.stopTalk(); h.say('K', this.board.pick(WIN_K));
    h.floatText('Stop cleared!', (C-1)/2, (R-1)/2);
    await h.sleep(500);
    const n = Math.min(this.movesLeft, 12);
    for (let i=0;i<n;i++){
      const cand: Tile[] = [];
      for (let r=0;r<R;r++) for (let c=0;c<C;c++){ const t = this.grid[r][c].t; if (t && !t.special) cand.push(t); }
      if (!cand.length) break;
      const t = this.board.pick(cand); t.special = this.board.rand() < .5 ? 'vh' : 'vv'; t.type = -1; t.sc = .3;
      this.movesLeft--; this.hudDirty = true; h.sfx('pop', 600 + i*45); await h.sleep(110);
    }
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){ const t = this.grid[r][c].t; if (t && t.special && !t.fired){ t.fired = true; this.queue.push({ r, c, special:t.special, tile:t }); } }
    await this.cascade(null);
    await h.sleep(300);
  }

  /** Applies the armed booster (slipper / lightning / broom) to the tapped cell. */
  async useBooster(p: Pos) {
    const h = this.hooks;
    const kind = this.boosterMode; this.boosterMode = null; h.boostersChanged();
    if (!kind || this.save.boost[kind] <= 0) return;
    this.busy = true; this.selected = null; this.hint = null;
    this.save.boost[kind]--; h.persist(); h.boostersChanged();
    if (kind === 'terlik'){
      h.quip('K','Mom\'s flying slipper! It never misses!');
      this.fx.push({ k:'slip', x1:p.c, y1:p.r, t:0, d:.38 }); await h.sleep(380);
      h.sfx('slap'); h.buzz(25); this.shakeT = .25; this.hitCell(p.r,p.c);
    } else if (kind === 'oklava'){
      h.quip('H','Lightning strikes the column, effendi!');
      this.fx.push({ k:'oklava', c:p.c, t:0, d:.45 }); h.sfx('zap');
      for (let r=0;r<R;r++){ this.hitCell(r,p.c); await h.sleep(40); }
    } else if (kind === 'supurge'){
      h.quip('H','Swept spotless, maşallah!');
      this.fx.push({ k:'broom', r:p.r, t:0, d:.45 }); h.sfx('broom');
      for (let c=0;c<C;c++){ this.hitCell(p.r,c); await h.sleep(40); }
    }
    await this.cascade(null); await this.afterTurn();
  }

  /** Dice booster: reshuffle the board. Doesn't cost a move. */
  async useZar() {
    const h = this.hooks;
    if (this.busy || this.save.boost.zar <= 0){ if (!this.busy) h.quip('K','No dice left! Win with three stars to earn more.'); return; }
    this.busy = true; this.boosterMode = null; this.selected = null; this.hint = null;
    this.save.boost.zar--; h.persist(); h.boostersChanged();
    h.quip('K','Come on, double sixes!'); h.sfx('dice'); h.floatText('Shuffle!', (C-1)/2, (R-1)/2);
    await this.shuffleBoard(true); await this.cascade(null); await this.afterTurn();
  }
}
