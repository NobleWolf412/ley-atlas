// Text search helpers (pure: no DOM, no state)

/** Lower-case with accents removed, so "sao" finds "São" and "chateau" finds "Château". */
export const fold = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** The words of a search box entry, folded. */
export const queryWords = q => fold(q).split(/\s+/).filter(Boolean);

const startsAWord = (text, w) => {
  for (let i = text.indexOf(w); i >= 0; i = text.indexOf(w, i + 1))
    if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true;
  return false;
};

/**
 * How well a record matches the search words. Higher is better; 0 means no match.
 *   4    the name starts with what was typed                 "stone" → Stonehenge
 *   3    every word starts a word of the name                "castle wind" → Windsor Castle
 *   2    every word is somewhere in the name                 "henge" → Stonehenge
 *   1.5  the rest of the words are its type or country       "castle france" → a castle in France
 *   1    some word only matches other text (region, nearest town)
 * Outside the name a word has to start a word, so "ome" does not find everything in Rome.
 * @param rec { name, strong, rest }, all folded: strong = type and country, rest = other text
 * @param words folded search words
 */
export function matchRank(rec, words) {
  if (!words.length) return 1;
  let weak = false,
    allInName = true;
  for (const w of words) {
    if (rec.name.includes(w)) continue;
    allInName = false;
    if (startsAWord(rec.strong, w)) continue;
    if (!startsAWord(rec.rest, w)) return 0;
    weak = true;
  }
  if (allInName) {
    if (rec.name.startsWith(words.join(' '))) return 4;
    return words.every(w => startsAWord(rec.name, w)) ? 3 : 2;
  }
  return weak ? 1 : 1.5;
}

/**
 * Puts the `k` items with the smallest keys at the front of `items`, in order, without
 * sorting the rest. Much cheaper than a full sort when only the top of a long list is shown.
 * @param items array, reordered in place  @param key item => number  @param k how many to order
 */
export function orderTop(items, key, k) {
  const n = items.length;
  if (k >= n || n < 400) return items.sort((a, b) => key(a) - key(b));
  // find the k-th smallest key (quickselect on a copy of the keys)
  const keys = Float64Array.from(items, key);
  let lo = 0,
    hi = n - 1;
  while (lo < hi) {
    const pivot = keys[(lo + hi) >> 1];
    let i = lo,
      j = hi;
    while (i <= j) {
      while (keys[i] < pivot) i++;
      while (keys[j] > pivot) j--;
      if (i <= j) {
        const t = keys[i];
        keys[i] = keys[j];
        keys[j] = t;
        i++;
        j--;
      }
    }
    if (k - 1 <= j) hi = j;
    else if (k - 1 >= i) lo = i;
    else break;
  }
  const cut = keys[k - 1];
  const top = [],
    rest = [];
  for (const it of items) (key(it) <= cut ? top : rest).push(it);
  top.sort((a, b) => key(a) - key(b));
  for (let i = 0; i < top.length; i++) items[i] = top[i];
  for (let i = 0; i < rest.length; i++) items[top.length + i] = rest[i];
  return items;
}
