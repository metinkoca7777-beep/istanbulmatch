import { $ } from './dom';
import { IMGURL } from '../assets/images';
import type { Level, Speaker } from '../engine/types';

/** The speech toast above the board: Hacivat, Karagöz or the stop's local character. */
export class Talk {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastQuip = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private level: () => Level | null) {}

  say(who: Speaker, text: string){
    const L = this.level(), npc = who === 'N' && L && L.npc;
    $('who').textContent = npc ? npc.n : who === 'H' ? 'Hacivat' : 'Karagöz';
    $('say').textContent = npc ? npc.line : text;
    $('tsvg').style.display = npc ? 'none' : 'block'; $('timg').style.display = npc ? 'block' : 'none';
    if (npc) $<HTMLImageElement>('timg').src = IMGURL[npc.k];
    else { $('tuse').setAttribute('href', who === 'H' ? '#hacivat' : '#karagoz'); $('tsvg').setAttribute('viewBox', who === 'H' ? '26 26 70 70' : '22 26 70 70'); }
    const t = $('toast'); t.classList.toggle('right', who === 'K'); t.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  /** Plays lines one after another, 2.8 s apart. */
  dialog(lines: readonly (readonly [Speaker, string])[]){ this.stop(); this.timers = lines.map((l,i) => setTimeout(() => this.say(l[0], l[1]), i*2800)); }
  /** A reaction line; ignored if another one was shown in the last 1.6 s. */
  quip(who: Speaker, text: string){ const n = performance.now(); if (n - this.lastQuip < 1600) return; this.lastQuip = n; this.stop(); this.say(who, text); }
  stop(){ this.timers.forEach(clearTimeout); }
  lowMoves(){ this.stop(); this.timers = [setTimeout(() => this.say('H','Few moves left, effendi. Careful now!'), 0), setTimeout(() => this.say('K','Careful? Casserole? I\'m hungry!'), 2400)]; }
}
