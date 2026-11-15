// A tiny event bus, so lower layers can announce things without knowing who listens.
//
//   on('map:tap', (x, y) => …)      subscribe (returns a function that unsubscribes)
//   emit('map:tap', x, y)           call every subscriber, in the order they subscribed
//
// Handlers run synchronously, so emit() returns after everyone has reacted.
// Event names are listed in ARCHITECTURE.md.

const handlers = new Map();

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event).push(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  const list = handlers.get(event);
  if (!list) return;
  const i = list.indexOf(fn);
  if (i >= 0) list.splice(i, 1);
}

export function emit(event, ...args) {
  const list = handlers.get(event);
  if (!list) return;
  for (const fn of [...list]) fn(...args);
}

/** For tests: forget every subscription. */
export function clearAllHandlers() {
  handlers.clear();
}
