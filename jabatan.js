(function (g) {
  'use strict';
  const A = g.Akses, $ = id => document.getElementById(id);
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const compare = (a, b) => (a.urutan ?? Infinity) - (b.urutan ?? Infinity) || a.nama.localeCompare(b.nama, 'id-ID', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  const list = async () => (await A.all('jabatan')).sort(compare);
  g.JabatanStore = Object.freeze({ list, compare, async save(values, previous) {
    if (!A.superAdmin()) throw new Error('Hanya Super Admin yang boleh mengelola jabatan.');
    return A.rpc('simpan_jabatan', { p_nama: values.nama.trim(), p_urutan: Number(values.urutan), p_id: previous?.id || null, p_versi: previous?.versi ?? null }, true);
  } });
  document.body.insertAdjacentHTML('beforeend', `<dialog class="form-dialog jobs-dialog" id="jobs-dialog" aria-labelledby="jobs-title">
    <div class="dialog-heading"><div><p class="dialog-kicker">DATA KARYAWAN</p><h2 id="jobs-title">Kelola jabatan</h2></div><button class="icon-button" type="button" data-close="jobs-dialog" aria-label="Tutup daftar jabatan"><span data-icon="close"></span></button></div>
    <div class="form-body"><p class="jobs-intro">Urutan 1 tampil paling atas. Karyawan dengan jabatan yang sama diurutkan berdasarkan nama.</p>
      <form id="job-form" class="job-form"><div><label for="job-name">Nama jabatan</label><input id="job-name" required maxlength="150" autocomplete="off"></div><div><label for="job-rank">Urutan</label><input id="job-rank" type="number" required min="1" max="9999" step="1" inputmode="numeric"></div><div class="heading-actions"><button id="job-save" class="button button-primary" type="submit">Tambah jabatan</button><button id="job-cancel-edit" class="button button-secondary" type="button" hidden>Batal edit</button></div><p id="job-error" class="form-error" role="alert" hidden></p></form>
      <p id="jobs-status" class="jobs-note" role="status"></p><ul class="jobs-list" id="jobs-list" aria-label="Urutan jabatan"></ul><button id="jobs-refresh" class="button button-text" type="button">Muat ulang daftar</button>
    </div></dialog>`);
  let jobs = [], editing = null, request = 0, pending = false;
  const ui = () => g.PortalUI;
  function reset() { editing = null; $('job-form').reset(); $('job-save').textContent = 'Tambah jabatan'; $('job-cancel-edit').hidden = true; }
  function render() {
    $('jobs-list').innerHTML = jobs.map(j => `<li class="job-row"><span class="job-rank">${j.urutan ?? '—'}</span><span class="job-row-name">${e(j.nama)}${j.urutan == null ? '<small>Urutan belum diatur</small>' : ''}</span><button class="button button-secondary" type="button" data-edit-job="${e(j.id)}" aria-label="Edit jabatan ${e(j.nama)}">Edit</button></li>`).join('');
    $('jobs-status').textContent = jobs.length ? `${jobs.length} jabatan${jobs.some(j => j.urutan == null) ? ' · Atur urutan jabatan lama sesuai struktur perusahaan.' : ''}` : 'Belum ada jabatan. Tambahkan jabatan pertama di atas.';
  }
  async function refresh() {
    const id = ++request; $('jobs-status').textContent = 'Memuat jabatan…';
    try { const rows = await list(); if (id !== request) return; jobs = rows; render(); }
    catch (error) { if (id === request) $('jobs-status').textContent = error.message; }
  }
  async function open() {
    if (!A.superAdmin()) return;
    reset(); ui().formError('job-error', ''); ui().openDialog('jobs-dialog'); await refresh(); $('job-name').focus();
  }
  document.querySelectorAll('[data-manage-jobs]').forEach(button => button.addEventListener('click', open));
  $('jobs-refresh').addEventListener('click', refresh); $('job-cancel-edit').addEventListener('click',()=>{if(!window.FormGuard||FormGuard.leave($('job-form')))reset();});
  $('jobs-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-job]'); if (!button || pending || !A.superAdmin()) return;
    if(window.FormGuard&&!FormGuard.leave($('job-form')))return;
    editing = jobs.find(j => j.id === button.dataset.editJob); if (!editing) return;
    $('job-name').value = editing.nama; $('job-rank').value = editing.urutan ?? ''; $('job-save').textContent = 'Simpan perubahan'; $('job-cancel-edit').hidden = false; ui().formError('job-error', ''); $('job-name').focus(); window.FormGuard?.clean($('job-form'));
  });
  $('job-form').addEventListener('submit', async event => {
    event.preventDefault(); if (pending || !A.superAdmin() || !event.currentTarget.reportValidity()) return;
    pending = true; $('job-save').disabled = true; $('job-cancel-edit').disabled = true; ui().formError('job-error', '');
    try {
      const saved = await g.JabatanStore.save({ nama: $('job-name').value, urutan: $('job-rank').value }, editing);
      reset(); await refresh(); document.dispatchEvent(new CustomEvent('jabatan:berubah', { detail: saved })); document.dispatchEvent(new CustomEvent('employees:changed')); ui().showToast('Jabatan tersimpan.');
    } catch (error) { ui().formError('job-error', error.message); }
    finally { pending = false; $('job-save').disabled = false; $('job-cancel-edit').disabled = false; }
  });
  $('jobs-dialog').addEventListener('close', () => { request++; });
  document.addEventListener('akses:berubah', () => { if (!A.superAdmin()) $('jobs-dialog').close(); });
})(window);
