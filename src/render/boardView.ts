import { IMG } from '../assets/images';
import { C, R } from '../engine/board';
import type { Game } from '../engine/game';
import { SpriteCache, drawChestU, drawKilimU, drawSpecialU, rr } from './sprites';

const SPEED = 11; // cells per second

interface Particle { x: number; y: number; vx: number; vy: number; life: number; col: string; sz: number; }
interface Float { txt: string; x: number; y: number; t: number; d: number; }

/** Draws the board canvas and animates tiles, particles, floating text and effects. */
export class BoardView {
  readonly ctx: CanvasRenderingContext2D;
  readonly sprites = new SpriteCache();
  cs = 40;
  boardPx = 320;
  dpr = 1;
  /** Seconds since page load (drives pulsing). */
  T = 0;
  parts: Particle[] = [];
  floats: Float[] = [];
  private settleWaiters: (() => void)[] = [];

  constructor(readonly cv: HTMLCanvasElement, readonly game: Game) {
    this.ctx = cv.getContext('2d')!;
  }

  reset(){ this.parts = []; this.floats = []; }

  /** Fits the board into its wrapper (a multiple of 8 px, 200..560). */
  resize(wrap: HTMLElement){
    const w = wrap.clientWidth, h = wrap.clientHeight;
    let size = Math.floor(Math.min(w - 50, h - 44, 560));
    size = Math.max(200, size - size % C);
    this.boardPx = size; this.cs = size / C; this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cv.style.width = this.cv.style.height = size + 'px';
    this.cv.width = this.cv.height = Math.round(size*this.dpr);
    this.sprites.size = this.cs * this.dpr;
    this.sprites.clear();
  }

  waitSettle(){ return new Promise<void>(res => this.settleWaiters.push(res)); }
  /** Releases everyone waiting for tiles to settle (used when the board isn't being animated). */
  flushSettle(){ if (this.settleWaiters.length){ const w = this.settleWaiters; this.settleWaiters = []; w.forEach(f => f()); } }

  spark(r: number, c: number, col: string, n: number){
    const cs = this.cs;
    for (let i=0;i<n;i++) this.parts.push({ x:(c+.5)*cs, y:(r+.5)*cs, vx:(Math.random()-.5)*cs*7, vy:(Math.random()-.85)*cs*7, life:.55, col, sz:cs*(.05+Math.random()*.06) });
  }
  floatText(txt: string, c: number, r: number){ this.floats.push({ txt, x:(c+.5)*this.cs, y:(r+.5)*this.cs, t:0, d:1.1 }); }

  /** Cell under a pointer event, or null if outside the board. */
  cellAt(e: { clientX: number; clientY: number }){
    const cv = this.cv, rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left - cv.clientLeft, y = e.clientY - rect.top - cv.clientTop;
    const c = Math.floor(x/this.cs), r = Math.floor(y/this.cs);
    return r >= 0 && r < R && c >= 0 && c < C ? { r, c } : null;
  }

