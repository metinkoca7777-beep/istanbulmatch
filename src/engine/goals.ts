import type { Goal, GoalDef, GoalKind, Grid, Level } from './types';

/** Goal targets as shown on the place card, computed from the level's map (kilim layers, chest count). */
export function goalNeeds(L: Level): (GoalDef & { need: number })[] {
  let kil = 0, che = 0;
  if (L.map) L.map.forEach(row => { for (const ch of row){ if (ch === 'k') kil++; if (ch === 'K') kil += 2; if (ch === 's' || ch === 'S') che++; } });
  return L.goals.map(g => ({ ...g, need: g.kind === 'kilim' ? kil : g.kind === 'sandik' ? che : g.need! }));
}

/** Live goals for a freshly built grid. */
export function makeGoals(L: Level, grid: Grid): Goal[] {
  let kil = 0, che = 0;
  grid.forEach(row => row.forEach(cell => { kil += cell.k; if (cell.b) che++; }));
  return L.goals.map(g => ({ ...g, got:0, need: g.kind === 'kilim' ? kil : g.kind === 'sandik' ? che : g.need! }));
}

/** Counts one unit toward the first open goal of that kind. Returns true if a goal moved. */
export function progress(goals: Goal[], kind: GoalKind, type?: number) {
  for (const g of goals){ if (g.kind === kind && (kind !== 'tile' || g.type === type) && g.got < g.need){ g.got++; return true; } }
  return false;
}
export const goalOpen = (goals: Goal[], kind: GoalKind) => goals.some(g => g.kind === kind && g.got < g.need);
export const goalOpenTile = (goals: Goal[], t: number) => goals.some(g => g.kind === 'tile' && g.type === t && g.got < g.need);
export const allDone = (goals: Goal[]) => goals.every(g => g.got >= g.need);
