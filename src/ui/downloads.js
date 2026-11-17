// Saving files: downloads, map picture, backup and restore
import { loadState, openHtml, openText } from '../panels/data-pane.js';
import { toast } from './intro.js';
import { draw } from '../map/draw.js';
import { cv } from '../map/canvas.js';
import { V2 } from '../state/preferences.js';
import { $ } from '../core/util.js';
import { v2Render } from './panels.js';

// Saving files: inside claude.ai the page asks the viewer to confirm a real download; opened as a file in a
// browser it downloads directly; only if neither works does it fall back to a box you can copy from.
export let DLNS;
export const dlNs = () =>
  DLNS ||
  (DLNS =
    window.claude && typeof window.claude.use === 'function'
      ? window.claude.use('downloads').catch(() => null)
      : Promise.resolve(null));
export async function v2Download(name, data, type = 'application/json') {
  const asText = () =>
    typeof data === 'string'
      ? openText(name + ' (copy and save as a file)', data)
      : toast('Saving is not available in this view');
  const dl = await dlNs();
  if (dl) {
    try {
      await dl.save({ filename: name, data });
      toast('Saved ' + name);
      return;
    } catch (e) {
      const k = e && e.code;
      if (k === 'declined') {
        toast('Not saved');
        return;
      }
      if (k === 'rate_limited') {
        toast('A save is already waiting for your answer');
        return;
      }
      if (k === 'too_large') {
        toast('That file is too large to save here');
        return;
      } /* anything else: try the plain way */
    }
  }
  let framed = true;
  try {
    framed = window.self !== window.top;
  } catch (e) {}
  if (framed && !dl) {
    asText();
    return;
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Downloaded ' + name);
  } catch (e) {
    asText();
  }
}
export function v2SaveMapPicture() {
  try {
    draw();
    cv.toBlob(b => {
      if (b) v2Download('ley-atlas-map.png', b, 'image/png');
      else toast('Could not make a picture of the map');
    }, 'image/png');
  } catch (e) {
    toast('The satellite layer blocks map pictures. Switch satellite off and try again.');
  }
}
export function v2RestoreBackup() {
  openHtml(
    'Restore a backup',
    '<p class="small">Choose a backup file, or paste its contents. Saved lines and markers are restored from this backup. Imported datasets are added to your collection.</p><label class="btn primary filebtn">Choose file<input type="file" id="rb-file" accept=".json,application/json,text/plain" hidden></label><textarea id="rb-text" rows="5" placeholder="Paste the backup here"></textarea><button class="btn" id="rb-go">Restore</button><p class="small" id="rb-msg"></p>',
  );
  const run = txt => {
    try {
      const j = JSON.parse(txt);
      const code = j.state || txt.trim();
      loadState(code);
      V2.disc = null;
      V2.host = null;
      V2.tab = 'saved';
      $('#modal').hidden = true;
      v2Render();
      toast('Backup restored');
    } catch (e) {
      $('#rb-msg').textContent = 'That file could not be read as a Ley Atlas backup.';
    }
  };
  $('#rb-file').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => run(String(r.result));
    r.readAsText(f);
  };
  $('#rb-go').onclick = () => run($('#rb-text').value);
}
