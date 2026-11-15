// Share links: a line (or just a map view) written into the page address (pure: no DOM, no state)
//
//   ?l=<line id>                 a published / case-study line
//   ?a=<site id>&b=<site id>     a line between two sites
//   ?p=lat,lon;lat,lon           a freehand line (5 decimals, about 1 m)
//   &g=1                         the line continues around the globe
//   &w=<km>                      search corridor
//   &n=<name>                    name of a freehand line
//   ?c=lon,lat,zoom              no line, just this view

const num = (v, lo, hi) => {
  const x = Number(v);
  return v !== '' && v != null && Number.isFinite(x) && x >= lo && x <= hi ? x : null;
};
const ID = /^[\w.:-]{1,80}$/;

/** @returns {string} the query string, starting with "?" */
export function encodeShare(d) {
  const q = new URLSearchParams();
  if (d.line) q.set('l', d.line);
  else if (d.sites) {
    q.set('a', d.sites[0]);
    q.set('b', d.sites[1]);
  } else if (d.ends) {
    q.set('p', d.ends.map(p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';'));
    if (d.name) q.set('n', d.name.slice(0, 80));
  } else if (d.cam) q.set('c', `${d.cam.lon.toFixed(4)},${d.cam.lat.toFixed(4)},${Math.round(d.cam.k)}`);
  if (d.global && (d.sites || d.ends)) q.set('g', '1');
  if (d.corridorKm && (d.line || d.sites || d.ends)) q.set('w', String(d.corridorKm));
  return '?' + q.toString();
}

/** @returns the same shape encodeShare takes, or null when the address holds no valid share. */
export function decodeShare(search) {
  const q = new URLSearchParams(search);
  const out = {};
  const w = num(q.get('w'), 0.05, 200);
  if (w != null) out.corridorKm = w;
  if (q.get('g') === '1') out.global = true;
  const l = q.get('l'),
    a = q.get('a'),
    b = q.get('b'),
    p = q.get('p'),
    c = q.get('c');
  if (l && ID.test(l)) return { ...out, line: l };
  if (a && b && ID.test(a) && ID.test(b) && a !== b) return { ...out, sites: [a, b] };
  if (p) {
    const ends = p.split(';').map(s => {
      const [la, lo] = s.split(',');
      return [num(la, -90, 90), num(lo, -180, 180)];
    });
    if (ends.length !== 2 || ends.flat().some(v => v == null)) return null;
    const n = q.get('n');
    return { ...out, ends, ...(n ? { name: n.slice(0, 80) } : {}) };
  }
  if (c) {
    const [lon, lat, k] = c.split(',');
    const cam = { lon: num(lon, -180, 180), lat: num(lat, -90, 90), k: num(k, 1, 1e9) };
    return Object.values(cam).some(v => v == null) ? null : { cam };
  }
  return null;
}