  update(dt: number){
    const g = this.game, grid = g.grid, cs = this.cs;
    let moving = false;
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      const cell = grid[r][c];
      if (cell.b && cell.b.shake > 0) cell.b.shake -= dt;
      const t = cell.t; if (!t) continue;
      const dx = c - t.x, dy = r - t.y;
      if (dx || dy){
        const d = Math.hypot(dx,dy), step = SPEED*dt;
        if (d <= step){ if (dy > .3) t.land = .18; t.x = c; t.y = r; } else { t.x += dx/d*step; t.y += dy/d*step; moving = true; }
      }
      if (t.sc < 1) t.sc = Math.min(1, t.sc + dt*5);
      if (t.land! > 0) t.land = Math.max(0, t.land! - dt);
    }
    g.dying = g.dying.filter(d => (d.life -= dt) > 0);
    this.parts = this.parts.filter(p => { p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += cs*16*dt; return p.life > 0; });
    g.fx = g.fx.filter(f => (f.t += dt) < f.d);
    this.floats = this.floats.filter(f => (f.t += dt) < f.d);
    if (g.shakeT > 0) g.shakeT -= dt;
    if (!moving) this.flushSettle();
  }

  draw(){
    const { ctx, cs, sprites, T } = this, g = this.game, grid = g.grid, W = this.boardPx;
    const { selected, hint } = g;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.fillStyle = '#8fb9ec'; ctx.fillRect(0,0,W,W);
    if (g.shakeT > 0){ ctx.translate((Math.random()-.5)*cs*.14, (Math.random()-.5)*cs*.14); }
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      const x = c*cs, y = r*cs, cell = grid[r][c];
      ctx.fillStyle = (r+c)%2 ? '#c2dafa' : '#dcebff'; ctx.fillRect(x, y, cs, cs);
      if (cell.k > 0) ctx.drawImage(sprites.get('k'+cell.k, gg => drawKilimU(gg, cell.k)), x, y, cs, cs);
    }
    if (selected){ ctx.fillStyle = 'rgba(255,214,80,.75)'; rr(ctx, selected.c*cs+2, selected.r*cs+2, cs-4, cs-4, cs*.2); ctx.fill(); }
    if (hint){
      const a = .4 + .35*Math.sin(T*6);
      ctx.strokeStyle = `rgba(230,178,58,${a})`; ctx.lineWidth = Math.max(2, cs*.08);
      hint.forEach(([r,c]) => { rr(ctx, c*cs+3, r*cs+3, cs-6, cs-6, cs*.2); ctx.stroke(); });
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,W); ctx.clip();
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      const t = grid[r][c].t; if (!t) continue;
      let s = cs*1.04*t.sc;
      if (t.special) s *= 1 + .05*Math.sin(T*5 + t.id);
      if (selected && selected.r === r && selected.c === c) s *= 1.1;
      if (hint && hint.some(([y,x]) => y === r && x === c)) s *= 1 + .06*Math.sin(T*8);
      const q = t.land! > 0 ? Math.sin((t.land!/.18)*Math.PI)*.12 : 0, sw = s*(1+q), sh = s*(1-q);
      ctx.drawImage(sprites.tile(t), (t.x+.5)*cs - sw/2, (t.y+.5)*cs + s/2 - sh, sw, sh);
    }
    g.dying.forEach(d => {
      const k = d.life/d.max, s = cs*1.04*(.4 + .8*(1-k)) * (k > .5 ? 1 : k*2);
      ctx.globalAlpha = k; ctx.drawImage(sprites.tile(d.t), (d.t.x+.5)*cs - s/2, (d.t.y+.5)*cs - s/2, s, s); ctx.globalAlpha = 1;
    });
    ctx.restore();
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      const b = grid[r][c].b; if (!b) continue;
      const sh = b.shake > 0 ? Math.sin(b.shake*60)*cs*.06 : 0;
      ctx.drawImage(sprites.get('c'+b.hp, gg => drawChestU(gg, b.hp)), c*cs + sh, r*cs, cs, cs);
    }
    this.drawFx();
    this.parts.forEach(p => { ctx.globalAlpha = Math.min(1, p.life*2); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x,p.y,p.sz,0,Math.PI*2); ctx.fill(); });
    ctx.globalAlpha = 1;
    this.floats.forEach(f => {
      const p = f.t/f.d, size = cs*(.62 + .2*Math.min(1,p*4));
      ctx.globalAlpha = p < .75 ? 1 : (1-p)*4;
      ctx.font = `${size}px 'Lilita One', 'Baloo 2', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = size*.18; ctx.strokeStyle = '#5a2a08'; ctx.strokeText(f.txt, f.x, f.y - p*cs*1.2);
      ctx.fillStyle = '#ffd34d'; ctx.fillText(f.txt, f.x, f.y - p*cs*1.2);
      ctx.globalAlpha = 1;
    });
  }

  private drawFx(){
    const { ctx, cs, sprites } = this, W = this.boardPx;
    for (const f of this.game.fx){
      const p = Math.min(1, f.t/f.d);
      if (f.k === 'sweep'){
        ctx.globalAlpha = 1-p; ctx.fillStyle = 'rgba(255,240,180,.85)';
        if (f.dir === 'h') ctx.fillRect(0, f.r*cs + cs*.22, W, cs*.56); else ctx.fillRect(f.c*cs + cs*.22, 0, cs*.56, W);
        ctx.globalAlpha = 1;
        const img = sprites.get('svh', g => drawSpecialU(g,'vh')), d = p*8;
        [-1,1].forEach(sg => { let x = f.c, y = f.r; if (f.dir === 'h') x += sg*d; else y += sg*d; ctx.drawImage(img, x*cs, y*cs, cs, cs); });
      } else if (f.k === 'ring'){
        ctx.globalAlpha = 1-p;
        ctx.fillStyle = 'rgba(255,160,60,.35)'; ctx.beginPath(); ctx.arc((f.c+.5)*cs, (f.r+.5)*cs, p*f.rad*cs, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = cs*.25*(1-p) + 2; ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'rays'){
        ctx.globalAlpha = 1-p; ctx.strokeStyle = '#3fa0ec'; ctx.lineWidth = Math.max(2, cs*.09);
        f.pts.forEach(([y,x]) => { ctx.beginPath(); ctx.moveTo((f.c+.5)*cs, (f.r+.5)*cs); ctx.lineTo((x+.5)*cs, (y+.5)*cs); ctx.stroke(); });
        ctx.globalAlpha = 1;
        const s = cs*1.3; ctx.drawImage(sprites.get('snazar', g => drawSpecialU(g,'nazar')), (f.c+.5)*cs - s/2, (f.r+.5)*cs - s/2, s, s);
      } else if (f.k === 'gull'){
        const x = f.x0 + (f.x1-f.x0)*p, y = f.y0 + (f.y1-f.y0)*p - Math.sin(Math.PI*p)*1.3;
        ctx.drawImage(sprites.get('smarti', g => drawSpecialU(g,'marti')), x*cs, y*cs, cs, cs);
      } else if (f.k === 'oklava'){
        const y = (-1 + p*(R+1)) * cs;
        ctx.globalAlpha = 1-p; ctx.fillStyle = 'rgba(255,245,170,.9)'; ctx.fillRect(f.c*cs + cs*.15, 0, cs*.7, W); ctx.globalAlpha = 1;
        ctx.drawImage(IMG.bolt, f.c*cs - cs*.1, y - cs*.2, cs*1.2, cs*1.2);
      } else if (f.k === 'slip' || f.k === 'broom'){
        ctx.save();
        if (f.k === 'slip'){ const x = (C/2) + (f.x1 + .5 - C/2)*p, y = (R+1) + (f.y1 + .5 - R - 1)*p; ctx.translate(x*cs, y*cs); ctx.rotate(p*Math.PI*4); ctx.drawImage(IMG.slipper, -cs*.6, -cs*.6, cs*1.2, cs*1.2); }
        else { ctx.drawImage(IMG.broom, (-1 + p*(C+1))*cs - cs*.1, f.r*cs - cs*.1, cs*1.2, cs*1.2); }
        ctx.restore();
      }
    }
  }
}
