/* StrengthLab startup, install and session continuity */
(function () {
  'use strict';
  var splash = document.getElementById('slabSplash');
  var start = Date.now();
  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('app');
    var panels = [
      document.getElementById('view-tecnica'),
      document.getElementById('view-rir')
    ];
    panels.forEach(function (panel) {
      if (app && panel && panel.parentElement !== app) app.appendChild(panel);
    });
  }, { once: true });
  function hideSplash() {
    if (!splash || splash.dataset.dismissed) return;
    splash.dataset.dismissed = 'true';
    var delay = Math.max(0, 650 - (Date.now() - start));
    window.setTimeout(function () {
      splash.classList.add('is-leaving');
      window.setTimeout(function () { splash.remove(); }, 500);
    }, delay);
  }
  if (document.readyState === 'complete') hideSplash();
  else window.addEventListener('load', hideSplash, { once: true });
  window.setTimeout(hideSplash, 4500);

  function safeStore(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest('nav.tabs button');
    if (!button) return;
    safeStore('slab_last_tab', button.id.replace(/^tab-/, ''));
    document.querySelectorAll('nav.tabs button').forEach(function (item) {
      item.classList.toggle('active', item === button);
      if (item === button) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  });
  window.setTimeout(function () {
    try {
      var lastTab = localStorage.getItem('slab_last_tab');
      if (lastTab && ['inicio', 'registro', 'progreso', 'tecnica'].indexOf(lastTab) >= 0 && typeof window.switchTab === 'function') {
        window.switchTab(lastTab);
      }
    } catch (e) {}
  }, 120);

  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    if (window.matchMedia('(display-mode: standalone)').matches || document.getElementById('installNudge')) return;
    var nudge = document.createElement('aside');
    nudge.id = 'installNudge';
    nudge.className = 'install-nudge';
    nudge.setAttribute('aria-label', 'Instalar StrengthLab');
    nudge.innerHTML = '<div><strong>StrengthLab en tu pantalla</strong><span>Abre tu registro como una app.</span></div><button type="button" id="installNudgeButton">Instalar</button><button type="button" class="install-nudge-close" aria-label="Cerrar">×</button>';
    document.body.appendChild(nudge);
    nudge.querySelector('#installNudgeButton').addEventListener('click', async function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      nudge.remove();
    });
    nudge.querySelector('.install-nudge-close').addEventListener('click', function () { nudge.remove(); });
  });
  window.addEventListener('appinstalled', function () {
    var nudge = document.getElementById('installNudge');
    if (nudge) nudge.remove();
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }, { once: true });
  }
})();
