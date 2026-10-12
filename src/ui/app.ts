import { $, isOn, show } from './dom';
import { closeModal, goalChips, modalOpen, openModal } from './modal';
import { Talk } from './talk';
import { renderGoals, updateBoosters, updateHud } from './hud';
import { LEVELS } from '../data/levels';
import { BOOST_TXT, WIN_H } from '../data/dialogue';
import { Game } from '../engine/game';
import { inb } from '../engine/board';
import { persistSave, recordWin, type SaveData } from '../engine/save';
import type { BoosterKind, Pos } from '../engine/types';
import { BoardView } from '../render/boardView';
import { MapScreen } from '../map/mapScreen';
import { ensureAudio, setSoundGate, sfx } from '../audio/sfx';
import { imgReady } from '../assets/images';
import { buzz } from '../platform/native';

/** Wires the engine to the DOM: screens, modals, input and the render loop. */
export class App {
  readonly game: Game;
  readonly view: BoardView;
  readonly map: MapScreen;
  readonly talk: Talk;
  private lastT = performance.now();

  constructor(readonly save: SaveData, private storage: Storage | null) {
    setSoundGate(() => this.save.sound);
    this.talk = new Talk(() => this.game.level);
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    this.game = new Game(save, {
      sleep,
      waitSettle: () => this.view.waitSettle(),
      now: () => performance.now(),
      sfx, buzz,
      spark: (r,c,col,n) => this.view.spark(r,c,col,n),
      floatText: (t,c,r) => this.view.floatText(t,c,r),
      say: (w,t) => this.talk.say(w,t),
      quip: (w,t) => this.talk.quip(w,t),
      stopTalk: () => this.talk.stop(),
      lowMoves: () => this.talk.lowMoves(),
      boostersChanged: () => updateBoosters(this.game),
      persist: () => this.persist(),
      win: stars => this.showWin(stars),
      lose: () => this.showLose(),
    });
    this.view = new BoardView($<HTMLCanvasElement>('cv'), this.game);
    this.map = new MapScreen(save, (i, fromCard) => this.startLevel(i, fromCard));
  }

  persist(){ persistSave(this.storage, this.save); }

  start(){
    this.bindInput();
    this.map.initInput();
    this.map.render();
    imgReady.then(() => this.view.sprites.clear());
    requestAnimationFrame(t => this.frame(t));
  }

  // ---------------- screens ----------------
  goToMap = () => { closeModal(); this.talk.stop(); this.game.busy = true; show('home'); this.map.render(); };

  startLevel(idx: number, fromCard?: boolean){
    const g = this.game, level = LEVELS[idx];
    this.view.reset();
    g.start(idx, level);
    $('lvlName').textContent = `${idx+1} · ${level.name}`;
    show('game'); this.view.resize($('boardWrap'));
    renderGoals(g.goals); updateHud(g); updateBoosters(g);
    if (fromCard){ setTimeout(() => { g.busy = false; g.lastInput = performance.now(); this.talk.dialog(level.npc ? [['N',''] as const, ...level.talk] : level.talk); }, 350); return; }
    this.talk.say('H', level.talk[0][1]);
    openModal(`<div class="banner">${idx+1} · ${level.name}</div><p>Collect in <b>${level.moves} moves</b>:</p><div class="row" id="introGoals"></div><p class="quote"><b>Karagöz:</b> “${level.talk[1][1]}”</p><div class="row"><button class="btn" id="goBtn">Play</button><button class="btn alt" id="mapBtn">Map</button></div>`);
    goalChips('introGoals', g.goals, 42, x => x.need);
    $('goBtn').onclick = () => { closeModal(); g.busy = false; g.lastInput = performance.now(); this.talk.dialog(level.talk); };
    $('mapBtn').onclick = this.goToMap;
  }

  showWin(stars: number){
    const g = this.game, save = this.save, levelIdx = g.levelIdx, level = g.level!;
    sfx('win');
    recordWin(save, levelIdx, stars, LEVELS.length);
    this.persist();
    const last = levelIdx === LEVELS.length - 1;
    openModal(`<div class="banner">${last ? 'Curtain call!' : level.name + ' cleared!'}</div><div class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3-stars)}</span></div><p class="quote"><b>Hacivat:</b> “${g.board.pick(WIN_H)}”</p>${last ? '' : `<div class="fact"><b>New stop unlocked: ${LEVELS[levelIdx+1].name}</b>${LEVELS[levelIdx+1].sub}</div>`}<p>Reward: 🩴 +1${stars === 3 ? '  🧹 +1  🎲 +1  ⚡ +1' : ''}</p><div class="row">${last ? '' : '<button class="btn" id="nextBtn">Continue</button>'}<button class="btn alt" id="mapBtn">Map</button></div>`);
    if (!last) $('nextBtn').onclick = () => { const n = levelIdx + 1; this.goToMap(); setTimeout(() => this.map.centerOn(n, true), 250); setTimeout(() => this.map.openPlace(n), 900); };
    $('mapBtn').onclick = this.goToMap;
  }

