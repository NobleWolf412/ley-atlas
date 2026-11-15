// Where features plug into the panels.
//
//   registerScreen('analyze', render)   a panel screen: render() returns its HTML
//   registerAction('share', fn)         what a button does: <button data-v2="share">
//
// A feature registers both in its init function, so adding or removing a feature
// does not mean editing the panel router or the action list.

const screens = new Map();
const actions = new Map();

/** @param {string} id the value of V2.tab that shows this screen @param {() => string} render */
export function registerScreen(id, render) {
  screens.set(id, render);
}
export function screenHtml(id) {
  const render = screens.get(id);
  if (!render) throw new Error(`No screen registered for "${id}"`);
  return render();
}

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
