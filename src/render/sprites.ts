import { IMG } from '../assets/images';
import type { Goal, Special, Tile } from '../engine/types';

// Canvas art in a 100-unit box with the origin at the centre.
type G = CanvasRenderingContext2D;

export function ell(g: G, x: number, y: number, rx: number, ry: number, fill: string){ g.beginPath(); g.ellipse(x,y,rx,ry,0,0,Math.PI*2); g.fillStyle=fill; g.fill(); }
export function rr(g: G, x: number, y: number, w: number, h: number, r: number){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

/** Tiles 0..5: Paşa, Hilal, Lale, Dansöz, Padişah, Cin. */
export const DRAW = [0,1,2,3,4,5].map(i => (g: G) => { g.filter = 'saturate(1.35) contrast(1.08)'; g.drawImage(IMG['t'+i], -50, -50, 100, 100); g.filter = 'none'; });

function arrows(g: G, h: boolean){
  g.fillStyle = '#c8372d'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  const tri = (x: number, y: number, a: number) => { g.save(); g.translate(x,y); g.rotate(a); g.beginPath(); g.moveTo(9,0); g.lineTo(-6,-8); g.lineTo(-6,8); g.closePath(); g.fill(); g.stroke(); g.restore(); };
  if (h){ tri(43,0,0); tri(-43,0,Math.PI); } else { tri(0,-43,-Math.PI/2); tri(0,43,Math.PI/2); }
}
export function drawSpecialU(g: G, sp: Special){
  const gl = g.createRadialGradient(0,0,8,0,0,50); gl.addColorStop(0,'rgba(255,240,170,.95)'); gl.addColorStop(.55,'rgba(255,205,90,.45)'); gl.addColorStop(1,'rgba(255,200,80,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0,0,50,0,Math.PI*2); g.fill();
  if (sp === 'vh' || sp === 'vv'){ g.drawImage(IMG.ferry, -38, -38, 76, 76); arrows(g, sp === 'vh'); }
  else if (sp === 'marti') g.drawImage(IMG.dove, -44, -44, 88, 88);
  else if (sp === 'mangal') g.drawImage(IMG.fire, -44, -46, 88, 88);
  else if (sp === 'nazar') g.drawImage(IMG.crown, -44, -44, 88, 88);
}
export function drawKilimU(g: G, k: number){
  g.fillStyle = k > 1 ? '#d65a52' : '#f4b4a2'; g.fillRect(-51,-51,102,102);
  g.strokeStyle = k > 1 ? '#ffd36a' : '#e88d6f'; g.lineWidth = 4; g.strokeRect(-44,-44,88,88);
  g.fillStyle = k > 1 ? '#ffd36a' : '#e88d6f';
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy]) => { g.beginPath(); g.moveTo(sx*44,sy*30); g.lineTo(sx*30,sy*44); g.lineTo(sx*44,sy*44); g.closePath(); g.fill(); });
  g.globalAlpha = .55; g.beginPath(); g.moveTo(0,-20); g.lineTo(20,0); g.lineTo(0,20); g.lineTo(-20,0); g.closePath(); g.fill(); g.globalAlpha = 1;
}
export function drawChestU(g: G, hp: number){
  ell(g,0,43,40,6,'rgba(0,0,0,.2)');
  g.fillStyle = '#8b5a2b'; rr(g,-42,-30,84,72,10); g.fill();
  g.fillStyle = '#a86d34'; rr(g,-42,-42,84,30,12); g.fill();
  g.strokeStyle = 'rgba(60,30,10,.45)'; g.lineWidth = 2; [0,14,28].forEach(y => { g.beginPath(); g.moveTo(-40,y); g.lineTo(40,y); g.stroke(); });
  g.fillStyle = '#d9a53c'; g.fillRect(-33,-42,9,84); g.fillRect(24,-42,9,84);
  g.fillStyle = '#f2c14e'; rr(g,-8,-18,16,20,3); g.fill(); ell(g,0,-11,2.6,2.6,'#3b2413'); g.fillStyle = '#3b2413'; g.fillRect(-1,-11,2,6);
  if (hp >= 2){
    g.strokeStyle = '#5f6670'; g.lineWidth = 5; g.beginPath(); g.moveTo(-40,-38); g.lineTo(40,38); g.moveTo(40,-38); g.lineTo(-40,38); g.stroke();
    ell(g,0,0,6,6,'#7d858f');
  } else {
    g.strokeStyle = '#2b1608'; g.lineWidth = 3; g.beginPath(); g.moveTo(-20,-30); g.lineTo(-10,-14); g.lineTo(-18,4); g.lineTo(-6,24); g.stroke();
  }
}

/** Pre-rendered sprite cache, sized to the current cell size × devicePixelRatio. */
export class SpriteCache {
  private cache: Record<string, HTMLCanvasElement> = {};
  size = 40;

  clear(){ this.cache = {}; }

  get(key: string, fn: (g: G) => void){
    let c = this.cache[key]; if (c) return c;
    const S = Math.max(8, Math.ceil(this.size));
    c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d')!; g.scale(S/100, S/100); g.translate(50,50); fn(g);
    // Don't cache sprites drawn before the images finished loading.
    if (Object.values(IMG).every(im => im.complete)) this.cache[key] = c; return c;
  }

  tile(t: Tile){
    return t.special ? this.get('s'+t.special, g => drawSpecialU(g,t.special!)) : this.get('t'+t.type, g => { ell(g,0,45,30,5,'rgba(0,0,0,.22)'); g.scale(.98,.98); DRAW[t.type](g); });
  }
}

/** Goal icon as a crisp little canvas element. */
export function iconFor(goal: Pick<Goal, 'kind' | 'type'>, size: number){
  const c = document.createElement('canvas'), d = window.devicePixelRatio || 1;
  c.width = c.height = Math.ceil(size*d); c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d')!; g.scale(size*d/100, size*d/100); g.translate(50,50); g.scale(.92,.92);
  if (goal.kind === 'tile') DRAW[goal.type!](g); else if (goal.kind === 'kilim') drawKilimU(g,1); else drawChestU(g,1);
  return c;
}
