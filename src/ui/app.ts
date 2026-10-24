import { $, isOn, show } from './dom';
import { closeModal, goalChips, modalOpen, openModal } from './modal';
import { Talk } from './talk';
import { renderGoals, updateBoosters, updateHud } from './hud';
import { LEVELS } from '../data/levels';
import { BOOST_TXT, WIN_H } from '../data/dialogue';
import { Game } from '../engine/game';
import { inb } from '../engine/board';
import { grantWinReward, persistSave, recordWin, type SaveData } from '../engine/save';
import type { BoosterKind, Pos } from '../engine/types';
import { BoardView } from '../render/boardView';
import { MapScreen } from '../map/mapScreen';
import { ensureAudio, setMusicGate, setSoundGate, sfx, ui } from '../audio/sfx';
import { refreshMusic, setMusicMode } from '../audio/music';
import { flyToGoal } from './collect';
import { confetti } from './confetti';
import { adStatus, adsEnabled, lastAdError, levelEnded, maybeInterstitial, privacyOptionsRequired, refillsAvailable, showPrivacyOptions, showRewarded } from '../platform/ads';
import { IMGURL, imgReady } from '../assets/images';
import { buzz } from '../platform/native';
import { LANDMARK } from '../map/landmarks';
import { APP_VERSION } from '../version';

/** Wires the engine to the DOM: screens, modals, input and the render loop. */
export class App {
  readonly game: Game;
  readonly view: BoardView;
  readonly map: MapScreen;
  readonly talk: Talk;
  private lastT = performance.now();

