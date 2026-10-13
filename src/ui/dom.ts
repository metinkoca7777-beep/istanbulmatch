export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Shows one screen section and hides the other. */
export function show(id: 'home' | 'game'){ (['home','game'] as const).forEach(s => $(s).classList.toggle('on', s === id)); }
export const isOn = (id: string) => $(id).classList.contains('on');
