/* Site behaviours: theme toggle, mobile menu, copy email.
   Everything degrades gracefully: without JavaScript the navigation stays open,
   the theme follows the system setting, and the email address stays a normal link. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  /* ---------- Theme ---------- */
  var themeButton = document.querySelector('[data-theme-toggle]');
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effectiveTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function updateThemeLabel() {
    if (!themeButton) return;
    // The label names the action, so it reads correctly in both states.
    themeButton.textContent = effectiveTheme() === 'dark' ? 'Light mode' : 'Dark mode';
  }

  if (themeButton) {
    updateThemeLabel();
    themeButton.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('jm-theme', next); } catch (e) { /* storage can be blocked; the choice still applies for this page */ }
      updateThemeLabel();
    });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', updateThemeLabel);
  }

  /* ---------- Mobile menu ---------- */
  var header = document.querySelector('.site-header');
  var menuButton = document.querySelector('[data-menu-toggle]');
  var wide = window.matchMedia ? window.matchMedia('(min-width: 54rem)') : null;

  function setMenu(open) {
    if (!header || !menuButton) return;
    header.setAttribute('data-nav-open', open ? 'true' : 'false');
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (header && menuButton) {
    menuButton.addEventListener('click', function () {
      setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
    });
    header.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuButton.focus();
      }
    });
    if (wide && wide.addEventListener) {
      wide.addEventListener('change', function () { setMenu(false); });
    }
  }

  /* ---------- Copy email ---------- */
  var copyButtons = document.querySelectorAll('[data-copy]');
  var statusTimer;

  function announce(message) {
    var region = document.getElementById('copy-status');
    if (!region) return;
    region.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { region.textContent = ''; }, 4000);
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  Array.prototype.forEach.call(copyButtons, function (button) {
    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy');
      var done = function () { announce('Email address copied.'); };
      var failed = function () { announce('Copying didn\u2019t work here. Select the address above and copy it manually.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { (fallbackCopy(text) ? done : failed)(); });
      } else {
        (fallbackCopy(text) ? done : failed)();
      }
    });
  });
}());
