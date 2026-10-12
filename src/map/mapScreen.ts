import { $ } from '../ui/dom';
import { CHAPTERS, LEVELS } from '../data/levels';
import { goalNeeds } from '../engine/goals';
import type { SaveData } from '../engine/save';
import { IMGURL } from '../assets/images';
import { ensureAudio } from '../audio/sfx';
import { closeModal, goalChips, openModal } from '../ui/modal';
import { buildMap } from './buildMap';
import { landmarkSVG } from './landmarks';
import MAPDATA from './mapdata.json';

/** Home screen: the scrollable Istanbul map, next-stop bar and the place cards. */
export class MapScreen {
  private mapZ = 1.35;
  private panState: { x: number; y: number; sl: number; st: number; moved: boolean } | null = null;

  constructor(private save: SaveData, private startLevel: (i: number, fromCard?: boolean) => void) {}

  centerOn(i: number, smooth?: boolean){
    const v = $('mapView'), [bx,by] = LEVELS[i].badge, z = this.mapZ;
    v.scrollTo({ left: bx*z - v.clientWidth/2, top: by*z - v.clientHeight*0.48, behavior: smooth ? 'smooth' : 'auto' });
  }

  /** Place card: landmark, local character, "Did you know?" fact and the goals. */
  openPlace(i: number){
    const L = LEVELS[i], locked = i+1 > this.save.unlocked;
    openModal(`<div class="banner">${i+1} · ${L.name}</div><div class="placeArt">${landmarkSVG(L.icon)}</div><div class="placeSub">${L.sub}</div>${L.npc ? `<div class="host"><img src="${IMGURL[L.npc.k]}" alt=""><div><b>${L.npc.n}</b><span>“${L.npc.line}”</span></div></div>` : ''}<div class="fact"><b>Did you know?</b>${L.fact}</div>${locked ? '<p>Finish the previous stop to unlock this one.</p>' : `<p>Collect in <b>${L.moves} moves</b>:</p><div class="row" id="pg"></div>`}<div class="row">${locked ? '' : '<button class="btn" id="goBtn">Play</button>'}<button class="btn alt" id="closeP">${locked ? 'OK' : 'Close'}</button></div>`);
    if (!locked){
      goalChips('pg', goalNeeds(L), 44, g => g.need);
      $('goBtn').onclick = () => { closeModal(); this.startLevel(i, true); };
    }
    $('closeP').onclick = closeModal;
  }

  render(){
    const v = $('mapView'), save = this.save;
    this.mapZ = Math.max(1.35, (v.clientHeight || 700) / MAPDATA.H);
    $('mapInner').innerHTML = buildMap(save, this.mapZ);
    const next = Math.min(LEVELS.length, save.unlocked) - 1, L = LEVELS[next];
    $('starTotal').textContent = String(save.stars.reduce((a,b) => a + (b || 0), 0));
    $('nextName').textContent = L.name; $('nextSub').textContent = L.sub;
    $('nextIco').innerHTML = landmarkSVG(L.icon);
    $('playLvl').textContent = `Level ${next + 1}`;
    const ch = L.district, inCh = LEVELS.filter(x => x.district === ch), pos = inCh.indexOf(L) + 1;
    $('chapter').textContent = `${CHAPTERS[ch]} · ${pos}/${inCh.length}`;
    $('soundBtn').textContent = save.sound ? '🔊' : '🔇';
    requestAnimationFrame(() => this.centerOn(next, false));
  }

  /** Mouse drag-to-pan (touch uses native scrolling) and pin taps. */
  initInput(){
    const v = $('mapView');
    v.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; this.panState = { x:e.clientX, y:e.clientY, sl:v.scrollLeft, st:v.scrollTop, moved:false }; });
    window.addEventListener('pointermove', e => { const p = this.panState; if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.abs(dx) + Math.abs(dy) > 6) p.moved = true; v.scrollLeft = p.sl - dx; v.scrollTop = p.st - dy; });
    window.addEventListener('pointerup', () => { setTimeout(() => { this.panState = null; }, 0); });
    $('mapInner').addEventListener('click', e => {
      if (this.panState && this.panState.moved) return;
      const pin = (e.target as Element).closest && (e.target as Element).closest<SVGElement>('.pin'); if (!pin) return;
      ensureAudio(); this.openPlace(+pin.dataset.i!);
    });
  }
}