  constructor(readonly save: SaveData, private storage: Storage | null) {
    setSoundGate(() => this.save.sound);
    setMusicGate(() => this.save.music);
    this.talk = new Talk(() => this.game.level);
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    this.game = new Game(save, {
      sleep,
      waitSettle: () => this.view.waitSettle(),
      now: () => performance.now(),
      sfx, buzz,
      spark: (r,c,col,n) => this.view.spark(r,c,col,n),
      collect: (kind, type, r, c) => flyToGoal(this.game.goals, kind, type, this.view.cellCenter(r, c)),
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
  goToMap = () => { closeModal(); this.talk.stop(); this.game.busy = true; show('home'); setMusicMode('map'); this.map.render(); };

  startLevel(idx: number, fromCard?: boolean){
    const g = this.game, level = LEVELS[idx];
    this.view.reset();
    g.start(idx, level);
    $('lvlName').textContent = `${idx+1} · ${level.name}`;
    $('gLand').innerHTML = LANDMARK[level.icon];
    show('game'); setMusicMode('game'); this.view.resize($('boardWrap'));
    renderGoals(g.goals); updateHud(g); updateBoosters(g);
    if (fromCard){ ui.start(); setTimeout(() => { g.busy = false; g.lastInput = performance.now(); this.talk.dialog(level.npc ? [['N',''] as const, ...level.talk] : level.talk); }, 350); return; }
    this.talk.say('H', level.talk[0][1]);
    openModal(`<div class="banner">${idx+1} · ${level.name}</div><p>Collect in <b>${level.moves} moves</b>:</p><div class="row" id="introGoals"></div><p class="quote"><b>Karagöz:</b> “${level.talk[1][1]}”</p><div class="row"><button class="btn" id="goBtn">Play</button><button class="btn alt" id="mapBtn">Map</button></div>`);
    goalChips('introGoals', g.goals, 42, x => x.need);
    $('goBtn').onclick = () => { closeModal(); ui.start(); g.busy = false; g.lastInput = performance.now(); this.talk.dialog(level.talk); };
    $('mapBtn').onclick = this.goToMap;
  }

  showWin(stars: number){
    const g = this.game, save = this.save, levelIdx = g.levelIdx, level = g.level!;
    sfx('win');
    recordWin(save, levelIdx, stars, LEVELS.length);
    this.persist();
    const last = levelIdx === LEVELS.length - 1;
    openModal(`<div class="banner">${last ? 'Curtain call!' : level.name + ' cleared!'}</div><div class="stars">${[0,1,2].map(i => `<span class="${i < stars ? 'on' : 'off'}" style="animation-delay:${.35 + i*.28}s">★</span>`).join('')}</div><p class="quote"><b>Hacivat:</b> “${g.board.pick(WIN_H)}”</p>${last ? '' : `<div class="fact"><b>New stop unlocked: ${LEVELS[levelIdx+1].name}</b>${LEVELS[levelIdx+1].sub}</div>`}<p>Reward: 🩴 +1${stars === 3 ? '  🧹 +1  🎲 +1  ⚡ +1' : ''}</p>${adsEnabled ? '<div class="row"><button class="btn warm adBtn" id="doubleBtn"><span class="adTag">▶ AD</span>Double reward</button></div>' : ''}<div class="row">${last ? '' : '<button class="btn" id="nextBtn">Continue</button>'}<button class="btn alt" id="mapBtn">Map</button></div>`);
    for (let i = 0; i < stars; i++) setTimeout(() => ui.star(i), 350 + i*280);
    if (stars >= 2) confetti(stars === 3 ? 160 : 90);
    levelEnded();
    if (adsEnabled) $('doubleBtn').onclick = async () => {
      const btn = $<HTMLButtonElement>('doubleBtn'); btn.disabled = true;
      const r = await showRewarded('double');
      // Unlike "+5 moves", a bonus is only paid for an ad actually watched.
      if (r !== 'rewarded'){ btn.disabled = false; if (r === 'unavailable'){ this.talk.say('H', 'No ad available right now, effendi.'); this.adNote(); } return; }
      grantWinReward(save, stars); this.persist(); updateBoosters(g); btn.remove();
      this.talk.say('K', 'Double helping! The bazaar is generous today!');
    };
    if (!last) $('nextBtn').onclick = async () => { await maybeInterstitial(); const n = levelIdx + 1; this.goToMap(); setTimeout(() => this.map.centerOn(n, true), 250); setTimeout(() => this.map.openPlace(n), 900); };
    $('mapBtn').onclick = async () => { await maybeInterstitial(); this.goToMap(); };
  }

  showLose(){
    const g = this.game;
    sfx('lose'); this.talk.stop(); this.talk.say('H','You have torn the curtain and left it in ruins!');
    openModal(`<div class="banner">The tea went cold!</div><p class="quote"><b>Hacivat:</b> “You have torn the curtain and left it in ruins!”<br><b>Karagöz:</b> “Brew another pot, I'll fix it!”</p><div class="row" id="loseGoals"></div><div class="row">${g.extraUsed ? '' : `<button class="btn warm adBtn" id="moreBtn">${adsEnabled ? '<span class="adTag">▶ AD</span>' : ''}🍵 +5 moves</button>`}<button class="btn" id="retryBtn">Try again</button><button class="btn alt" id="mapBtn">Map</button></div>`);
    goalChips('loseGoals', g.goals.filter(x => x.got < x.need), 36, x => x.need - x.got);
    levelEnded();
    if (!g.extraUsed) $('moreBtn').onclick = async () => {
      const btn = $<HTMLButtonElement>('moreBtn'); btn.disabled = true;
      // If no ad can be loaded (offline, no fill) the player still gets the moves, as before.
      const r = await showRewarded('moves');
      if (r === 'skipped'){ btn.disabled = false; this.talk.say('K','No ad, no tea... fair enough!'); return; }
      g.addExtraMoves(); closeModal(); g.busy = false; g.lastInput = performance.now(); this.talk.say('K','Fresh tea! Let\'s go!');
      if (r === 'unavailable') this.adNote();
    };
    $('retryBtn').onclick = async () => { await maybeInterstitial(); closeModal(); this.startLevel(g.levelIdx); };
    $('mapBtn').onclick = async () => { await maybeInterstitial(); this.goToMap(); };
  }

  /** When no ad could play, say why in a small note so it can be reported (e.g. "error 3: No fill"). */
  private adNote(){
    const why = lastAdError(); if (!why) return;
    const el = document.createElement('div'); el.className = 'adNote'; el.textContent = `Ad unavailable: ${why}`;
    document.body.append(el); setTimeout(() => el.remove(), 6000);
  }

  /** Pause card ("Tea break"). Returns false if it couldn't open (mid-turn or a card is already up). */
  pause(){
    const g = this.game;
    if (g.busy || modalOpen()) return false;
    g.busy = true;
    openModal(`<div class="banner" id="pauseBanner">Tea break</div><p class="quote"><b>Karagöz:</b> “A tea break? Two sugars for me!”</p><div class="row toggles"><button class="tog" id="togSound"></button><button class="tog" id="togMusic"></button></div><div class="row"><button class="btn" id="resumeBtn">Resume</button><button class="btn alt" id="mapBtn">Map</button></div>${privacyOptionsRequired() ? '<button class="linkBtn" id="privacyBtn">Privacy settings</button>' : ''}<p class="small adDiag">v${APP_VERSION}${adsEnabled ? ' · ' + adStatus() : ''}</p>`);
    this.bindToggles();
    if (privacyOptionsRequired()) $('privacyBtn').onclick = () => showPrivacyOptions();
    $('resumeBtn').onclick = () => { closeModal(); g.busy = false; g.lastInput = performance.now(); };
    $('mapBtn').onclick = this.goToMap;
    return true;
  }

  /** Sound / music switches on the pause card. */
  private bindToggles(){
    const paint = () => {
      $('togSound').textContent = `${this.save.sound ? '🔊' : '🔇'} Sound ${this.save.sound ? 'on' : 'off'}`; $('togSound').classList.toggle('off', !this.save.sound);
      $('togMusic').textContent = `🎵 Music ${this.save.music ? 'on' : 'off'}`; $('togMusic').classList.toggle('off', !this.save.music);
    };
    $('togSound').onclick = () => { this.toggleSound(); paint(); };
    $('togMusic').onclick = () => { this.toggleMusic(); paint(); };
    paint();
  }
  private toggleSound(){ this.save.sound = !this.save.sound; this.persist(); $('soundBtn').textContent = this.save.sound ? '🔊' : '🔇'; ensureAudio(); }
  private toggleMusic(){ this.save.music = !this.save.music; this.persist(); $('musicBtn').classList.toggle('off', !this.save.music); ensureAudio(); refreshMusic(); }

  /** Out of a booster: offer one more for watching an ad (capped per day). */
  private offerRefill(kind: BoosterKind, line: string){
    const g = this.game;
    if (g.busy || modalOpen()) return;
    const NAMES: Record<BoosterKind, [string, string]> = { terlik:['slipper','slipper'], oklava:['lightning','bolt'], supurge:['broom','broom'], zar:['dice','die'] };
    const [name, img] = NAMES[kind], left = refillsAvailable();
    if (!adsEnabled || !left){ this.talk.quip('K', line); return; }
    g.busy = true;
    openModal(`<div class="banner">Out of ${name}s</div><div class="refillIco"><img src="${IMGURL[img]}" alt=""></div><p>Watch a short ad to get <b>+1 ${name}</b>.</p><p class="small">${left} free refill${left > 1 ? 's' : ''} left today</p><div class="row"><button class="btn warm adBtn" id="refillBtn"><span class="adTag">▶ AD</span>+1 ${name}</button><button class="btn alt" id="noBtn">No thanks</button></div>`);
    const close = () => { closeModal(); g.busy = false; g.lastInput = performance.now(); };
    $('noBtn').onclick = close;
    $('refillBtn').onclick = async () => {
      $<HTMLButtonElement>('refillBtn').disabled = true;
      const r = await showRewarded('refill');
      close();
      // No ad available (offline, no fill): give it anyway, like "+5 moves". It still counts toward the daily cap.
      if (r === 'skipped') return;
      this.save.boost[kind] = Math.min(9, (this.save.boost[kind] || 0) + 1); this.persist(); updateBoosters(g);
      this.talk.say('K', r === 'rewarded' ? `One more ${name}, fresh from the bazaar!` : `No ad today, so this ${name} is on the house!`);
      if (r === 'unavailable') this.adNote();
    };
  }

  private toggleBooster(kind: Exclude<BoosterKind, 'zar'>){
    const g = this.game;
    if (g.busy) return;
    const t = BOOST_TXT[kind];
    if ((this.save.boost[kind] || 0) <= 0){ this.offerRefill(kind, t[2]); return; }
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
    $('bZar').onclick = () => { if (!g.busy && (this.save.boost.zar || 0) <= 0) this.offerRefill('zar', 'No dice left! Win with three stars to earn more.'); else g.useZar(); };
    $('backBtn').onclick = () => { this.pause(); };
    $('soundBtn').onclick = () => this.toggleSound();
    $('musicBtn').onclick = () => this.toggleMusic();
    // Every button press gets a soft click (and wakes the audio on the first one).
    document.addEventListener('click', e => { if ((e.target as Element).closest?.('button')){ ensureAudio(); ui.click(); } }, true);
    $('playBtn').onclick = () => { ensureAudio(); this.map.openPlace(Math.min(LEVELS.length, this.save.unlocked) - 1); };
    window.addEventListener('resize', () => { if (isOn('game')) v.resize($('boardWrap')); else this.map.render(); });
  }
}
