// Entry point: load styles and datasets, then start the app.
import './styles/index.css';
import { loadDatasets } from './data/datasets.js';

const boot = document.getElementById('boot');

try {
  await loadDatasets((done, total) => {
    boot.textContent = `Loading Ley Atlas… ${Math.round((done / total) * 100)}%`;
  });
  // Imported after the data is in, so every module sees loaded datasets.
  const { startApp } = await import('./app.js');
  startApp();
  boot.remove();
} catch (err) {
  boot.textContent = `Ley Atlas could not load: ${err.message}`;
  throw err;
}
