import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllHandlers, emit, off, on } from '../src/core/events.js';
import { addDrawLayer, addSiteHighlighter, highlightedSites, runDrawLayers } from '../src/map/hooks.js';
import { registerAction, registerScreen, runAction, screenHtml } from '../src/ui/registry.js';

describe('event bus', () => {
  beforeEach(clearAllHandlers);
  it('calls subscribers in order, with the arguments', () => {
    const seen = [];
    on('map:tap', (x, y) => seen.push(['first', x, y]));
    on('map:tap', (x, y) => seen.push(['second', x, y]));
    emit('map:tap', 3, 4);
    expect(seen).toEqual([
      ['first', 3, 4],
      ['second', 3, 4],
    ]);
  });
  it('stops calling a handler once it is removed', () => {
    let n = 0;
    const fn = () => n++;
    const unsubscribe = on('x', fn);
    emit('x');
    unsubscribe();
    emit('x');
    on('x', fn);
    off('x', fn);
    emit('x');
    expect(n).toBe(1);
  });
  it('an event nobody listens to is fine', () => {
    expect(() => emit('nobody:home')).not.toThrow();
  });
});

describe('map hooks', () => {
  it('runs draw layers of a stage in the order they were added', () => {
    const seen = [];
    addDrawLayer('underLines', () => seen.push('glow'));
    addDrawLayer('underLines', () => seen.push('fan'));
    addDrawLayer('top', () => seen.push('overlay'));
    runDrawLayers('underLines');
    expect(seen).toEqual(['glow', 'fan']);
  });
  it('reports highlighted sites only while a feature offers some', () => {
    let picking = false;
    addSiteHighlighter(() => (picking ? new Set(['stonehenge']) : null));
    expect(highlightedSites()).toBeNull();
    picking = true;
    expect(highlightedSites().has('stonehenge')).toBe(true);
  });
});

describe('panel registry', () => {
  it('renders a registered screen and rejects an unknown one', () => {
    registerScreen('demo', () => '<p>hi</p>');
    expect(screenHtml('demo')).toBe('<p>hi</p>');
    expect(() => screenHtml('nope')).toThrow(/No screen/);
  });
  it('runs a registered action with the button id, and says when there is none', () => {
    let got;
    registerAction('demo-action', id => (got = id));
    expect(runAction('demo-action', 'line-7')).toBe(true);
    expect(got).toBe('line-7');
    expect(runAction('unknown-action')).toBe(false);
  });
});
