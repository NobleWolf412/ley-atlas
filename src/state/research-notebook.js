import { parseNotebook } from '../core/research.js';
import { RESEARCH_RECORDS } from '../data/research.js';

const KEY = 'ley-atlas-notebook-v1';
let entries = [];
export function notebookSnapshot() {
  return { format: 'ley-atlas-notebook', version: 1, entries: structuredClone(entries) };
}
export function validateNotebook(value) {
  return parseNotebook(value, new Set(RESEARCH_RECORDS.map(r => r.id)));
}
export function initResearchNotebook() {
  try {
    entries = validateNotebook(JSON.parse(localStorage.getItem(KEY))).entries;
  } catch {
    entries = [];
  }
}
export function replaceNotebook(value) {
  const next = validateNotebook(value);
  // Write first: quota/security failure must not silently lose the current notebook.
  localStorage.setItem(KEY, JSON.stringify(next));
  entries = next.entries;
}
export function saveResearchNote(recordId, text, saved = true, investigation) {
  const next = notebookSnapshot();
  next.entries = next.entries.filter(e => e.recordId !== recordId);
  const snapshot = investigation || researchNote(recordId)?.investigation;
  if (saved || text.trim() || snapshot)
    next.entries.push({
      recordId,
      text,
      saved,
      updatedAt: new Date().toISOString(),
      ...(snapshot ? { investigation: snapshot } : {}),
    });
  replaceNotebook(next);
}
export function researchNote(id) {
  return entries.find(e => e.recordId === id);
}
