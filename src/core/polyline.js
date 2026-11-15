// Encoded polyline decoder (pure)

export function dec(str, prec = 1e3) {
  const out = [];
  let i = 0,
    x = 0,
    y = 0;
  const nxt = () => {
    let r = 0,
      sh = 0,
      b;
    do {
      b = str.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << sh;
      sh += 5;
    } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < str.length) {
    x += nxt();
    y += nxt();
    out.push([x / prec, y / prec]);
  }
  return out;
}
