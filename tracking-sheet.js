(function(g){
 'use strict';
 const A=g.Akses,T=g.TrackingDomain,D=g.TrackingSheetDomain,S=g.TrackingSheetStore,U=g.PortalUI,$=id=>document.getElementById(id),e=U.escape,panel=$('tracking-sheet-panel');
 panel.innerHTML=` <div class="ts-message" id="ts-message" role="status" aria-live="polite" hidden></div><div class="ts-helper"><span>Tab pindah sel · Enter pindah baris · Tempel dari Excel</span><button type="button" id="ts-changed-only" aria-pressed="false">Lihat perubahan <span id="ts-change-badge">0</span></button><button type="button" id="ts-help-toggle" aria-expanded="false" aria-controls="ts-help">Cara tempel</button><button type="button" id="ts-load-retry" hidden>Coba lagi</button></div>
 <div class="ti-help" id="ts-help" hidden><p>Salin sel Excel, lalu tempel pada kolom Tanggal, Tujuan, Status baru, atau Catatan. Urutan tanpa judul: Tanggal perpindahan · Tujuan · Status baru · Catatan, mengikuti urutan dokumen yang tampil.</p><p>Untuk menempel seluruh tabel atau urutan dokumen yang berbeda, sertakan judul <strong>Kode</strong>, Tanggal perpindahan, Tujuan, Status baru, Catatan. Kode dipakai untuk mencocokkan dokumen secara otomatis. Kolom Nama dokumen/Posisi sekarang boleh ikut disalin dengan Kode.</p><p>Hanya baris yang diubah disimpan. Maksimal 500 perubahan per kiriman. Tanggal menerima DD/MM/YYYY atau YYYY-MM-DD.</p></div>
 <form id="tracking-sheet-form" autocomplete="off" novalidate><div class="ts-frame" id="ts-frame" tabindex="0" role="region" aria-label="Tabel perpindahan seluruh dokumen, geser untuk melihat kolom"><table class="ts-table"><caption class="sr-only">Dokumen aktif dan isian perpindahan. Identitas dan posisi sekarang diisi otomatis.</caption><colgroup><col style="width:44px"><col style="width:220px"><col style="width:125px"><col style="width:200px"><col style="width:165px"><col style="width:190px"><col style="width:180px"><col style="width:230px"><col style="width:140px"></colgroup><thead><tr><th scope="col">No.</th><th scope="col" class="ts-document">Dokumen</th><th scope="col">BU / Office</th><th scope="col">Posisi sekarang</th>${D.columns.map(c=>`<th scope="col" class="ts-edit-heading">${e(c.label)}</th>`).join('')}<th scope="col">Lama tertahan</th></tr></thead><tbody id="ts-rows"></tbody></table><p class="ts-empty" id="ts-empty" hidden></p></div>
 <div class="pagination" id="ts-pagination"></div><div class="ts-actions"><div><strong id="ts-count" role="status" aria-live="polite">Memuat dokumen…</strong><small>Baris yang tidak diubah tetap seperti semula.</small></div><div class="ts-action-buttons"><button type="button" class="button button-secondary" id="ts-discard">Batalkan isian</button><button type="button" class="button button-secondary" id="ts-check">Periksa data</button><button type="button" class="button button-secondary" id="ts-retry" hidden>Kirim ulang</button><button type="submit" class="button button-primary" id="ts-save">Simpan perubahan</button></div></div></form>`;
 const form=$('tracking-sheet-form');let identity='',generation=0,records=[],changes=new Map(),issues=new Map(),checked=new Set(),visible=[],loaded=false,loading=false,loadPromise=null,queuedReload=false,busy=false,onlyChanged=false,page=1,filtered=[],pageState=null,today=T.today(),entries=[];
 const key=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 const active=()=>!!A.profile&&A.canWrite()&&g.TrackingInputStore.mode==='excel'&&$('tab-active').getAttribute('aria-selected')==='true'&&location.hash==='#tracking';
 const allowed=()=>identity===key()&&!!A.profile&&A.canWrite();
 const locked=()=>busy||loading||!!S.pending;
 const find=id=>records.find(doc=>doc.id===id);
 const cell=(id,col)=>`ts-cell-${id}-${col}`;
 function message(text,tone='info'){$('ts-message').textContent=text;$('ts-message').hidden=!text;$('ts-message').setAttribute('data-tone',tone);}
 function mark(){if(changes.size)g.FormGuard?.touch(form);else g.FormGuard?.clean(form);}
 function filter(){return {query:$('search').value,bu:$('filter-bu').value,status:$('filter-status').value,office:A.administrator()?$('filter-office').value:A.profile?.office_id||'',dateFrom:$('filter-from').value,dateTo:$('filter-to').value};}
 function displayRows(){
  let list=onlyChanged?records.filter(doc=>changes.has(doc.id)):T.filterDocuments(records,filter(),false);
  const included=new Set(list.map(doc=>doc.id));changes.forEach((draft,id)=>{const doc=find(id);if(!included.has(id)&&(onlyChanged||!doc||T.isFinal(doc.statusTerakhir))){list.push(doc||draft.doc);included.add(id);}});
  return list;
 }
 function conflict(id){const draft=changes.get(id),doc=find(id);return !!draft&&(!doc||T.isFinal(doc.statusTerakhir)||doc.revision!==draft.doc.revision);}
 function values(doc){return changes.get(doc.id)?.values||D.defaults(doc,today);}
 function renderRow(doc,index){
  const row=values(doc);return `<tr id="ts-row-${e(doc.id)}"><th scope="row" class="ts-no">${pageState.start+index+1}</th><td class="ts-document"><button type="button" class="ts-document-name" data-document="${e(doc.id)}">${e(doc.namaDokumen)}</button><span class="ts-code">${e(doc.kode)}${doc.nomorDokumen?' · '+e(doc.nomorDokumen):''}</span></td><td class="ts-origin"><strong>${e(doc.bu)}</strong><span>${e(doc.asalDokumen||g.OfficeStore.name(doc.officeId)||'—')}</span></td><td class="ts-current"><strong>${e(doc.posisiSekarang||'—')}</strong><span>${e(doc.statusTerakhir)}</span><small>${doc.perpindahanTerakhir?'Sejak '+e(U.dateText(doc.perpindahanTerakhir)):'Belum ada perpindahan'}</small></td>${D.columns.map((col,number)=>{
   const attrs=`id="${cell(doc.id,number)}" name="move_${e(doc.id)}_${col.key}" data-ts-cell="" data-doc="${e(doc.id)}" data-column="${number}" aria-label="${e(doc.kode||doc.namaDokumen)}, ${e(col.label)}" aria-describedby="ts-error-${e(doc.id)}-${number}"`;
   const input=col.options?`<select ${attrs}><option value="">Pilih status</option>${!T.STATUS.includes(row.status)&&row.status?`<option value="${e(row.status)}">${e(row.status)} (periksa)</option>`:''}${T.STATUS.map(s=>`<option>${e(s)}</option>`).join('')}</select>`:col.key==='catatan'?`<textarea ${attrs} rows="1" placeholder="Opsional">${e(row[col.key])}</textarea>`:`<input ${attrs} type="text" value="${e(row[col.key])}" ${col.key==='tanggal'?'inputmode="numeric" placeholder="DD/MM/YYYY"':'placeholder="Isi tujuan baru"'}>`;
   return `<td class="ts-edit-cell">${input}<span class="ti-cell-error" id="ts-error-${e(doc.id)}-${number}" hidden></span></td>`;
  }).join('')}<td class="ts-row-review"><span id="ts-review-${e(doc.id)}"></span><button type="button" class="ts-row-button" data-ts-accept="${e(doc.id)}" hidden>Pakai versi terbaru</button><button type="button" class="ts-row-button" data-ts-clear="${e(doc.id)}" hidden>Batalkan baris</button></td></tr>`;
 }
 function updateRow(doc){
  const id=doc.id,draft=changes.get(id),errors=issues.get(id)||{},isConflict=conflict(id),disabled=locked()||!find(id)||T.isFinal(doc.statusTerakhir);
  $('ts-row-'+id).setAttribute('data-changed',draft?'true':'false');
  D.columns.forEach((col,number)=>{const input=$(cell(id,number)),hint=$(`ts-error-${id}-${number}`);input.disabled=disabled;g.TanggalInput.sync(input);input.setAttribute('aria-invalid',errors[col.key]?'true':'false');hint.textContent=errors[col.key]||'';hint.hidden=!errors[col.key];});
  const status=$('ts-review-'+id),days=T.holdDays(doc,today);status.textContent=(days===null?'—':days+' hari')+(isConflict?' · Data berubah':Object.keys(errors).length?' · Periksa isian':'');status.setAttribute('data-state',isConflict||Object.keys(errors).length?'error':'idle');
  const accept=panel.querySelector(`[data-ts-accept="${id}"]`),clear=panel.querySelector(`[data-ts-clear="${id}"]`);accept.hidden=!isConflict||!find(id)||T.isFinal(doc.statusTerakhir);accept.disabled=locked();clear.hidden=!draft;clear.disabled=locked();
 }
 function controls(){
  const pending=S.pending,hold=locked(),visibleChanged=visible.filter(doc=>changes.has(doc.id)).length,hiddenChanged=changes.size-visibleChanged;
  $('ts-count').textContent=loading?'Memuat dokumen…':`${pageState?.total||0} dokumen · ${changes.size} perubahan${hiddenChanged?' ('+hiddenChanged+' di lembar lain atau di luar filter)':''}`;
  $('ts-change-badge').textContent=String(changes.size);$('ts-changed-only').setAttribute('aria-pressed',String(onlyChanged));
  $('ts-save').disabled=hold||!changes.size;$('ts-save').hidden=!!pending;$('ts-save').textContent=busy?'Menyimpan…':'Simpan perubahan';
  $('ts-check').disabled=busy||loading||(!pending&&!changes.size);$('ts-check').textContent=pending?'Periksa penyimpanan':'Periksa data';
  $('ts-retry').hidden=!pending?.canRetry;$('ts-retry').disabled=busy||loading;
  $('ts-discard').disabled=hold||!changes.size;
  $('ts-changed-only').disabled=busy||loading;$('ts-load-retry').disabled=busy||loading;
  form.setAttribute('aria-busy',String(busy||loading));
 }
 function render(){
  if(!allowed())return;
  g.TanggalInput.close(false);
  try{filtered=displayRows();pageState=g.Paginasi.range(filtered.length,page,20);page=pageState.page;visible=filtered.slice(pageState.start,pageState.end);}catch(err){filtered=[];visible=[];pageState=g.Paginasi.range(0);message(err.message,'error');}
  g.Paginasi.render($('ts-pagination'),pageState,next=>{page=next;render();});
  $('ts-rows').innerHTML=visible.map(renderRow).join('');
  visible.forEach(doc=>{const row=values(doc);D.columns.forEach((col,number)=>{const input=$(cell(doc.id,number));input.value=row[col.key]||'';if(col.key==='tanggal')g.TanggalInput.mount(input,{min:()=>find(doc.id)?.perpindahanTerakhir||find(doc.id)?.tanggalMasuk||doc.perpindahanTerakhir||doc.tanggalMasuk,max:()=>T.today()});});updateRow(doc);});
  $('ts-empty').hidden=!!visible.length;$('ts-empty').textContent=loading?'Memuat dokumen…':onlyChanged?'Belum ada baris yang diubah.':'Tidak ada dokumen aktif yang sesuai filter.';controls();mark();
 }
 function repaint(){visible.forEach(updateRow);controls();}
 function focus(id,col=0){const input=$(cell(id,col));if(input&&!input.disabled){input.focus();input.scrollIntoView({block:'nearest',inline:'nearest'});}}
 async function load(force=false){
  if(!allowed())return;if(loading){if(force)queuedReload=true;return loadPromise;}if(loaded&&!force){render();return;}
  const seq=generation;loading=true;$('ts-load-retry').hidden=true;repaint();
  loadPromise=(async()=>{try{const data=await S.list();if(seq!==generation||!allowed())return;records=data;loaded=true;loading=false;render();if(S.pending){message(`Ada kiriman ${S.pending.count} perpindahan yang belum dikonfirmasi. Periksa penyimpanan sebelum melanjutkan.`);}}
   catch(err){if(seq===generation&&allowed()){loading=false;message(err.message||'Daftar belum dapat dimuat.','error');$('ts-load-retry').hidden=false;render();}}
   finally{if(seq===generation){loading=false;loadPromise=null;controls();if(queuedReload){queuedReload=false;load(true);}}}})();return loadPromise;
 }
 function inspect(){
  let result;try{result=D.validate(changes,records,T.today());}catch(err){message(err.message,'error');return false;}
  issues=result.issues;entries=result.entries;checked=new Set(entries.filter(x=>!issues.has(x.id)).map(x=>x.id));
  if(!entries.length){message('Isi perpindahan pada minimal satu baris.');return false;}
  if(issues.size){onlyChanged=true;page=1;render();const [id,errors]=issues.entries().next().value;message(`${issues.size} baris perlu diperiksa. Perubahan belum dikirim.`,'error');focus(id,Math.max(0,D.columns.findIndex(col=>Object.hasOwn(errors,col.key))));return false;}
  repaint();message(`${entries.length} perpindahan siap disimpan.`,'success');return true;
 }
 function applyReceipt(receipt){
  receipt.dokumen.forEach(doc=>{const old=find(doc.id);if(old)Object.assign(old,{revision:doc.versi,statusTerakhir:doc.status_terakhir,posisiSekarang:doc.posisi_sekarang,perpindahanTerakhir:doc.perpindahan_terakhir,notePerpindahanTerakhir:changes.get(doc.id)?.values.catatan||''});});
  changes.clear();issues.clear();checked.clear();entries=[];onlyChanged=false;render();g.FormGuard?.clean(form);message(`${receipt.jumlah} perpindahan berhasil disimpan.`,'success');document.dispatchEvent(new CustomEvent('tracking:batch-moved',{detail:{jumlah:receipt.jumlah}}));
 }
 async function submit(action){
  if(!allowed()||busy||loading)return;if(action==='save'&&(!inspect()||S.pending))return;
  const seq=generation;busy=true;message(action==='check'?'Memeriksa kiriman terakhir…':`Menyimpan ${S.pending?.count||entries.length} perpindahan…`);repaint();
  try{const result=action==='check'?await S.check():action==='retry'?await S.retry():await S.save(entries.map(x=>x.data));if(seq!==generation||!allowed())return;busy=false;if(result){applyReceipt(result);if(!loaded||!records.length)await load(true);}else{message('Kiriman sebelumnya tidak tersimpan. Periksa kembali isian sebelum menyimpan.');repaint();mark();}}
  catch(err){if(seq!==generation||!allowed()||err.stale)return;busy=false;if(S.pending){message(`Hasil penyimpanan belum dikonfirmasi. ${err.message} Gunakan Periksa penyimpanan sebelum mengirim data baru.`,'error');}
   else{if(err.code==='40001'){await load(true);const result=D.validate(changes,records,T.today());issues=result.issues;onlyChanged=true;render();}message(err.message||'Perpindahan belum disimpan.','error');}repaint();mark();}
  finally{if(seq===generation){busy=false;repaint();}}
 }
 function discard(){changes.clear();issues.clear();checked.clear();entries=[];onlyChanged=false;render();g.FormGuard?.clean(form);}
 function leave(){if(!active())return true;if(busy||S.pending){message('Periksa hasil penyimpanan sebelum mengganti tampilan Tracking.','error');return false;}if(g.FormGuard?.leave(form)===false)return false;if(changes.size)discard();return true;}
 function sync(){
  const next=key();if(identity!==next){identity=next;generation++;records=[];changes.clear();issues.clear();checked.clear();visible=[];entries=[];loaded=false;loading=false;loadPromise=null;queuedReload=false;busy=false;onlyChanged=false;today=T.today();page=1;$('ts-rows').replaceChildren();message('');g.FormGuard?.clean(form);}
  if(!changes.size&&!S.pending)today=T.today();
  const enabled=active();document.body.classList.remove('tracking-excel-full');$('tracking-page').classList.remove('ts-filters-closed');panel.hidden=!enabled;$('tracking-page').classList.toggle('tracking-sheet-active',enabled);$('tab-active').setAttribute('aria-controls',A.canWrite()&&g.TrackingInputStore.mode==='excel'?'tracking-sheet-panel':'document-results');
  if(enabled){if(!A.administrator()&&!A.profile.office_id){message('Office akun belum ditetapkan. Hubungi Administrator.','error');return;}load().catch(err=>message(err.message,'error'));}
 }
 function edit(event){
  const input=event.target.closest('[data-ts-cell]');if(!input||!allowed()||locked())return;const id=input.dataset.doc,doc=find(id);if(!doc||T.isFinal(doc.statusTerakhir))return;
  const draft=changes.get(id)||{doc:{...doc},values:D.defaults(doc,today),defaults:D.defaults(doc,today)};draft.values[D.columns[Number(input.dataset.column)].key]=input.value;
  if(D.same(draft.values,draft.defaults))changes.delete(id);else changes.set(id,draft);issues.delete(id);checked.delete(id);message('');updateRow(doc);controls();mark();
 }
 form.addEventListener('input',edit);form.addEventListener('change',edit);
 form.addEventListener('submit',event=>{event.preventDefault();submit('save');});
 form.addEventListener('reset',()=>queueMicrotask(()=>{if(allowed()&&!busy&&!S.pending)discard();}));
 form.addEventListener('click',event=>{
  if(!allowed()||locked())return;const clear=event.target.closest('[data-ts-clear]'),accept=event.target.closest('[data-ts-accept]');
  if(clear){changes.delete(clear.dataset.tsClear);issues.delete(clear.dataset.tsClear);checked.delete(clear.dataset.tsClear);render();}
  if(accept){const id=accept.dataset.tsAccept,doc=find(id),draft=changes.get(id);if(!doc||!draft||T.isFinal(doc.statusTerakhir))return;if(draft.values.status===draft.defaults.status)draft.values.status=doc.statusTerakhir;draft.defaults.status=doc.statusTerakhir;draft.doc={...doc};issues.delete(id);checked.delete(id);render();message('Versi terbaru dipakai untuk baris ini. Periksa tanggal, tujuan, dan status sebelum menyimpan.');}
 });
 form.addEventListener('paste',event=>{
  const input=event.target.closest('[data-ts-cell]');if(!input||!allowed()||locked())return;const text=event.clipboardData?.getData('text/plain');if(!text)return;const col=Number(input.dataset.column);if(!/[\t\r\n]/.test(text)&&input.tagName!=='SELECT')return;if(col===3&&!text.includes('\t'))return;event.preventDefault();
  try{const result=D.paste(changes,text,filtered.findIndex(doc=>doc.id===input.dataset.doc),col,filtered,records,today);changes=result.changes;issues.clear();checked.clear();render();message(`${result.count} baris ditempel. Periksa data sebelum menyimpan.`);focus(input.dataset.doc,col);}catch(err){message(err.message,'error');}
 });
 form.addEventListener('keydown',event=>{
  const input=event.target.closest('[data-ts-cell]');if(!input||!allowed()||locked()||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!['Tab','Enter'].includes(event.key))return;
  let row=filtered.findIndex(doc=>doc.id===input.dataset.doc),col=Number(input.dataset.column);if(event.key==='Enter'&&event.shiftKey&&col===3)return;
  if(event.key==='Enter')row+=event.shiftKey?-1:1;else{col+=event.shiftKey?-1:1;if(col<0){col=D.columns.length-1;row--;}if(col>=D.columns.length){col=0;row++;}}
  if(row<0||row>=filtered.length)return;event.preventDefault();const id=filtered[row].id,nextPage=Math.floor(row/20)+1;if(nextPage!==page){page=nextPage;render();}focus(id,col);
 });
 $('ts-check').addEventListener('click',()=>{if(!allowed()||busy||loading)return;if(S.pending)submit('check');else inspect();});$('ts-retry').addEventListener('click',()=>submit('retry'));
 $('ts-discard').addEventListener('click',()=>{if(allowed()&&!locked()&&g.FormGuard?.leave(form)!==false)discard();});
 $('ts-changed-only').addEventListener('click',()=>{if(busy||loading)return;onlyChanged=!onlyChanged;page=1;render();});
 $('ts-load-retry').addEventListener('click',()=>load(true));
 $('ts-help-toggle').addEventListener('click',()=>{$('ts-help').hidden=!$('ts-help').hidden;$('ts-help-toggle').setAttribute('aria-expanded',String(!$('ts-help').hidden));});
 ['search','filter-bu','filter-status','filter-office','filter-from','filter-to'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{if(active()&&loaded){page=1;render();}}));
 ['tracking:input-mode','tracking:tab-changed','akses:berubah'].forEach(name=>document.addEventListener(name,sync));g.addEventListener('hashchange',sync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active())sync();});
 ['tracking:document-changed','tracking:batch-saved','data:muat-ulang'].forEach(name=>document.addEventListener(name,()=>{loaded=false;if(active())load(true);}));
 g.TrackingSheetUI=Object.freeze({leave,active});A.ready.then(sync).catch(()=>{});sync();
})(window);
