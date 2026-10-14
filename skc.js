(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { icon, escape: e, dateText, showToast, formError, openDialog, closeDialog } = window.PortalUI;
  const repo = window.SkcStore, domain = window.SkcDomain;
  const picker = window.EmployeeUI.createPicker('skc-employee', 'Karyawan', { allowAdmin: false });
  let records = [], view = 'pending', collecting = null, collectRequest=0;
  const taken = record => record.status === 'Sudah diambil';
  const link = (url, label) => url ? `<a class="skc-drive-link" href="${e(domain.driveLink(url))}" target="_blank" rel="noopener noreferrer">${e(label)} <span aria-hidden="true">↗</span></a>` : '<span class="skc-no-link">Tidak dilampirkan</span>';
  function render() {
    const pending = records.filter(record => !taken(record)), completed = records.filter(taken);
    $('skc-count').textContent = records.length; $('skc-pending-count').textContent = pending.length; $('skc-taken-count').textContent = completed.length;
    const rows = view === 'pending' ? pending : completed;
    $('skc-result-count').textContent = `${rows.length} SKC ${view === 'pending' ? 'belum diambil' : 'sudah diambil'}`;
    if (!rows.length) {
      const title = view === 'taken' ? 'Belum ada SKC yang diambil' : records.length ? 'Semua SKC sudah diambil' : 'Belum ada data SKC';
      const caption = view === 'taken' ? 'SKC yang sudah diserahkan kepada karyawan akan tampil di sini.' : records.length ? 'Tidak ada SKC yang menunggu pengambilan.' : 'Tambahkan karyawan dan tanggal cuti untuk mencatat pengambilan SKC.';
      $('skc-results').innerHTML = `<div class="empty-state"><span class="empty-symbol">${icon(view === 'taken' ? 'check-circle' : 'file')}</span><h2>${title}</h2><p>${caption}</p>${view === 'pending' ? `<button class="button button-secondary" type="button" data-skc-action="new">${icon('plus')}Tambah SKC</button>` : ''}</div>`;
      return;
    }
    $('skc-results').innerHTML = `<div class="table-scroll"><table class="skc-table"><caption class="sr-only">SKC ${view === 'pending' ? 'belum' : 'sudah'} diambil</caption><thead><tr><th scope="col">Karyawan</th><th scope="col">Tanggal cuti</th><th scope="col">Form Cuti</th><th scope="col">Exit</th><th scope="col">${view === 'pending' ? 'Pengambilan' : 'Sudah diambil'}</th></tr></thead><tbody>${rows.map(record => `<tr><td data-label="Karyawan"><strong class="skc-person-name">${e(record.nama)}</strong><span class="secondary-value">NIK ${e(record.nik)}</span></td><td data-label="Tanggal cuti" class="date-cell">${e(dateText(record.tanggalCuti))}</td><td data-label="Form Cuti">${link(record.formCutiUrl, 'Form Cuti')}</td><td data-label="Exit">${link(record.exitUrl, 'Exit')}</td><td data-label="Pengambilan">${taken(record) ? `<span class="skc-taken-label">${icon('check-circle')}Sudah diambil</span><span class="secondary-value">${e(dateText(record.tanggalDiambil))}</span><span class="secondary-value">Diambil: ${e(record.namaPengambil)} · ${e(record.nikPengambil)}</span><span class="secondary-value">Dicatat: ${e(record.namaPetugas)}</span>` : `<button class="button button-primary" type="button" data-skc-action="collect" data-skc-id="${e(record.id)}" aria-label="Tandai SKC ${e(record.nama)} tanggal cuti ${e(dateText(record.tanggalCuti))} sudah diambil">Tandai Diambil</button>`}${window.DataAdmin?.buttons('skc',record.id,record.revision,record.nama+' · '+dateText(record.tanggalCuti))||''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  async function refresh() { records = await repo.list(); render(); }
  function selectView(next) {
    view = next;
    document.querySelectorAll('[data-skc-tab]').forEach(button => {
      const selected = button.dataset.skcTab === view;
      button.classList.toggle('active', selected); button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    $('skc-results').setAttribute('aria-labelledby', 'skc-tab-' + view); render();
  }
  document.querySelectorAll('[data-skc-tab]').forEach(button => {
    button.addEventListener('click', () => selectView(button.dataset.skcTab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'pending' : event.key === 'End' ? 'taken' : view === 'pending' ? 'taken' : 'pending';
      selectView(next); $('skc-tab-' + next).focus();
    });
  });
  async function newSkc() {
    $('skc-form').reset(); formError('skc-form-error', '');
    await picker.load(); openDialog('skc-dialog'); picker.focus();
  }
  async function beginCollect(id) {
    const seq=++collectRequest,record=await repo.get(id);if(seq!==collectRequest)return;
    if (taken(record)) { await refresh(); selectView('taken'); return; }
    collecting = { id, revision: record.revision, employeeId: record.employeeId };
    const held=await window.DeviceStore.heldHt(record.employeeId);if(seq!==collectRequest)return;
    if(held.length) {
      $('skc-ht-person').textContent = `${record.nama} · NIK ${record.nik} · ${held.length} HT`;
      $('skc-ht-list').innerHTML = held.map(device=>`<div class="skc-ht-item"><div><strong>${e(device.nomor)}</strong><span>${e(device.merek)} · ${e(device.kondisi)}</span></div></div>`).join('');
      formError('skc-ht-error',''); openDialog('skc-ht-dialog'); return;
    }
    if($('skc-ht-dialog').open) closeDialog('skc-ht-dialog');
    $('skc-collect-name').textContent = record.nama; $('skc-collect-nik').textContent = `NIK ${record.nik}`;
    $('skc-collect-date').textContent = dateText(record.tanggalCuti); formError('skc-collect-error', '');
    openDialog('skc-collect-dialog');
  }
  $('skc-ht-continue').addEventListener('click',event=>saveCollection(event.currentTarget,'skc-ht-error','skc-ht-dialog'));
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-skc-action]');
    if (!button) return;
    if (button.dataset.skcAction === 'new') newSkc().catch(error => showToast(error.message));
    if (button.dataset.skcAction === 'collect') beginCollect(button.dataset.skcId).catch(error => showToast(error.message));
  });
  $('skc-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type=submit]');
    if (!form.reportValidity() || button.disabled) return;
    button.disabled = true;
    try {
      await repo.create({ ...Object.fromEntries(new FormData(form)), employeeId: picker.read().employeeId });
      window.FormGuard?.clean($('skc-form')); closeDialog('skc-dialog'); await refresh(); selectView('pending'); showToast('SKC ditambahkan ke daftar Belum diambil.');
    } catch (error) { formError('skc-form-error', error.message); }
    finally { button.disabled = false; }
  });
  async function saveCollection(button,errorId,dialogId) {
    if(button.disabled||!collecting)return;
    button.disabled=true;formError(errorId,'');
    try {
      await repo.collect(collecting.id,collecting.revision);
      window.FormGuard?.clean($('skc-collect-form'));closeDialog(dialogId);await refresh();selectView('taken');
      collecting=null;$('skc-tab-taken').focus();showToast('SKC masuk ke daftar Sudah diambil.');
    } catch(error){formError(errorId,error.message);}
    finally{button.disabled=false;}
  }
  $('skc-collect-form').addEventListener('submit',event=>{
    event.preventDefault();saveCollection(event.currentTarget.querySelector('[type=submit]'),'skc-collect-error','skc-collect-dialog');
  });
  document.addEventListener('employees:changed', () => refresh().catch(error => showToast(error.message)));
  refresh().catch(error => showToast(error.message));
document.addEventListener('akses:berubah',()=>refresh().catch(error=>showToast(error.message)));
  document.addEventListener('data:muat-ulang',()=>refresh().catch(error=>showToast(error.message)));
})();
