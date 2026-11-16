import { describe, expect, it } from 'vitest';
import { nameMatch, pickNearby, shortExtract, wikiRef, wikidataId } from '../src/core/wiki.js';

describe('wikiRef', () => {
  it('reads language and title, decoding the address', () => {
    expect(wikiRef('https://en.wikipedia.org/wiki/Palace_of_Versailles')).toEqual({
      lang: 'en',
      title: 'Palace of Versailles',
    });
    expect(wikiRef('https://fr.wikipedia.org/wiki/Ch%C3%A2teau_de_Chambord')).toEqual({
      lang: 'fr',
      title: 'Château de Chambord',
    });
  });
  it('is null for anything else', () => {
    expect(wikiRef('https://example.com/wiki/X')).toBeNull();
    expect(wikiRef(null)).toBeNull();
  });
});

describe('wikidataId', () => {
  it('finds the id in an address', () => {
    expect(wikidataId('https://www.wikidata.org/wiki/Q2946')).toBe('Q2946');
    expect(wikidataId('no id here')).toBeNull();
  });
});

describe('nameMatch and pickNearby', () => {
  it('ignores accents, brackets and filler words', () => {
    expect(nameMatch('Château de Chambord', 'Chateau of Chambord')).toBe(1);
    expect(nameMatch('Schans (Gennep)', 'Schans')).toBe(1);
    expect(nameMatch('Windsor Castle', 'Windsor Great Park')).toBeLessThan(1);
  });
  it('picks the nearest article whose name matches, and nothing when none does', () => {
    const near = [
      { title: 'Windsor Great Park', dist: 100 },
      { title: 'Windsor Castle', dist: 400 },
    ];
    expect(pickNearby('Windsor Castle', near).title).toBe('Windsor Castle');
    expect(pickNearby('Star fort near Sigtuna', [{ title: 'Sigtuna Church', dist: 50 }])).toBeNull();
    expect(pickNearby('Anything', [])).toBeNull();
  });
});

describe('shortExtract', () => {
  it('keeps short text whole and cuts long text at a sentence end', () => {
    expect(shortExtract('A fort.')).toBe('A fort.');
    const long = 'First sentence here. ' + 'Second sentence is rather long indeed. '.repeat(20);
    const s = shortExtract(long, 100);
    expect(s.length).toBeLessThanOrEqual(100);
    expect(s.endsWith('.')).toBe(true);
  });
});
