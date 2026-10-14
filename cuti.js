(function (g) {
  'use strict';
  const A=g.Akses,U=g.PortalUI,C=g.CutiDomain,S=g.CutiStore,D=g.TrackingDomain;
  const $=id=>document.getElementById(id),e=U.escape,date=U.dateText;
  const days=v=>Number(v||0).toLocaleString('id-ID',{maximumFractionDigits:2})+' hari';
  const stamp=v=>v?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jayapura',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))+' WIT':'—';
  const host=$('cuti-page');
  let data={pengaturan:[],saldo:[],pemakaian:[],potongan:[]},people=[],tab='saldo',loaded=false,request=0,opening=false;
  let extraEdit=null,extraKey='',useKey='',detailId='';
  const today=()=>data.hari_ini||D.today();
  const employee=id=>people.find(k=>k.id===id);
  const balance=id=>data.saldo.filter(s=>s.karyawan_id===id);
  const name=id=>employee(id)?.nama||'Karyawan';
  const total=(rows,kind)=>rows.filter(s=>s.jenis===kind&&C.usable(s,today())).reduce((n,s)=>n+Number(s.sisa),0);
  host.innerHTML=`<header class="page-heading"><div><h1>Tahunan &amp; Extra</h1><p class="page-description">Saldo hak, pemakaian izin, dan pemberian Extra karyawan.</p></div></header>
    <div class="cuti-actions" id="cuti-actions"><button class="button button-secondary" type="button" id="cuti-add-opening" data-administrator-only>Saldo awal Tahunan</button><button class="button button-secondary" type="button" id="cuti-add-extra">Tambah Extra</button><button class="button button-secondary" type="button" id="cuti-settings-toggle" data-administrator-only>Masa berlaku Extra</button><button class="button button-secondary" type="button" id="cuti-sell-annual">Jual Tahunan</button><button class="button button-secondary" type="button" id="cuti-sell">Jual Extra</button><button class="button button-primary" type="button" id="cuti-use">Catat izin / cuti</button></div>
    <section id="cuti-settings" class="cuti-settings" hidden><form id="cuti-settings-form"><h2>Masa berlaku Extra</h2><p class="cuti-help">Administrator menentukan masa berlaku sejak tanggal pemberian. Saat pertama kali diatur, Extra lama yang belum memiliki tanggal hangus juga mengikuti pengaturan ini. Tanggal hangus yang sudah ada tetap dipertahankan.</p><div class="cuti-settings-fields"><div class="field"><label for="cuti-extra-months">Berlaku selama (bulan)</label><input type="number" id="cuti-extra-months" min="1" max="120" required step="1" placeholder="Misalnya 6 atau 12"></div><label class="agenda-check"><input type="checkbox" id="cuti-settings-agree" required> Saya sudah memeriksa masa berlaku yang dipilih.</label><button class="button button-primary" type="submit">Simpan pengaturan</button></div><p id="cuti-settings-message" class="form-error" role="status" hidden></p></form></section>
    <p id="cuti-expiry-help" class="cuti-help"></p><div class="cuti-panel"><div class="cuti-tabs" role="tablist" aria-label="Tahunan dan Extra"><button type="button" id="cuti-tab-saldo" role="tab" aria-selected="true" aria-controls="cuti-results" data-cuti-tab="saldo">Saldo karyawan</button><button type="button" id="cuti-tab-extra" role="tab" aria-selected="false" aria-controls="cuti-results" tabindex="-1" data-cuti-tab="extra">Pemberian Extra</button><button type="button" id="cuti-tab-history" role="tab" aria-selected="false" aria-controls="cuti-results" tabindex="-1" data-cuti-tab="history">Pemakaian &amp; penjualan</button><button type="button" id="cuti-tab-hangus" role="tab" aria-selected="false" aria-controls="cuti-results" tabindex="-1" data-cuti-tab="hangus">Hangus</button></div>
    <div class="cuti-toolbar"><div class="search-field"><span data-icon="search">${U.icon('search')}</span><label class="sr-only" for="cuti-search">Cari nama atau NIK</label><input type="search" id="cuti-search" placeholder="Cari nama atau NIK…"></div><span id="cuti-count" role="status"></span><button class="button button-secondary" type="button" id="cuti-refresh">Muat ulang</button></div>
    <p id="cuti-error" class="form-error" role="alert" hidden></p><div id="cuti-results" role="tabpanel" aria-labelledby="cuti-tab-saldo"><p class="cuti-empty">Memuat saldo…</p></div></div>`;

  function dialog(id,title,content,button) {
    const d=document.createElement('dialog');d.id=id;d.className='form-dialog cuti-dialog';d.setAttribute('aria-labelledby',id+'-title');
    d.innerHTML=`<div class="dialog-heading"><h2 id="${id}-title">${title}</h2><button class="icon-button" type="button" data-cuti-close="${id}" aria-label="Tutup">${U.icon('close')}</button></div><form id="${id}-form"><div class="form-body"><p class="cuti-actor">Petugas: <strong data-cuti-actor></strong></p>${content}<p id="${id}-error" class="form-error" role="alert" hidden></p></div><div class="dialog-actions"><button class="button button-secondary" type="button" data-cuti-close="${id}">Batal</button><button class="button button-primary" type="submit">${button}</button></div></form>`;
    document.body.append(d);return d;
  }
  const initial=dialog('cuti-awal','Saldo awal Tahunan',`<div class="form-grid"><div class="field span-two" id="awal-karyawan-picker"></div><p class="cuti-help span-two">Masukkan sisa sebenarnya, termasuk 0 jika sudah habis. Saldo awal bukan tambahan 12 hari.</p><div class="field"><label for="awal-mulai">Tanggal Efektif Kerja</label><input type="date" id="awal-mulai" readonly required><small id="awal-efektif-help">Mengikuti Data Karyawan.</small></div><div class="field"><label for="awal-masa">Masa berlaku Tahunan (bulan)</label><input type="number" id="awal-masa" value="12" readonly><small>Berlaku sampai sehari sebelum ulang tahun masa kerja berikutnya.</small></div><div class="field span-two"><label for="awal-periode">Periode hak *</label><select id="awal-periode" required></select><small id="awal-periode-help"></small></div><div class="field"><label for="awal-sisa">Sisa saldo awal (hari) *</label><input type="number" id="awal-sisa" min="0" max="12" step="0.01" required></div><div class="field"><label for="awal-hangus">Tanggal hangus saldo ini *</label><input type="date" id="awal-hangus" readonly></div><div class="field span-two"><label for="awal-note">Note <span class="optional">opsional</span></label><textarea id="awal-note" rows="3" maxlength="3000"></textarea></div></div>`,'Simpan saldo awal');
  const extra=dialog('cuti-extra','Tambah Extra',`<div class="form-grid"><div class="field span-two" id="extra-karyawan-picker"></div><div class="field"><label for="extra-semula">Tanggal cuti semula *</label><input type="date" id="extra-semula" required></div><div class="field"><label for="extra-baru">Tanggal cuti setelah diundur *</label><input type="date" id="extra-baru" required></div><p class="cuti-help span-two" id="extra-delay">Jumlah Extra ditentukan oleh admin.</p><div class="field span-two"><label for="extra-jumlah">Extra yang diberikan (hari) *</label><input type="number" id="extra-jumlah" min="0.01" max="99999" step="0.01" required></div><div class="field span-two" id="extra-expiry-field" hidden><label for="extra-expiry">Berlaku sampai</label><input type="date" id="extra-expiry"></div><p class="cuti-help span-two" id="extra-expiry-help"></p><div class="field span-two"><label for="extra-note">Note / alasan pemberian *</label><textarea id="extra-note" required rows="4" maxlength="3000"></textarea></div><p class="cuti-help span-two" id="extra-edit-help" hidden></p></div>`,'Simpan Extra');
  const use=dialog('cuti-pakai','Catat izin / cuti',`<div class="form-grid"><div class="field span-two" id="pakai-karyawan-picker"></div><div class="field"><label for="pakai-jenis">Jenis pencatatan *</label><select id="pakai-jenis" required><option>Izin</option><option>Cuti Tahunan</option><option>Extra</option><option>Jual Extra</option><option>Jual Tahunan</option></select></div><div class="field"><label for="pakai-sumber">Potong dari *</label><select id="pakai-sumber" required><option>Tahunan</option><option>Extra</option><option>Gabungan</option></select></div><div class="field span-two"><label for="pakai-periode">Saldo / periode yang dipotong</label><select id="pakai-periode"><option value="">Otomatis — saldo paling lama dahulu</option></select></div><div class="field"><label for="pakai-mulai" id="pakai-mulai-label">Tanggal mulai izin *</label><input type="date" id="pakai-mulai" required></div><div class="field" id="pakai-akhir-field"><label for="pakai-akhir">Tanggal selesai izin *</label><input type="date" id="pakai-akhir" required></div><div class="field span-two"><label for="pakai-jumlah">Jumlah hari yang dipotong *</label><input type="number" id="pakai-jumlah" min="0.01" max="99999" step="0.01" required><small>Diisi manual, sesuai keputusan pemakaian saldo.</small></div><div id="pakai-preview" class="cuti-preview span-two" role="status"></div><div class="field span-two"><label for="pakai-link" id="pakai-link-label">Link Google Drive form izin <span class="optional">opsional</span></label><input type="url" id="pakai-link" maxlength="3000" placeholder="https://drive.google.com/…"></div><div class="field span-two"><label for="pakai-note">Note <span class="optional">opsional</span></label><textarea id="pakai-note" rows="3" maxlength="3000"></textarea></div></div>`,'Simpan pemotongan');
  const pickers={awal:g.EmployeeUI.createPicker('awal-karyawan','Karyawan',{allowAdmin:false}),extra:g.EmployeeUI.createPicker('extra-karyawan','Karyawan',{allowAdmin:false,allowExistingInactive:true}),pakai:g.EmployeeUI.createPicker('pakai-karyawan','Karyawan',{allowAdmin:false})};
  const detail=document.createElement('dialog');detail.id='cuti-detail';detail.className='form-dialog cuti-dialog';detail.setAttribute('aria-labelledby','cuti-detail-title');detail.innerHTML=`<div class="dialog-heading"><h2 id="cuti-detail-title">Rincian saldo</h2><button type="button" class="icon-button" aria-label="Tutup" data-cuti-close="cuti-detail">${U.icon('close')}</button></div><div class="form-body" id="cuti-detail-body"></div><div class="dialog-actions"><button class="button button-secondary" type="button" data-cuti-close="cuti-detail">Tutup</button></div>`;document.body.append(detail);
  function chosen(key){try{return pickers[key].read().employeeId;}catch{return '';}}
  function error(id,msg){$(id).textContent=msg;$(id).hidden=!msg;}
  function badge(s){const w=C.warning(s,today());return w.label?`<span class="cuti-warning ${w.kind}">${e(w.label)}</span>`:Number(s.sisa)===0?'<span class="cuti-muted">Habis</span>':'';}
  function personCell(id){const k=employee(id);return `<strong>${e(k?.nama||'Karyawan')}</strong><span class="secondary-value">${e(k?.nik||'')}${k?.aktif===false?' · Nonaktif':''}</span>`;}
  function proof(link,label){if(!link)return '';try{const safe=g.DeviceDomain.proofUrl(link);return `<a class="cuti-proof" href="${e(safe)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>`;}catch{return '<span class="cuti-muted">Link perlu diperiksa</span>';}}
  function table(headers,rows){return `<div class="table-scroll"><table class="cuti-table"><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;}
  function render(){
    $('cuti-actions').hidden=!A.canWrite();$('cuti-add-opening').hidden=!A.administrator();$('cuti-settings-toggle').hidden=!A.administrator();if(!A.administrator())$('cuti-settings').hidden=true;
    $('cuti-expiry-help').textContent='Tahunan berlaku 12 bulan sejak ulang tahun masa kerja. '+(data.aturan_extra?.masa_extra_bulan?'Extra baru berlaku '+data.aturan_extra.masa_extra_bulan+' bulan sejak diberikan.':'Masa berlaku Extra belum diatur. Administrator perlu mengaturnya sebelum pemberian Extra baru.');
    if(!A.canWrite()){$('cuti-results').innerHTML='<p class="cuti-empty">Halaman ini tersedia untuk admin dengan akses Portal.</p>';$('cuti-count').textContent='';return;}
    const q=$('cuti-search').value.trim().toLocaleLowerCase('id-ID'),matches=id=>[employee(id)?.nama,employee(id)?.nik].join(' ').toLocaleLowerCase('id-ID').includes(q);
    let rows=[];
    if(tab==='saldo'){
      rows=people.filter(k=>(k.aktif||balance(k.id).length)&&matches(k.id));
      $('cuti-results').innerHTML=rows.length?table(['Karyawan','Tahunan tersedia','Extra tersedia','Pengingat','Tindakan'],rows.map(k=>{
        const b=balance(k.id),cfg=data.pengaturan.find(c=>c.karyawan_id===k.id),near=b.filter(s=>C.usable(s,today())&&C.warning(s,today()).label).sort((a,b)=>a.tanggal_hangus.localeCompare(b.tanggal_hangus)),expired=b.filter(s=>Number(s.sisa)>0&&s.tanggal_hangus&&s.tanggal_hangus<today());
        const reminder=near.length?badge(near[0])+`<span class="secondary-value">${days(near.reduce((n,s)=>n+Number(s.sisa),0))} mendekati tanggal hangus</span>`:cfg?'<span class="cuti-muted">Tidak ada yang mendekati hangus</span>':'<span class="cuti-muted">Tahunan belum diatur</span>';
        return `<tr><td data-label="Karyawan">${personCell(k.id)}</td><td data-label="Tahunan tersedia"><strong class="cuti-balance">${days(total(b,'Tahunan'))}</strong></td><td data-label="Extra tersedia"><strong class="cuti-balance">${days(total(b,'Extra'))}</strong></td><td data-label="Pengingat">${reminder}${expired.length?'<span class="secondary-value">Ada sisa periode yang sudah hangus</span>':''}</td><td data-label="Tindakan"><button type="button" class="button button-secondary" data-cuti-detail="${e(k.id)}">Rincian saldo</button></td></tr>`;
      }).join('')):'<p class="cuti-empty">Tidak ada karyawan yang sesuai.</p>';
    }else if(tab==='extra'){
      rows=data.saldo.filter(s=>s.jenis==='Extra'&&matches(s.karyawan_id)).sort((a,b)=>b.dibuat_pada.localeCompare(a.dibuat_pada));
      $('cuti-results').innerHTML=rows.length?table(['Karyawan','Penundaan cuti','Extra','Note & petugas','Tindakan'],rows.map(s=>`<tr><td data-label="Karyawan">${personCell(s.karyawan_id)}</td><td data-label="Penundaan cuti">${e(date(s.tanggal_cuti_semula))}<span class="secondary-value">Menjadi ${e(date(s.tanggal_cuti_baru))}</span></td><td data-label="Extra"><strong>${days(s.jumlah_hari)}</strong><span class="secondary-value">Sisa ${days(s.sisa)}</span></td><td data-label="Note & petugas"><p class="cuti-note">${e(s.catatan)}</p><small>Diberikan: ${e(s.nama_pembuat)} · ${e(stamp(s.dibuat_pada))}</small>${s.nama_pengubah?`<small>Diubah: ${e(s.nama_pengubah)} · ${e(stamp(s.diubah_pada))}</small>`:''}</td><td data-label="Tindakan">${A.administrator()?`<button class="button button-secondary" type="button" data-cuti-edit-extra="${e(s.id)}">Edit Extra</button>`:'<span class="cuti-muted">—</span>'}</td></tr>`).join('')):'<p class="cuti-empty">Belum ada pemberian Extra.</p>';
    }else if(tab==='hangus'){
      rows=data.saldo.filter(s=>s.tanggal_hangus&&s.tanggal_hangus<today()&&Number(s.sisa)>0&&matches(s.karyawan_id)).sort((a,b)=>a.tanggal_hangus.localeCompare(b.tanggal_hangus));
      $('cuti-results').innerHTML=rows.length?table(['Karyawan','Jenis','Diperoleh','Hangus','Sisa yang hangus'],rows.map(s=>`<tr><td data-label="Karyawan">${personCell(s.karyawan_id)}</td><td data-label="Jenis">${e(s.jenis)}</td><td data-label="Diperoleh">${e(date(s.tanggal_perolehan))}</td><td data-label="Hangus">${e(date(s.tanggal_hangus))}</td><td data-label="Sisa yang hangus"><strong>${days(s.sisa)}</strong></td></tr>`).join('')):'<p class="cuti-empty">Tidak ada saldo tersisa yang sudah hangus.</p>';
    }else{
      rows=data.pemakaian.filter(r=>matches(r.karyawan_id));
      $('cuti-results').innerHTML=rows.length?table(['Karyawan / jenis','Tanggal','Potongan saldo','Form & note','Petugas'],rows.map(r=>{
        const cuts=data.potongan.filter(p=>p.pemakaian_id===r.id).map(p=>{const s=data.saldo.find(s=>s.id===p.saldo_id);return `${days(p.jumlah_hari)} ${s?.jenis||''} · ${date(s?.tanggal_perolehan)}`;});
        return `<tr><td data-label="Karyawan / jenis">${personCell(r.karyawan_id)}<span class="cuti-type">${e(r.jenis)}</span></td><td data-label="Tanggal">${e(date(r.tanggal_mulai))}${r.tanggal_selesai!==r.tanggal_mulai?`<span class="secondary-value">s.d. ${e(date(r.tanggal_selesai))}</span>`:''}</td><td data-label="Potongan saldo"><strong>${days(r.jumlah_hari)}</strong>${cuts.map(c=>`<span class="secondary-value">${e(c)}</span>`).join('')}</td><td data-label="Form & note">${proof(r.link_form,r.jenis.startsWith('Jual ')?'Lihat bukti penjualan':'Lihat Form Izin')}<p class="cuti-note">${e(r.catatan||'—')}</p></td><td data-label="Petugas">${e(r.nama_petugas)}<small>${e(stamp(r.dibuat_pada))}</small></td></tr>`;
      }).join('')):'<p class="cuti-empty">Belum ada pemakaian atau penjualan saldo.</p>';
    }
    $('cuti-count').textContent=rows.length+(tab==='saldo'?' karyawan':' catatan');
  }
  async function refresh(){
    const n=++request;await A.ready;
    if(!A.canWrite()){data={pengaturan:[],saldo:[],pemakaian:[],potongan:[]};people=[];loaded=false;render();return false;}
    try{const [snapshot,k]=await Promise.all([S.load(),g.EmployeeStore.list()]);if(n!==request)return false;data=snapshot;people=k;loaded=true;error('cuti-error','');render();if(detail.open)showDetail(detailId);return true;}
    catch(err){if(n===request)error('cuti-error',err.message);return false;}
  }
  function selectTab(next){tab=next;for(const b of host.querySelectorAll('[data-cuti-tab]')){b.setAttribute('aria-selected',String(b.dataset.cutiTab===tab));b.tabIndex=b.dataset.cutiTab===tab?0:-1;}$('cuti-results').setAttribute('aria-labelledby','cuti-tab-'+tab);render();}
  function showDetail(id){detailId=id;const cfg=data.pengaturan.find(c=>c.karyawan_id===id);$('cuti-detail-title').textContent=name(id);
    $('cuti-detail-body').innerHTML=(cfg?`<p class="cuti-help">Mulai bekerja: ${e(date(cfg.tanggal_mulai_kerja))}<br>Hak 12 hari berikutnya: ${e(date(C.anniversary(cfg.tanggal_mulai_kerja,cfg.tahun_terakhir_diproses+1)))}</p>`:'<p class="cuti-help">Saldo awal Tahunan belum diatur Administrator.</p>')+`<div class="cuti-credit-list">${balance(id).map(s=>`<article class="cuti-credit"><div><strong>${e(s.jenis)} · ${e(date(s.tanggal_perolehan))}</strong>${badge(s)}</div><p><strong>${days(s.sisa)}</strong> tersisa dari ${days(s.jumlah_hari)}</p><p class="cuti-help">${s.tanggal_hangus?'Berlaku sampai '+e(date(s.tanggal_hangus))+(s.tanggal_hangus>=today()?' · '+(D.dayNumber(s.tanggal_hangus)-D.dayNumber(today()))+' hari lagi':' · Sudah hangus'):'Tanggal hangus belum ditetapkan'} · ${e(s.sumber)}</p><p class="cuti-note">${e(s.catatan||'')}</p><small>${e(s.nama_pembuat)} · ${e(stamp(s.dibuat_pada))}</small></article>`).join('')||'<p class="cuti-empty">Belum ada saldo yang dicatat.</p>'}</div>`;
    if(!detail.open)detail.showModal();
  }
  function show(d){d.querySelector('[data-cuti-actor]').textContent=A.profile?.nama||'';error(d.id+'-error','');d.showModal();}
  function updateOpening(){
    const kid=chosen('awal'),cfg=data.pengaturan.find(c=>c.karyawan_id===kid);$('awal-mulai').readOnly=true;$('awal-masa').disabled=!!cfg;$('awal-mulai').value=employee(kid)?.tanggalEfektifKerja||cfg?.tanggal_mulai_kerja||'';
    $('awal-efektif-help').textContent=$('awal-mulai').value?'Mengikuti Data Karyawan.':'Isi Tanggal Efektif Kerja melalui Data Karyawan terlebih dahulu.';
    $('awal-masa').value='12';
    if(cfg){$('awal-mulai').value=cfg.tanggal_mulai_kerja;$('awal-masa').value=cfg.masa_berlaku_bulan;}
    const start=$('awal-mulai').value,previous=$('awal-periode').value;let years=[];
    if(kid&&start&&start<=today()){
      const n=cfg?cfg.tahun_mulai_sistem:C.tenure(start,today());
      years=cfg?Array.from({length:n},(_,i)=>n-i).filter(y=>!balance(kid).some(s=>s.jenis==='Tahunan'&&s.tahun_hak===y)):[n];
      $('awal-periode').innerHTML=years.length?years.map(y=>`<option value="${y}">${y===0?'Belum genap satu tahun':e(date(C.anniversary(start,y)))+' · Hak tahun ke-'+y}</option>`).join(''):'<option value="">Semua periode lama sudah dicatat</option>';
      if(previous!==''&&years.includes(Number(previous)))$('awal-periode').value=previous;
    }else $('awal-periode').innerHTML='<option value="">Pilih karyawan yang sudah memiliki tanggal efektif</option>';
    const noRight=$('awal-periode').value==='0';$('awal-sisa').readOnly=noRight;$('awal-hangus').disabled=noRight;$('awal-hangus').required=!noRight;
    if(noRight)$('awal-sisa').value='0';
    $('awal-periode-help').textContent=cfg?'Tambah sisa periode lama yang belum dicatat. Hak berikutnya berjalan otomatis.':noRight?'Belum ada hak tahunan. Sistem memberikan 12 hari saat genap satu tahun.':'Isi sisa periode saat ini dahulu. Periode yang lebih lama dapat ditambahkan sesudahnya.';
    $('awal-hangus').value=start&&$('awal-periode').value&&!noRight?new Date((D.dayNumber(C.anniversary(start,Number($('awal-periode').value)+1))-1)*86400000).toISOString().slice(0,10):'';
  }
  async function openOpening(){if(!A.administrator()||!await refresh())return;opening=true;$('cuti-awal-form').reset();await pickers.awal.load();opening=false;updateOpening();show(initial);pickers.awal.focus();}
  function delay(){const a=$('extra-semula').value,b=$('extra-baru').value;$('extra-baru').min=a||'';$('extra-delay').textContent=a&&b&&b>a?'Penundaan '+(D.dayNumber(b)-D.dayNumber(a))+' hari. Jumlah Extra tetap diisi berdasarkan keputusan admin.':'Jumlah Extra ditentukan oleh admin.';}
  async function openExtra(id){if(!A.canWrite()||(id&&!A.administrator())||!await refresh())return;
    if(!id&&!data.aturan_extra?.masa_extra_bulan)throw new Error('Administrator perlu mengatur masa berlaku Extra terlebih dahulu.');
    extraEdit=id?data.saldo.find(s=>s.id===id):null;if(id&&!extraEdit)throw new Error('Extra tidak ditemukan. Muat ulang.');extraKey=crypto.randomUUID();opening=true;$('cuti-extra-form').reset();await pickers.extra.load(extraEdit?.karyawan_id||'');pickers.extra.setDisabled(!!extraEdit);opening=false;
    $('cuti-extra-title').textContent=id?'Edit pemberian Extra':'Tambah Extra';$('extra-semula').value=extraEdit?.tanggal_cuti_semula||'';$('extra-baru').value=extraEdit?.tanggal_cuti_baru||'';$('extra-jumlah').value=extraEdit?.jumlah_hari??'';$('extra-note').value=extraEdit?.catatan||'';
    $('extra-expiry-field').hidden=!id;$('extra-expiry').value=extraEdit?.tanggal_hangus||'';$('extra-expiry').required=!!id;$('extra-expiry').min=extraEdit?.tanggal_perolehan||'';$('extra-expiry-help').textContent=id?'Perubahan tanggal hangus hanya dapat dilakukan Administrator.':'Extra berlaku '+data.aturan_extra.masa_extra_bulan+' bulan sejak tanggal pemberian hari ini.';
    $('extra-edit-help').hidden=!extraEdit;$('extra-edit-help').textContent=extraEdit?`Pemberi awal: ${extraEdit.nama_pembuat}. Sudah terpakai/dijual ${days(extraEdit.terpakai)}.`:'';delay();show(extra);
  }
  function periods(){
    const previous=$('pakai-periode').value,source=$('pakai-sumber').value,kid=chosen('pakai');
    const rows=balance(kid).filter(s=>C.usable(s,today())&&s.jenis===source).sort(C.oldest);
    $('pakai-periode').innerHTML='<option value="">Otomatis — saldo paling lama dahulu</option>'+rows.slice(0,1).map(s=>`<option value="${e(s.id)}">${e(s.jenis)} · ${e(date(s.tanggal_perolehan))} · sisa ${days(s.sisa)}</option>`).join('');
    $('pakai-periode').disabled=source==='Gabungan';if(rows[0]?.id===previous)$('pakai-periode').value=previous;preview();
  }
  function useType(){const type=$('pakai-jenis').value,sale=type.startsWith('Jual ');$('pakai-sumber').disabled=type!=='Izin';if(type!=='Izin')$('pakai-sumber').value=['Cuti Tahunan','Jual Tahunan'].includes(type)?'Tahunan':'Extra';
    $('pakai-akhir-field').hidden=sale;$('pakai-akhir').disabled=sale;$('pakai-akhir').required=!sale;$('pakai-mulai-label').textContent=sale?'Tanggal penjualan *':'Tanggal mulai izin *';$('pakai-mulai').max=sale?today():'';
    $('pakai-link-label').innerHTML=(sale?'Link Google Drive bukti penjualan ':'Link Google Drive form izin ')+'<span class="optional">opsional</span>';
    $('cuti-pakai-title').textContent=sale?type:'Catat izin / cuti';use.querySelector('[type=submit]').textContent=sale?'Simpan penjualan':'Simpan pemotongan';periods();
  }
  function preview(){const n=Number($('pakai-jumlah').value),kid=chosen('pakai');if(!kid||!n){$('pakai-preview').textContent='Pilih karyawan dan isi jumlah hari untuk melihat potongan.';return;}
    const a=C.allocation(balance(kid),$('pakai-sumber').value,n,$('pakai-periode').value,today());
    $('pakai-preview').innerHTML='<strong>Rincian potongan</strong>'+a.rincian.map(p=>`<span>${days(p.jumlah)} ${e(p.saldo.jenis)} · ${e(date(p.saldo.tanggal_perolehan))}</span>`).join('')+(a.kurang>0?`<p class="form-error">Saldo tidak cukup. Kurang ${days(a.kurang)}.</p>`:'');
  }
  async function openUse(sale){if(!A.canWrite()||!await refresh())return;useKey=crypto.randomUUID();opening=true;$('cuti-pakai-form').reset();await pickers.pakai.load();opening=false;$('pakai-jenis').value=sale?String(sale):'Izin';$('pakai-mulai').value=$('pakai-akhir').value=today();useType();show(use);pickers.pakai.focus();}
  function listenButton(id,fn){$(id).onclick=()=>Promise.resolve(fn()).catch(err=>error('cuti-error',err.message));}
  listenButton('cuti-add-opening',openOpening);listenButton('cuti-add-extra',()=>openExtra());listenButton('cuti-use',()=>openUse(false));listenButton('cuti-sell',()=>openUse('Jual Extra'));listenButton('cuti-refresh',refresh);listenButton('cuti-sell-annual',()=>openUse('Jual Tahunan'));
  listenButton('cuti-settings-toggle',()=>{if(!A.administrator())return;$('cuti-settings').hidden=!$('cuti-settings').hidden;$('cuti-extra-months').value=data.aturan_extra?.masa_extra_bulan||'';$('cuti-settings-agree').checked=false;});
  $('cuti-settings-form').onsubmit=async event=>{event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type=submit]');if(b.disabled||!A.administrator()||!f.reportValidity())return;b.disabled=true;try{await S.settings($('cuti-extra-months').value,data.aturan_extra?.versi);g.FormGuard?.clean(f);$('cuti-settings').hidden=true;await refresh();U.showToast('Masa berlaku Extra tersimpan.');document.dispatchEvent(new CustomEvent('cuti:berubah'));}catch(err){error('cuti-settings-message',err.message);}finally{b.disabled=false;}};
  $('cuti-search').oninput=render;
  for(const b of host.querySelectorAll('[data-cuti-tab]')){b.onclick=()=>selectTab(b.dataset.cutiTab);b.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['saldo','extra','history','hangus'],at=tabs.indexOf(tab);selectTab(event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(at+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length]);$('cuti-tab-'+tab).focus();};}
  document.querySelectorAll('[data-cuti-close]').forEach(b=>b.onclick=()=>$(b.dataset.cutiClose).close());
  host.addEventListener('click',event=>{const d=event.target.closest('[data-cuti-detail]'),x=event.target.closest('[data-cuti-edit-extra]');if(d)showDetail(d.dataset.cutiDetail);if(x)openExtra(x.dataset.cutiEditExtra).catch(err=>error('cuti-error',err.message));});
  $('awal-karyawan-picker').addEventListener('karyawan:dipilih',()=>{if(!opening){$('awal-mulai').value=$('awal-masa').value=$('awal-sisa').value=$('awal-hangus').value='';updateOpening();}});
  $('awal-mulai').onchange=$('awal-periode').onchange=updateOpening;
  $('extra-semula').onchange=$('extra-baru').onchange=delay;
  $('pakai-karyawan-picker').addEventListener('karyawan:dipilih',()=>{if(!opening)periods();});$('pakai-jenis').onchange=useType;$('pakai-sumber').onchange=periods;$('pakai-periode').onchange=$('pakai-jumlah').oninput=preview;
  for(const d of [initial,extra,use])d.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type=submit]');if(b.disabled||!f.reportValidity())return;b.disabled=true;
    try{
      if(d===initial)await S.opening({karyawan_id:chosen('awal'),tanggal_mulai_kerja:$('awal-mulai').value,masa_berlaku_bulan:$('awal-masa').value,tahun_hak:$('awal-periode').value,sisa_hari:$('awal-sisa').value,tanggal_hangus:$('awal-hangus').disabled?'':$('awal-hangus').value,catatan:$('awal-note').value});
      else if(d===extra)await S.extra({karyawan_id:chosen('extra'),tanggal_cuti_semula:$('extra-semula').value,tanggal_cuti_baru:$('extra-baru').value,jumlah_hari:$('extra-jumlah').value,catatan:$('extra-note').value,...(extraEdit?{tanggal_hangus:$('extra-expiry').value}:{})},extraKey,extraEdit);
      else {const kind=$('pakai-jenis').value,p={karyawan_id:chosen('pakai'),jenis:kind,sumber_saldo:$('pakai-sumber').value,saldo_id:$('pakai-periode').value,tanggal_mulai:$('pakai-mulai').value,tanggal_selesai:kind.startsWith('Jual ')?$('pakai-mulai').value:$('pakai-akhir').value,jumlah_hari:$('pakai-jumlah').value,link_form:g.DeviceDomain.proofUrl($('pakai-link').value),catatan:$('pakai-note').value};await S.use(p,useKey);}
      g.FormGuard?.clean(f);d.close();await refresh();document.dispatchEvent(new CustomEvent('cuti:berubah'));selectTab(d===extra?'extra':d===use?'history':'saldo');U.showToast(d===initial?'Saldo awal tersimpan.':d===extra?'Pemberian Extra tersimpan.':'Pemotongan saldo tersimpan.');
    }catch(err){error(d.id+'-error',err.message);}finally{b.disabled=false;}
  };
  g.addEventListener('hashchange',()=>{if(location.hash==='#cuti')refresh();});
  document.addEventListener('data:muat-ulang',()=>{if(location.hash==='#cuti')refresh();});
  document.addEventListener('akses:berubah',()=>{
    for(const d of [initial,extra,use,detail]){
      const denied=!A.canWrite()||(!A.administrator()&&(d===initial||(d===extra&&extraEdit)));
      if(denied&&d.open){const f=d.querySelector('form');if(f)g.FormGuard?.clean(f);d.close();}
    }
    if(!A.canWrite()||location.hash==='#cuti')refresh();else render();
  });
  A.ready.then(()=>{if(location.hash==='#cuti')refresh();else render();});
})(window);
