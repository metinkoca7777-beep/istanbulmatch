// One AudioContext for the whole game: sfx and music buses into a gentle compressor,
// plus a shared reverb send. Created lazily from the first user gesture (autoplay rules).

export interface Mixer {
  ac: AudioContext;
  sfx: GainNode;
  music: GainNode;
  /** Send into the shared hall reverb. */
  reverb: GainNode;
  /** Final output, after compression and limiting. */
  out: GainNode;
}

let mixer: Mixer | null = null;

/** A synthetic hall: decaying stereo noise, darker towards the tail. */
function impulse(ac: AudioContext, seconds: number) {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++){
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++){
      const t = i / len, k = .35 + .6*t; // low-pass coefficient rises → tail gets darker
      lp += (Math.random()*2 - 1 - lp) * (1 - k);
      d[i] = lp * Math.pow(1 - t, 2.6);
    }
  }
  return buf;
}

export function getMixer(): Mixer | null {
  if (mixer) return mixer;
  let ac: AudioContext;
  try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (e) { return null; }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
  // Brick-wall-ish limiter after the glue compressor so stacked blasts never clip.
  const limit = ac.createDynamicsCompressor();
  limit.threshold.value = -4; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = .001; limit.release.value = .12;
  const master = ac.createGain(); master.gain.value = .85;
  comp.connect(limit); limit.connect(master); master.connect(ac.destination);
  const sfx = ac.createGain(); sfx.gain.value = .75; sfx.connect(comp);
  const music = ac.createGain(); music.gain.value = 0; music.connect(comp);
  const conv = ac.createConvolver(); conv.buffer = impulse(ac, 2.4);
  const reverb = ac.createGain(); reverb.gain.value = 1;
  reverb.connect(conv); conv.connect(comp);
  mixer = { ac, sfx, music, reverb, out: master };
  if (import.meta.env.DEV) (window as any).__mixer = mixer; // for the audio checks in dev
  // Pause all audio while the page/app is hidden.
  document.addEventListener('visibilitychange', () => {
    if (!mixer) return;
    if (document.hidden) mixer.ac.suspend().catch(() => {}); else mixer.ac.resume().catch(() => {});
  });
  return mixer;
}
