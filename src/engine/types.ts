/** Special tiles: ferry (4 in a row, h/v), dove (2×2), fire (L/T), crown (5 in a row). */
export type Special = 'vh' | 'vv' | 'marti' | 'mangal' | 'nazar';
/** Effects that only exist as detonations (combos), never as tiles on the board. */
export type Blast = Special | 'cross' | 'bigcross' | 'bigmangal' | 'all';

export interface Tile {
  id: number;
  /** Colour 0..5, or -1 for a special tile. */
  type: number;
  special: Special | null;
  /** Animated position in cell units (render state, eased toward the cell by the renderer). */
  x: number;
  y: number;
  /** Pop-in scale (render state). */
  sc: number;
  /** Squash-on-landing timer (render state). */
  land?: number;
  /** Already queued for detonation. */
  fired: boolean;
}

export interface Blocker { hp: number; shake: number; }

export interface Cell {
  t: Tile | null;
  /** Chest (sandık). */
  b: Blocker | null;
  /** Kilim layers left under this cell (0..2). */
  k: number;
}

export type Grid = Cell[][];
export interface Pos { r: number; c: number; }
export type RC = [number, number];

export type GoalKind = 'tile' | 'kilim' | 'sandik';
export interface GoalDef { kind: GoalKind; type?: number; need?: number; }
export interface Goal extends GoalDef { need: number; got: number; }

export type Speaker = 'H' | 'K' | 'N';

export interface Level {
  name: string;
  npc?: { n: string; k: string; line: string };
  district: string;
  icon: string;
  /** Real location on the map (SVG units). */
  pt: [number, number];
  /** Badge position on the map (SVG units). */
  badge: [number, number];
  sub: string;
  fact: string;
  moves: number;
  colors: number;
  goals: GoalDef[];
  map?: string[];
  talk: [Speaker, string][];
}

export interface QueueItem {
  r: number;
  c: number;
  special: Blast;
  tile?: Tile;
  /** Colour picked by a crown swapped with a normal tile. */
  color?: number;
  /** Special a dove carries to its target (dove + special combo). */
  carry?: Special;
}

/** One-shot visual effects the renderer animates. */
export type Fx =
  | { k: 'sweep'; r: number; c: number; dir: 'h' | 'v'; t: number; d: number }
  | { k: 'ring'; r: number; c: number; rad: number; t: number; d: number }
  | { k: 'rays'; r: number; c: number; pts: RC[]; t: number; d: number }
  | { k: 'gull'; x0: number; y0: number; x1: number; y1: number; t: number; d: number }
  | { k: 'oklava'; c: number; t: number; d: number }
  | { k: 'slip'; x1: number; y1: number; t: number; d: number }
  | { k: 'broom'; r: number; t: number; d: number };

export type BoosterKind = 'terlik' | 'oklava' | 'supurge' | 'zar';
