import type { Grid, RC, Special, Tile } from './types';

export const R = 8, C = 8;
export const D4: readonly RC[] = [[1,0],[-1,0],[0,1],[0,-1]];
export const inb = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C;

export interface Run { dir: 'h' | 'v'; cells: number[]; }
/** A connected set of matched cells (runs of 3+ and 2×2 squares merged together). Cells are r*C+c. */
export interface Group { cells: Set<number>; runs: Run[]; squares: number[][]; }

/**
 * The 8×8 board: cells, tiles, kilims and chests, plus the pure match-3 rules.
 * `rand` is injectable so tests can be deterministic; the game uses Math.random.
 */
export class Board {
  grid: Grid = [];
  colors = 5;
  private tileId = 0;

  constructor(public rand: () => number = Math.random) {}

  ri(n: number) { return Math.floor(this.rand() * n); }
  pick<T>(a: readonly T[]): T { return a[this.ri(a.length)]; }

  newTile(type: number, special?: Special | null): Tile {
    return { id: this.tileId++, type, special: special || null, x: 0, y: 0, sc: 1, fired: false };
  }

  typeAt(r: number, c: number) {
    if (!inb(r,c)) return -1;
    const t = this.grid[r][c].t;
    return (t && !t.special) ? t.type : -1;
  }

  build(map?: readonly string[]) {
    const grid: Grid = [];
    for (let r=0;r<R;r++){
      const row = [];
      for (let c=0;c<C;c++){
        const ch = map ? map[r][c] : '.';
        const cell: Grid[number][number] = { t:null, b:null, k:0 };
        if (ch === 'k') cell.k = 1; if (ch === 'K') cell.k = 2;
        if (ch === 's') cell.b = { hp:1, shake:0 }; if (ch === 'S') cell.b = { hp:2, shake:0 };
        row.push(cell);
      }
      grid.push(row);
    }
    this.grid = grid;
  }

  wouldMatch(r: number, c: number, t: number) {
    if (this.typeAt(r,c-1) === t && this.typeAt(r,c-2) === t) return true;
    if (this.typeAt(r-1,c) === t && this.typeAt(r-2,c) === t) return true;
    if (this.typeAt(r,c-1) === t && this.typeAt(r-1,c) === t && this.typeAt(r-1,c-1) === t) return true;
    return false;
  }

  /** Deals a fresh board with no ready-made matches and at least one legal move. Tiles start above the board and fall in. */
  fillInitial() {
    for (let tries=0; tries<100; tries++){
      for (let r=0;r<R;r++) for (let c=0;c<C;c++){
        const cell = this.grid[r][c]; if (cell.b){ cell.t = null; continue; }
        cell.t = null;
        let t, guard = 0; do { t = this.ri(this.colors); guard++; } while (guard < 40 && this.wouldMatch(r,c,t));
        const tile = this.newTile(t); tile.x = c; tile.y = r - R - 1; cell.t = tile;
      }
      if (this.findMove() && !this.findGroups().length) break;
    }
  }

  /** Is (r,c) part of a run of 3+ or a 2×2 square? */
  matchAt(r: number, c: number) {
    const t = this.typeAt(r,c); if (t < 0) return false;
    let a=c, b=c; while (this.typeAt(r,a-1) === t) a--; while (this.typeAt(r,b+1) === t) b++; if (b - a >= 2) return true;
    a=r; b=r; while (this.typeAt(a-1,c) === t) a--; while (this.typeAt(b+1,c) === t) b++; if (b - a >= 2) return true;
    for (const [dr,dc] of [[0,0],[0,-1],[-1,0],[-1,-1]]){
      const y = r+dr, x = c+dc;
      if (this.typeAt(y,x) === t && this.typeAt(y+1,x) === t && this.typeAt(y,x+1) === t && this.typeAt(y+1,x+1) === t) return true;
    }
    return false;
  }

