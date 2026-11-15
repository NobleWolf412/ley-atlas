// Star fort notes and coordinate parsing

// ================= FORTS pane =================
export function parseCoords(txt) {
  const out = [];
  const dms =
    /(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NS])[\s,;]+(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([EW])/gi;
  let m;
  const used = [];
  while ((m = dms.exec(txt))) {
    out.push([
      (+m[1] + (+m[2] || 0) / 60 + (+m[3] || 0) / 3600) * (/s/i.test(m[4]) ? -1 : 1),
      (+m[5] + (+m[6] || 0) / 60 + (+m[7] || 0) / 3600) * (/w/i.test(m[8]) ? -1 : 1),
    ]);
    used.push([m.index, m.index + m[0].length]);
  }
  let rest = txt;
  for (const [a, b] of used.reverse()) rest = rest.slice(0, a) + ' '.repeat(b - a) + rest.slice(b);
  const dd = /(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/g;
  while ((m = dd.exec(rest))) {
    const la = +m[1],
      lo = +m[2];
    if (Math.abs(la) <= 90 && Math.abs(lo) <= 180 && (m[1].includes('.') || m[2].includes('.')))
      out.push([la, lo]);
  }
  return out;
}
