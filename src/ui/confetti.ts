// A short burst of confetti over the whole screen for a won stop (gold, turquoise, pomegranate, tulip pink).
const COLS = ['#f5c04a', '#ffe08a', '#24b8c6', '#d8432f', '#ff5fa8', '#ffffff', '#3cc35a'];

export function confetti(count: number){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  cv.className = 'confetti'; cv.width = W*dpr; cv.height = H*dpr;
  document.body.append(cv);
  const g = cv.getContext('2d')!; g.scale(dpr, dpr);
  const ps = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    return { x: left ? -10 : W + 10, y: H*.62, vx: (left ? 1 : -1)*(260 + Math.random()*420), vy: -(520 + Math.random()*560),
      w: 6 + Math.random()*6, h: 9 + Math.random()*8, a: Math.random()*6, va: (Math.random() - .5)*14, col: COLS[i % COLS.length], wob: Math.random()*6 };
  });
  let last = performance.now(), age = 0;
  const tick = (now: number) => {
    const dt = Math.min(.05, (now - last)/1000); last = now; age += dt;
    g.clearRect(0, 0, W, H);
    for (const p of ps){
      p.vy += 900*dt; p.vx *= 1 - 1.6*dt; p.vy *= 1 - .9*dt;
      p.x += (p.vx + Math.sin(age*6 + p.wob)*40)*dt; p.y += p.vy*dt; p.a += p.va*dt;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.scale(1, Math.cos(age*8 + p.wob));
      g.globalAlpha = Math.max(0, Math.min(1, 3.2 - age)); g.fillStyle = p.col; g.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      g.restore();
    }
    if (age < 3.2) requestAnimationFrame(tick); else cv.remove();
  };
  requestAnimationFrame(tick);
}
