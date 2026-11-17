import { activeLine } from '../../domain/lines.js';
import { esc } from '../../core/util.js';
import { navIcon } from '../navigation.js';
import { v2Button } from '../panel-parts.js';

export function v2Analysis() {
  const line = activeLine();
  const tool = (action, icon, title, text) =>
    `<button class="v2-menurow" data-v2="${action}"><span class="ic">${navIcon(icon)}</span><span class="nm"><strong>${title}</strong><small>${text}</small></span><span aria-hidden="true">↗</span></button>`;
  return `<div class="atlas-heading"><span class="atlas-eyebrow">RESEARCH WORKSPACE</span><h2>Follow the evidence.</h2></div>
    <div class="v2-card accent"><span class="atlas-eyebrow">ACTIVE LINE</span><h3>${line ? esc(line.short || line.name) : 'No active line'}</h3><div class="v2-actions">${line ? v2Button('analyze', 'Line details', 'primary') : v2Button('new-line', 'Draw a line', 'primary')}${v2Button('choose-line', 'Case studies')}</div></div>
    <div class="atlas-navigation">${tool('tool-lab', 'analyze', 'Comparisons', 'Line tests · Site tests · Crossings')}${tool('align', 'lines', 'Find alignments', 'Search the sites in view')}${tool('menu-tools', 'tools', 'Map tools', 'Measure · Markers')}</div>
    <p class="atlas-footnote">Explore patterns. Compare them with chance.</p>`;
}
