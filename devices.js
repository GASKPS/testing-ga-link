(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const UI = window.PortalUI, repo = window.DeviceStore, domain = window.DeviceDomain;
  const { icon, escape: e, dateText, showToast, formError, openDialog, closeDialog } = UI;
  // Existing links copied from the user's original Link Kerja HTML.
  const resources = {
    form: 'https://docs.google.com/forms/d/e/1FAIpQLScYHx8hBaEEZ4fhhUmnMtLyWEa6u0nDMGmtmY5YedIvtG0L8w/viewform?usp=header',
    responses: 'https://docs.google.com/spreadsheets/d/1rMtKL27MJ_UP5N3tdgJqOaSMMMbd5JERy0UTrvENBGM/edit?resourcekey=&gid=1928238653#gid=1928238653'
  };
  document.querySelectorAll('[data-device-resource]').forEach(a => { a.href = resources[a.dataset.deviceResource]; });
  let devices = [], historyId = null, handoverId = null, handoverRevision = null, editingDevice = null, afterReturn = null;
  let historyPage = 1, historyDevice = null, historyRequest=0;
  const pages = window.Paginasi;
  const initialPicker = window.EmployeeUI.createPicker('device-holder', 'Pemegang awal');
  const recipientPicker = window.EmployeeUI.createPicker('handover-recipient', 'Penerima');
  const radioIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="7" width="12" height="15" rx="2"/><path d="M8 7V2M16 7V4M9 11h6M9 15h6M9 18h3"/></svg>';
  const typeName = kind => ({HT:'Handy Talky',HP:'Handphone',PC:'PC',Printer:'Printer'}[kind] || kind);
  const typeIcon = kind => kind === 'HT' ? radioIcon : icon({HP:'phone',PC:'monitor',Printer:'printer'}[kind]);
  const condition = value => `<span class="device-condition ${value === 'Rusak Ringan' ? 'minor' : value === 'Rusak Berat' ? 'major' : ''}">${e(value)}</span>`;
  const personLabel = value => value.kind === 'admin' ? 'Admin/Gudang' : value.nama;
  const personNik = value => value.kind === 'employee' ? `NIK ${value.nik}${value.jabatan ? ' · ' + value.jabatan : ''}` : '';
  function empty(title, caption, action) {
    return `<div class="empty-state"><span class="empty-symbol">${icon('phone')}</span><h2>${e(title)}</h2><p>${e(caption)}</p>${action || ''}</div>`;
  }
  function renderDevices() {
    const q = $('device-search').value.trim().toLocaleLowerCase('id-ID'), kind = $('device-kind-filter').value;
    const rows = devices.filter(d => (d.aktif===($('device-active-filter').value!=='nonaktif'))&&(!kind || d.jenis === kind) && (!q || [d.jenis,d.nomor,d.merek,d.pemegang.nik,d.pemegang.jabatan,personLabel(d.pemegang)].join(' ').toLocaleLowerCase('id-ID').includes(q)));
    $('device-summary').textContent = domain.TYPES.map(kind => `${devices.filter(d => d.jenis === kind).length} ${kind}`).join(' · ');
    $('device-result-count').textContent = q || kind ? `${rows.length} dari ${devices.length} perangkat` : `${devices.length} perangkat`;
    if (!rows.length) {
      $('device-results').innerHTML = q || kind
        ? empty('Perangkat tidak ditemukan', 'Coba kata kunci lain atau tampilkan semua perangkat.', '<button class="button button-secondary" type="button" data-device-action="reset">Reset pencarian</button>')
        : empty('Belum ada perangkat', 'Tambahkan perangkat untuk mencatat pemegang dan riwayatnya.', `<button class="button button-secondary" type="button" data-device-action="new">${icon('plus')}Tambah Perangkat</button>`);
      return;
    }
    $('device-results').innerHTML = `<div class="table-scroll"><table class="device-table"><caption class="sr-only">Daftar perangkat beserta pemegang saat ini</caption><thead><tr><th scope="col">Jenis</th><th scope="col">Nomor seri</th><th scope="col">Merek / tipe</th><th scope="col">Kondisi</th><th scope="col">Pemegang saat ini</th><th scope="col">Tindakan</th></tr></thead><tbody>${rows.map(d => `<tr>
      <td data-label="Jenis"><span class="device-type ${e(d.jenis.toLowerCase())}">${typeIcon(d.jenis)}${e(d.jenis)}</span></td>
      <td data-label="Nomor seri"><button class="device-serial" type="button" data-device-action="history" data-device-id="${e(d.id)}" aria-label="Riwayat perangkat ${e(d.nomor)}">${e(d.nomor)}</button></td>
      <td data-label="Merek / tipe">${e(d.merek)}</td><td data-label="Kondisi">${condition(d.kondisi)}</td>
      <td data-label="Pemegang saat ini"><span class="device-owner ${d.pemegang.kind === 'admin' ? 'admin' : ''}">${e(personLabel(d.pemegang))}</span>${d.pemegang.kind === 'employee' ? `<span class="device-owner-nik">${e(personNik(d.pemegang))}</span>` : ''}</td>
      <td data-label="Tindakan"><div class="device-row-actions"><button ${d.aktif ? '' : 'hidden'} class="button button-primary" type="button" data-device-action="transfer" data-device-id="${e(d.id)}" aria-label="Serah terima ${e(d.nomor)}">Serah Terima</button><button class="button button-secondary" type="button" data-device-action="history" data-device-id="${e(d.id)}" aria-label="Riwayat ${e(d.nomor)}">Riwayat</button><button ${d.aktif ? '' : 'hidden'} class="button button-secondary" type="button" data-device-action="edit" data-device-id="${e(d.id)}" aria-label="Edit perangkat ${e(d.nomor)}">Edit</button>${window.DataAdmin?.buttons('perangkat',d.id,d.revision,d.nomor,d.aktif)||''}</div></td>
    </tr>`).join('')}</tbody></table></div>`;
  }
  async function refreshDevices() { if(location.hash!=='#ht-hp')return;devices = await repo.list(); renderDevices(); }
  $('device-search').addEventListener('input', renderDevices);
  $('device-kind-filter').addEventListener('change', renderDevices);
  $('device-active-filter').addEventListener('change',renderDevices);
  function resetFilters() { $('device-search').value = ''; $('device-kind-filter').value = ''; renderDevices(); }
  async function newDevice() {
    if (!window.Akses.superAdmin()) return;
    editingDevice = null; $('device-form').reset(); formError('device-form-error', '');
    $('device-form-kicker').textContent = 'PERANGKAT BARU'; $('device-form-title').textContent = 'Tambah perangkat'; $('device-save').textContent = 'Simpan Perangkat';
    $('device-holder-picker').hidden = false; initialPicker.setDisabled(false); $('device-edit-hint').hidden = true;
    await initialPicker.load('admin'); openDialog('device-dialog'); $('device-kind').focus();
  }
  async function editDevice(id) {
    if (!window.Akses.superAdmin()) return;
    const device = await repo.get(id), form = $('device-form'); form.reset();
    editingDevice = { id, revision: device.revision };
    ['jenis','nomor','merek','kondisi'].forEach(field => { form.elements.namedItem(field).value = device[field]; });
    $('device-form-kicker').textContent = 'DATA PERANGKAT'; $('device-form-title').textContent = 'Edit perangkat'; $('device-save').textContent = 'Simpan Perubahan';
    $('device-holder-picker').hidden = true; initialPicker.setDisabled(true); $('device-edit-hint').hidden = false;
    formError('device-form-error', ''); openDialog('device-dialog'); $('device-serial').focus();
  }
  function fillHolder(prefix, device) {
    $(prefix + '-name').textContent = personLabel(device.pemegang);
    $(prefix + '-nik').textContent = personNik(device.pemegang);
    $(prefix + '-condition').innerHTML = condition(device.kondisi);
  }
  function renderHistory(device) {
    historyDevice = device; historyPage = 1;historyRequest++;
    $('device-history-kind').textContent = typeName(device.jenis).toUpperCase() + ' · RIWAYAT PERANGKAT';
    $('device-history-title').textContent = device.nomor;
    $('device-history-brand').textContent = device.merek;
    $('device-history-holder').textContent = personLabel(device.pemegang);
    $('device-history-nik').textContent = personNik(device.pemegang);
    $('device-history-condition').innerHTML = condition(device.kondisi);
    $('device-initial-holder').textContent = personLabel(device.pemegangAwal) + (device.pemegangAwal.kind === 'employee' ? ` · ${personNik(device.pemegangAwal)}` : '');
    renderHistoryEvents();
  }
  function renderHistoryEvents() {
    const device = historyDevice; if (!device) return;
    const page = pages.range(device.historyTotal||0, historyPage); historyPage = page.page;
    $('device-history-count').textContent = `${device.historyTotal||0} perpindahan`;
    $('device-history-events').innerHTML = device.history.length ? `<ol class="timeline">${device.history.map(event => `<li class="history-event"><div class="event-heading"><strong>Serah terima ${event.urutan}</strong><time datetime="${e(event.tanggal)}">${e(dateText(event.tanggal))}</time></div><div class="device-event-route"><div>${e(personLabel(event.dari))}${event.dari.kind === 'employee' ? `<small>${e(personNik(event.dari))}</small>` : ''}</div>${icon('arrow')}<div>${e(personLabel(event.kepada))}${event.kepada.kind === 'employee' ? `<small>${e(personNik(event.kepada))}</small>` : ''}</div></div><small class="event-actor">Dicatat oleh ${e(event.namaPetugas)} · ${e(new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jayapura',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(event.dicatatPada)))} WIT</small>${event.catatan ? `<p class="event-note">${e(event.catatan)}</p>` : ''}<div class="device-event-footer">${condition(event.kondisi)}${event.buktiUrl ? `<a class="device-proof-button" href="${e(domain.proofUrl(event.buktiUrl))}" target="_blank" rel="noopener noreferrer" aria-label="Lihat bukti serah terima ${e(dateText(event.tanggal))}">${icon('file')}Lihat Bukti <span aria-hidden="true">↗</span></a>` : '<span class="device-no-proof">Bukti tidak dilampirkan</span>'}</div></li>`).join('')}</ol>` : '<p class="history-empty">Belum ada serah terima. Perangkat masih pada pemegang awal yang dicatat.</p>';
    pages.render($('device-history-pagination'), page, async next => { const id=historyId,seq=++historyRequest;try{const h=await repo.historyPage(id,next);if(historyId!==id||seq!==historyRequest)return;historyDevice={...historyDevice,...h};historyPage=h.historyPage;renderHistoryEvents();$('device-history-events').scrollIntoView({block:'start'});}catch(error){showToast(error.message);} });
  }
  async function showHistory(id, success = false) {
    const device = await repo.get(id); historyId = id; renderHistory(device); $('device-history-transfer').hidden=!device.aktif;
    $('device-history-success').hidden = !success;
    $('device-history-success').textContent = success ? 'Serah terima dicatat. Pemegang perangkat sudah diperbarui.' : '';
    openDialog('device-history-dialog');
    $('device-history-dialog').scrollTop = 0;
  }
  async function beginTransfer(id, options = {}) {
    afterReturn = options.afterReturn || null;
    const device = await repo.get(id);
    if(options.employeeId && device.pemegang.employeeId !== options.employeeId) throw new Error('Pemegang HT sudah berubah. Tekan Periksa lagi pada pemeriksaan SKC.');
    handoverId = id; handoverRevision = device.revision;
    $('handover-form').reset(); formError('handover-error', '');
    $('handover-kind').textContent = 'SERAH TERIMA ' + typeName(device.jenis).toUpperCase();
    $('handover-title').textContent = device.nomor; $('handover-brand').textContent = device.merek;
    fillHolder('handover-from', device);
    $('handover-date').value = domain.today(); $('handover-date').max = domain.today();
    $('handover-date').min = device.tanggalTerakhir || '';
    $('handover-condition').value = device.kondisi;
    recipientPicker.setDisabled(false);
    await recipientPicker.load(options.returnToAdmin ? 'admin' : '', device.pemegang);
    recipientPicker.setDisabled(!!options.returnToAdmin);
    openDialog('handover-dialog'); recipientPicker.focus();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-device-action]');
    if (!button) return;
    const action = button.dataset.deviceAction, id = button.dataset.deviceId;
    if (action === 'new') newDevice().catch(error => showToast(error.message));
    if (action === 'reset') resetFilters();
    if (action === 'history') showHistory(id).catch(error => showToast(error.message));
    if (action === 'transfer') beginTransfer(id).catch(error => showToast(error.message));
    if (action === 'edit') editDevice(id).catch(error => showToast(error.message));
  });
  $('device-history-transfer').addEventListener('click', () => beginTransfer(historyId).catch(error => showToast(error.message)));
  $('device-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type=submit]');
    if (!window.Akses.superAdmin() || !form.reportValidity() || button.disabled) return;
    button.disabled = true;
    try {
      const editing = editingDevice, data = Object.fromEntries(new FormData(form));
      if (editing) await repo.update(editing.id, { ...data, expectedRevision: editing.revision });
      else await repo.create({ ...data, pemegang: initialPicker.read() });
      window.FormGuard?.clean($('device-form')); closeDialog('device-dialog'); await refreshDevices(); resetFilters();
      document.dispatchEvent(new CustomEvent('devices:changed'));
      showToast(editing ? 'Data perangkat diperbarui.' : 'Perangkat ditambahkan dan disimpan.');
    } catch (error) { formError('device-form-error', error.message); }
    finally { button.disabled = false; }
  });
  $('handover-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type=submit]');
    if (!form.reportValidity() || button.disabled) return;
    button.disabled = true;
    try {
      const device = await repo.handover(handoverId, { ...Object.fromEntries(new FormData(form)), penerima: recipientPicker.read(), expectedRevision: handoverRevision });
      const continuation = afterReturn; afterReturn = null;
      window.FormGuard?.clean($('handover-form')); closeDialog('handover-dialog'); await refreshDevices();
      document.dispatchEvent(new CustomEvent('devices:changed'));
      if (continuation) await continuation(); else await showHistory(device.id, true);
    } catch (error) { formError('handover-error', error.message); }
    finally { button.disabled = false; }
  });
  document.addEventListener('akses:berubah', () => { if (!window.Akses.superAdmin()) $('device-dialog').close(); });
  window.DeviceUI = Object.freeze({beginReturn:(id,employeeId,afterReturn)=>beginTransfer(id,{returnToAdmin:true,employeeId,afterReturn})});
  document.addEventListener('employees:changed', () => refreshDevices().catch(error => showToast(error.message)));
  window.addEventListener('hashchange',()=>refreshDevices().catch(error=>showToast(error.message)));
  refreshDevices().catch(error => showToast(error.message));
document.addEventListener('akses:berubah',()=>refreshDevices().catch(error=>showToast(error.message)));
  document.addEventListener('data:muat-ulang',()=>refreshDevices().catch(error=>showToast(error.message)));
})();
