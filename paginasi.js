(function (g) {
  'use strict';
  function range(total, requested = 1, size = 20) {
    total = Math.max(0, Math.trunc(Number(total) || 0));
    size = Math.max(1, Math.trunc(Number(size) || 20));
    const pages = Math.max(1, Math.ceil(total / size));
    const page = Math.max(1, Math.min(pages, Math.trunc(Number(requested) || 1)));
    return { total, page, pages, size, start: (page - 1) * size, end: Math.min(page * size, total) };
  }
  function numbers(page, pages) {
    const selected = new Set([1, pages]);
    for (let n = Math.max(1, page - 1); n <= Math.min(pages, page + 1); n++) selected.add(n);
    if (page <= 2) selected.add(Math.min(3, pages));
    if (page >= pages - 1) selected.add(Math.max(1, pages - 2));
    const out = []; let previous = 0;
    [...selected].sort((a, b) => a - b).forEach(n => {
      if (n - previous === 2) out.push(previous + 1);
      else if (n - previous > 2) out.push(null);
      out.push(n); previous = n;
    });
    return out;
  }
  const summary = r => r.total ? `Menampilkan ${r.start + 1}–${r.end} dari ${r.total} data` : '0 data';
  function render(el, state, change, showCount = true) {
    el.hidden = !state.total;
    const button = (label, n, disabled = false, current = false) => `<button type="button" data-page="${n}"${disabled ? ' disabled' : ''}${current ? ' aria-current="page"' : ''} aria-label="${typeof label === 'number' ? 'Halaman ' + label : label}">${label}</button>`;
    el.innerHTML = `${showCount ? `<span class="pagination-summary" role="status">${summary(state)}</span>` : ''}<nav class="pagination-controls" aria-label="Halaman data">${button('Sebelumnya', state.page - 1, state.page === 1)}<span class="pagination-numbers">${numbers(state.page, state.pages).map(n => n === null ? '<span class="pagination-gap" aria-hidden="true">…</span>' : button(n, n, false, n === state.page)).join('')}</span><span class="pagination-mobile">Halaman ${state.page} dari ${state.pages}</span>${button('Berikutnya', state.page + 1, state.page === state.pages)}</nav>`;
    el.onclick = event => {
      const target = event.target.closest('button[data-page]');
      if (!target || target.disabled) return;
      const next = Number(target.dataset.page);
      if (next === state.page || next < 1 || next > state.pages) return;
      change(next);
      const focus = el.querySelector('button[aria-current="page"]');
      if (focus?.getClientRects().length) focus.focus({ preventScroll: true });
      else { el.tabIndex = -1; el.focus({ preventScroll: true }); }
    };
  }
  g.Paginasi = Object.freeze({ range, numbers, summary, render });
})(window);
