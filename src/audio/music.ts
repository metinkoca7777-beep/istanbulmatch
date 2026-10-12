import { getMixer, type Mixer } from './mixer';

// Background music, synthesised live: an 8-bar tune in makam Hicaz on D, played on a
// kanun-like plucked voice over a D drone and an oud-like bass, with darbuka in the
// Maksum rhythm (düm tek · tek düm · tek ka). The darbuka only plays during a level.

const BPM = 92;
const EIGHTH = 60 / BPM / 2;
const D4 = 293.66;
const hz = (semi: number) => D4 * Math.pow(2, semi / 12);

// Semitones from D4 (Hicaz: D Eb F# G A Bb C D); null = rest. One row = one bar of 8 eighths.
const _ = null;
const TUNE: (number | null)[][] = [
  [7, 5, 4, 5, 7, _, 7, 8],
  [7, 5, 4, 1, 0, _, _, _],
  [0, 1, 4, 5, 7, _, 8, 7],
  [5, 4, 5, 7, 4, _, _, _],
  [12, 10, 8, 7, 8, _, 7, 5],
  [7, 8, 7, 5, 4, _, 5, 4],
  [1, 4, 5, 7, 5, 4, 1, 4],
  [0, _, _, _, _, _, _, _],
];
/** Bass root per bar, semitones from D4 (played two octaves down). */
const ROOTS = [0, 0, 0, 0, -7, 0, -2, 0];
/** Maksum on eighths: D = düm, T = tek, k = soft ka. */
const DARBUKA = 'DT.TD.Tk';

interface Bus { melody: GainNode; bass: GainNode; perc: GainNode; drone: GainNode; }

let bus: Bus | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextT = 0, step = 0;
let gate = () => true;
let mode: 'map' | 'game' = 'map';
const LEVEL = .3;

function setup(m: Mixer) {
  const { ac } = m;
  const mk = (g: number, rev = 0) => {
    const n = ac.createGain(); n.gain.value = g; n.connect(m.music);
    if (rev){ const s = ac.createGain(); s.gain.value = rev; n.connect(s); s.connect(m.reverb); }
    return n;
  };
  bus = { melody: mk(.55, .45), bass: mk(.5, .2), perc: mk(0, .15), drone: mk(.16, .3) };
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
  // Drone: D2 + A2, softly filtered with a slow breathing filter.
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = .7; lp.connect(bus.drone);
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = .07; lfoG.gain.value = 140; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  for (const [semi, det] of [[-24, -4], [-24, 5], [-17, 0]]){
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(semi); o.detune.value = det;
    const g = ac.createGain(); g.gain.value = semi === -17 ? .5 : .7; o.connect(g); g.connect(lp); o.start();
  }
}

/** Kanun/oud-style pluck: bright attack that darkens quickly, long exponential tail. */
function pluck(ac: AudioContext, out: AudioNode, t: number, f: number, vel: number, len: number) {
  const g = ac.createGain(), lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(Math.min(9000, f*12), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f*2.2), t + .25);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + len);
  lp.connect(g); g.connect(out);
  for (const [type, mul, det, amp] of [['sawtooth', 1, -5, .5], ['sawtooth', 1, 6, .5], ['triangle', 2, 0, .35]] as const){
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = type; o.frequency.value = f*mul; o.detune.value = det; og.gain.value = amp;
    o.connect(og); og.connect(lp); o.start(t); o.stop(t + len + .05);
  }
}

function drum(ac: AudioContext, out: AudioNode, t: number, kind: string) {
  if (kind === 'D'){
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + .16);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.95, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .42);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + .45);
  }
  // Skin slap: band-passed noise; düm gets a low thump, tek/ka a bright crack.
  const src = ac.createBufferSource(); src.buffer = noise;
  const bp = ac.createBiquadFilter(), g = ac.createGain();
  bp.type = 'bandpass'; bp.frequency.value = kind === 'D' ? 300 : 3400; bp.Q.value = kind === 'D' ? 1 : .9;
  const peak = kind === 'D' ? .35 : kind === 'T' ? .55 : .22, len = kind === 'D' ? .09 : .07;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + len);
  src.connect(bp); bp.connect(g); g.connect(out); src.start(t, Math.random()*.5); src.stop(t + len + .02);
}

function schedule(m: Mixer) {
  const { ac } = m, b = bus!;
  // After a stall (busy main thread, throttled timer) skip ahead instead of firing a burst of late notes.
  if (nextT < ac.currentTime - .1) nextT = ac.currentTime + .05;
  while (nextT < ac.currentTime + .25){
    const bar = Math.floor(step / 8) % TUNE.length, e = step % 8;
    const human = (Math.random() - .5) * .012;
    const note = TUNE[bar][e];
    if (note !== null) pluck(ac, b.melody, nextT + human, hz(note), .3 + Math.random()*.06 + (e % 4 === 0 ? .06 : 0), 1.3);
    if (e === 0 || e === 4){ const r = ROOTS[bar] - 24 + (e === 4 ? 7 : 0); pluck(ac, b.bass, nextT, hz(r), .42, 1.6); }
    const dk = DARBUKA[e]; if (dk !== '.') drum(ac, b.perc, nextT + human*.5, dk);
    nextT += EIGHTH; step++;
  }
}

function applyLevels() {
  const m = getMixer(); if (!m || !bus) return;
  const t = m.ac.currentTime;
  m.music.gain.cancelScheduledValues(t); m.music.gain.setTargetAtTime(gate() ? LEVEL : 0, t, .4);
  bus.perc.gain.setTargetAtTime(mode === 'game' ? .8 : 0, t, .6);
}

/** Starts the loop once (from a user gesture). `on` says whether music is enabled in settings. */
export function startMusic(on: () => boolean) {
  gate = on;
  const m = getMixer(); if (!m) return;
  if (!bus){ setup(m); nextT = m.ac.currentTime + .1; step = 0; }
  if (!timer) timer = setInterval(() => { if (gate() && m.ac.state === 'running') schedule(m); else nextT = Math.max(nextT, m.ac.currentTime + .05); }, 60);
  applyLevels();
}

/** Map: melody and drone only. Game: adds the darbuka. */
export function setMusicMode(next: 'map' | 'game') { mode = next; applyLevels(); }
/** Re-read the music setting (after the player toggles it). */
export const refreshMusic = applyLevels;

/** Dips the music under a jingle for `seconds`. */
export function duckMusic(seconds: number) {
  const m = getMixer(); if (!m || !bus || !gate()) return;
  const t = m.ac.currentTime;
  m.music.gain.cancelScheduledValues(t);
  m.music.gain.setTargetAtTime(LEVEL * .2, t, .05);
  m.music.gain.setTargetAtTime(LEVEL, t + seconds, .5);
}
