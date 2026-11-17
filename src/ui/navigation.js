// The workspace vocabulary and its single entry point for each task.
export const NAVIGATION = [
  {
    id: 'saved',
    action: 'menu-lines',
    icon: 'lines',
    title: 'My lines',
    description: 'Working & saved lines',
  },
  {
    id: 'layers',
    action: 'menu-layers',
    icon: 'layers',
    title: 'Layers',
    description: 'Sites · Underground · Lines',
  },
  {
    id: 'analysis',
    action: 'menu-analyze',
    icon: 'analyze',
    title: 'Analyze',
    description: 'Patterns & comparisons',
  },
  {
    id: 'data',
    action: 'tool-data',
    icon: 'resources',
    title: 'Resources',
    description: 'Datasets · Import · Export',
  },
  {
    id: 'appearance',
    action: 'menu-appearance',
    icon: 'appearance',
    title: 'Appearance',
    description: 'Theme & map style',
  },
];

const PATHS = {
  lines: '<path d="M5 5l14 14M5 19L19 5"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  analyze: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 11l2-3 2 2 2-3"/>',
  resources: '<path d="M3 6h7l2 3h9v11H3V6ZM3 6V4h7l2 2h9v3"/>',
  appearance: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 4a8 8 0 0 1 0 16Z"/>',
  tools: '<path d="m4 17 13-13 4 4L8 21l-4-4ZM12 9l3 3M8 13l3 3"/>',
};

export function navIcon(name) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.analyze}</svg>`;
}
