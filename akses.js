/* Shared Supabase authentication. Database rules remain the authority. */
(function (g) {
  'use strict';
  const cfg = g.KONFIGURASI || {}, state = { client: null, profile: null, preview: false, configured: false };
  const $ = id => document.getElementById(id);
  const area = document.body.dataset.area || 'portal';
  const canWrite = () => !!state.profile?.aktif && (['administrator','super_admin'].includes(state.profile.peran) || (state.profile.akses_portal && state.profile.peran === 'admin'));
  const superAdmin = () => state.profile?.aktif && ['administrator','super_admin'].includes(state.profile.peran);
  const administrator = () => !!state.profile?.aktif && state.profile.peran === 'administrator';
  const errorText = error => {
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) return 'Koneksi terputus. Periksa internet lalu coba kembali.';
    if (['PGRST205','42P01','PGRST202'].includes(error?.code)) return 'Database belum lengkap. Jalankan SQL pemasangan pada proyek Supabase baru.';
    return error?.message || 'Data belum dapat dimuat. Coba kembali.';
  };
  function showError(text) { $('auth-error').textContent = text; $('auth-error').hidden = !text; }
  function showApp() {
    $('auth-screen').hidden = true; $('app-shell').hidden = false;
    document.body.classList.toggle('read-only', !canWrite());
    document.body.classList.toggle('not-super-admin', !superAdmin());
    document.body.classList.toggle('not-administrator', !administrator());
    document.body.classList.toggle('mode-pratinjau', state.preview);
    document.querySelectorAll('[data-current-user]').forEach(el => { el.textContent = state.profile?.nama || 'Pratinjau tampilan'; });
    document.querySelectorAll('[data-actor-input]').forEach(el => { el.value = state.profile?.nama || ''; });
    document.querySelectorAll('[data-current-role]').forEach(el => { el.textContent = ({administrator:'Administrator',super_admin:'Super Admin',admin:'Admin',pembaca:'Hanya lihat'})[state.profile?.peran] || 'Belum terhubung'; });
    document.querySelectorAll('[data-super-admin]').forEach(el => { el.hidden = !superAdmin(); });
    document.querySelectorAll('[data-administrator]').forEach(el => { el.hidden = !administrator(); });
    document.querySelectorAll('[data-preview-notice]').forEach(el => { el.hidden = !state.preview; });
    document.dispatchEvent(new CustomEvent('akses:berubah'));
  }
  async function hydrate(user) {
    if (!user) { state.profile = null; $('app-shell').hidden = true; $('auth-screen').hidden = false; document.dispatchEvent(new CustomEvent('akses:berubah')); return; }
    const { data, error } = await state.client.from('profil_pengguna').select('*').eq('id',user.id).single();
    if (error || !data?.aktif || (!['administrator','super_admin'].includes(data.peran) && !data[area === 'mess' ? 'akses_mess' : 'akses_portal'])) {
      state.profile = null;
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      $('app-shell').hidden = true; $('auth-screen').hidden = false;
      const message = error ? errorText(error) : !data.aktif ? 'Akun belum aktif. Hubungi Super Admin.' : 'Akun ini belum diberi akses ke web ini. Hubungi Super Admin.';
      document.dispatchEvent(new CustomEvent('akses:berubah'));
      showError(message); throw new Error(message);
    }
    state.profile = data; state.preview = false; showApp();
  }
  function loadSdk() {
    return new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/supabase.js';
      script.onload = () => g.supabase?.createClient ? resolve() : reject(new Error('Komponen login belum dapat dimuat. Muat ulang halaman.'));
      script.onerror = () => reject(new Error('Komponen login belum dapat dimuat. Periksa koneksi internet.'));
      document.head.append(script);
    });
  }
  async function init() {
    if (!cfg.urlSupabase || !cfg.kunciPublishable) {
      $('auth-description').textContent = 'Web siap dihubungkan ke proyek Supabase baru.';
      $('login-form').hidden = true; $('auth-setup').hidden = false; $('auth-preview').hidden = false;
      return;
    }
    let url;
    try { url = new URL(cfg.urlSupabase); } catch { throw new Error('URL Supabase pada konfigurasi.js belum valid.'); }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/') throw new Error('Gunakan Project URL HTTPS Supabase pada konfigurasi.js.');
    if (cfg.kunciPublishable.startsWith('sb_secret_')) throw new Error('Gunakan publishable key, bukan secret key.');
    if (cfg.kunciPublishable.startsWith('eyJ')) {
      try { if (JSON.parse(atob(cfg.kunciPublishable.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role !== 'anon') throw new Error('unsafe'); }
      catch { throw new Error('Kunci lama harus berjenis anon. Jangan gunakan service_role key.'); }
    }
    state.configured = true;
    await loadSdk();
    state.client = g.supabase.createClient(url.origin,cfg.kunciPublishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data,error} = await state.client.auth.getSession();
    if (error) throw error;
    try { await hydrate(data.session?.user); } catch (err) { showError(errorText(err)); $('auth-reset').hidden = false; }
    state.client.auth.onAuthStateChange((event,session) => {
      if (event === 'SIGNED_OUT' && state.profile) location.reload();
      if (event === 'SIGNED_IN' && state.profile && session?.user?.id !== state.profile.id) location.reload();
    });
    $('login-submit').disabled = false;
  }
  const ready = init().catch(err => { showError(errorText(err)); });
  async function requireClient(write = false) {
    await ready;
    if (!state.profile || state.preview) throw new Error('Masuk dengan akun yang aktif untuk menyimpan data.');
    if (write && !canWrite()) throw new Error('Akun ini hanya memiliki akses melihat.');
    return state.client;
  }
  async function rpc(name,args,write = false) {
    const client = await requireClient(write), {data,error} = await client.rpc(name,args);
    if (error) throw Object.assign(new Error(errorText(error)), {code: error.code});
    // PostgREST represents composite row results as arrays, even for one row.
    const rows = ['simpan_office','atur_hak_akses_office','simpan_link_kerja','ubah_nama_akun','simpan_foto_karyawan','atur_masa_extra','simpan_karyawan','simpan_dokumen','catat_perpindahan_dokumen','simpan_perangkat','catat_serah_terima','tambah_skc','ambil_skc','terbitkan_impor_mess','simpan_jabatan','simpan_foto_profil','atur_hak_akses','simpan_tamu','simpan_catatan_admin','ubah_status_catatan','simpan_extra','catat_pemakaian_cuti'];
    if (rows.includes(name) && Array.isArray(data)) {
      if (data.length !== 1) throw new Error('Hasil penyimpanan belum dapat dipastikan. Muat ulang data sebelum mencoba lagi.');
      return data[0];
    }
    return data;
  }
  async function all(table,columns='*',filters={},order='id') {
    await ready; if (!state.profile || state.preview) return [];
    const client = await requireClient(); let rows = [];
    for (let offset=0;;offset+=500) {
      let query=client.from(table).select(columns).order(order).order('id').range(offset,offset+499);
      for(const [key,value] of Object.entries(filters)) query=query.eq(key,value);
      const {data,error}=await query; if(error) throw new Error(errorText(error));
      rows.push(...data); if(data.length<500) return rows;
    }
  }
  async function one(table,id,columns='*') {
    const client = await requireClient(), {data,error}=await client.from(table).select(columns).eq('id',id).single();
    if(error) throw new Error(errorText(error)); return data;
  }
  async function refreshProfile() {
    await ready;
    if (!state.client || state.preview) return;
    const {data,error} = await state.client.auth.getUser();
    if (error) throw new Error(errorText(error));
    await hydrate(data.user);
    return state.profile;
  }
  function acceptProfile(profile) {
    if (profile?.id !== state.profile?.id) return;
    state.profile=profile; showApp();
  }
  g.Akses = Object.freeze({ready,canWrite,superAdmin,administrator,rpc,all,one,requireClient,errorText,refreshProfile,acceptProfile,
    get profile(){return state.profile;}, get preview(){return state.preview;}, get configured(){return state.configured;}});
  $('login-form').addEventListener('submit',async event => {
    event.preventDefault(); const button=$('login-submit'); if(button.disabled) return;
    button.disabled=true; showError('');
    try {
      await ready; if(!state.client) throw new Error('Koneksi belum siap. Periksa konfigurasi Supabase.');
      const {data,error}=await state.client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
      if(error) throw new Error(error.code === 'invalid_credentials' ? 'Email atau password tidak sesuai.' : errorText(error));
      if (area === 'portal') location.hash='link-kerja';
      await hydrate(data.user); $('login-password').value='';
    } catch(err) { showError(errorText(err)); $('auth-reset').hidden=false; }
    finally { button.disabled=false; }
  });
  $('auth-preview').addEventListener('click',() => { state.preview=true; showApp(); });
  $('auth-password-toggle').addEventListener('click',() => { const field=$('login-password'); field.type=field.type==='password'?'text':'password'; $('auth-password-toggle').textContent=field.type==='password'?'Lihat':'Sembunyikan'; });
  document.querySelectorAll('[data-logout]').forEach(el => el.addEventListener('click',async () => {
    el.disabled=true;
    try { if(state.client) { const {error}=await state.client.auth.signOut({scope:'local'}); if(error) throw error; } location.reload(); }
    catch(err) { el.disabled=false; showError(errorText(err)); g.PortalUI?.showToast(errorText(err)); }
  }));
})(window);
