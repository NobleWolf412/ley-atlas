// Where features plug into the panels.
//
//   registerScreen('analyze', render)   a panel screen: render() returns its HTML
//   registerAction('share', fn)         what a button does: <button data-v2="share">
//
// A feature registers both in its init function, so adding or removing a feature
// does not mean editing the panel router or the action list.

const screens = new Map();
const actions = new Map();

/**
 * @param {string} id the value of V2.tab that shows this screen
 * @param {() => string} render returns the screen's HTML
 * @param {{ title?: string, parent?: string }} [opts] header title, and the screen "←" goes back to
 */
export function registerScreen(id, render, opts = {}) {
  screens.set(id, { render, ...opts });
}

export function screenHistory(id) {
  return screens.get(id)?.history === true;
}
export function captureScreen(id) {
  return screens.get(id)?.capture?.() || null;
}
export function restoreScreen(id, state) {
  screens.get(id)?.restore?.(state);
}
export function screenHtml(id) {
  const sc = screens.get(id);
  if (!sc) throw new Error(`No screen registered for "${id}"`);
  return sc.render();
}
/** Title and parent screen given at registration (undefined for screens that did not give them). */
export const screenTitle = id => screens.get(id)?.title;
export const screenParent = id => screens.get(id)?.parent;

/** @param {string} name the data-v2 value @param {(id?: string) => void} fn gets the button's data-id */
export function registerAction(name, fn) {
  actions.set(name, fn);
}
/** Runs a registered action. @returns {boolean} false when nothing is registered under that name */
export function runAction(name, id) {
  const fn = actions.get(name);
  if (!fn) return false;
  fn(id);
  return true;
}
