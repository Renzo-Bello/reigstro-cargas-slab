/* StrengthLab startup and lightweight interaction polish */
(function () {
  'use strict';
  var splash = document.getElementById('slabSplash');
  if (!splash) return;
  var start = Date.now();
  function hideSplash() {
    var delay = Math.max(0, 650 - (Date.now() - start));
    window.setTimeout(function () {
      splash.classList.add('is-leaving');
      window.setTimeout(function () { splash.remove(); }, 500);
    }, delay);
  }
  if (document.readyState === 'complete') hideSplash();
  else window.addEventListener('load', hideSplash, { once: true });
  window.setTimeout(hideSplash, 4500);

  document.addEventListener('click', function (event) {
    var button = event.target.closest('nav.tabs button');
    if (!button) return;
    document.querySelectorAll('nav.tabs button').forEach(function (item) {
      item.classList.toggle('active', item === button);
      if (item === button) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  });
})();
