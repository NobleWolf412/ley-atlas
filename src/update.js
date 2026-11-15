// Tells the user when a newer version of the app has been downloaded, and reloads into it on request.
//
// The service worker (vite-plugin-pwa, autoUpdate) fetches a new version in the background and
// takes over the open page, but the page itself keeps running the old code until it is reloaded.
// Without this, an update only shows after closing and reopening the tab.

function showUpdateChip() {
  if (document.getElementById('update-chip')) return;
  const chip = document.createElement('div');
  chip.id = 'update-chip';
  chip.setAttribute('role', 'status');
  chip.innerHTML = `<span>A new version of Ley Atlas is ready</span><button type="button">Update</button>`;
  chip.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(chip);
}

export function watchForUpdates() {
  if (!('serviceWorker' in navigator)) return;
  // On a first visit the worker takes control too; that is not an update.
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadWorker) showUpdateChip();
  });
  // Look for a new version whenever the app comes back to the front, not only when it is opened.
  navigator.serviceWorker.ready.then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  });
}
