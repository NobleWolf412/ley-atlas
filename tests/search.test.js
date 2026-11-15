import { describe, expect, it } from 'vitest';
import { canonicalCountry, countryFromText } from '../src/core/countries.js';
import { fold, matchRank, orderTop, queryWords } from '../src/core/text-search.js';

describe('fold', () => {
  it('drops accents and case', () => {
    expect(fold('Château de São Jorge')).toBe('chateau de sao jorge');
  });
});

describe('matchRank', () => {
  const rank = (name, strong, q, rest = '') =>
    matchRank({ name: fold(name), strong: fold(strong), rest: fold(rest) }, queryWords(q));
  it('ranks a name that starts with the query highest', () => {
    expect(rank('Stonehenge', 'megalith united kingdom', 'stone')).toBe(4);
  });
  it('then names where every word starts a word', () => {
    expect(rank('Windsor Castle', 'castle united kingdom', 'castle wind')).toBe(3);
  });
  it('then names that contain the words', () => {
    expect(rank('Stonehenge', 'megalith united kingdom', 'henge')).toBe(2);
  });
  it('then matches by type or country', () => {
    expect(rank('Château de Chambord', 'castle france', 'france')).toBe(1.5);
    expect(rank('Château de Chambord', 'castle france', 'chateau france')).toBe(1.5);
  });
  it('puts a match in the nearest-town text last: "france" is not San Francesco', () => {
    const french = rank('Fort Central', 'castles france', 'castle france', '5.7 km S of Limone');
    const italian = rank(
      'Castello Nipozzano',
      'castles italy',
      'castle france',
      '2.1 km NE of San Francesco',
    );
    expect(french).toBeGreaterThan(italian);
    expect(italian).toBe(1);
  });
  it('outside the name, a word must start a word', () => {
    expect(rank('Fort Central', 'castles france', 'rance')).toBe(0);
    expect(rank('Fort Central', 'castles france', 'fra')).toBe(1.5);
  });
  it('needs every word to match', () => {
    expect(rank('Windsor Castle', 'castle united kingdom', 'windsor france')).toBe(0);
  });
  it('an empty search matches everything', () => {
    expect(rank('Anything', '', '   ')).toBe(1);
  });
  it('orders a realistic list the way a person expects', () => {
    const sites = ['Fort Rome', 'Rome', 'Romeral dolmen', 'Chrome mine', 'Jerome castle'];
    const sorted = [...sites].sort((a, b) => rank(b, '', 'rome') - rank(a, '', 'rome'));
    expect(sorted.slice(0, 2).sort()).toEqual(['Rome', 'Romeral dolmen']);
    expect(sorted[2]).toBe('Fort Rome');
  });
});

describe('countries', () => {
  const known = new Set(['Egypt', 'France', 'United Kingdom', 'United States']);
  it('uses one spelling per country', () => {
    expect(canonicalCountry('United States of America')).toBe('United States');
    expect(canonicalCountry('Scotland')).toBe('United Kingdom');
    expect(canonicalCountry('France')).toBe('France');
  });
  it('finds the country in a free-text region', () => {
    expect(countryFromText('Luxor, Egypt', known)).toBe('Egypt');
    expect(countryFromText('Castle · England', known)).toBe('United Kingdom');
    expect(countryFromText('UNESCO · cultural · 1986', known)).toBe('');
    expect(countryFromText(undefined, known)).toBe('');
  });
});

describe('orderTop', () => {
  it('puts the k smallest at the front in order and keeps every item', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const items = Array.from({ length: 5000 }, (_, i) => ({ i, k: Math.floor(rnd() * 800) })); // many ties
    const want = [...items]
      .sort((a, b) => a.k - b.k)
      .slice(0, 60)
      .map(x => x.k);
    const got = orderTop([...items], x => x.k, 60);
    expect(got.slice(0, 60).map(x => x.k)).toEqual(want);
    expect(got).toHaveLength(5000);
    expect(new Set(got.map(x => x.i)).size).toBe(5000);
  });
  it('simply sorts short lists', () => {
    expect(orderTop([3, 1, 2], x => x, 2)).toEqual([1, 2, 3]);
  });
});
