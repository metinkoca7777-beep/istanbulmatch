import { LEVELS } from '../data/levels';
import type { SaveData } from '../engine/save';
import { LANDMARK } from './landmarks';
import MAPDATA from './mapdata.json';

// District polygons come from OpenStreetMap-based GeoJSON, projected to a 1000×884 SVG space (mapdata.json).
const DFILL: Record<string, string> = { 'Fatih':'#ffdf9a', 'Beyoğlu':'#ffd0ae', 'Beşiktaş':'#d6eea0', 'Üsküdar':'#bfe8c8', 'Kadıköy':'#f7c9d6' };
const MAP_LABELS: [string, number, number, number, number, string][] = [
  ['Historic Peninsula',232,612,22,-8,'big'],['Beyoğlu',372,395,15,0,''],['Beşiktaş',665,240,15,0,''],['Üsküdar',830,470,15,0,''],['Kadıköy',820,820,15,0,''],
  ['Şişli',520,250,13,0,''],['Eyüpsultan',230,200,13,0,''],['Kağıthane',440,120,13,0,''],['Zeytinburnu',70,690,13,0,''],['Bayrampaşa',60,330,13,0,'']
];
const WATER_LABELS: [string, number, number, number][] = [['Golden Horn',300,350,-48],['Bosphorus',805,165,-63],['Sea of Marmara',360,830,0]];
/** Catmull-Rom style smooth path through the route badges. */
export function smoothPath(pts: readonly (readonly [number, number])[]){
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i=0;i<pts.length-1;i++){
    const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
    const c1 = [p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2 = [p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
/** The whole Istanbul map as an SVG string: districts, labels, ferries, route and level pins. */
export function buildMap(save: Pick<SaveData, 'unlocked' | 'stars'>, mapZ: number){
  const M = MAPDATA, un = save.unlocked;
  const dState: Record<string, string> = {};
  LEVELS.forEach((L,i) => { if (i+1 <= un) dState[L.district] = 'open'; else if (!dState[L.district]) dState[L.district] = 'locked'; });
  let s = `<svg viewBox="0 0 ${M.W} ${M.H}" width="${Math.round(M.W*mapZ)}" height="${Math.round(M.H*mapZ)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fb3f0"/><stop offset="1" stop-color="#2271c9"/></linearGradient>
    <pattern id="wv" width="46" height="24" patternUnits="userSpaceOnUse"><path d="M2 12 q6 -6 12 0 t12 0" stroke="#fff" stroke-opacity=".22" stroke-width="2" fill="none"/></pattern>
    <radialGradient id="bbg" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#e9f6ff"/><stop offset="1" stop-color="#8fcaf5"/></radialGradient>
    <clipPath id="bclip"><circle r="24"/></clipPath>
  </defs>
  <rect width="${M.W}" height="${M.H}" fill="url(#mw)"/><rect width="${M.W}" height="${M.H}" fill="url(#wv)"/>
  <path d="${M.land}" fill="none" stroke="#9fe0ff" stroke-opacity=".55" stroke-width="26" stroke-linejoin="round"/>
  <path d="${M.land}" fill="#1b4f8f" opacity=".35" transform="translate(0 7)"/>
  <path d="${M.land}" fill="#fff1c9" stroke="#fff1c9" stroke-width="8" stroke-linejoin="round"/>`;
  M.districts.forEach(D => {
    const st = dState[D.n], fill = st === 'open' ? (DFILL[D.n] || '#ffe2a8') : st === 'locked' ? '#cfd5c6' : '#e7e1cc';
    s += `<path d="${D.d}" fill="${fill}" stroke="#ffffff" stroke-width="2.2" stroke-dasharray="7 5" stroke-opacity=".9" stroke-linejoin="round"/>`;
  });
  s += `<g fill="#8fcf6a" stroke="#5f9e44" stroke-width="2"><ellipse cx="480" cy="584" rx="12" ry="9"/><ellipse cx="656" cy="318" rx="14" ry="10"/></g>`;
  // bridges
  s += `<g stroke-linecap="round"><path d="M433 553 L440 513" stroke="#5b6573" stroke-width="9"/><path d="M433 553 L440 513" stroke="#e6e9ee" stroke-width="5"/>
    <path d="M742 319 L818 361" stroke="#5b6573" stroke-width="10"/><path d="M742 319 L818 361" stroke="#e6e9ee" stroke-width="6"/><path d="M754 323 Q780 348 806 351" stroke="#e8433a" stroke-width="2.4" fill="none"/></g>`;
  MAP_LABELS.forEach(([t,x,y,fs,rot,cls]) => { s += `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" class="mlabel ${cls}" transform="rotate(${rot} ${x} ${y})">${t}</text>`; });
  WATER_LABELS.forEach(([t,x,y,rot]) => { s += `<text x="${x}" y="${y}" font-size="17" text-anchor="middle" class="wlabel" transform="rotate(${rot} ${x} ${y})">${t}</text>`; });
  // ferries
  const ferry = `<g transform="translate(-14 -8)"><path d="M0 9 h28 l-4 6 h-20z" fill="#1d2b3a"/><rect x="2" y="3" width="24" height="6" fill="#fff"/><rect x="12" y="-3" width="5" height="6" fill="#f2c14e"/></g>`;
  s += `<g>${ferry}<animateMotion dur="18s" repeatCount="indefinite" path="M445 548 Q560 575 655 505 Q560 575 445 548"/></g>`;
  s += `<g>${ferry}<animateMotion dur="24s" repeatCount="indefinite" path="M452 520 Q610 640 700 722 Q610 640 452 520"/></g>`;
  // compass
  s += `<g transform="translate(940 820)" class="compass"><circle r="34" fill="#fff8e4" stroke="#173b85" stroke-width="3"/><path d="M0 -28 L7 0 L0 28 L-7 0Z" fill="#d8322a" stroke="#2a1505" stroke-width="1.5"/><path d="M0 0 L7 0 L0 28 L-7 0Z" fill="#fff"/><text y="-36" text-anchor="middle" class="mlabel" font-size="14">N</text></g>`;
  // route
  const pts = LEVELS.map(L => L.badge);
  s += `<path d="${smoothPath(pts)}" fill="none" stroke="#173b85" stroke-opacity=".35" stroke-width="11" stroke-linecap="round"/>`;
  s += `<path d="${smoothPath(pts)}" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="1 11" stroke-linecap="round"/>`;
  const doneN = Math.min(un, LEVELS.length);
  if (doneN >= 2) s += `<path d="${smoothPath(pts.slice(0, doneN))}" fill="none" stroke="#ffcf3a" stroke-width="7" stroke-linecap="round"/>`;
  LEVELS.forEach(L => {
    const [px,py] = L.pt, [bx,by] = L.badge;
    s += `<line x1="${px}" y1="${py}" x2="${bx}" y2="${by}" stroke="#2a1505" stroke-width="2.5" stroke-dasharray="3 4" opacity=".55"/><circle cx="${px}" cy="${py}" r="5" fill="#d8322a" stroke="#fff" stroke-width="2.2"/>`;
  });
  LEVELS.forEach((L,i) => {
    const [bx,by] = L.badge, locked = i+1 > un, cur = i+1 === un, st = save.stars[i] || 0;
    s += `<g class="pin${locked ? ' locked' : ''}${cur ? ' cur' : ''}" data-i="${i}" transform="translate(${bx} ${by})">`;
    if (cur) s += `<circle r="31" class="pulse" fill="none" stroke="#ffd34d" stroke-width="5"/>`;
    s += `<circle r="29" fill="#fff" stroke="#173b85" stroke-width="4"/><circle r="24" fill="url(#bbg)"/>`;
    s += `<g clip-path="url(#bclip)" class="ico"><svg x="-23" y="-25" width="46" height="46" viewBox="0 0 100 100">${LANDMARK[L.icon]}</svg></g>`;
    if (locked) s += `<circle r="24" fill="#2a3448" opacity=".45"/><path d="M-6 -2 v-5 a6 6 0 0 1 12 0 v5" fill="none" stroke="#fff" stroke-width="3"/><rect x="-9" y="-3" width="18" height="13" rx="3" fill="#fff"/>`;
    s += `<rect x="-15" y="19" width="30" height="17" rx="8.5" fill="${locked ? '#7d8796' : '#d8322a'}" stroke="#fff" stroke-width="2.4"/><text y="32" text-anchor="middle" class="pnum">${i+1}</text>`;
    if (!locked && st) s += `<text y="52" text-anchor="middle" class="pstar">${'★'.repeat(st)}${'☆'.repeat(3-st)}</text>`;
    if (cur) s += `<g class="bounce"><path d="M-11 -58 h22 l-11 14z" fill="#ffd34d" stroke="#2a1505" stroke-width="2.6" stroke-linejoin="round"/></g>`;
    s += `</g>`;
  });
  return s + '</svg>';
}
