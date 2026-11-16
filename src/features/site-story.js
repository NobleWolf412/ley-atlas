// "About this place": a short introduction to a site from Wikipedia, fetched when its card opens.
// Needs a connection; with none, or when no article is clearly about the site, nothing is shown.
import { esc } from '../core/util.js';
import { pickNearby, shortExtract, wikiRef, wikidataId } from '../core/wiki.js';

const CACHE = new Map(); // site id -> { state: 'loading' | 'done' | 'none', story? }

const getJson = async url => {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};
const summary = async ref => {
  const j = await getJson(
    `https://${ref.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ref.title.replace(/ /g, '_'))}`,
  );
  if (j.type !== 'standard' || !j.extract) return null;
  return {
    title: j.title,
    text: shortExtract(j.extract),
    img: j.thumbnail?.source || null,
    url:
      j.content_urls?.desktop?.page ||
      `https://${ref.lang}.wikipedia.org/wiki/${encodeURIComponent(j.title)}`,
    lang: ref.lang,
  };
};

async function findStory(p) {
  // 1. the site list names its article
  const direct =
    wikiRef(p.wikiUrl) ||
    (p.wiki ? wikiRef(p.wiki) || { lang: 'en', title: String(p.wiki).replace(/_/g, ' ') } : null);
  if (direct) {
    const s = await summary(direct).catch(() => null);
    if (s) return s;
  }
  // 2. the site list gives a Wikidata id
  const q = p.qid || p.ext?.q || (/wikidata\.org/.test(p.srcUrl || '') ? wikidataId(p.srcUrl) : null);
  if (q) {
    const j = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${q}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`,
    ).catch(() => null);
    const title = j?.entities?.[q]?.sitelinks?.enwiki?.title;
    if (title) {
      const s = await summary({ lang: 'en', title }).catch(() => null);
      if (s) return s;
    }
  }
  // 3. an article within 2 km whose name matches the site's name
  const g = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${p.lat}%7C${p.lon}&gsradius=2000&gslimit=20&format=json&origin=*`,
  ).catch(() => null);
  const hit = pickNearby(p.n, g?.query?.geosearch);
  return hit ? summary({ lang: 'en', title: hit.title }).catch(() => null) : null;
}

function html(c) {
  if (!c || c.state === 'none') return '';
  if (c.state === 'loading') return `<p class="v2-muted st-load">Looking up this place…</p>`;
  const s = c.story;
  return (
    `<div class="st-body">${s.img ? `<img class="st-img" src="${esc(s.img)}" alt="" loading="lazy">` : ''}<p>${esc(s.text)}</p></div>` +
    `<p class="st-src"><a href="${esc(s.url)}" target="_blank" rel="noopener">Read more on Wikipedia ↗</a> · text: Wikipedia, CC BY-SA</p>`
  );
}

/** The story block for a site card. Fills itself in when the article arrives. */
export function storyHtml(p) {
  if (!CACHE.has(p.id)) {
    if (!navigator.onLine) return '';
    CACHE.set(p.id, { state: 'loading' });
    findStory(p)
      .catch(() => null)
      .then(story => {
        CACHE.set(p.id, story ? { state: 'done', story } : { state: 'none' });
        const el = document.querySelector(`.st[data-story="${CSS.escape(p.id)}"]`);
        if (el) el.innerHTML = html(CACHE.get(p.id));
      });
  }
  return `<div class="st" data-story="${esc(p.id)}">${html(CACHE.get(p.id))}</div>`;
}
