import type { BoosterKind } from './types';

export const SKEY = 'tatli-kavga-v1';

export interface SaveData {
  /** Highest playable level, 1-based. */
  unlocked: number;
  /** Best stars per level index. */
  stars: number[];
  boost: Record<BoosterKind, number>;
  sound: boolean;
}

const defaultBoost = (): SaveData['boost'] => ({ terlik:3, supurge:2, oklava:2, zar:2 });
export const defaultSave = (): SaveData => ({ unlocked:1, stars:[], boost:defaultBoost(), sound:true });

type KV = Pick<Storage, 'getItem' | 'setItem'>;

/** Reads the save from storage, merging over defaults exactly like the original game. Never throws. */
export function loadSave(storage: KV | null | undefined): SaveData {
  let save = defaultSave();
  try {
    const s = JSON.parse(storage?.getItem(SKEY) || 'null');
    if (s && typeof s === 'object') save = Object.assign(save, s, { boost:Object.assign(defaultBoost(), s.boost || {}) });
  } catch (e) {}
  return save;
}

export function persistSave(storage: KV | null | undefined, save: SaveData) {
  try { storage?.setItem(SKEY, JSON.stringify(save)); } catch (e) {}
}

/** 3 stars with ≥30% of the moves left, 2 with ≥12%, else 1. */
export function starsFor(movesLeft: number, moves: number) {
  const ratio = movesLeft / moves;
  return ratio >= .3 ? 3 : ratio >= .12 ? 2 : 1;
}

/** Records a cleared level: best stars, unlocks the next stop, and hands out booster rewards (capped at 9). */
export function recordWin(save: SaveData, levelIdx: number, stars: number, levelCount: number) {
  save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(levelCount, levelIdx + 2));
  save.boost.terlik = Math.min(9, save.boost.terlik + 1);
  if (stars === 3){ save.boost.supurge = Math.min(9, save.boost.supurge + 1); save.boost.oklava = Math.min(9, (save.boost.oklava || 0) + 1); save.boost.zar = Math.min(9, (save.boost.zar || 0) + 1); }
}
