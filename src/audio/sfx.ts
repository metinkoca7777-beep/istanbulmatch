import type { Sfx } from '../engine/game';

// Simple WebAudio blips, unchanged from the original game.
let AC: AudioContext | null = null;
let enabled = () => true;

export function setSoundGate(fn: () => boolean) { enabled = fn; }

/** Must run from a user gesture: creates/resumes the AudioContext. */
export function ensureAudio() {
  if (!AC){ try { AC = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
}

function tone(f: number, d: number, type?: OscillatorType, v?: number, slide?: number) {
  if (!AC || !enabled()) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f,t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide,t0+d);
    g.gain.setValueAtTime(v || .07,t0); g.gain.exponentialRampToValueAtTime(.0001,t0+d);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0+d);
  } catch (e) {}
}

export function sfx(k: Sfx, f?: number) {
  switch (k){
    case 'swap': tone(480,.08,'triangle',.05,720); break;
    case 'nope': tone(220,.15,'square',.035,150); break;
    case 'pop': tone(f || 520,.13,'triangle',.07,(f || 520)*1.6); break;
    case 'boom': tone(150,.32,'sawtooth',.06,45); break;
    case 'wood': tone(240,.09,'square',.035,170); break;
    case 'win': [523,659,784,1046].forEach((x,i) => setTimeout(() => tone(x,.28,'triangle',.08), i*120)); break;
    case 'lose': [392,330,262].forEach((x,i) => setTimeout(() => tone(x,.3,'triangle',.07), i*160)); break;
  }
}
