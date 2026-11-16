import { describe, expect, it } from 'vitest';
import { registerScreen, screenHtml, screenParent, screenTitle } from '../src/ui/registry.js';

describe('screen registration with title and parent', () => {
  it('keeps the title and the screen to go back to', () => {
    registerScreen('demo-tool', () => '<p>tool</p>', { title: 'Demo tool', parent: 'tools' });
    expect(screenHtml('demo-tool')).toBe('<p>tool</p>');
    expect(screenTitle('demo-tool')).toBe('Demo tool');
    expect(screenParent('demo-tool')).toBe('tools');
  });
  it('a screen registered without options has neither', () => {
    registerScreen('plain', () => '');
    expect(screenTitle('plain')).toBeUndefined();
    expect(screenParent('plain')).toBeUndefined();
  });
});
