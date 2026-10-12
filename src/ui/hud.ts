import { $ } from './dom';
import { iconFor } from '../render/sprites';
import type { Game } from '../engine/game';
import type { Goal } from '../engine/types';

type GoalEl = Goal & { el?: HTMLElement; span?: HTMLElement; lastLeft?: number };

export function renderGoals(goals: GoalEl[]){
  const box = $('goals'); box.innerHTML = '';
  goals.forEach(g => {
    const d = document.createElement('div'); d.className = 'goal';
    d.append(iconFor(g, 42)); const s = document.createElement('span'); d.append(s); g.el = d; g.span = s; box.append(d);
  });
}

export function updateHud(game: Game){
  $('moves').textContent = String(game.movesLeft);
  $('movesBox').classList.toggle('low', game.movesLeft <= 3);
  (game.goals as GoalEl[]).forEach(g => { const left = Math.max(0, g.need - g.got); if (g.lastLeft !== undefined && g.lastLeft !== left){ g.el!.classList.remove('bump'); void g.el!.offsetWidth; g.el!.classList.add('bump'); } g.lastLeft = left; g.span!.textContent = left ? String(left) : '✓'; g.el!.classList.toggle('done', !left); });
}

const BKEYS = [['terlik','bTerlik','cTerlik'],['oklava','bOklava','cOklava'],['supurge','bSupurge','cSupurge'],['zar','bZar','cZar']] as const;
export function updateBoosters(game: Game){
  BKEYS.forEach(([k,b,c]) => { const n = game.save.boost[k] || 0; $(c).textContent = n > 0 ? String(n) : '+'; $(b).classList.toggle('active', game.boosterMode === k); $(b).classList.toggle('empty', n <= 0); });
}
