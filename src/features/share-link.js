// Share links: send someone the line you are looking at, and open a line someone sent you
import { decodeShare, encodeShare } from '../core/share.js';
import { LINEBY, activeLine } from '../domain/lines.js';
import { findPoint } from '../domain/points.js';
import { flyToLine } from '../map/camera.js';
import { req } from '../map/draw.js';
import { openText } from '../panels/data-pane.js';
import { setActive } from '../panels/lines-pane.js';
import { S } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { changed } from '../ui/sheet.js';
import { v2ApplyEnds, v2ConnectSites, v2Ends } from './create-lines.js';

/** What the current screen shows, in the shape core/share.js encodes. */
function describe() {
  const L = activeLine();
  if (!L) return { cam: S.cam };
  const u = S.active === 'work' ? S.work : S.userLines.find(x => x.id === S.active);
  if (!u) return { line: L.id, corridorKm: S.corridorKm };
  const base = { global: u.len == null, corridorKm: S.corridorKm };
  if (u.sites && u.sites.every(findPoint)) return { ...base, sites: u.sites };
  const ends = v2Ends(u);
  return ends ? { ...base, ends, name: u.name } : { cam: S.cam };
}

export function shareUrl() {
  return location.origin + location.pathname + encodeShare(describe());
}

/** Share sheet on phones; copies the link elsewhere. */
export async function shareCurrent() {
  const url = shareUrl();
  const L = activeLine();
  try {
    if (navigator.share) {
      await navigator.share({ title: L ? `Ley Atlas: ${L.name}` : 'Ley Atlas', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // the share sheet was closed
    openText('Copy this link', url);
  }
}

/** If the page was opened from a share link, show what it describes, then tidy the address bar. */
export function openSharedLink() {
  const d = decodeShare(location.search);
  if (!location.search) return;
  history.replaceState(history.state, '', location.pathname + location.hash);
  if (!d) return;
  if (d.corridorKm) S.corridorKm = d.corridorKm;
  if (d.cam) {
    Object.assign(S.cam, d.cam);
    changed();
    req();
  } else if (d.line) {
    if (!LINEBY[d.line]) return toast('That shared line is not in this version of the atlas');
    S.focus = true;
    setActive(d.line);
    flyToLine(activeLine());
  } else if (d.sites) {
    if (!d.sites.every(findPoint)) return toast('That shared line uses a site this atlas does not have');
    v2ConnectSites(d.sites[0], d.sites[1], !!d.global);
  } else if (d.ends && v2ApplyEnds(d.ends, d.name, !!d.global)) flyToLine(activeLine());
}
