import { $ } from './dom';
import { iconFor } from '../render/sprites';
import type { Goal } from '../engine/types';
import { ui } from '../audio/sfx';

export function openModal(html: string){ $('card').innerHTML = html; $('modal').classList.add('on'); ui.open(); }
export function closeModal(){ $('modal').classList.remove('on'); }
export const modalOpen = () => $('modal').classList.contains('on');

/** Appends goal chips (icon + count) to a container inside the modal. */
export function goalChips(boxId: string, goals: Pick<Goal, 'kind' | 'type'>[], size: number, count: (g: any) => number){
  goals.forEach(g => { const d = document.createElement('div'); d.className = 'goal'; d.append(iconFor(g, size)); const s = document.createElement('span'); s.textContent = String(count(g)); d.append(s); $(boxId).append(d); });
}