  /** A swap that makes a match, else the first special tile (tapping it is a move), else null. */
  findMove(): RC[] | null {
    const grid = this.grid;
    let sp: RC[] | null = null;
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      const A = grid[r][c]; if (!A.t) continue;
      if (A.t.special && !sp) sp = [[r,c]];
      for (const [dr,dc] of [[0,1],[1,0]]){
        const r2 = r+dr, c2 = c+dc; if (!inb(r2,c2)) continue;
        const B = grid[r2][c2]; if (!B.t) continue;
        if (A.t.special || B.t.special) continue;
        [A.t, B.t] = [B.t, A.t];
        const ok = this.matchAt(r,c) || this.matchAt(r2,c2);
        [A.t, B.t] = [B.t, A.t];
        if (ok) return [[r,c],[r2,c2]];
      }
    }
    return sp;
  }

  findGroups(): Group[] {
    const runs: Run[] = [], squares: number[][] = [];
    for (let r=0;r<R;r++){ let c=0; while (c<C){ const t = this.typeAt(r,c); if (t<0){ c++; continue; } let e=c+1; while (e<C && this.typeAt(r,e)===t) e++; if (e-c>=3){ const cells=[]; for (let i=c;i<e;i++) cells.push(r*C+i); runs.push({ dir:'h', cells }); } c=e; } }
    for (let c=0;c<C;c++){ let r=0; while (r<R){ const t = this.typeAt(r,c); if (t<0){ r++; continue; } let e=r+1; while (e<R && this.typeAt(e,c)===t) e++; if (e-r>=3){ const cells=[]; for (let i=r;i<e;i++) cells.push(i*C+c); runs.push({ dir:'v', cells }); } r=e; } }
    for (let r=0;r<R-1;r++) for (let c=0;c<C-1;c++){ const t = this.typeAt(r,c); if (t>=0 && this.typeAt(r+1,c)===t && this.typeAt(r,c+1)===t && this.typeAt(r+1,c+1)===t) squares.push([r*C+c,(r+1)*C+c,r*C+c+1,(r+1)*C+c+1]); }
    if (!runs.length && !squares.length) return [];
    const par = Array.from({ length:R*C }, (_,i) => i);
    const f = (x: number): number => par[x] === x ? x : (par[x] = f(par[x]));
    const u = (a: number, b: number) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
    runs.forEach(run => run.cells.forEach(x => u(run.cells[0], x)));
    squares.forEach(sq => sq.forEach(x => u(sq[0], x)));
    const m = new Map<number, Group>();
    const get = (root: number) => { if (!m.has(root)) m.set(root, { cells:new Set(), runs:[], squares:[] }); return m.get(root)!; };
    runs.forEach(run => { const g = get(f(run.cells[0])); run.cells.forEach(x => g.cells.add(x)); g.runs.push(run); });
    squares.forEach(sq => { const g = get(f(sq[0])); sq.forEach(x => g.cells.add(x)); g.squares.push(sq); });
    return [...m.values()];
  }

  findTile(t: Tile): RC | null {
    for (let r=0;r<R;r++) for (let c=0;c<C;c++) if (this.grid[r][c].t === t) return [r,c];
    return null;
  }

  mostCommonColor() {
    const n = [0,0,0,0,0,0];
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){ const t = this.typeAt(r,c); if (t >= 0) n[t]++; }
    let b = 0; for (let i=1;i<6;i++) if (n[i] > n[b]) b = i; return b;
  }

  /** Drops tiles into holes, spawns new ones on top, and slides tiles diagonally into holes hidden under chests. */
  applyGravity() {
    const grid = this.grid;
    const spawn = new Array(C).fill(0);
    let again = true, guard = 0;
    while (again && guard++ < 400){
      again = false;
      let v = true;
      while (v){
        v = false;
        for (let r=R-1;r>=0;r--) for (let c=0;c<C;c++){
          const cell = grid[r][c]; if (cell.b || cell.t) continue;
          if (r === 0){ const t = this.newTile(this.ri(this.colors)); spawn[c]++; t.x = c; t.y = -spawn[c]; cell.t = t; v = true; }
          else { const up = grid[r-1][c]; if (!up.b && up.t){ cell.t = up.t; up.t = null; v = true; } }
        }
      }
      diag:
      for (let r=R-1;r>=1;r--) for (let c=0;c<C;c++){
        const cell = grid[r][c]; if (cell.b || cell.t) continue;
        if (!grid[r-1][c].b) continue;
        for (const dc of (this.rand() < .5 ? [-1,1] : [1,-1])){
          const x = c+dc; if (x < 0 || x >= C) continue;
          const src = grid[r-1][x]; if (src.b || !src.t) continue;
          const below = grid[r][x]; if (!below.b && !below.t) continue;
          cell.t = src.t; src.t = null; again = true; break diag;
        }
      }
    }
  }

  /** Reshuffles the normal tiles until there is a move and no ready-made match. */
  shuffle() {
    const grid = this.grid;
    const cells: RC[] = [], tiles: Tile[] = [];
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){ const t = grid[r][c].t; if (t && !t.special){ cells.push([r,c]); tiles.push(t); } }
    for (let k=0;k<80;k++){
      for (let i=tiles.length-1;i>0;i--){ const j = this.ri(i+1); [tiles[i],tiles[j]] = [tiles[j],tiles[i]]; }
      cells.forEach(([r,c],i) => grid[r][c].t = tiles[i]);
      if (!this.findGroups().length && this.findMove()) break;
      if (k > 40) tiles.forEach(t => t.type = this.ri(this.colors));
    }
  }
}

/** Which special a matched group creates: 5-run → crown, L/T → fire, 4-run → ferry, 2×2 → dove. */
export function groupSpecial(g: Group): Special | null {
  let maxLen = 0, hasH = false, hasV = false, dir4: 'h' | 'v' | null = null;
  g.runs.forEach(run => { maxLen = Math.max(maxLen, run.cells.length); if (run.dir === 'h') hasH = true; else hasV = true; if (run.cells.length === 4) dir4 = run.dir; });
  if (maxLen >= 5) return 'nazar';
  if (hasH && hasV) return 'mangal';
  if (maxLen === 4) return dir4 === 'h' ? 'vh' : 'vv';
  if (g.squares.length) return 'marti';
  return null;
}

/** Cell where a group's special appears: the swapped cell if it is in the group, else the run crossing, else the middle. */
export function placeFor(g: Group, pref: readonly RC[] | null) {
  if (pref) for (const [r,c] of pref){ const i = r*C+c; if (g.cells.has(i)) return i; }
  const hs = new Set<number>(), vs = new Set<number>();
  g.runs.forEach(run => run.cells.forEach(x => (run.dir === 'h' ? hs : vs).add(x)));
  for (const x of hs) if (vs.has(x)) return x;
  const arr = [...g.cells].sort((a,b) => a-b); return arr[Math.floor(arr.length/2)];
}
