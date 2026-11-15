// Statistics helpers for "Is it unusual?" (pure: no DOM, no state)

/**
 * How many genuinely different directions were on offer when point B was picked
 * after seeing match scores: about π · line length / corridor width, capped at the
 * number of candidate sites (corridor floored at 0.5 km).
 */
export function independentDirections(candidates, lengthKm, corridorKm) {
  return Math.max(1, Math.min(candidates, Math.round((Math.PI * lengthKm) / Math.max(corridorKm, 0.5))));
}

/**
 * Fair p-value for the best of K independent tries:
 * the chance that at least one of K random directions scores as well by luck.
 */
export function fairP(p, K) {
  return 1 - Math.pow(1 - p, K);
}
