(function () {
  'use strict';
  const A = window.Akses, S = window.ProfilStore, $ = id => document.getElementById(id);
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = name => (name || '').trim().split(/\s+/).slice(0, 2).map(x => [...x][0] || '').join('').toLocaleUpperCase('id-ID');
  const isPortal = !!$('profile-page');
  const sectionNames = {profile:'Profil Saya',password:'Ganti Kata Sandi',users:'Hak Akses',offices:'Kelola Office',download:'Download'};
  const sectionDescriptions = {profile:'Foto dan identitas akun kerja Anda.',password:'Perbarui kata sandi untuk akun Portal GA dan Web Mess.',users:'Atur peran dan akses pengguna.',offices:'Kelola daftar office dan statusnya.',download:'Unduh data sesuai akses akun Anda.'};
  let host = $('profile-page');
  if (!host) { host = document.createElement('section'); host.id = 'profile-page'; host.className = 'mess-profile-page'; host.hidden = true; $('app-shell').append(host); }
  host.innerHTML = `
    <section id="ga-profile-page" class="ga-profile" aria-labelledby="ga-profile-title">
      <div class="ga-profile-header"><div><h1 id="ga-profile-title" tabindex="-1">Profil &amp; Pengaturan</h1>${isPortal?'<p class="ga-profile-subtitle" id="ga-profile-description"></p>':''}</div><button type="button" class="ga-profile-button" id="ga-profile-back">Kembali</button></div>
      <div class="ga-profile-surface">
      <div class="ga-profile-tabs" role="tablist" aria-label="Pengaturan akun">
        <button class="ga-profile-tab" id="ga-tab-profile" type="button" role="tab" aria-selected="true" aria-controls="ga-panel-profile" data-profile-tab="profile">Profil Saya</button>
        <button class="ga-profile-tab" id="ga-tab-password" type="button" role="tab" aria-selected="false" aria-controls="ga-panel-password" tabindex="-1" data-profile-tab="password">Keamanan</button>
        <button class="ga-profile-tab" id="ga-tab-users" type="button" role="tab" aria-selected="false" aria-controls="ga-panel-users" tabindex="-1" data-profile-tab="users" hidden>Akun tim</button>
        <button class="ga-profile-tab" id="ga-tab-offices" type="button" role="tab" aria-selected="false" aria-controls="ga-panel-offices" tabindex="-1" data-profile-tab="offices" hidden>Office</button>
        <button class="ga-profile-tab" id="ga-tab-download" type="button" role="tab" aria-selected="false" aria-controls="ga-panel-download" tabindex="-1" data-profile-tab="download" hidden>Unduhan</button>
      </div>
      <div id="ga-panel-profile" class="ga-profile-body" role="tabpanel" aria-labelledby="ga-tab-profile">
        <div class="ga-profile-person"><span class="account-avatar" data-account-avatar aria-hidden="true"></span><div><strong id="ga-profile-name"></strong><span class="ga-profile-email" id="ga-profile-email"></span><span class="ga-profile-role" id="ga-profile-role"></span><span class="ga-profile-email" id="ga-profile-office"></span></div></div>
        <section class="ga-profile-section" aria-labelledby="ga-photo-title"><h2 id="ga-photo-title">Foto profil</h2><p class="ga-profile-help">Gunakan foto yang memudahkan rekan kerja mengenali Anda.</p>
          <form id="ga-photo-form"><label class="ga-profile-label ga-photo-picker" for="ga-photo-file">Pilih foto baru</label><input id="ga-photo-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="ga-photo-help"><p id="ga-photo-help" class="ga-profile-help">JPG, PNG, atau WebP. Maksimal 2 MB.</p>
          <div class="ga-photo-preview" id="ga-photo-preview" hidden><span class="account-avatar"><img id="ga-photo-new-image" alt="Pratinjau foto yang dipilih"></span><span class="ga-profile-help">Foto baru</span></div>
          <div class="ga-profile-actions"><button type="submit" class="ga-profile-button primary" id="ga-photo-save" disabled>Simpan foto</button><button type="button" class="ga-profile-button danger" id="ga-photo-remove" hidden>Hapus foto</button></div><p id="ga-photo-message" class="ga-profile-message" role="status" hidden></p></form>
        </section>
      </div>
      <div id="ga-panel-password" class="ga-profile-body" role="tabpanel" aria-labelledby="ga-tab-password" hidden>
        <section class="ga-profile-section" aria-labelledby="ga-password-title"><h3 id="ga-password-title">Ganti kata sandi</h3>
          <form id="ga-password-form"><div class="ga-profile-grid"><div class="ga-profile-field"><label class="ga-profile-label" for="ga-password-new">Password baru</label><input id="ga-password-new" type="password" required minlength="8" maxlength="128" autocomplete="new-password" aria-describedby="ga-password-help"></div><div class="ga-profile-field"><label class="ga-profile-label" for="ga-password-confirm">Konfirmasi password</label><input id="ga-password-confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></div></div>
          <p id="ga-password-help" class="ga-profile-help">Minimal 8 karakter. Password baru berlaku untuk Portal GA dan Web Mess.</p><label class="ga-access-check"><input type="checkbox" id="ga-password-show">Tampilkan password</label>
          <div class="ga-profile-code" id="ga-password-code-box" hidden><p class="ga-profile-help">Konfirmasi akun diperlukan. Minta kode, lalu masukkan kode yang diterima melalui email akun.</p><button type="button" class="ga-profile-button" id="ga-password-send-code">Kirim kode verifikasi</button><label class="ga-profile-label" for="ga-password-code">Kode verifikasi</label><input id="ga-password-code" autocomplete="one-time-code" inputmode="numeric" maxlength="32"></div>
          <div class="ga-profile-actions"><button type="submit" class="ga-profile-button primary" id="ga-password-save">Simpan password</button></div><p id="ga-password-message" class="ga-profile-message" role="status" hidden></p></form>
        </section>
      </div>
      <div id="ga-panel-users" class="ga-profile-body" role="tabpanel" aria-labelledby="ga-tab-users" hidden>
        <div class="ga-users-heading"><div><h2>Daftar akun</h2><p class="ga-profile-help">Pilih akun untuk membuka pengaturannya.</p></div><button type="button" id="ga-create-user" class="ga-profile-button primary" hidden>Buat akun</button></div><div class="ga-users-layout"><div class="ga-users-directory">
        <form id="ga-users-search-form" class="ga-profile-search"><label class="sr-only" for="ga-users-query" hidden>Cari nama atau email akun</label><input id="ga-users-query" type="search" maxlength="150" placeholder="Cari nama atau email akun…" aria-label="Cari nama atau email akun"><button type="submit" class="ga-profile-button">Cari</button></form>
        <div class="ga-settings-table-scroll"><table class="ga-settings-table"><caption class="sr-only">Daftar akun perusahaan</caption><thead><tr><th scope="col">Nama / email</th><th scope="col">Office</th><th scope="col">Peran</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody id="ga-users-list"></tbody></table></div><p id="ga-users-message" class="ga-profile-message" role="status" hidden></p><div class="ga-profile-actions"><button type="button" class="ga-profile-button" id="ga-users-more" hidden>Muat berikutnya</button><button type="button" class="ga-profile-button" id="ga-users-refresh">Muat ulang</button></div>
        </div>
        <section id="ga-access-dialog" class="ga-account-page" aria-labelledby="ga-access-title" hidden><section id="ga-access-editor" class="ga-access-editor" aria-labelledby="ga-access-title" hidden>
          <div class="dialog-heading"><div><p class="dialog-kicker">PENGATURAN AKUN</p><h2 id="ga-access-title" tabindex="-1">Hak akses akun</h2></div><button type="button" class="icon-button" data-access-cancel aria-label="Kembali ke daftar akun">← Daftar akun</button></div>
<form id="ga-access-form" class="ga-profile-body">
      <div class="ga-access-summary"><strong id="ga-access-name"></strong><small id="ga-access-email"></small></div>
      <div class="ga-access-role"><label class="ga-profile-label" for="ga-access-role">Peran</label><select id="ga-access-role" required><option value="pembaca">Pembaca</option><option value="crew">Crew</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option><option value="administrator">Administrator</option></select></div>
      <div class="ga-access-role"><label class="ga-profile-label" for="ga-access-office">Office akun</label><select id="ga-access-office" disabled><option value="">Belum ditetapkan</option></select><p class="ga-profile-help">Office membatasi dokumen yang dapat dilihat. Administrator dapat melihat seluruh office. Hanya Administrator yang dapat mengubah office akun.</p></div>
      <label class="ga-access-check"><input id="ga-access-active" type="checkbox">Akun aktif</label><label class="ga-access-check"><input id="ga-access-portal" type="checkbox">Akses Portal GA</label><label class="ga-access-check"><input id="ga-access-mess" type="checkbox">Akses Web Mess</label>
      <p class="ga-profile-help" id="ga-access-help"></p><p class="ga-profile-message" id="ga-access-message" role="status" hidden></p>
      <div class="ga-profile-actions"><button class="ga-profile-button" type="button" data-access-cancel>Batal</button><button class="ga-profile-button primary" id="ga-access-save" type="submit">Simpan hak akses</button></div>
    </form>
    <div id="ga-admin-account-tools" hidden><details class="ga-settings-advanced"><summary>Nama akun dan kata sandi</summary>
      <form id="ga-rename-form" class="ga-account-tool"><h3>Nama Akun</h3><p class="ga-profile-help">Nama petugas yang muncul di portal. Email untuk masuk dan data karyawan tetap terpisah.</p><label class="ga-profile-label" for="ga-rename-name">Nama Akun / username</label><input id="ga-rename-name" required maxlength="150" autocomplete="off"><div class="ga-profile-actions"><button class="ga-profile-button primary" type="submit">Simpan Nama Akun</button></div><p id="ga-rename-message" class="ga-profile-message" role="status" hidden></p></form>
      <form id="ga-admin-password-form" class="ga-account-tool"><h3>Atur kata sandi akun ini</h3><p class="ga-profile-help">Tidak membutuhkan kata sandi lama. Berikan kata sandi sementara kepada pemilik akun, lalu minta ia menggantinya melalui Profil &amp; Pengaturan.</p><label class="ga-profile-label" for="ga-admin-password">Kata sandi baru</label><input id="ga-admin-password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"><label class="ga-profile-label" for="ga-admin-confirm">Konfirmasi kata sandi</label><input id="ga-admin-confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password"><label class="ga-access-check"><input id="ga-admin-password-agree" type="checkbox" required> Saya memastikan akun yang dipilih sudah benar.</label><div class="ga-profile-actions"><button class="ga-profile-button primary" type="submit">Ganti kata sandi akun ini</button></div><p id="ga-admin-password-message" class="ga-profile-message" role="status" hidden></p></form>
    </details></div></section></section></div>
      </div>
      <div id="ga-panel-offices" class="ga-profile-body" role="tabpanel" aria-labelledby="ga-tab-offices" hidden><section class="ga-profile-section"><div class="ga-users-heading"><h2>Daftar office</h2><button class="ga-profile-button primary" type="button" id="ga-office-new">Tambah office</button></div><p class="ga-profile-help">Tambahkan office untuk pemisahan dokumen. Office nonaktif tidak tersedia untuk akun atau dokumen baru; dokumen lama tetap tersimpan.</p><p id="ga-office-message" class="ga-profile-message" role="status" hidden></p><div class="ga-settings-table-scroll"><table class="ga-settings-table"><caption class="sr-only">Daftar office perusahaan</caption><thead><tr><th scope="col">Office</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody id="ga-office-list"></tbody></table></div><dialog class="form-dialog ga-settings-dialog" id="ga-office-dialog" aria-labelledby="ga-office-title"><div class="dialog-heading"><h2 id="ga-office-title">Tambah office</h2><button class="icon-button" type="button" id="ga-office-close" aria-label="Tutup formulir office">×</button></div><form id="ga-office-form" class="ga-profile-body"><div class="ga-profile-field"><label class="ga-profile-label" for="ga-office-name">Nama office</label><input id="ga-office-name" required maxlength="100" autocomplete="off" placeholder="Nama office"></div><label class="ga-access-check"><input id="ga-office-active" type="checkbox" checked>Office aktif</label><div class="ga-profile-actions"><button class="ga-profile-button primary" type="submit">Simpan office</button></div><p id="ga-office-form-message" class="ga-profile-message" role="status" hidden></p></form></dialog></section></div>
      <div id="ga-panel-download" class="ga-profile-body" role="tabpanel" aria-labelledby="ga-tab-download" hidden></div>
      </div>
    </section>`;

  const accountPage=$('ga-access-dialog');host.querySelector('.ga-profile').append(accountPage);let directoryScroll=0;
  function accountPageShow(on){accountPage.hidden=!on;host.querySelector('.ga-profile-surface').hidden=on;host.querySelector('.ga-profile-header').hidden=on;if(on){directoryScroll=window.scrollY;window.scrollTo(0,0);}else if(directoryScroll){window.scrollTo(0,directoryScroll);}}
  let currentTab = 'profile', requestedTab = 'profile', users = [], userOffset = 0, userQuery = '', userRequest = 0, editing = null;
  let photoBlob = null, photoUrl = '', photoGeneration = 0, photoVersion = 0, photoBusy = false, passwordBusy = false, accessBusy = false;
  let pageVisible = false, previousRoute = isPortal ? '#link-kerja' : '';
  let accountId=null;
  let avatarRequest = 0, avatarPath = null, avatarUrl = '', avatarExpiry = 0;
  function message(id, text, kind = '') { const el = $(id); el.textContent = text; el.className = 'ga-profile-message' + (kind ? ' ' + kind : ''); el.hidden = !text; }
  function errorMessage(error) {
    if (error?.code === 'same_password') return 'Password baru harus berbeda dari password saat ini.';
    if (error?.code === 'weak_password') return 'Password belum memenuhi ketentuan akun. Gunakan kombinasi yang lebih kuat.';
    return A.errorText(error);
  }
  function drawAvatars(url) {
    document.querySelectorAll('[data-account-avatar]').forEach(el => {
      el.textContent = '';
      if (url) { const img = document.createElement('img'); img.src = url; img.alt = ''; img.onerror = () => { el.textContent = initials(A.profile?.nama) || 'GA'; }; el.append(img); }
      else el.textContent = initials(A.profile?.nama) || 'GA';
    });
  }
  async function avatar() {
    const profile = A.profile, path = profile?.foto_path || '', request = ++avatarRequest;
    if (!path) { avatarPath = ''; avatarUrl = ''; drawAvatars(''); return; }
    if (avatarPath === path && Date.now() < avatarExpiry) { drawAvatars(avatarUrl); return; }
    drawAvatars('');
    try {
      const url = await S.signedPhoto(path);
      if (request !== avatarRequest || A.profile?.foto_path !== path) return;
      avatarPath = path; avatarUrl = url; avatarExpiry = Date.now() + 3000000; drawAvatars(url);
    } catch (error) { if (pageVisible) message('ga-photo-message', error.message, 'error'); }
  }
  function account() {
    const p = A.profile;if(accountId!==p?.id){accountId=p?.id;photoBusy=false;passwordBusy=false;accessBusy=false;clearPhoto();resetPassword();closeAccess();freezePhoto(false);$('ga-password-save').disabled=false;userRequest++;users=[];$('ga-users-list').replaceChildren();}
    $('ga-profile-name').textContent = p?.nama || 'Profil saya'; $('ga-profile-email').textContent = p?.email || '';
    $('ga-profile-role').textContent = S.roles[p?.peran] || '';
    $('ga-tab-users').hidden = !A.superAdmin();
    $('ga-tab-download').hidden = !A.canWrite();
    $('ga-tab-offices').hidden=!isPortal||!A.administrator();
    if(!A.administrator()&&currentTab==='offices')selectTab('profile',true);
    $('ga-admin-account-tools').hidden = !A.administrator();$('ga-create-user').hidden=!A.administrator();
    if(!A.administrator()){$('ga-admin-password-form').reset();$('ga-rename-form').reset();$('ga-office-form').reset();window.FormGuard?.clean($('ga-office-form'));if($('ga-office-dialog').open)$('ga-office-dialog').close();if(editing&&['administrator','super_admin'].includes(editing.peran))closeAccess();}
    if(!A.canWrite()&&currentTab==='download')selectTab('profile',true);
    [...$('ga-access-role').options].forEach(o=>{o.disabled=!A.administrator()&&['administrator','super_admin'].includes(o.value);o.hidden=o.disabled;});
    document.dispatchEvent(new CustomEvent('profil:siap'));
    if (!A.superAdmin() && currentTab === 'users') selectTab('profile',true);
    if (!A.superAdmin()) { users = []; editing = null; $('ga-users-list').replaceChildren(); closeAccess(); }
    $('ga-photo-remove').hidden = !p?.foto_path;
    syncProfileLinks();
    avatar();
    if (p && !pageVisible && location.hash === '#profil') routeProfile();
  }
  function clearPhoto() {
    photoGeneration++; photoBlob = null;
    if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = '';
    $('ga-photo-file').value = ''; $('ga-photo-preview').hidden = true; $('ga-photo-new-image').removeAttribute('src'); $('ga-photo-save').disabled = true; window.FormGuard?.clean($('ga-photo-form'));
  }
  function freezePhoto(value) { photoBusy = value; $('ga-photo-file').disabled = value; $('ga-photo-remove').disabled = value; $('ga-photo-save').disabled = value || !photoBlob; }
  function resetPassword() {
    $('ga-password-form').reset(); $('ga-password-code-box').hidden = true;
    $('ga-password-new').type = $('ga-password-confirm').type = 'password';
  }
  function closeAccess() {
    editing = null; accountPageShow(false);$('ga-access-editor').hidden = true;for(const id of ['ga-access-form','ga-rename-form','ga-admin-password-form'])window.FormGuard?.clean($(id));if($('ga-access-dialog').open)$('ga-access-dialog').close();
    $('ga-access-form').reset(); $('ga-rename-form').reset(); $('ga-admin-password-form').reset(); message('ga-access-message', '');message('ga-rename-message','');message('ga-admin-password-message','');
  }
  function canOpenTab(tab){
    return !!A.profile && Object.hasOwn(sectionNames,tab) && (tab!=='users'||A.superAdmin()) && (tab!=='offices'||(isPortal&&A.administrator())) && (tab!=='download'||A.canWrite());
  }
  function syncProfileLinks(){
    document.querySelectorAll('[data-open-profile]').forEach(button=>{
      const section=button.dataset.profileSection||'profile';button.disabled=!canOpenTab(section);
      if(button.dataset.profileSection&&['users','offices','download'].includes(section))button.hidden=!canOpenTab(section);
      if(pageVisible&&(!button.dataset.profileSection||section===currentTab))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
  }
  function updateSectionTitle(){
    if(!isPortal)return;$('ga-profile-title').textContent='Pengaturan';$('ga-profile-description').textContent='Kelola identitas, keamanan, dan kebutuhan kerja tim Anda.';
    if(pageVisible){$('page-label').textContent=sectionNames[currentTab];document.title=sectionNames[currentTab]+' · GA Services';}
  }
  function selectTab(tab,force=false) {
    if(!canOpenTab(tab))return false;
    if(!force&&tab!==currentTab && window.FormGuard && !FormGuard.leave($('ga-panel-'+currentTab)))return false;
    if (currentTab === 'password' && tab !== 'password' && !passwordBusy) resetPassword();
    currentTab = tab;
    for (const name of ['profile', 'password', 'users', 'offices', 'download']) { $('ga-tab-' + name).setAttribute('aria-selected', String(tab === name)); $('ga-tab-' + name).tabIndex = tab === name ? 0 : -1; $('ga-panel-' + name).hidden = tab !== name; }
    syncProfileLinks();updateSectionTitle();
    if (tab === 'users'&&!users.length) loadUsers(true);else if(tab!=='users')closeAccess();
    if(tab==='offices')window.OfficeUI.loadManager().catch(error=>message('ga-office-message',error.message,'error'));
    return true;
  }
  async function preparePage() {
    clearPhoto(); resetPassword(); closeAccess();
    for (const id of ['ga-photo-message', 'ga-password-message']) message(id, '');
    const next=requestedTab;photoVersion = A.profile?.versi_foto; account();selectTab(canOpenTab(next)?next:'profile');
    $('ga-profile-title').focus({preventScroll:true});
    try { await A.refreshProfile(); photoVersion = A.profile?.versi_foto; }
    catch (error) { message('ga-photo-message', error.message, 'error'); }
  }
  function routeProfile() {
    const visible = location.hash === '#profil' && !!A.profile;
    if (location.hash !== '#profil') previousRoute = location.hash || (isPortal ? '#link-kerja' : '');
    if (!isPortal) {
      host.hidden = !visible;
      document.querySelector('.simple-app-shell').hidden = visible;
      document.title = visible ? 'Profil & Pengaturan · Mess Karyawan' : 'Mess Karyawan · HKOC';
    }
    const changed = visible !== pageVisible; pageVisible = visible;
    syncProfileLinks();updateSectionTitle();
    if (changed && visible) { window.scrollTo(0,0); preparePage(); }
    if (changed && !visible) { requestedTab='profile';clearPhoto(); resetPassword(); closeAccess(); userRequest++; users = []; $('ga-users-list').replaceChildren(); }
  }
  function openProfile(event) {
    const next=event?.currentTarget?.dataset.profileSection||'profile';
    if (!canOpenTab(next)) return;
    if(pageVisible&&next!==currentTab&&window.FormGuard&&!FormGuard.leave(host))return;
    requestedTab=next;
    if ($('sidebar')?.classList.contains('open')) $('close-menu').click();
    if (location.hash !== '#profil') location.hash = 'profil';
    else { if(selectTab(next)){routeProfile();$('ga-profile-title').focus({preventScroll:true});} }
  }
  document.querySelectorAll('[data-open-profile]').forEach(button => button.addEventListener('click', openProfile));
  $('ga-profile-back').addEventListener('click', () => { location.hash = previousRoute; });
  document.querySelectorAll('[data-access-cancel]').forEach(button => button.addEventListener('click', () => { if (!accessBusy && (!window.FormGuard||FormGuard.leave($('ga-access-editor')))) { closeAccess(); $('ga-users-query').focus(); } }));
  window.addEventListener('hashchange', routeProfile);
  document.querySelectorAll('[data-profile-tab]').forEach(button => {
    button.addEventListener('click', () => selectTab(button.dataset.profileTab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = ['profile','password',...(A.superAdmin()?['users']:[]),...(isPortal&&A.administrator()?['offices']:[]),...(A.canWrite()?['download']:[])], index = tabs.indexOf(currentTab);
      const tab = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      if(selectTab(tab)){$('ga-tab-' + tab).focus();$('ga-tab-'+tab).scrollIntoView({block:'nearest',inline:'nearest'});}
    });
  });
  $('ga-photo-file').addEventListener('change', async event => {
    const file = event.target.files[0]; clearPhoto(); message('ga-photo-message', ''); if (!file) return; window.FormGuard?.touch($('ga-photo-form'));
    const generation = photoGeneration; freezePhoto(true); message('ga-photo-message', 'Menyiapkan foto…');
    try { const blob = await S.preparePhoto(file); if (generation !== photoGeneration) return; photoBlob = blob; photoUrl = URL.createObjectURL(blob); $('ga-photo-new-image').src = photoUrl; $('ga-photo-preview').hidden = false; message('ga-photo-message', ''); }
    catch (error) { if (generation === photoGeneration) { clearPhoto(); message('ga-photo-message', error.message, 'error'); } }
    finally { if(generation===photoGeneration)freezePhoto(false); }
  });
  async function savePhoto(remove) {
    if (photoBusy || (!remove && !photoBlob)) return;
    const owner=A.profile?.id;freezePhoto(true); message('ga-photo-message', 'Menyimpan foto…');
    try { const profile = await S.savePhoto(remove ? null : photoBlob, photoVersion);if(A.profile?.id!==owner)return;photoVersion = profile.versi_foto; window.FormGuard?.clean($('ga-photo-form')); clearPhoto(); message('ga-photo-message', remove ? 'Foto profil dihapus.' : 'Foto profil tersimpan.', 'success'); }
    catch (error) { if(A.profile?.id===owner)message('ga-photo-message', errorMessage(error), 'error'); }
    finally { if(A.profile?.id===owner)freezePhoto(false); }
  }
  $('ga-photo-form').addEventListener('reset', clearPhoto);
  $('ga-photo-form').addEventListener('submit', event => { event.preventDefault(); savePhoto(false); });
  $('ga-photo-remove').addEventListener('click', () => savePhoto(true));
  $('ga-password-show').addEventListener('change', event => { $('ga-password-new').type = $('ga-password-confirm').type = event.target.checked ? 'text' : 'password'; });
  $('ga-password-form').addEventListener('submit', async event => {
    event.preventDefault(); if (passwordBusy || !event.currentTarget.reportValidity()) return;
    const owner=A.profile?.id;passwordBusy = true; $('ga-password-save').disabled = true; message('ga-password-message', '');
    try { await S.changePassword($('ga-password-new').value, $('ga-password-confirm').value, $('ga-password-code').value);if(A.profile?.id!==owner)return;$('ga-password-form').reset(); $('ga-password-new').type = $('ga-password-confirm').type = 'password'; $('ga-password-code-box').hidden = true; message('ga-password-message', 'Password berhasil diganti. Gunakan password baru saat masuk berikutnya.', 'success'); }
    catch (error) {if(A.profile?.id!==owner)return;if (error.code === 'reauthentication_needed' || /reauthentication|reauthenticate/i.test(error.message)) { $('ga-password-code-box').hidden = false; message('ga-password-message', 'Konfirmasi akun diperlukan sebelum password dapat diganti. Minta kode verifikasi di atas.'); } else message('ga-password-message', errorMessage(error), 'error'); }
    finally {if(A.profile?.id===owner){passwordBusy = false; $('ga-password-save').disabled = false;} }
  });
  $('ga-password-send-code').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { await S.sendCode(); message('ga-password-message', 'Kode verifikasi dikirim. Periksa email akun Anda.'); $('ga-password-code').focus(); }
    catch (error) { message('ga-password-message', errorMessage(error), 'error'); }
    finally { button.disabled = false; }
  });
  function drawUsers() {
    $('ga-users-list').innerHTML = users.map(p => `<tr><td><button class="ga-account-name" type="button" data-edit-access="${escape(p.id)}">${escape(p.nama)}${p.id === A.profile?.id ? ' (Anda)' : ''}</button><small>${escape(p.email)}</small></td><td>${escape(window.OfficeStore?.name(p.office_id)||'Belum ditetapkan')}</td><td>${escape(S.roles[p.peran]||p.peran)}</td><td><span class="ga-user-status${p.aktif?'':' inactive'}">${p.aktif?'Aktif':'Nonaktif'}</span></td><td><button class="ga-profile-button" ${!A.administrator()&&['administrator','super_admin'].includes(p.peran)?'disabled':''} type="button" data-edit-access="${escape(p.id)}" aria-label="Atur akun ${escape(p.nama)}">Atur akun</button></td></tr>`).join('');

  }
  async function loadUsers(reset) {
    if (!A.superAdmin()) return;
    const request = ++userRequest;
    if (reset) { if(accessBusy||window.FormGuard&&!FormGuard.leave($('ga-access-editor')))return; closeAccess(); userQuery = $('ga-users-query').value.trim(); userOffset = 0; users = []; drawUsers(); }
    const offset = userOffset; message('ga-users-message', 'Memuat akun…'); $('ga-users-more').disabled = true; $('ga-users-more').hidden = true;
    try {
      const rows = await S.users(userQuery, offset);
      if (request !== userRequest || !A.superAdmin()) return;
      users.push(...rows); userOffset = offset + rows.length; drawUsers();
      $('ga-users-more').hidden = rows.length < 100; message('ga-users-message', users.length ? '' : 'Akun tidak ditemukan.');
    } catch (error) { if (request === userRequest) message('ga-users-message', errorMessage(error), 'error'); }
    finally { if (request === userRequest) $('ga-users-more').disabled = false; }
  }
  $('ga-users-search-form').addEventListener('submit', event => { event.preventDefault(); loadUsers(true); });
  $('ga-users-more').addEventListener('click', () => loadUsers(false)); $('ga-users-refresh').addEventListener('click', () => loadUsers(true));
  function roleHelp() {
    const crew=$('ga-access-role').value==='crew';
    const sa = ['administrator','super_admin'].includes($('ga-access-role').value);
    for (const id of ['ga-access-portal', 'ga-access-mess']) { $(id).disabled = sa||crew; if (sa) $(id).checked = true; if(crew)$(id).checked=id==='ga-access-portal'; }
    $('ga-access-help').textContent = crew?'Crew hanya mencatat barang keluar dan mengisi hitungan fisik pada office penugasannya.':sa ? ($('ga-access-role').value==='administrator'?'Administrator mengelola seluruh akses, penghapusan, dan aktivasi kembali data.':'Super Admin mengelola master serta akses Admin dan Pembaca di kedua web.') : $('ga-access-role').value === 'admin' ? 'Admin dapat mencatat dokumen, SKC, serah terima perangkat, dan update mess. Data master dikelola Super Admin.' : 'Pembaca hanya dapat melihat data pada web yang diizinkan.';
  }
  $('ga-users-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-access]'); if (!button || !A.superAdmin() || accessBusy) return;
    if (window.FormGuard && !FormGuard.leave($('ga-access-editor'))) return;
    editing = users.find(p => p.id === button.dataset.editAccess); if (!editing) return;
    if (!A.administrator() && ['administrator','super_admin'].includes(editing.peran)) return;
    $('ga-rename-name').value=editing.nama; $('ga-admin-password-form').reset();message('ga-rename-message','');message('ga-admin-password-message','');
    $('ga-admin-account-tools').hidden=!A.administrator();
    $('ga-access-form').dataset.userId=editing.id; $('ga-access-name').textContent = editing.nama; $('ga-access-email').textContent = editing.email;
    $('ga-access-role').value = editing.peran; $('ga-access-active').checked = editing.aktif; $('ga-access-portal').checked = editing.akses_portal; $('ga-access-mess').checked = editing.akses_mess;
    roleHelp();window.OfficeUI.accountOffice(editing).catch(error=>message('ga-access-message',error.message,'error')); message('ga-access-message', ''); $('ga-access-editor').hidden = false;accountPageShow(true);$('ga-access-title').textContent='Pengaturan akun — '+editing.nama;$('ga-access-title').focus(); window.FormGuard?.clean($('ga-access-form'));
  });
  $('ga-access-dialog').addEventListener('cancel',event=>{if(accessBusy)event.preventDefault();});
  $('ga-access-role').addEventListener('change', roleHelp);
  $('ga-access-form').addEventListener('submit', async event => {
    event.preventDefault(); if (accessBusy || !editing || !A.superAdmin()) return;
    if(window.FormGuard&&!FormGuard.leave($('ga-admin-account-tools')))return;
    const operationOwner=A.profile?.id;accessBusy = true; $('ga-access-save').disabled = true; message('ga-access-message', '');
    try {
      const saved = await S.setAccess(editing, { peran: $('ga-access-role').value, aktif: $('ga-access-active').checked, aksesPortal: $('ga-access-portal').checked, aksesMess: $('ga-access-mess').checked,officeId:$('ga-access-office').value });
      if(A.profile?.id!==operationOwner)return;window.FormGuard?.clean($('ga-access-form'));
      users = users.map(p => p.id === saved.id ? saved : p); editing=saved;drawUsers(); message('ga-access-message', 'Pengaturan akun tersimpan.', 'success');
      if (saved.id === A.profile.id) await A.refreshProfile();
    } catch (error) { if(A.profile?.id===operationOwner)message('ga-access-message', errorMessage(error), 'error'); }
    finally { if(A.profile?.id===operationOwner){accessBusy = false; $('ga-access-save').disabled = false;} }
  });
  $('ga-rename-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(accessBusy||!editing||!A.administrator()||!form.reportValidity())return;
    const operationOwner=A.profile?.id;accessBusy=true;const b=form.querySelector('[type=submit]');b.disabled=true;message('ga-rename-message','');
    try{const saved=await S.rename(editing,$('ga-rename-name').value);if(A.profile?.id!==operationOwner)return;editing=saved;users=users.map(p=>p.id===saved.id?saved:p);drawUsers();$('ga-access-name').textContent=saved.nama;$('ga-access-title').textContent='Pengaturan akun — '+saved.nama;window.FormGuard?.clean(form);message('ga-rename-message','Nama Akun tersimpan. Catatan petugas sebelumnya tetap memakai nama saat dicatat.','success');if(saved.id===A.profile.id)await A.refreshProfile();}
    catch(error){if(A.profile?.id===operationOwner)message('ga-rename-message',errorMessage(error),'error');}finally{if(A.profile?.id===operationOwner){accessBusy=false;b.disabled=false;}}
  });
  $('ga-admin-password-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(accessBusy||!editing||!A.administrator()||!form.reportValidity())return;
    const operationOwner=A.profile?.id;accessBusy=true;const b=form.querySelector('[type=submit]');b.disabled=true;message('ga-admin-password-message','');
    try{await S.resetAccountPassword(editing,$('ga-admin-password').value,$('ga-admin-confirm').value);if(A.profile?.id!==operationOwner)return;form.reset();window.FormGuard?.clean(form);message('ga-admin-password-message','Kata sandi akun berhasil diganti. Sampaikan kepada pemilik akun melalui jalur yang aman.','success');}
    catch(error){if(A.profile?.id===operationOwner)message('ga-admin-password-message',errorMessage(error),'error');}finally{if(A.profile?.id===operationOwner){accessBusy=false;b.disabled=false;}}
  });
  document.addEventListener('akun:dibuat',event=>{if(A.administrator()){$('ga-users-query').value=event.detail.email;loadUsers(true);}});
  document.addEventListener('akses:berubah', account);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.profile && !photoBusy && !passwordBusy && !accessBusy) A.refreshProfile().catch(() => {}); });
  A.ready.then(() => { account(); routeProfile(); });
})();
