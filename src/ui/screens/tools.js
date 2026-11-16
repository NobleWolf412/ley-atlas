// Research tools: one place for every tool, each registered by its own feature
import { esc } from '../../core/util.js';
import { listTools, registerScreen, registerTool } from '../registry.js';
import { v2Peek } from '../panel-parts.js';
import { v2ChangeTab } from '../panels.js';
import { registerAction } from '../registry.js';

function toolsScreen() {
  const cards = listTools()
    .map(
      t =>
        `<button class="v2-menurow" data-v2="${esc(t.action)}"${t.actionId != null ? ` data-id="${esc(t.actionId)}"` : ''}><span class="ic" aria-hidden="true">${t.icon}</span><span class="nm"><strong>${esc(t.title)}</strong><small>${esc(t.sub)}</small></span><span aria-hidden="true">›</span></button>`,
    )
    .join('');
  return (
    v2Peek('Research tools') +
    `<p class="v2-sub" style="margin:0 0 10px">Ways to test what the map seems to show. Each one compares what it finds with what chance alone would give.</p>` +
    cards
  );
}

export function initToolsScreen() {
  registerScreen('tools', toolsScreen, { title: 'Research tools', parent: 'menu' });
  registerAction('tools', () => v2ChangeTab('tools'));
  // the existing random-line test, listed here too
  registerTool({
    id: 'unusual',
    icon: '◈',
    title: 'Is it unusual?',
    sub: 'Test a line or a set of sites against random ones',
    action: 'tool-lab',
  });
}
