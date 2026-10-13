import { IMG } from '../assets/images';
import { C, R } from '../engine/board';
import type { Game } from '../engine/game';
import { SpriteCache, drawChestU, drawKilimU, drawSpecialU, rr } from './sprites';

const SPEED = 11; // cells per second

/** dot: debris that falls; star: additive sparkle; ring: expanding shock ring. */
interface Particle { kind: 'dot' | 'star' | 'ring'; x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; sz: number; rot: number; }
const MAX_PARTS = 700;
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
  /** Effects whose one-off particle burst has already been emitted. */
  private burst = new WeakSet<object>();

  constructor(readonly cv: HTMLCanvasElement, readonly game: Game) {
    this.ctx = cv.getContext('2d')!;
  }

  reset(){ this.parts = []; this.floats = []; }

  /** Fits the board into its wrapper (a multiple of 8 px, 200..560), leaving room for the gold frame. */
  resize(wrap: HTMLElement){
    const w = wrap.clientWidth, h = wrap.clientHeight;
    let size = Math.floor(Math.min(w - 40, h - 32, 560));
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

  /** Burst at a cell: falling debris in the tile's colour, a few glints and a shock ring. */
  spark(r: number, c: number, col: string, n: number){
    const cs = this.cs, x = (c+.5)*cs, y = (r+.5)*cs;
    if (this.parts.length > MAX_PARTS) return;
    for (let i=0;i<n;i++) this.parts.push({ kind:'dot', x, y, vx:(Math.random()-.5)*cs*7, vy:(Math.random()-.85)*cs*7, life:.55, max:.55, col, sz:cs*(.05+Math.random()*.07), rot:0 });
    for (let i=0;i<Math.ceil(n/2);i++){ const a = Math.random()*Math.PI*2, v = cs*(1.5 + Math.random()*3); this.parts.push({ kind:'star', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v - cs, life:.45, max:.45, col:'#fff6c8', sz:cs*(.12+Math.random()*.1), rot:Math.random()*3 }); }
    this.parts.push({ kind:'ring', x, y, vx:0, vy:0, life:.32, max:.32, col, sz:cs*.55, rot:0 });
  }
  /** Lots of glowing embers from a point (big blasts). */
  private embers(x: number, y: number, n: number, speed: number, cols: string[]){
    const cs = this.cs;
    for (let i=0;i<n && this.parts.length < MAX_PARTS;i++){ const a = Math.random()*Math.PI*2, v = cs*speed*(.4 + Math.random()); this.parts.push({ kind: i % 3 ? 'dot' : 'star', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v - cs*1.5, life:.6 + Math.random()*.3, max:.9, col:cols[i % cols.length], sz:cs*(.06 + Math.random()*.08), rot:Math.random()*3 }); }
  }
  /** Screen position of a cell's centre (for icons that fly out of the board). */
  cellCenter(r: number, c: number){
    const rect = this.cv.getBoundingClientRect();
    if (!rect.width) return null;
    return { x: rect.left + this.cv.clientLeft + (c+.5)*this.cs, y: rect.top + this.cv.clientTop + (r+.5)*this.cs };
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
    this.parts = this.parts.filter(p => { p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += (p.kind === 'star' ? 4 : 16)*cs*dt; p.rot += dt*6; return p.life > 0; });
    g.fx = g.fx.filter(f => (f.t += dt) < f.d);
    this.floats = this.floats.filter(f => (f.t += dt) < f.d);
    if (g.shakeT > 0) g.shakeT -= dt;
    if (!moving) this.flushSettle();
  }

  draw(){
    const { ctx, cs, sprites, T } = this, g = this.game, grid = g.grid, W = this.boardPx;
    const { selected, hint } = g;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,W,W);
    if (g.shakeT > 0){ ctx.translate((Math.random()-.5)*cs*.14, (Math.random()-.5)*cs*.14); }
    // Translucent navy wells: bright tiles pop, and the stop's landmark shows through the board.
    const gap = Math.max(1, cs*.045), rad = cs*.16;
    ctx.fillStyle = 'rgba(10,19,48,.2)'; ctx.fillRect(0,0,W,W);
    for (let r=0;r<R;r++) for (let c=0;c<C;c++){
      const x = c*cs, y = r*cs, cell = grid[r][c];
      ctx.fillStyle = (r+c)%2 ? 'rgba(28,52,128,.74)' : 'rgba(38,68,152,.74)'; rr(ctx, x+gap, y+gap, cs-2*gap, cs-2*gap, rad); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(ctx, x+gap, y+gap, cs-2*gap, cs*.42, rad); ctx.fill();
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
      if (t.special && t.sc < 1) this.glow((t.x+.5)*cs, (t.y+.5)*cs, cs*(.6 + 1.1*(1-t.sc)), 'rgba(255,236,150,', 1 - t.sc);
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
    if (hint && hint.length === 2) this.drawSwipeHint(hint[0], hint[1]);
    this.drawFx();
    this.drawParticles();
    this.floats.forEach(f => {
      const p = f.t/f.d, pop = p < .12 ? .4 + 1.0*(p/.12) : p < .24 ? 1.4 - .4*((p - .12)/.12) : 1, size = cs*.72*pop;
      ctx.globalAlpha = p < .75 ? 1 : (1-p)*4;
      ctx.font = `${size}px 'Lilita One', 'Baloo 2', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = size*.18; ctx.strokeStyle = '#5a2a08'; ctx.strokeText(f.txt, f.x, f.y - p*cs*1.2);
      const gr = ctx.createLinearGradient(0, f.y - p*cs*1.2 - size/2, 0, f.y - p*cs*1.2 + size/2); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(.5, '#ffd34d'); gr.addColorStop(1, '#f29a1a');
      ctx.fillStyle = gr; ctx.fillText(f.txt, f.x, f.y - p*cs*1.2);
      ctx.globalAlpha = 1;
    });
  }

  /** A fingertip that slides from one hinted cell to the other, so the suggested swap reads as a gesture. */
  private drawSwipeHint([r0,c0]: [number, number], [r1,c1]: [number, number]){
    const { ctx, cs } = this, p = (this.T % 1.4) / 1.4, k = Math.min(1, p / .7), e = k*k*(3 - 2*k);
    const x = (c0 + .5 + (c1 - c0)*e)*cs, y = (r0 + .5 + (r1 - r0)*e)*cs;
    ctx.save();
    ctx.globalAlpha = p < .85 ? .9 : (1 - p) / .15 * .9;
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#13245c'; ctx.lineWidth = Math.max(2, cs*.06);
    ctx.beginPath(); ctx.arc(x, y, cs*.17, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha *= .5; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, cs*.04);
    ctx.beginPath(); ctx.arc(x, y, cs*(.22 + .1*Math.sin(this.T*8)), 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  /** Soft additive glow disc. `rgba` is a colour prefix like 'rgba(255,200,80,'. */
  private glow(x: number, y: number, rad: number, rgba: string, a: number){
    if (a <= 0 || rad <= 0) return;
    const ctx = this.ctx, gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba + (.9*a) + ')'); gr.addColorStop(.4, rgba + (.45*a) + ')'); gr.addColorStop(1, rgba + '0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
  /** Bright additive beam across a row ('h') or down a column ('v'). */
  private beam(dir: 'h' | 'v', at: number, a: number){
    const ctx = this.ctx, W = this.boardPx, half = this.cs*.55;
    const gr = dir === 'h' ? ctx.createLinearGradient(0, at - half, 0, at + half) : ctx.createLinearGradient(at - half, 0, at + half, 0);
    gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(.42, `rgba(255,230,150,${.55*a})`); gr.addColorStop(.5, `rgba(255,255,255,${.95*a})`); gr.addColorStop(.58, `rgba(255,230,150,${.55*a})`); gr.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr;
    if (dir === 'h') ctx.fillRect(0, at - half, W, half*2); else ctx.fillRect(at - half, 0, half*2, W);
    ctx.restore();
  }
  /** A flickering jagged bolt down a column. */
  private lightning(x: number, H: number, a: number){
    const ctx = this.ctx, cs = this.cs;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    for (const [w, col] of [[cs*.28, `rgba(120,190,255,${.35*a})`], [cs*.07, `rgba(255,255,255,${.95*a})`]] as const){
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = cs*.5; y < H; y += cs*.5) ctx.lineTo(x + (Math.random() - .5)*cs*.5, y);
      ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.restore();
  }
  private drawParticles(){
    const ctx = this.ctx;
    for (const p of this.parts){
      const k = p.life/p.max;
      if (p.kind === 'ring'){
        ctx.globalAlpha = k*.9; ctx.strokeStyle = p.col; ctx.lineWidth = this.cs*.09*k + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz*(.3 + .9*(1-k)), 0, Math.PI*2); ctx.stroke();
      } else if (p.kind === 'star'){
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, k*1.6); ctx.fillStyle = p.col;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); const s = p.sz*(.5 + .5*k);
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = Math.min(1, p.life*2); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFx(){
    const { ctx, cs, sprites } = this, W = this.boardPx;
    for (const f of this.game.fx){
      const p = Math.min(1, f.t/f.d);
      if (f.k === 'sweep'){
        ctx.globalAlpha = 1-p; ctx.fillStyle = 'rgba(255,240,180,.85)';
        if (f.dir === 'h') ctx.fillRect(0, f.r*cs + cs*.22, W, cs*.56); else ctx.fillRect(f.c*cs + cs*.22, 0, cs*.56, W);
        this.beam(f.dir, f.dir === 'h' ? (f.r+.5)*cs : (f.c+.5)*cs, 1-p);
        ctx.globalAlpha = 1;
        if (!this.burst.has(f)){ this.burst.add(f); for (let i=0;i<C;i++) this.embers(f.dir === 'h' ? (i+.5)*cs : (f.c+.5)*cs, f.dir === 'h' ? (f.r+.5)*cs : (i+.5)*cs, 3, 2.2, ['#fff6c8','#ffd34d']); }
        const img = sprites.get('svh', g => drawSpecialU(g,'vh')), d = p*8;
        [-1,1].forEach(sg => { let x = f.c, y = f.r; if (f.dir === 'h') x += sg*d; else y += sg*d; ctx.drawImage(img, x*cs, y*cs, cs, cs); });
      } else if (f.k === 'ring'){
        if (!this.burst.has(f)){ this.burst.add(f); this.embers((f.c+.5)*cs, (f.r+.5)*cs, 18 + f.rad*8, 3 + f.rad, ['#ffd34d','#ff7a1a','#ff4a1a','#fff3b0']); }
        this.glow((f.c+.5)*cs, (f.r+.5)*cs, cs*f.rad*(.4 + p), 'rgba(255,170,60,', (1-p)*.9);
        ctx.globalAlpha = 1-p;
        ctx.fillStyle = 'rgba(255,160,60,.35)'; ctx.beginPath(); ctx.arc((f.c+.5)*cs, (f.r+.5)*cs, p*f.rad*cs, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = cs*.25*(1-p) + 2; ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'rays'){
        if (!this.burst.has(f)){ this.burst.add(f); f.pts.forEach(([y,x]) => this.embers((x+.5)*cs, (y+.5)*cs, 4, 1.6, ['#bfe6ff','#ffffff','#ffd34d'])); }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [w, col] of [[cs*.32, 'rgba(63,160,236,.35)'], [Math.max(2, cs*.09), 'rgba(220,245,255,.95)']] as const){
          ctx.globalAlpha = 1-p; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
          f.pts.forEach(([y,x]) => { ctx.beginPath(); ctx.moveTo((f.c+.5)*cs, (f.r+.5)*cs); ctx.lineTo((x+.5)*cs, (y+.5)*cs); ctx.stroke(); });
        }
        ctx.restore();
        this.glow((f.c+.5)*cs, (f.r+.5)*cs, cs*1.6, 'rgba(255,236,150,', 1-p);
        ctx.globalAlpha = 1;
        const s = cs*1.3; ctx.drawImage(sprites.get('snazar', g => drawSpecialU(g,'nazar')), (f.c+.5)*cs - s/2, (f.r+.5)*cs - s/2, s, s);
      } else if (f.k === 'gull'){
        const x = f.x0 + (f.x1-f.x0)*p, y = f.y0 + (f.y1-f.y0)*p - Math.sin(Math.PI*p)*1.3;
        ctx.drawImage(sprites.get('smarti', g => drawSpecialU(g,'marti')), x*cs, y*cs, cs, cs);
      } else if (f.k === 'oklava'){
        const y = (-1 + p*(R+1)) * cs;
        this.lightning((f.c+.5)*cs, W, 1-p);
        ctx.globalAlpha = 1-p; ctx.fillStyle = 'rgba(255,245,170,.9)'; ctx.fillRect(f.c*cs + cs*.15, 0, cs*.7, W); ctx.globalAlpha = 1;
        ctx.drawImage(IMG.bolt, f.c*cs - cs*.1, y - cs*.2, cs*1.2, cs*1.2);
      } else if (f.k === 'slip' || f.k === 'broom'){
        ctx.save();
        if (f.k === 'slip'){ const x = (C/2) + (f.x1 + .5 - C/2)*p, y = (R+1) + (f.y1 + .5 - R - 1)*p; ctx.translate(x*cs, y*cs); ctx.rotate(p*Math.PI*4); ctx.drawImage(IMG.slipper, -cs*.6, -cs*.6, cs*1.2, cs*1.2); }
        else { const bx = (-1 + p*(C+1))*cs; ctx.drawImage(IMG.broom, bx - cs*.1, f.r*cs - cs*.1, cs*1.2, cs*1.2); if (Math.random() < .6) this.embers(bx, (f.r+.9)*cs, 1, 1.2, ['#e8d9b8','#cdb894']); }
        ctx.restore();
      }
    }
  }
}
