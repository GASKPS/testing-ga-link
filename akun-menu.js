(function () {
  'use strict';
  const shell = document.getElementById('account-menu-shell');
  const trigger = document.getElementById('account-menu-toggle');
  const menu = document.getElementById('account-menu');
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  let open = false;

  function close(restoreFocus = false) {
    if (!open) return;
    open = false;
    trigger.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    if ((restoreFocus || menu.contains(document.activeElement)) && !trigger.disabled) trigger.focus({preventScroll:true});
    menu.inert = true;
    menu.setAttribute('aria-hidden', 'true');
  }

  function show(last = false) {
    if (trigger.disabled) return;
    open = true;
    menu.inert = false;
    menu.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    menu.classList.add('is-open');
    const enabled = items.filter(item => !item.disabled && !item.hidden);
    (last ? enabled.at(-1) : enabled[0])?.focus({preventScroll:true});
  }

  trigger.addEventListener('click', () => open ? close(true) : show());
  trigger.addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'ArrowUp');
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      // Let the browser move focus normally, then finish dismissing the menu.
      setTimeout(() => close(), 0);
      return;
    }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.filter(item => !item.disabled && !item.hidden);
    if (!enabled.length) return;
    const current = enabled.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : enabled.length - 1)) % enabled.length;
    enabled[next].focus({preventScroll:true});
  });
  menu.addEventListener('click', event => {
    const action = event.target.closest('[role="menuitem"]');
    if (action) close();
  });
  document.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !shell.contains(event.target)) close();
  }, true);
  document.addEventListener('click', event => {
    if (open && !shell.contains(event.target)) close();
  });
  document.addEventListener('focusin', event => {
    if (open && !menu.contains(event.target) && event.target !== trigger) close();
  });
  // A click inside Link Kerja's iframe moves focus out of the parent document.
  window.addEventListener('blur', () => close());
  window.addEventListener('hashchange', () => close());
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });

  function account() {
    close();
    const profile = window.Akses.profile;
    trigger.disabled = !profile && !window.Akses.preview;
    trigger.setAttribute('aria-label', profile?.nama ? 'Buka menu akun ' + profile.nama : 'Buka menu akun');
    trigger.title = profile?.nama ? 'Menu akun · ' + profile.nama : 'Menu akun';
  }
  document.addEventListener('akses:berubah', account);
  window.Akses.ready.then(account);
})();
