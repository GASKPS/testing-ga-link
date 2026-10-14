(function (g) {
  'use strict';
  const A = g.Akses, U = g.PortalUI, S = g.StokStore, D = g.StokDomain, P = g.Paginasi;
  const e = U.escape, $ = id => document.getElementById(id), host = $('stok-page');
  const statusNames = {draf:'Sedang dihitung',menunggu:'Perlu diperiksa',sesuai:'Sesuai',disesuaikan:'Stok disesuaikan',ditutup:'Ditutup tanpa penyesuaian',batal:'Dibatalkan'};
  const kindNames = {awal:'Stok awal',masuk:'Barang masuk',keluar:'Barang keluar',penyesuaian:'Penyesuaian opname'};
  const stamp = v => v ? new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jayapura',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)) + ' WIT' : '—';
  const today = () => g.TrackingDomain.today();
  const qty = (v, unit = '') => `${e(D.format(v))}${unit ? ' ' + e(unit) : ''}`;
  const badge = (text, cls = '') => `<span class="stok-badge ${cls}">${e(text)}</span>`;
  const differenceBadge = v => badge(v == null ? 'Belum dihitung' : (v > 0 ? '+' : '') + D.format(v) + ' · ' + D.label(v), v == null ? '' : v < 0 ? 'short' : v > 0 ? 'over' : 'ok');
  let tab = 'stok', page = 1, rows = [], snapshot = {total:0,ringkasan:{}}, request = 0, timer;
  let master = null, transactionItems = [], transactionKey, startKey, detail = null, detailRequest = 0, catalogPromise;
  host.innerHTML = `<div class="page-heading"><div><p class="page-kicker">PERSEDIAAN</p><h1>Stok Barang &amp; Opname</h1><p class="page-description">Catat pemakaian barang dan bandingkan stok dengan hitungan crew setiap minggu.</p></div><div class="heading-actions"><button id="stok-add-item" class="button button-secondary" type="button">Tambah barang</button><button id="stok-add-move" class="button button-primary" type="button">Barang masuk / keluar</button></div></div>
    <div class="stats" aria-label="Ringkasan stok"><div class="stok-stat"><small>Jenis barang aktif</small><strong id="stok-stat-items">—</strong></div><div class="stok-stat"><small>Barang stok habis</small><strong id="stok-stat-zero">—</strong></div><div class="stok-stat"><small>Opname perlu diperiksa</small><strong id="stok-stat-pending">—</strong></div><div class="stok-stat"><small>Opname terakhir</small><strong id="stok-stat-last" class="stok-last">—</strong></div></div>
    <div id="stok-active" class="stok-active" hidden></div><div class="stok-panel"><div class="stok-tabs" role="tablist" aria-label="Persediaan">${[['stok','Stok barang'],['opname','Opname mingguan'],['mutasi','Riwayat barang']].map(([id,name],i)=>`<button type="button" id="stok-tab-${id}" data-stok-tab="${id}" role="tab" aria-controls="stok-results" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${name}</button>`).join('')}</div>
    <div class="stok-tools"><div class="field"><label for="stok-search">Pencarian</label><input type="search" id="stok-search" maxlength="200" placeholder="Kode, nama barang, atau spesifikasi"></div><div class="field"><label for="stok-filter">Tampilkan</label><select id="stok-filter"></select></div><button id="stok-refresh" class="button button-secondary" type="button">Muat ulang</button><button id="stok-start" class="button button-primary" type="button" hidden>Mulai opname</button></div>
    <p class="stok-help" id="stok-help"></p><p class="form-error" id="stok-error" role="alert" hidden></p><p class="stok-help" id="stok-setup" hidden>Administrator: <a href="stok_setup.sql" download="23_stok_opname.sql">unduh SQL Stok &amp; Opname</a>, lalu jalankan pada database Portal GA.</p>
    <div id="stok-results" role="tabpanel" aria-labelledby="stok-tab-stok"></div><div class="stok-footer"><span id="stok-count" class="stok-count" role="status"></span><button id="stok-backup" class="button button-secondary stok-backup" type="button" hidden>Unduh data stok JSON</button></div><div class="pagination" id="stok-pages"></div></div>`;
  function modal(id, title, body, actions) {
    const node = document.createElement('dialog'); node.id = id; node.className = 'form-dialog stok-dialog'; node.setAttribute('aria-labelledby',id+'-title');
    node.innerHTML = `<div class="dialog-heading"><h2 id="${id}-title">${title}</h2><button type="button" class="icon-button" data-stok-close="${id}" aria-label="Tutup">${U.icon('close')}</button></div><form id="${id}-form"><div class="form-body">${body}<p id="${id}-error" class="form-error" role="alert" hidden></p></div><div class="dialog-actions"><button type="button" class="button button-secondary" data-stok-close="${id}">Tutup</button>${actions}</div></form>`;
    document.body.append(node); return node;
  }
  const itemDialog = modal('stok-item','Tambah barang',`<p class="stok-intro">Kode, nama, spesifikasi, jenis aset, dan satuan mengikuti format Excel. Isi stok awal sesuai jumlah yang menjadi acuan saat mulai memakai web.</p><div class="field" id="stok-source-field"><label for="stok-source">Ambil identitas barang dari Excel</label><select id="stok-source"><option value="">Isi manual</option></select><small>Pilihan berasal dari file Anda. Jumlah penerimaan lama tidak dijadikan stok awal.</small></div><div class="form-grid">
    <div class="field"><label for="stok-item-code">Kode barang *</label><input id="stok-item-code" name="kode" required maxlength="60"></div><div class="field"><label for="stok-item-name">Nama item *</label><input id="stok-item-name" name="nama" required maxlength="200"></div><div class="field full-width"><label for="stok-item-spec">Spesifikasi</label><input id="stok-item-spec" name="spesifikasi" maxlength="500"></div><div class="field"><label for="stok-item-asset">Jenis aset *</label><input id="stok-item-asset" name="jenis_aset" value="Consumable" required maxlength="100"></div><div class="field"><label for="stok-item-unit">Satuan *</label><input id="stok-item-unit" name="satuan" placeholder="Pcs, Btl, Roll…" required maxlength="40"></div><div class="field" id="stok-opening-field"><label for="stok-item-opening">Stok awal *</label><input id="stok-item-opening" name="saldo_awal" type="number" min="0" step="0.001" required><small>Gunakan satuan yang sama dengan kolom di atas.</small></div><div class="field" id="stok-active-field" hidden><label for="stok-item-active">Status barang</label><select id="stok-item-active"><option value="true">Aktif</option><option value="false">Nonaktif</option></select><small>Barang dapat dinonaktifkan setelah stok nol.</small></div></div>`, '<button type="submit" class="button button-primary">Simpan barang</button>');
  const moveDialog = modal('stok-move','Catat barang masuk / keluar',`<div class="form-grid"><div class="field"><label for="stok-move-kind">Transaksi *</label><select id="stok-move-kind" name="jenis"><option value="masuk">Barang masuk</option><option value="keluar">Barang keluar / pengambilan</option></select></div><div class="field"><label for="stok-move-date">Tanggal *</label><input id="stok-move-date" name="tanggal" type="date" required></div><div class="field full-width"><label for="stok-move-target" id="stok-target-label">Asal barang / vendor</label><input id="stok-move-target" name="tujuan" maxlength="200"></div></div><div id="stok-move-lines"></div><button id="stok-line-add" class="button button-secondary" type="button">Tambah item</button><div class="field" style="margin-top:18px"><label for="stok-move-note">Remark / Catatan</label><textarea id="stok-move-note" name="catatan" maxlength="2000" rows="3"></textarea></div><p class="stok-warning">Setiap pengambilan dicatat menggunakan satuan barang. Petugas pencatat mengikuti akun yang login.</p>`, '<button type="submit" class="button button-primary">Simpan transaksi</button>');
  const startDialog = modal('stok-start-dialog','Mulai opname mingguan',`<p class="stok-intro">Mulai sesi sebelum crew menghitung. Web menyimpan stok catatan saat sesi dimulai. Selama perhitungan, jeda perpindahan fisik barang dan pencatatan barang masuk/keluar. Pencatatan dibuka kembali setelah hasil hitungan diselesaikan.</p><div class="field"><label for="stok-crew">Crew yang menghitung *</label><input id="stok-crew" name="crew" required maxlength="200" placeholder="Nama crew atau tim"></div><div class="field"><label for="stok-start-note">Catatan pemeriksaan</label><textarea id="stok-start-note" name="catatan" rows="3" maxlength="2000"></textarea></div>`, '<button type="submit" class="button button-primary">Mulai &amp; buka lembar hitung</button>');
  const countDialog = modal('stok-count-dialog','Hasil opname','<div id="stok-detail-body"></div>', '<div class="stok-inline-actions" id="stok-detail-actions"></div>');
  function error(id, message) { $(id).textContent = message || ''; $(id).hidden = !message; }
  function setBusy(form, busy) { form.querySelectorAll('button').forEach(b => b.disabled = busy); }
  const clearForm = form => g.FormGuard?.clean(form);
  function permissions() {
    $('stok-add-item').hidden = !A.superAdmin(); $('stok-add-move').hidden = !A.canWrite(); $('stok-backup').hidden = !A.superAdmin();
    $('stok-start').hidden = tab !== 'opname' || !A.canWrite();
    $('stok-start').disabled = !!snapshot.aktif || !!snapshot.ringkasan?.menunggu;
    $('stok-add-item').disabled = $('stok-add-move').disabled = !!snapshot.aktif;
  }
  function controls() {
    const options = tab === 'stok' ? [['aktif','Barang aktif'],['nonaktif','Barang nonaktif']] : tab === 'opname' ? [['','Semua opname'],...Object.entries(statusNames)] : [['','Semua transaksi'],...Object.entries(kindNames)];
    $('stok-filter').innerHTML = options.map(([value,name])=>`<option value="${e(value)}">${e(name)}</option>`).join('');
    $('stok-search').placeholder = tab === 'stok' ? 'Kode, nama barang, atau spesifikasi' : tab === 'opname' ? 'Crew, pencatat, atau catatan pemeriksaan' : 'Kode, barang, penerima, atau catatan';
    $('stok-help').textContent = tab === 'stok' ? 'Stok berasal dari saldo awal + barang masuk − barang keluar + penyesuaian yang disetujui.' : tab === 'opname' ? 'Crew menghitung barang secara manual. Masukkan hasilnya, lalu periksa selisih dengan stok catatan pada waktu mulai. Selesaikan pemeriksaan selisih sebelum memulai opname berikutnya.' : 'Jumlah masuk ditandai positif dan jumlah keluar negatif. Barang rusak atau expired yang dikeluarkan dicatat sebagai barang keluar dengan catatan penyebabnya.';
    permissions();
  }
  function render() {
    const s = snapshot.ringkasan || {};
    $('stok-stat-items').textContent = s.barang ?? '—'; $('stok-stat-zero').textContent = s.habis ?? '—'; $('stok-stat-pending').textContent = s.menunggu ?? '—';
    $('stok-stat-last').textContent = s.terakhir ? U.dateText(s.terakhir.tanggal) : 'Belum ada';
    const active = snapshot.aktif; $('stok-active').hidden = !active;
    $('stok-active').innerHTML = active ? `<div><strong>Opname sedang berjalan · ${e(active.crew)}</strong><p>Mulai ${e(stamp(active.mulai_pada))}. Pencatatan barang masuk/keluar menunggu hasil selesai.</p></div><button class="button button-secondary" type="button" data-stok-detail="${e(active.id)}">${A.canWrite()?'Lanjutkan hitungan':'Lihat pemeriksaan'}</button>` : '';
    permissions(); const range = P.range(snapshot.total || 0, page); page = range.page;
    $('stok-count').textContent = P.summary(range); P.render($('stok-pages'),range,next=>{page=next;refresh();},false);
    $('stok-results').setAttribute('aria-labelledby','stok-tab-'+tab);
    if (!rows.length) {
      const text = A.preview ? 'Mode pratinjau tidak memuat atau menyimpan data operasional.' : tab === 'stok' ? 'Tambahkan barang dan stok awal untuk mulai mencatat persediaan.' : tab === 'opname' ? 'Pemeriksaan mingguan akan tersimpan di sini, lengkap dengan crew dan hasil selisihnya.' : 'Setiap penerimaan, pengambilan, dan penyesuaian stok akan tampil di sini.';
      $('stok-results').innerHTML = `<div class="empty-state"><span class="empty-symbol">${U.icon('box')}</span><h2>${$('stok-search').value ? 'Data tidak ditemukan' : 'Belum ada data'}</h2><p>${e(text)}</p></div>`; return;
    }
    let headings, body;
    if (tab === 'stok') {
      headings = ['Barang','Jenis aset','Satuan','Stok tercatat','Status',''];
      body = rows.map(v=>`<tr><td data-label="Barang"><strong>${e(v.nama)}</strong><span class="document-meta">${e(v.kode)}</span><span class="document-meta">${e(v.spesifikasi)}</span></td><td data-label="Jenis aset">${e(v.jenis_aset)}</td><td data-label="Satuan">${e(v.satuan)}</td><td data-label="Stok tercatat" class="stok-number">${qty(v.saldo)}</td><td data-label="Status">${badge(!v.aktif?'Nonaktif':Number(v.saldo)===0?'Habis':'Tersedia',v.aktif&&Number(v.saldo)===0?'short':'')}</td><td class="stok-actions">${A.superAdmin()?`<button type="button" class="button button-secondary" data-stok-edit="${e(v.id)}">Edit</button>`:''}</td></tr>`).join('');
    } else if (tab === 'opname') {
      headings = ['Tanggal mulai','Crew','Hasil','Barang berselisih','Pencatat',''];
      body = rows.map(v=>`<tr><td data-label="Tanggal mulai">${e(U.dateText(v.tanggal))}<span class="document-meta">${e(stamp(v.mulai_pada))}</span></td><td data-label="Crew">${e(v.crew)}</td><td data-label="Hasil">${badge(statusNames[v.status],v.status==='menunggu'?'wait':v.status==='sesuai'?'ok':'')}${Number(v.belum)>0?`<span class="document-meta">${v.belum} barang belum dihitung</span>`:''}</td><td data-label="Barang berselisih">${e(v.jumlah_selisih)} jenis barang</td><td data-label="Pencatat">${e(v.nama_pencatat)}</td><td class="stok-actions"><button type="button" class="button button-secondary" data-stok-detail="${e(v.id)}">${v.status==='draf'&&A.canWrite()?'Lanjutkan':'Lihat hasil'}</button></td></tr>`).join('');
    } else {
      headings = ['Tanggal','Barang','Transaksi','Jumlah','Saldo setelah','Tujuan / Catatan','Petugas'];
      body = rows.map(v=>`<tr><td data-label="Tanggal">${e(U.dateText(v.tanggal))}<span class="document-meta">${e(stamp(v.dibuat_pada))}</span></td><td data-label="Barang"><strong>${e(v.nama)}</strong><span class="document-meta">${e(v.kode)}</span></td><td data-label="Transaksi">${badge(kindNames[v.jenis])}</td><td data-label="Jumlah" class="stok-number">${Number(v.jumlah)>0?'+':''}${qty(v.jumlah,v.satuan)}</td><td data-label="Saldo setelah">${qty(v.saldo_setelah,v.satuan)}</td><td data-label="Tujuan / Catatan">${e(v.tujuan)}<span class="document-meta">${e(v.catatan)}</span>${v.opname_id?`<button type="button" class="stok-title-link" data-stok-detail="${e(v.opname_id)}">Lihat opname</button>`:''}</td><td data-label="Petugas">${e(v.nama_petugas)}</td></tr>`).join('');
    }
    $('stok-results').innerHTML = `<div class="table-scroll"><table><caption class="sr-only">${e($('stok-tab-'+tab).textContent)}</caption><thead><tr>${headings.map(v=>`<th scope="col">${v?e(v):'<span class="sr-only">Tindakan</span>'}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  async function refresh() {
    if (location.hash !== '#stok') return; const seq = ++request; await A.ready;
    if (A.preview || !A.profile) {rows=[];snapshot={total:0,ringkasan:{}};render();return;}
    $('stok-results').setAttribute('aria-busy','true');
    try {
      const result = await S.page(tab,$('stok-search').value.trim(),page,$('stok-filter').value);
      if (seq !== request || !A.profile) return; snapshot=result;rows=result.data;page=result.halaman;error('stok-error','');$('stok-setup').hidden=true;render();
    } catch (err) {if(seq===request){rows=[];snapshot={total:0,ringkasan:{}};render();error('stok-error',err.message);$('stok-setup').hidden=!err.setup;}}
    finally {if(seq===request)$('stok-results').setAttribute('aria-busy','false');}
  }
  function selectTab(next) {
    if (!['stok','opname','mutasi'].includes(next)) return;
    tab=next;page=1;request++;rows=[];snapshot={...snapshot,total:0};$('stok-search').value='';
    host.querySelectorAll('[data-stok-tab]').forEach(b=>{const selected=b.dataset.stokTab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    controls();render();refresh();
  }
  async function catalog() {
    if (!catalogPromise) catalogPromise=fetch('stok-katalog.json?v=20').then(r=>{if(!r.ok)throw new Error('Daftar Excel belum dapat dimuat. Identitas barang tetap bisa diisi manual.');return r.json();}).catch(err=>{catalogPromise=null;throw err;});
    return catalogPromise;
  }
  async function itemForm(id) {
    if (!A.superAdmin()) return; master=id?rows.find(v=>v.id===id):null; if(id&&!master)throw new Error('Muat ulang daftar barang.');
    const form=$('stok-item-form');form.reset();error('stok-item-error','');
    $('stok-item-title').textContent=master?'Edit barang':'Tambah barang';
    for(const field of ['kode','nama','spesifikasi','jenis_aset','satuan'])form.elements.namedItem(field).value=master?.[field]??(field==='jenis_aset'?'Consumable':'');
    $('stok-item-code').readOnly=$('stok-item-unit').readOnly=!!master;$('stok-source-field').hidden=!!master;$('stok-opening-field').hidden=!!master;
    $('stok-item-opening').required=!master;$('stok-item-opening').disabled=!!master;$('stok-active-field').hidden=!master;$('stok-item-active').value=String(master?.aktif??true);
    itemDialog.showModal();clearForm(form);$('stok-item-code').focus();
    if(!master){try{const list=await catalog();if(!itemDialog.open||master)return;$('stok-source').innerHTML='<option value="">Isi manual</option>'+list.map((v,i)=>`<option value="${i}">${e(v.nama+' · '+v.spesifikasi+' · '+v.kode+' · '+v.satuan)}</option>`).join('');}catch(err){error('stok-item-error',err.message);}}
  }
  $('stok-source').onchange=async()=>{const value=$('stok-source').value;if(value==='')return;const v=(await catalog())[Number(value)];for(const field of ['kode','nama','spesifikasi','jenis_aset','satuan'])$('stok-item-form').elements.namedItem(field).value=v[field]||'';g.FormGuard?.touch($('stok-item-form'));$('stok-item-opening').focus();};
  $('stok-item-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;if(!A.superAdmin()||form.dataset.busy||!form.reportValidity())return;form.dataset.busy='1';setBusy(form,true);error('stok-item-error','');
    try{const data=Object.fromEntries(new FormData(form));if(master)data.aktif=$('stok-item-active').value==='true';else data.saldo_awal=D.quantity(data.saldo_awal);await S.saveItem(data,master);clearForm(form);itemDialog.close();U.showToast('Data barang tersimpan.');await refresh();}
    catch(err){error('stok-item-error',err.message);}finally{delete form.dataset.busy;setBusy(form,false);}
  };
  function line() {
    const id=crypto.randomUUID(),node=document.createElement('div');node.className='stok-line';node.dataset.stokLine='';
    node.innerHTML=`<select id="stok-pick-${id}" aria-label="Pilih barang" required><option value="">Pilih barang…</option>${transactionItems.map(v=>`<option value="${e(v.id)}">${e(v.nama+' · '+v.spesifikasi+' · '+v.kode)}</option>`).join('')}</select><input id="stok-amount-${id}" aria-label="Jumlah barang" type="number" step="0.001" min="0.001" required placeholder="Jumlah"><span class="stok-unit"></span><button type="button" class="icon-button" data-stok-line-remove aria-label="Hapus baris barang">${U.icon('close')}</button>`;
    node.querySelector('select').onchange=()=>{const v=transactionItems.find(v=>v.id===node.querySelector('select').value);node.querySelector('.stok-unit').textContent=v?.satuan||'';node.querySelector('input').setAttribute('aria-label','Jumlah '+(v?.nama||'barang')+' '+(v?.satuan||''));};
    $('stok-move-lines').append(node);g.FormGuard?.touch($('stok-move-form'));
  }
  function moveKind() {const out=$('stok-move-kind').value==='keluar';$('stok-target-label').textContent=out?'Tujuan / penerima *':'Asal barang / vendor';$('stok-move-target').required=out;}
  async function moveForm() {
    if(!A.canWrite())return;transactionItems=await S.items();if(!transactionItems.length)throw new Error('Tambahkan barang beserta stok awal terlebih dahulu.');
    transactionKey=crypto.randomUUID();$('stok-move-form').reset();$('stok-move-date').value=$('stok-move-date').max=today();$('stok-move-lines').innerHTML='';line();moveKind();error('stok-move-error','');moveDialog.showModal();clearForm($('stok-move-form'));$('stok-move-kind').focus();
  }
  $('stok-move-kind').onchange=moveKind;$('stok-line-add').onclick=line;
  $('stok-move-lines').onclick=event=>{const b=event.target.closest('[data-stok-line-remove]');if(!b)return;if($('stok-move-lines').children.length===1)return U.showToast('Sisakan satu barang dalam transaksi.');b.closest('[data-stok-line]').remove();g.FormGuard?.touch($('stok-move-form'));};
  $('stok-move-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;if(!A.canWrite()||form.dataset.busy||!form.reportValidity())return;form.dataset.busy='1';setBusy(form,true);error('stok-move-error','');
    try{const data=Object.fromEntries(new FormData(form)),lines=[...$('stok-move-lines').children].map(node=>({item_id:node.querySelector('select').value,jumlah:D.quantity(node.querySelector('input').value)}));
      if(new Set(lines.map(v=>v.item_id)).size!==lines.length)throw new Error('Pilih setiap barang satu kali. Gabungkan jumlahnya jika barang sama.');
      await S.transaction(transactionKey,data,lines);clearForm(form);moveDialog.close();U.showToast('Transaksi tersimpan. Stok sudah diperbarui.');await refresh();
    }catch(err){error('stok-move-error',err.message);}finally{delete form.dataset.busy;setBusy(form,false);}
  };
  $('stok-start').onclick=()=>{if(!A.canWrite())return;startKey=crypto.randomUUID();$('stok-start-dialog-form').reset();error('stok-start-dialog-error','');startDialog.showModal();$('stok-crew').focus();};
  $('stok-start-dialog-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;if(!A.canWrite()||form.dataset.busy||!form.reportValidity())return;form.dataset.busy='1';setBusy(form,true);error('stok-start-dialog-error','');
    try{const result=await S.start(startKey,$('stok-crew').value.trim(),$('stok-start-note').value.trim());clearForm(form);startDialog.close();await refresh();await showDetail(result.id);}
    catch(err){error('stok-start-dialog-error',err.message);}finally{delete form.dataset.busy;setBusy(form,false);}
  };
  function draftRows() {return detail.baris.map((v,i)=>({item_id:v.item_id,fisik:$('stok-fisik-'+i)?.value??v.fisik,catatan:$('stok-remark-'+i)?.value??v.catatan}));}
  function updateCount() {
    if(!detail)return;const editable=detail.opname.status==='draf'&&A.canWrite();
    const lines=editable?draftRows():detail.baris;
    let s;try{s=D.summary(lines.map((v,i)=>({...v,stok_catatan:detail.baris[i].stok_catatan})));}catch{return;}
    $('stok-count-summary').innerHTML=`<span><strong>${s.sesuai}</strong> sesuai</span><span><strong>${s.selisih}</strong> berselisih</span><span><strong>${s.belum}</strong> belum dihitung</span><span>${s.total} jenis barang</span>`;
    lines.forEach((v,i)=>{try{$('stok-diff-'+i).innerHTML=differenceBadge(D.difference(v.fisik,detail.baris[i].stok_catatan));}catch{$('stok-diff-'+i).textContent='Periksa angka';}});
  }
  function renderDetail() {
    const o=detail.opname,editable=o.status==='draf'&&A.canWrite();
    $('stok-count-dialog-title').textContent='Opname · '+U.dateText(o.tanggal);
    $('stok-detail-body').innerHTML=`<div class="stok-meta"><span>Crew: <strong>${e(o.crew)}</strong></span><span>Mulai: ${e(stamp(o.mulai_pada))}</span><span>Pencatat: ${e(o.nama_pencatat)}</span><span>${badge(statusNames[o.status],o.status==='menunggu'?'wait':'')}</span></div>${o.catatan?`<p class="stok-session-note">${e(o.catatan)}</p>`:''}
      <p class="stok-intro">${editable?'Masukkan hitungan fisik crew menggunakan satuan yang tertera. Isi 0 untuk barang habis. Kolom kosong berarti belum dihitung. Simpan draf untuk melanjutkan nanti.':'Selisih = stok fisik − stok catatan pada waktu mulai. Nilai negatif berarti kurang, nilai positif berarti lebih.'}</p><div class="stok-count-summary" id="stok-count-summary" role="status"></div>
      <div class="stok-count-wrap"><table class="stok-count-table"><thead><tr><th scope="col">Kode / Nama item</th><th scope="col">Satuan</th><th scope="col">Stok catatan</th><th scope="col">Hitungan fisik</th><th scope="col">Selisih</th><th scope="col">Remark</th></tr></thead><tbody>${detail.baris.map((v,i)=>`<tr><td><strong>${e(v.nama)}</strong><span class="document-meta">${e(v.kode)}</span><span class="document-meta">${e(v.spesifikasi)}</span></td><td>${e(v.satuan)}</td><td class="stok-number">${qty(v.stok_catatan)}</td><td class="stok-physical">${editable?`<input id="stok-fisik-${i}" name="fisik-${i}" class="stok-qty-input" type="number" min="0" step="0.001" value="${e(v.fisik??'')}" aria-label="Hitungan fisik ${e(v.nama)} ${e(v.spesifikasi)} dalam ${e(v.satuan)}">`:qty(v.fisik)}</td><td id="stok-diff-${i}"></td><td class="stok-note">${editable?`<input id="stok-remark-${i}" name="remark-${i}" maxlength="1000" value="${e(v.catatan)}" aria-label="Catatan ${e(v.nama)}">`:e(v.catatan)}</td></tr>`).join('')}</tbody></table></div>
      ${o.status==='menunggu'&&A.administrator()?`<section class="stok-review"><h3>Pemeriksaan Administrator</h3><p class="stok-intro">Periksa penyebab selisih sebelum menyesuaikan stok. Penyesuaian menambahkan selisih ke saldo terbaru, sehingga transaksi setelah opname tetap diperhitungkan.</p><div class="field"><label for="stok-review-reason">Alasan / hasil pemeriksaan *</label><textarea id="stok-review-reason" name="alasan" rows="3" maxlength="2000"></textarea></div><div class="stok-delta-preview">${detail.baris.filter(v=>Number(v.selisih)!==0).map(v=>`<p><strong>${e(v.nama)}</strong>: stok terbaru ${qty(v.saldo_terkini,v.satuan)}, selisih ${Number(v.selisih)>0?'+':''}${qty(v.selisih,v.satuan)}. Perkiraan saldo setelah penyesuaian: ${qty((Math.round(Number(v.saldo_terkini)*1000)+Math.round(Number(v.selisih)*1000))/1000,v.satuan)}.</p>`).join('')}<small>Saldo dihitung kembali saat penyesuaian disimpan.</small></div></section>`:''}
      ${o.status==='draf'&&A.canWrite()?'<div class="field"><label for="stok-cancel-reason">Alasan pembatalan (jika dibatalkan)</label><input id="stok-cancel-reason" name="alasan_batal" maxlength="2000"></div>':''}
      ${o.diperiksa_pada?`<p class="stok-session-note">Diperiksa oleh ${e(o.nama_pemeriksa)} · ${e(stamp(o.diperiksa_pada))}<br>${e(o.alasan)}</p>`:''}`;
    $('stok-detail-actions').innerHTML=`<button type="button" class="button button-secondary" id="stok-print">${editable?'Cetak lembar hitung':'Cetak hasil'}</button>${editable?'<button type="button" class="button button-secondary" data-stok-review="batalkan">Batalkan opname</button><button type="button" class="button button-secondary" id="stok-save-draft">Simpan draf</button><button type="submit" class="button button-primary">Selesaikan perbandingan</button>':''}${o.status==='menunggu'&&A.administrator()?'<button type="button" class="button button-secondary" data-stok-review="tutup">Tutup tanpa penyesuaian</button><button type="button" class="button button-primary" data-stok-review="sesuaikan">Setujui penyesuaian stok</button>':''}`;
    error('stok-count-dialog-error','');updateCount();clearForm($('stok-count-dialog-form'));
  }
  async function showDetail(id) {
    const seq=++detailRequest,result=await S.detail(id);if(seq!==detailRequest||!A.profile)return;detail=result;renderDetail();if(!countDialog.open)countDialog.showModal();clearForm($('stok-count-dialog-form'));
  }
  async function saveCount(finish) {
    const form=$('stok-count-dialog-form');if(!detail||!A.canWrite()||detail.opname.status!=='draf'||form.dataset.busy||!form.reportValidity())return;form.dataset.busy='1';setBusy(form,true);error('stok-count-dialog-error','');
    try{
      const lines=draftRows().map(v=>({...v,fisik:D.quantity(v.fisik)}));
      if(finish&&lines.some(v=>v.fisik==null))throw new Error('Masih ada barang belum dihitung. Isi 0 jika stok fisiknya habis.');
      const result=await S.saveCount(detail.opname,lines,finish);detail.opname=result;detail.baris=detail.baris.map((v,i)=>({...v,...lines[i],selisih:D.difference(lines[i].fisik,v.stok_catatan)}));
      clearForm(form);renderDetail();await refresh();U.showToast(finish?'Hasil opname tersimpan. Selisih dapat diperiksa Administrator.':'Draf hitungan tersimpan.');
    }catch(err){error('stok-count-dialog-error',err.message);}finally{delete form.dataset.busy;setBusy(form,false);}
  }
  $('stok-count-dialog-form').onsubmit=event=>{event.preventDefault();saveCount(true);};
  $('stok-detail-body').oninput=event=>{
    if(event.target.id.startsWith('stok-fisik-')){try{D.quantity(event.target.value);event.target.setCustomValidity('');}catch(err){event.target.setCustomValidity(err.message);}updateCount();}
  };
  async function review(action) {
    const form=$('stok-count-dialog-form');if(!detail||!A.canWrite()||form.dataset.busy)return;
    const reason=$(action==='batalkan'?'stok-cancel-reason':'stok-review-reason')?.value.trim();
    if(!reason)return error('stok-count-dialog-error','Isi alasan pemeriksaan atau pembatalan.');
    if(action!=='batalkan'&&!A.administrator())return;form.dataset.busy='1';setBusy(form,true);error('stok-count-dialog-error','');
    try{await S.review(detail.opname,action,reason);clearForm(form);await showDetail(detail.opname.id);await refresh();U.showToast(action==='sesuaikan'?'Penyesuaian stok tersimpan.':'Status opname tersimpan.');}
    catch(err){error('stok-count-dialog-error',err.message);}finally{delete form.dataset.busy;setBusy(form,false);}
  }
  function printSheet() {
    if(!detail)return;const o=detail.opname,blank=o.status==='draf';
    const header=blank?['No.','Kode / Nama item','Spesifikasi','Satuan','Hitungan fisik','Remark']:['No.','Kode / Nama item','Satuan','Stok catatan','Stok fisik','Selisih','Remark'];
    const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${blank?'Lembar hitung':'Hasil opname'}</title><style>@page{size:A4 landscape;margin:14mm}body{font:11px Arial,sans-serif;color:#222}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #bbb;padding:9px;text-align:left;vertical-align:top}th{background:#f1f3f5;font-size:10px}thead{display:table-header-group}tr{break-inside:avoid}small{display:block;color:#555;margin-top:4px}.sign{display:flex;justify-content:space-between;margin-top:30px;gap:30px}.sign p{width:30%;min-height:65px}.sign span{display:block;margin-top:45px;border-top:1px solid #aaa;padding-top:6px}</style></head><body><p>PT KPS · Camp &amp; Facility</p><h1>${blank?'Lembar hitung stok opname':'Hasil stok opname'}</h1><p>Tanggal: ${e(U.dateText(o.tanggal))} · Crew: ${e(o.crew)}</p><p>Stok catatan diambil pada ${e(stamp(o.mulai_pada))}. Pencatat: ${e(o.nama_pencatat)}</p>${blank?'<p>Hitung fisik dalam satuan tertera. Tulis 0 jika habis. Jeda perpindahan barang selama perhitungan.</p>':`<p>Status: ${e(statusNames[o.status])}. Selisih = stok fisik − stok catatan.</p>`}${o.catatan?`<p>Catatan: ${e(o.catatan)}</p>`:''}<table><thead><tr>${header.map(v=>'<th>'+e(v)+'</th>').join('')}</tr></thead><tbody>${detail.baris.map((v,i)=>`<tr><td>${i+1}</td><td>${e(v.nama)}<small>${e(v.kode)}</small></td>${blank?`<td>${e(v.spesifikasi)}</td><td>${e(v.satuan)}</td><td style="min-width:85px;height:35px"></td><td style="min-width:120px"></td>`:`<td>${e(v.satuan)}</td><td>${qty(v.stok_catatan)}</td><td>${qty(v.fisik)}</td><td>${v.selisih!=null&&Number(v.selisih)>0?'+':''}${qty(v.selisih)}</td><td>${e(v.catatan)}</td>`}</tr>`).join('')}</tbody></table>${o.diperiksa_pada?`<p>Diperiksa: ${e(o.nama_pemeriksa)} · ${e(stamp(o.diperiksa_pada))}. ${e(o.alasan)}</p>`:''}<div class="sign"><p>Dihitung oleh<span>${e(o.crew)}</span></p><p>Dicatat oleh<span>${e(o.nama_pencatat)}</span></p><p>Diperiksa oleh<span>${e(o.nama_pemeriksa||'')}</span></p></div></body></html>`;
    const frame=document.createElement('iframe');frame.className='stok-print-frame';frame.title=blank?'Lembar hitung untuk crew':'Hasil opname';frame.onload=()=>{frame.contentWindow.onafterprint=()=>frame.remove();frame.contentWindow.focus();frame.contentWindow.print();};frame.srcdoc=html;document.body.append(frame);
  }
  countDialog.addEventListener('click',event=>{if(event.target.closest('#stok-save-draft'))saveCount(false);if(event.target.closest('#stok-print'))printSheet();const b=event.target.closest('[data-stok-review]');if(b)review(b.dataset.stokReview);});
  countDialog.addEventListener('close',()=>{detailRequest++;detail=null;});
  document.addEventListener('click',event=>{const b=event.target.closest('[data-stok-close]');if(b)$(b.dataset.stokClose).close();});
  host.addEventListener('click',event=>{const edit=event.target.closest('[data-stok-edit]'),open=event.target.closest('[data-stok-detail]');if(edit)itemForm(edit.dataset.stokEdit).catch(err=>error('stok-error',err.message));if(open)showDetail(open.dataset.stokDetail).catch(err=>error('stok-error',err.message));});
  $('stok-add-item').onclick=()=>itemForm().catch(err=>error('stok-error',err.message));$('stok-add-move').onclick=()=>moveForm().catch(err=>error('stok-error',err.message));
  $('stok-refresh').onclick=()=>refresh();$('stok-filter').onchange=()=>{page=1;refresh();};$('stok-search').oninput=()=>{request++;clearTimeout(timer);timer=setTimeout(()=>{page=1;refresh();},250);};
  host.querySelectorAll('[data-stok-tab]').forEach(b=>{b.onclick=()=>selectTab(b.dataset.stokTab);b.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['stok','opname','mutasi'],i=tabs.indexOf(tab);selectTab(tabs[event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3]);$('stok-tab-'+tab).focus();};});
  $('stok-backup').onclick=async event=>{const b=event.currentTarget;if(b.disabled||!A.superAdmin())return;b.disabled=true;try{const data=await S.backup(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Cadangan_Stok_'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);U.showToast('Data stok dari seluruh halaman siap diunduh.');}catch(err){error('stok-error',err.message);}finally{b.disabled=false;}};
  document.addEventListener('akses:berubah',()=>{request++;detailRequest++;permissions();if(!A.profile){rows=[];snapshot={total:0,ringkasan:{}};detail=null;for(const d of [itemDialog,moveDialog,startDialog,countDialog])if(d.open){clearForm(d.querySelector('form'));d.close();}render();}else if(!A.canWrite()){for(const d of [itemDialog,moveDialog,startDialog])if(d.open){clearForm(d.querySelector('form'));d.close();}if(detail&&countDialog.open)renderDetail();}refresh();});
  document.addEventListener('data:muat-ulang',refresh);g.addEventListener('hashchange',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!countDialog.open)refresh();});
  controls();render();A.ready.then(refresh);
})(window);
