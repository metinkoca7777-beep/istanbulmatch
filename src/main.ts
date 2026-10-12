// Bundled instead of Google Fonts so the Android build looks identical offline.
// Use the per-weight files: they carry unicode-range, so Turkish letters (ş, ğ, İ) come from the latin-ext face.
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/lilita-one/400.css';
import './styles/main.css';
import { App } from './ui/app';
import { isOn } from './ui/dom';
import { IMGURL } from './assets/images';
import { closeModal, modalOpen } from './ui/modal';
import { loadSave } from './engine/save';
import { initNative } from './platform/native';

let storage: Storage | null = null;
try { storage = window.localStorage; } catch (e) {}

const app = new App(loadSave(storage), storage);
if (import.meta.env.DEV) (window as any).__app = app; // for scripted demos and checks in dev
document.querySelectorAll<HTMLImageElement>('img[data-k]').forEach(im => { im.src = IMGURL[im.dataset.k!]; });
app.start();

const click = (id: string) => { const b = document.getElementById(id); if (b){ b.click(); return true; } return false; };
initNative({
  onBack(){
    if (modalOpen()){
      // Same buttons a player would press: Resume / Close / OK / Map.
      return click('resumeBtn') || click('closeP') || click('mapBtn') || (closeModal(), true);
    }
    if (isOn('game')) return app.pause() || true;
    return false;
  },
  onBackground(){ if (isOn('game') && !modalOpen()) app.pause(); },
});
