(function(g){
 'use strict';
 const A=g.Akses,D=g.TrackingInputDomain,S=g.TrackingInputStore,U=g.PortalUI,$=id=>document.getElementById(id),e=U.escape;
 const dialog=document.createElement('dialog');dialog.id='tracking-excel-dialog';dialog.className='ti-dialog';dialog.setAttribute('aria-labelledby','ti-title');dialog.setAttribute('aria-describedby','ti-description');
 dialog.innerHTML=`<div class="ti-heading"><div><p class="dialog-kicker">TRACKING DOKUMEN <span class="ti-mode-tag">EXCEL</span></p><h2 id="ti-title">Input dokumen</h2><p id="ti-description">Isi beberapa dokumen sekaligus. Satu baris untuk satu dokumen.</p></div><button type="button" class="icon-button" id="ti-close" aria-label="Tutup input dokumen">${U.icon('close')}</button></div>
 <form id="tracking-excel-form" novalidate autocomplete="off"><div class="ti-toolbar"><div class="ti-toolbar-left"><button type="button" class="button button-secondary" id="ti-add">${U.icon('plus')}Tambah 5 baris</button><span class="ti-office" id="ti-office"></span></div><button type="button" class="ti-help-toggle" id="ti-help-toggle" aria-expanded="false" aria-controls="ti-help">Cara tempel data ${U.icon('info')}</button></div>
 <div class="ti-help" id="ti-help" hidden><p>Salin sel dari Excel, lalu tempel pada sel awal di tabel ini. Judul kolom boleh ikut disalin.</p><p><strong>Urutan kolom:</strong> Nama dokumen · Tanggal masuk · BU · Jenis dokumen · Nomor dokumen · Office · Catatan.</p><p>Tanggal: DD/MM/YYYY atau YYYY-MM-DD. Jenis: FORM, EM, IM, atau tulis nama jenis lainnya. Maksimal 100 baris. ${'Office mengikuti akun untuk selain Administrator.'}</p></div>
 <div class="ti-message" id="ti-message" role="status" aria-live="polite" hidden></div><div class="ti-frame" id="ti-frame" tabindex="0" role="region" aria-label="Tabel input dokumen, geser untuk melihat seluruh kolom"><table class="ti-table"><caption class="sr-only">Input dokumen baru. Nama, tanggal, BU, jenis, dan office wajib diisi.</caption><colgroup><col class="ti-no-col"><col class="ti-name-col"><col class="ti-date-col"><col class="ti-bu-col"><col class="ti-type-col"><col class="ti-number-col"><col class="ti-office-col"><col class="ti-note-col"><col class="ti-status-col"><col class="ti-delete-col"></colgroup><thead><tr><th scope="col">No.</th>${D.columns.map((col,index)=>`<th scope="col">${e(col.label)}${[0,1,2,3,5].includes(index)?'<span class="ti-required" aria-hidden="true"> *</span>':''}</th>`).join('')}<th scope="col">Pemeriksaan</th><th scope="col"><span class="sr-only">Hapus baris</span></th></tr></thead><tbody id="ti-rows"></tbody></table></div>
 <datalist id="ti-types"><option value="FORM"></option><option value="EM"></option><option value="IM"></option></datalist>
 <div class="ti-bottom"><span class="ti-keyboard">Tab pindah sel · Enter pindah baris</span><span class="ti-count" id="ti-count" role="status" aria-live="polite"></span></div>
 <div class="ti-actions"><span class="ti-save-note" id="ti-save-note">Baris kosong tidak disimpan.</span><div><button type="button" class="button button-secondary" id="ti-cancel">Tutup</button><button type="button" class="button button-secondary" id="ti-check">Periksa data</button><button type="button" class="button button-secondary" id="ti-retry" hidden>Kirim ulang</button><button type="button" class="button button-secondary" id="ti-new" hidden>Input baru</button><button type="submit" class="button button-primary" id="ti-save">Simpan semua</button></div></div></form>`;
 document.body.append(dialog);
 const form=$('tracking-excel-form');
 let rows=[],context=null,identity='',stage='draft',busy=false,opening=false,issues=new Map(),checked=new Set(),entries=[],receipt=null,revision=0;
 const profileKey=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 const allowed=()=>A.canWrite()&&!!A.profile&&identity===profileKey();
 const editable=()=>allowed()&&!busy&&stage==='draft';
 const cellId=(row,col)=>`ti-cell-${row}-${col}`;
 function message(text,tone='info'){$('ti-message').textContent=text;$('ti-message').hidden=!text;$('ti-message').setAttribute('data-tone',tone);}
 function dirty(){if(rows.some(row=>!D.empty(row,context)))g.FormGuard?.touch(form);else g.FormGuard?.clean(form);}
 function selectOptions(options,value){return '<option value="">Pilih BU</option>'+(!options.includes(value)&&value?`<option value="${e(value)}">${e(value)} (periksa)</option>`:'')+options.map(x=>`<option value="${e(x)}">${e(x)}</option>`).join('');}
 function officeOptions(value){const offices=context.offices.filter(o=>o.aktif||o.id===context.officeId);return '<option value="">Pilih office</option>'+(!offices.some(o=>o.id===value)&&value?`<option value="${e(value)}">${e(value)} (periksa)</option>`:'')+offices.map(o=>`<option value="${e(o.id)}">${e(o.nama)}${o.aktif?'':' (nonaktif)'}</option>`).join('');}
 function renderRows(){
  $('ti-rows').innerHTML=rows.map((row,index)=>`<tr id="ti-row-${index}"><th scope="row" class="ti-row-number">${index+1}</th>${D.columns.map((col,number)=>{
   const attrs=`id="${cellId(index,number)}" name="r${index}_${col.key}" data-ti-cell="" data-row="${index}" data-column="${number}" aria-label="Baris ${index+1}, ${e(col.label)}" aria-describedby="ti-error-${index}-${number}"`;
   const control=col.key==='bu'?`<select ${attrs}>${selectOptions(col.options,row[col.key])}</select>`:col.key==='officeId'?`<select ${attrs}>${officeOptions(row[col.key])}</select>`:col.key==='noteDokumen'?`<textarea ${attrs} rows="1" placeholder="Opsional">${e(row[col.key])}</textarea>`:`<input ${attrs} type="text" value="${e(row[col.key])}" ${col.key==='jenis'?'list="ti-types"':''} ${col.key==='tanggalMasuk'?'inputmode="numeric"':''} placeholder="${{namaDokumen:'Nama / perihal dokumen',tanggalMasuk:'DD/MM/YYYY',jenis:'FORM, EM, IM, lainnya',nomorDokumen:'Opsional'}[col.key]||''}">`;
   return `<td>${control}<span class="ti-cell-error" id="ti-error-${index}-${number}" hidden></span></td>`;
  }).join('')}<td class="ti-status-cell"><span id="ti-status-${index}" class="ti-row-status"></span></td><td class="ti-delete-cell"><button type="button" class="ti-delete icon-button" data-ti-delete="${index}" aria-label="Hapus baris ${index+1}" title="Hapus baris">${U.icon('close')}</button></td></tr>`).join('');
  rows.forEach((row,index)=>D.columns.forEach((col,number)=>{const control=$(cellId(index,number));control.value=row[col.key]||'';}));
  update();
 }
 function update(){
  if(!context)return;
  const filled=rows.filter(row=>!D.empty(row,context)).length,locked=busy||stage!=='draft';
  $('ti-count').textContent=stage==='saved'?`${receipt.jumlah} dokumen tersimpan`:`${filled} dokumen · ${rows.length}/${D.maxRows} baris`;
  $('ti-add').disabled=locked||rows.length>=D.maxRows;
  $('ti-save').disabled=locked||!filled;$('ti-save').hidden=stage==='pending'||stage==='saved';$('ti-save').textContent=busy&&stage==='draft'?'Menyimpan…':'Simpan semua';
  $('ti-check').hidden=stage==='saved';$('ti-check').disabled=busy;$('ti-check').textContent=stage==='pending'?(busy?'Memeriksa…':'Periksa penyimpanan'):'Periksa data';
  $('ti-retry').hidden=stage!=='pending'||!S.pending?.canRetry;$('ti-retry').disabled=busy;
  $('ti-new').hidden=stage!=='saved';$('ti-close').disabled=busy;$('ti-cancel').disabled=busy;
  $('ti-frame').hidden=stage==='pending'&&!entries.length;
  $('ti-save-note').textContent=stage==='saved'?'Dokumen sudah masuk ke daftar Aktif.':stage==='pending'?'Periksa hasil sebelum mengirim data baru.':'Baris kosong tidak disimpan.';
  rows.forEach((row,index)=>{
   const errors=issues.get(index)||{};
   D.columns.forEach((col,number)=>{const control=$(cellId(index,number)),hint=$(`ti-error-${index}-${number}`),error=errors[col.key];control.disabled=locked||(col.key==='officeId'&&!context.administrator);control.setAttribute('aria-invalid',error?'true':'false');hint.textContent=error||'';hint.hidden=!error;});
   const status=$('ti-status-'+index),doc=stage==='saved'?receipt.dokumen[entries.findIndex(entry=>entry.index===index)]:null;
   status.textContent=doc?(doc.kode||'Tersimpan'):Object.keys(errors).length?'Perlu diperbaiki':checked.has(index)?'Siap':D.empty(row,context)?'—':'Belum diperiksa';
   status.setAttribute('data-state',doc?'saved':Object.keys(errors).length?'error':checked.has(index)?'ready':'draft');
  });
  dialog.querySelectorAll('[data-ti-delete]').forEach(button=>{button.disabled=locked;});
  form.setAttribute('aria-busy',busy?'true':'false');
 }
 function focusCell(row,col){const control=$(cellId(row,col));if(control&&!control.disabled){control.focus();control.scrollIntoView({block:'nearest',inline:'nearest'});}}
 function clearRow(index){issues.delete(index);checked.delete(index);}
 function inspect(){
  const result=D.validate(rows,context);issues=new Map(result.issues.map(item=>[item.index,item.errors]));checked=new Set(result.entries.filter(entry=>!issues.has(entry.index)).map(entry=>entry.index));entries=result.entries;update();
  if(!entries.length){message('Isi minimal satu dokumen terlebih dahulu.');focusCell(0,0);return false;}
  if(issues.size){message(`${issues.size} baris perlu diperbaiki. Periksa sel yang ditandai.`,'error');const [index,errors]=issues.entries().next().value;focusCell(index,D.columns.findIndex(col=>Object.hasOwn(errors,col.key)));return false;}
  message(`${entries.length} dokumen siap disimpan.`, 'success');return true;
 }
 function reset(){rows=Array.from({length:5},()=>D.blank(context));issues=new Map();checked=new Set();entries=[];receipt=null;stage='draft';message('');renderRows();g.FormGuard?.clean(form);focusCell(0,0);}
 function confirmed(value){receipt=value;stage='saved';issues.clear();checked.clear();message(`${value.jumlah} dokumen berhasil disimpan.`,'success');update();g.FormGuard?.clean(form);document.dispatchEvent(new CustomEvent('tracking:batch-saved',{detail:{jumlah:value.jumlah}}));$('ti-cancel').focus();}
 async function submit(action){
  if(!allowed()||busy)return;
  if(action==='save'&&(!editable()||!inspect()))return;
  const seq=revision;busy=true;message(action==='check'?'Memeriksa penyimpanan terakhir…':`Menyimpan ${S.pending?.count||entries.length} dokumen…`);update();
  try{
   const value=action==='check'?await S.check():action==='retry'?await S.retry():await S.save(entries.map(entry=>entry.data));
   if(seq!==revision||!allowed())return;
   busy=false;
   if(value)confirmed(value);
   else{stage='draft';message('Kiriman sebelumnya tidak tersimpan. Data dapat diperbaiki dan dikirim kembali.');update();dirty();}
  }catch(error){
   if(seq!==revision||!allowed()||error.stale)return;
   busy=false;stage=S.pending?'pending':'draft';
   message(stage==='pending'?`Hasil penyimpanan belum dikonfirmasi. ${error.message||'Koneksi terputus.'} Gunakan Periksa penyimpanan; kirim ulang memakai kiriman yang sama.`:(error.message||'Dokumen belum tersimpan.'),'error');update();dirty();
  }finally{if(seq===revision){busy=false;update();}}
 }
 async function open(){
  if(opening||dialog.open){if(dialog.open)dialog.focus();return;}opening=true;
  try{
   await A.ready;if(!A.profile||!A.canWrite())throw new Error('Akun tidak memiliki akses mencatat dokumen.');
   const key=profileKey(),offices=await g.OfficeStore.list();if(key!==profileKey()||!A.canWrite())throw new Error('Akun berubah. Buka kembali input dokumen.');
   if(!A.administrator()&&!A.profile.office_id)throw new Error('Office akun belum ditetapkan. Hubungi Administrator.');
   const keep=identity===key&&S.pending&&rows.length;identity=key;revision++;context={today:g.TrackingDomain.today(),officeId:A.profile.office_id||'',administrator:A.administrator(),offices};busy=false;
   if(!keep){rows=Array.from({length:5},()=>D.blank(context));issues=new Map();checked=new Set();entries=[];receipt=null;}
   stage=S.pending?'pending':'draft';
   $('ti-office').textContent=context.administrator?'Office dapat dipilih per baris':`Office: ${g.OfficeStore.name(context.officeId)||'Office akun'}`;
   message(stage==='pending'?`Ada kiriman ${S.pending.count} dokumen yang belum dikonfirmasi. Periksa penyimpanan sebelum melanjutkan.`:'');renderRows();dialog.showModal();g.FormGuard?.clean(form);if(stage==='draft')focusCell(0,0);else await submit('check');
  }finally{opening=false;}
 }
 function close(){if(!busy)dialog.close();}
 $('ti-close').addEventListener('click',close);$('ti-cancel').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{if(busy){event.preventDefault();event.stopImmediatePropagation();}});
 dialog.addEventListener('close',()=>{if(!S.pending){rows=[];entries=[];context=null;$('ti-rows').replaceChildren();} $('tracking-add-document').focus();});
 $('ti-help-toggle').addEventListener('click',()=>{const hidden=!$('ti-help').hidden;$('ti-help').hidden=hidden;$('ti-help-toggle').setAttribute('aria-expanded',String(!hidden));});
 $('ti-add').addEventListener('click',()=>{if(!editable())return;const start=rows.length;while(rows.length<Math.min(start+5,D.maxRows))rows.push(D.blank(context));renderRows();dirty();focusCell(start,0);});
 $('ti-new').addEventListener('click',()=>{if(allowed()&&!busy&&!S.pending)reset();});
 $('ti-check').addEventListener('click',()=>{if(!allowed()||busy)return;if(stage==='pending')submit('check');else inspect();});
 $('ti-retry').addEventListener('click',()=>submit('retry'));
 form.addEventListener('submit',event=>{event.preventDefault();submit('save');});
 function input(event){const control=event.target.closest('[data-ti-cell]');if(!control||!editable())return;const row=Number(control.dataset.row),col=Number(control.dataset.column);rows[row][D.columns[col].key]=control.value;clearRow(row);message('');update();}
 form.addEventListener('input',input);form.addEventListener('change',input);
 form.addEventListener('click',event=>{const button=event.target.closest('[data-ti-delete]');if(!button||!editable())return;const index=Number(button.dataset.tiDelete);if(!D.empty(rows[index],context)&&!g.confirm(`Hapus isi baris ${index+1}?`))return;rows.splice(index,1);if(!rows.length)rows.push(D.blank(context));issues.clear();checked.clear();message('');renderRows();dirty();focusCell(Math.min(index,rows.length-1),0);});
 form.addEventListener('paste',event=>{
  const control=event.target.closest('[data-ti-cell]');if(!control||!editable())return;const text=event.clipboardData?.getData('text/plain');if(!text)return;
  if(!text.includes('\t')&&!text.includes('\n')&&!text.includes('\r')&&control.tagName!=='SELECT')return;
  if(D.columns[Number(control.dataset.column)].key==='noteDokumen'&&!text.includes('\t'))return;
  event.preventDefault();try{const row=Number(control.dataset.row),col=Number(control.dataset.column),result=D.paste(rows,text,row,col,context);rows=result.rows;issues.clear();checked.clear();message(`${result.count} baris ditempel. Periksa data sebelum menyimpan.`);renderRows();dirty();focusCell(row,col);}catch(error){message(error.message,'error');}
 });
 form.addEventListener('keydown',event=>{
  const control=event.target.closest('[data-ti-cell]');if(!control||!editable()||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!['Tab','Enter'].includes(event.key))return;
  const row=Number(control.dataset.row),col=Number(control.dataset.column);if(event.key==='Enter'&&event.shiftKey&&D.columns[col].key==='noteDokumen')return;
  let nextRow=row,nextCol=col;
  if(event.key==='Enter')nextRow+=event.shiftKey?-1:1;
  else{const direction=event.shiftKey?-1:1;do{nextCol+=direction;if(nextCol<0){nextRow--;nextCol=D.columns.length-1;}if(nextCol>=D.columns.length){nextRow++;nextCol=0;}}while(nextRow>=0&&nextRow<D.maxRows&&D.columns[nextCol].key==='officeId'&&!context.administrator);}
  if(nextRow<0||nextRow>=D.maxRows){if(event.key==='Enter')event.preventDefault();return;}event.preventDefault();if(nextRow>=rows.length){rows.push(D.blank(context));renderRows();dirty();}focusCell(nextRow,nextCol);
 });
 function modeControls(){const mode=S.mode;['form','excel'].forEach(value=>{$('tracking-mode-'+value).setAttribute('aria-pressed',String(value===mode));});$('tracking-add-document').innerHTML=mode==='excel'?`${U.icon('grid')}<span>Input Excel</span>`:`${U.icon('plus')}<span>Tambah Dokumen</span>`;}
 ['form','excel'].forEach(value=>$('tracking-mode-'+value).addEventListener('click',async()=>{
  if(!A.canWrite()||S.mode===value)return;['form','excel'].forEach(v=>{$('tracking-mode-'+v).disabled=true;});
  try{await S.setMode(value);modeControls();}catch(error){if(!error.stale)U.showToast(`${error.message} Pastikan SQL pembaruan 28 sudah dipasang.`);}finally{['form','excel'].forEach(v=>{$('tracking-mode-'+v).disabled=false;});}
 }));
 document.addEventListener('tracking:input-mode',modeControls);
 document.addEventListener('akses:berubah',()=>{if(identity&&identity!==profileKey()){revision++;busy=false;rows=[];entries=[];context=null;identity='';g.FormGuard?.clean(form);if(dialog.open)dialog.close();$('ti-rows').replaceChildren();}modeControls();});
 g.TrackingInputUI=Object.freeze({open,get mode(){return S.mode;}});modeControls();
})(window);