  showLose(){
    const g = this.game;
    sfx('lose'); this.talk.stop(); this.talk.say('H','You have torn the curtain and left it in ruins!');
    openModal(`<div class="banner">The tea went cold!</div><p class="quote"><b>Hacivat:</b> “You have torn the curtain and left it in ruins!”<br><b>Karagöz:</b> “Brew another pot, I'll fix it!”</p><div class="row" id="loseGoals"></div><div class="row">${g.extraUsed ? '' : '<button class="btn warm" id="moreBtn">🍵 +5 moves</button>'}<button class="btn" id="retryBtn">Try again</button><button class="btn alt" id="mapBtn">Map</button></div>`);
    goalChips('loseGoals', g.goals.filter(x => x.got < x.need), 36, x => x.need - x.got);
    if (!g.extraUsed) $('moreBtn').onclick = () => { g.addExtraMoves(); closeModal(); g.busy = false; g.lastInput = performance.now(); this.talk.say('K','Fresh tea! Let\'s go!'); };
    $('retryBtn').onclick = () => { closeModal(); this.startLevel(g.levelIdx); };
    $('mapBtn').onclick = this.goToMap;
  }

  /** Pause card ("Tea break"). Returns false if it couldn't open (mid-turn or a card is already up). */
  pause(){
    const g = this.game;
    if (g.busy || modalOpen()) return false;
    g.busy = true;
    openModal(`<div class="banner">Tea break</div><p class="quote"><b>Karagöz:</b> “A tea break? Two sugars for me!”</p><div class="row"><button class="btn" id="resumeBtn">Resume</button><button class="btn alt" id="mapBtn">Map</button></div>`);
    $('resumeBtn').onclick = () => { closeModal(); g.busy = false; g.lastInput = performance.now(); };
    $('mapBtn').onclick = this.goToMap;
    return true;
  }

  private toggleBooster(kind: Exclude<BoosterKind, 'zar'>){
    const g = this.game;
    if (g.busy) return;
    const t = BOOST_TXT[kind];
    if ((this.save.boost[kind] || 0) <= 0){ this.talk.quip('K', t[2]); return; }
    g.boosterMode = g.boosterMode === kind ? null : kind; g.selected = null;
    if (g.boosterMode) this.talk.say(t[0], t[1]);
    updateBoosters(g);
  }

  // ---------------- loop ----------------
  private frame(now: number){
    const g = this.game, v = this.view;
    const dt = Math.min(.05, (now - this.lastT)/1000); this.lastT = now; v.T = now/1000;
    if (isOn('game') && g.grid.length){
      v.update(dt); v.draw();
      if (g.hudDirty){ updateHud(g); g.hudDirty = false; }
      if (!g.busy && g.hint === null && now - g.lastInput > 6000) g.hint = g.board.findMove() || 0;
    } else v.flushSettle();
    requestAnimationFrame(t => this.frame(t));
  }

  // ---------------- input ----------------
  private bindInput(){
    const g = this.game, v = this.view, cv = v.cv;
    let down: { p: Pos; x: number; y: number; moved: boolean } | null = null;
    cv.addEventListener('pointerdown', e => {
      ensureAudio(); if (g.busy) return;
      const p = v.cellAt(e); if (!p) return;
      g.lastInput = performance.now(); g.hint = null;
      if (g.boosterMode){ g.useBooster(p); return; }
      down = { p, x:e.clientX, y:e.clientY, moved:false };
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', e => {
      if (!down || down.moved || g.busy) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y, th = v.cs*.35;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
      down.moved = true;
      const q = Math.abs(dx) > Math.abs(dy) ? { r:down.p.r, c:down.p.c + Math.sign(dx) } : { r:down.p.r + Math.sign(dy), c:down.p.c };
      g.selected = null;
      if (inb(q.r,q.c)) g.trySwap(down.p, q);
    });
    cv.addEventListener('pointerup', () => {
      if (!down) return;
      const d = down; down = null;
      if (d.moved || g.busy) return;
      const p = d.p, t = g.grid[p.r][p.c].t, sel = g.selected;
      if (sel && Math.abs(sel.r - p.r) + Math.abs(sel.c - p.c) === 1){ g.selected = null; g.trySwap(sel, p); return; }
      if (t && t.special){ g.tapSpecial(p); return; }
      if (t) g.selected = (sel && sel.r === p.r && sel.c === p.c) ? null : p;
    });
    cv.addEventListener('pointercancel', () => { down = null; });

    $('bTerlik').onclick = () => this.toggleBooster('terlik');
    $('bSupurge').onclick = () => this.toggleBooster('supurge');
    $('bOklava').onclick = () => this.toggleBooster('oklava');
    $('bZar').onclick = () => g.useZar();
    $('backBtn').onclick = () => { this.pause(); };
    $('soundBtn').onclick = () => { this.save.sound = !this.save.sound; this.persist(); $('soundBtn').textContent = this.save.sound ? '🔊' : '🔇'; ensureAudio(); };
    $('playBtn').onclick = () => { ensureAudio(); this.map.openPlace(Math.min(LEVELS.length, this.save.unlocked) - 1); };
    window.addEventListener('resize', () => { if (isOn('game')) v.resize($('boardWrap')); else this.map.render(); });
  }
}
