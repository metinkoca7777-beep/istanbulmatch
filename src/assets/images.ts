// Fluent Emoji 3D art (Copyright (c) Microsoft Corporation, MIT License — https://github.com/microsoft/fluentui-emoji),
// extracted from the base64 IMGDATA block of the original single-file game.
const files = import.meta.glob<string>('./img/*.png', { eager: true, query: '?url', import: 'default' });

/** Image URL by key: t0..t5 tiles, ferry/dove/fire/crown specials, slipper/bolt/broom/die boosters, n_* portraits. */
export const IMGURL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice('./img/'.length, -'.png'.length), url]),
);

export const IMG: Record<string, HTMLImageElement> = {};
Object.entries(IMGURL).forEach(([k,v]) => { const im = new Image(); im.src = v; IMG[k] = im; });
export const imgReady = Promise.all(Object.values(IMG).map(im => im.decode ? im.decode().catch(() => {}) : Promise.resolve()));
