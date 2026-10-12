import { iconFor } from '../render/sprites';
import type { Goal } from '../engine/types';

type GoalEl = Goal & { el?: HTMLElement };

let flying = 0;
const MAX_FLYING = 14;

/**
 * Royal Match-style collect: a goal icon pops out of the cleared cell and arcs into its goal
 * slot in the HUD, which bumps when it lands. Purely visual; the count is already updated.
 */
export function flyToGoal(goals: Goal[], kind: Goal['kind'], type: number | undefined, from: { x: number; y: number } | null){
  if (!from || flying >= MAX_FLYING || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const g = (goals as GoalEl[]).find(x => x.kind === kind && (kind !== 'tile' || x.type === type));
  const target = g?.el; if (!target) return;
  const to = target.getBoundingClientRect(), size = 34;
  const ico = iconFor({ kind, type }, size);
  ico.className = 'flyer';
  document.body.append(ico);
  flying++;
  const x0 = from.x - size/2, y0 = from.y - size/2, x1 = to.left + to.width/2 - size/2, y1 = to.top + to.height/2 - size/2;
  const mx = (x0 + x1)/2 + (Math.random() - .5)*80, my = Math.min(y0, y1) - 40 - Math.random()*40;
  const anim = ico.animate([
    { transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: .4 },
    { transform: `translate(${x0}px,${y0 - 16}px) scale(1.25)`, opacity: 1, offset: .15 },
    { transform: `translate(${mx}px,${my}px) scale(1.1)`, offset: .55 },
    { transform: `translate(${x1}px,${y1}px) scale(.75)`, opacity: .9 },
  ], { duration: 620 + Math.random()*120, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
  anim.onfinish = anim.oncancel = () => {
    ico.remove(); flying--;
    target.classList.remove('land'); void target.offsetWidth; target.classList.add('land');
  };
}
