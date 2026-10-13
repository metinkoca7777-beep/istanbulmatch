import type { Sfx } from '../engine/game';
import type { Blast } from '../engine/types';
import { getMixer } from './mixer';
import { startMusic, duckMusic } from './music';

// Recorded sound effects (Kenney, CC0 — see src/assets/sfx/CREDITS.md), loaded once and
// played through WebAudio so they can be pitched, layered and throttled.
const urls = import.meta.glob<string>('../assets/sfx/*.ogg', { eager: true, query: '?url', import: 'default' });
const URL_OF: Record<string, string> = Object.fromEntries(
  Object.entries(urls).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -'.ogg'.length), u]),
);

const buffers: Record<string, AudioBuffer> = {};
let loading: Promise<void> | null = null;
let soundOn = () => true;
let musicOn = () => true;

export function setSoundGate(fn: () => boolean) { soundOn = fn; }
export function setMusicGate(fn: () => boolean) { musicOn = fn; }

/** Sample bytes from a URL; inlined data: URLs (single-file builds) are decoded without fetch. */
async function bytes(u: string): Promise<ArrayBuffer> {
  if (u.startsWith('data:')){
    const bin = atob(u.slice(u.indexOf(',') + 1)), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  return (await fetch(u)).arrayBuffer();
}

function load() {
  const m = getMixer(); if (!m || loading) return loading;
  loading = Promise.all(Object.entries(URL_OF).map(async ([k, u]) => {
    try { buffers[k] = await m.ac.decodeAudioData(await bytes(u)); } catch (e) {}
  })).then(() => {});
  return loading;
}

/** Must run from a user gesture: creates/resumes the AudioContext, loads the samples and starts the music. */
export function ensureAudio() {
  const m = getMixer(); if (!m) return;
  if (m.ac.state === 'suspended') m.ac.resume().catch(() => {});
  load();
  startMusic(musicOn);
}

interface PlayOpts { rate?: number; gain?: number; /** random pitch spread in cents */ vary?: number; delay?: number; reverb?: number; }

const lastAt: Record<string, number> = {};
const voices: Record<string, number> = {};

/** Plays one sample. Rapid repeats of the same sound are thinned out so cascades don't turn into noise. */
function play(name: string, o: PlayOpts = {}) {
  const m = getMixer(), buf = buffers[name];
  if (!m || !buf || !soundOn() || m.ac.state !== 'running') return;
  const now = m.ac.currentTime + (o.delay || 0);
  if (!o.delay){
    if (now - (lastAt[name] || 0) < .03 || (voices[name] || 0) >= 5) return;
    lastAt[name] = now;
  }
  const src = m.ac.createBufferSource(); src.buffer = buf;
  const cents = (o.vary ?? 0) * (Math.random()*2 - 1);
  src.playbackRate.value = (o.rate ?? 1) * Math.pow(2, cents/1200);
  const g = m.ac.createGain(); g.gain.value = o.gain ?? 1;
  src.connect(g); g.connect(m.sfx);
  if (o.reverb){ const s = m.ac.createGain(); s.gain.value = o.reverb; g.connect(s); s.connect(m.reverb); }
  voices[name] = (voices[name] || 0) + 1;
  src.onended = () => { voices[name]--; };
  src.start(now);
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random()*a.length)];

/** Game sound cues. `f` is the old synth pitch for pops (440 + 90·chain), used here as a pitch ladder. */
export function sfx(k: Sfx, f?: number, blast?: Blast) {
  switch (k){
    case 'swap': play('swap', { gain:.55, vary:60 }); break;
    case 'nope': play('nope', { gain:.6 }); break;
    case 'pop': {
      const rate = Math.min(2.2, (f || 520) / 530);
      play(pick(['pop1','pop2','pop3','pop4']), { rate, gain:.6, reverb:.25 });
      break;
    }
    case 'boom':
      switch (blast){
        case 'vh': case 'vv': play('ferry', { gain:.8, vary:80 }); break;
        case 'cross': case 'bigcross': play('ferry', { gain:.9, rate:.85 }); play('punch', { gain:.55 }); break;
        case 'mangal': play('fire', { gain:.9, vary:60 }); play('punch', { gain:.4, rate:.8 }); break;
        case 'bigmangal': play('fire', { gain:1, rate:.8 }); play('punch', { gain:.6, rate:.7 }); break;
        case 'nazar': play('crown', { gain:.7, reverb:.5 }); play('spawn', { gain:.4, rate:1.2 }); break;
        case 'all': play('crown', { gain:.8, rate:.8, reverb:.7 }); play('fire', { gain:.8, rate:.7 }); break;
        case 'marti': play('dove', { gain:.75, vary:100 }); break;
        default: play('punch', { gain:.6 });
      }
      break;
    case 'wood': play(pick(['wood1','wood2']), { gain:.7, vary:120 }); break;
    case 'chest': play('chest', { gain:.8 }); break;
    case 'cloth': play('cloth', { gain:.6, vary:150 }); break;
    case 'spawn': play('spawn', { gain:.55, reverb:.4 }); break;
    case 'combo': play('combo', { gain:.7, reverb:.4 }); break;
    case 'slap': play('slap', { gain:.9 }); break;
    case 'zap': play('zap', { gain:.6 }); break;
    case 'broom': play('broom', { gain:.9 }); break;
    case 'dice': play('dice', { gain:1 }); break;
    case 'win': duckMusic(2.2); play('win', { gain:.9, reverb:.3 }); break;
    case 'lose': duckMusic(2); play('lose', { gain:.85, reverb:.3 }); break;
  }
}

/** UI sounds that aren't part of the game engine. */
export const ui = {
  click: () => play('click', { gain:.45 }),
  open: () => play('open', { gain:.35 }),
  start: () => { duckMusic(1.2); play('start', { gain:.75, reverb:.3 }); },
  /** The i-th star (0-based) landing on the win card, rising in pitch. */
  star: (i: number) => play('star', { gain:.8, rate:1 + i*.26, reverb:.5, delay:0 }),
};
