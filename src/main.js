// Entry point: load styles and start-up data, start the app, then fetch the heavy layers in the background.
import './styles/index.css';
import { loadDatasets, loadDeferredDatasets } from './data/datasets.js';
import { watchForUpdates } from './update.js';

watchForUpdates();

const boot = document.getElementById('boot');
const pct = (done, total) => `${Math.round((done / total) * 100)}%`;

try {
  await loadDatasets((done, total) => {
    boot.textContent = `Loading Ley Atlas… ${pct(done, total)}`;
  });
  // Imported after the start-up data is in, so every module sees loaded datasets.
  const { startApp, deferredDataReady } = await import('./app.js');
  startApp();

  // The map is usable now. Coastline detail and the underground layers arrive in the background.
  boot.classList.add('chip');
  boot.textContent = 'Loading underground data…';
  await loadDeferredDatasets((done, total) => {
    boot.textContent = `Loading underground data… ${pct(done, total)}`;
  });
  deferredDataReady();
  boot.remove();
} catch (err) {
  boot.classList.remove('chip');
  boot.textContent = `Ley Atlas could not load: ${err.message}`;
  throw err;
}
