(function(g){
 'use strict';
 const A=g.Akses,D=g.SkcInputDomain,S=g.SkcInputStore,U=g.PortalUI,$=id=>document.getElementById(id),e=U.escape,dialog=$('skc-dialog'),single=$('skc-form');
 const switcher=document.createElement('div');switcher.className='si-mode-bar';
 switcher.innerHTML='<div class="si-mode-switch" role="group" aria-label="Cara input SKC"><button type="button" id="si-mode-form" aria-pressed="true">Form</button><button type="button" id="si-mode-excel" aria-pressed="false">Excel</button></div><span id="si-mode-note">Isi satu karyawan melalui form.</span>';single.before(switcher);
 const form=document.createElement('form');form.id='skc-excel-form';form.hidden=true;form.setAttribute('novalidate','');form.setAttribute('autocomplete','off');
 form.innerHTML=`<div class="si-toolbar"><button type="button" class="button button-secondary" id="si-add">${U.icon('plus')}Tambah 5 baris</button><button type="button" id="si-help-toggle" class="si-text-button" aria-expanded="false" aria-controls="si-help">Cara tempel dari Excel</button></div>
 <div id="si-help" class="si-help" hidden><p>Salin beberapa baris Excel, lalu tempel pada sel awal. Urutan tanpa judul: <strong>NIK · Tanggal cuti · Link Form Cuti · Link Exit</strong>.</p><p>Judul kolom boleh ikut disalin. Kolom Nama dan Jabatan akan diisi dari Data Karyawan berdasarkan NIK. Pertahankan angka nol di depan NIK pada Excel. Tanggal menerima DD/MM/YYYY atau YYYY-MM-DD. Kedua link boleh kosong. Maksimal 100 baris.</p></div>
 <p id="si-message" class="si-message" role="status" aria-live="polite" hidden></p>
 <div id="si-frame" class="si-frame" role="region" aria-label="Tabel input SKC, geser untuk melihat kolom" tabindex="0"><table class="si-table"><caption class="sr-only">Input SKC massal. Isi NIK dan tanggal cuti; nama dan jabatan terisi otomatis.</caption><colgroup><col style="width:44px"><col style="width:150px"><col style="width:210px"><col style="width:170px"><col style="width:180px"><col style="width:280px"><col style="width:280px"><col style="width:54px"></colgroup><thead><tr><th scope="col">No.</th><th scope="col">NIK <span aria-hidden="true">*</span></th><th scope="col">Nama karyawan</th><th scope="col">Jabatan</th><th scope="col">Tanggal cuti <span aria-hidden="true">*</span></th><th scope="col">Link Form Cuti</th><th scope="col">Link Exit</th><th scope="col"><span class="sr-only">Hapus baris</span></th></tr></thead><tbody id="si-rows"></tbody></table></div>
 <div class="si-summary"><span>Tab pindah sel · Enter pindah baris</span><strong id="si-count" role="status" aria-live="polite"></strong></div><div class="si-actions"><span id="si-save-note">Baris kosong tidak disimpan.</span><div><button type="button" class="button button-secondary" id="si-cancel">Tutup</button><button type="button" class="button button-secondary" id="si-check">Periksa data</button><button type="button" class="button button-secondary" id="si-retry" hidden>Kirim ulang</button><button type="button" class="button button-secondary" id="si-new" hidden>Input baru</button><button type="submit" class="button button-primary" id="si-save">Simpan semua SKC</button></div></div>`;
 dialog.append(form);
 let mode='form',rows=[],context=null,identity='',revision=0,busy=false,opening=false,singleBusy=false,stage='draft',issues=new Map(),entries=[],receipt=null;
 const profileKey=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 const allowed=()=>!!A.profile&&A.canWrite()&&identity===profileKey();
 const editable=()=>allowed()&&!busy&&!opening&&!singleBusy&&stage==='draft';
 const cellId=(row,col)=>`si-cell-${row}-${col}`;
 function message(text,tone='info'){$('si-message').textContent=text;$('si-message').hidden=!text;$('si-message').setAttribute('data-tone',tone);}
 function mark(){if(rows.some(row=>!D.empty(row)))g.FormGuard?.touch(form);else g.FormGuard?.clean(form);}
 function focus(row=0,col=0){const control=$(cellId(row,col));if(control&&!control.disabled){control.focus();control.scrollIntoView({block:'nearest',inline:'nearest'});}}
 async function loadContext(){
  const key=profileKey(),[employees,records]=await Promise.all([g.EmployeeStore.list(),g.SkcStore.list()]);
  if(key!==profileKey()||!A.canWrite())throw new Error('Akun berubah. Buka kembali input SKC.');context={employees,records};
 }
 function update(){
  const locked=busy||opening||singleBusy||stage!=='draft'||!allowed(),filled=rows.filter(row=>!D.empty(row)).length;
  single.hidden=mode==='excel';form.hidden=mode!=='excel';dialog.classList.toggle('skc-excel-active',mode==='excel');$('skc-form-title').textContent=mode==='excel'?'Input SKC':'Tambah SKC';
  for(const next of ['form','excel']){$('si-mode-'+next).setAttribute('aria-pressed',String(mode===next));$('si-mode-'+next).disabled=busy||opening||singleBusy||!!S.pending;}
  $('si-mode-note').textContent=opening?'Menyiapkan data karyawan…':mode==='excel'?'Isi NIK. Nama dan jabatan terisi otomatis.':'Isi satu karyawan melalui form.';
  $('si-count').textContent=stage==='saved'?`${receipt.jumlah} SKC tersimpan`:`${filled} SKC · ${rows.length}/${D.maxRows} baris`;
  $('si-add').disabled=locked||rows.length>=D.maxRows;$('si-save').disabled=locked||!filled;$('si-save').hidden=stage!=='draft';$('si-save').textContent=busy?'Menyimpan…':'Simpan semua SKC';
  $('si-check').hidden=stage==='saved';$('si-check').disabled=busy||opening;$('si-check').textContent=stage==='pending'?'Periksa penyimpanan':'Periksa data';
  $('si-retry').hidden=stage!=='pending'||!S.pending?.canRetry;$('si-retry').disabled=busy||opening;$('si-new').hidden=stage!=='saved';$('si-new').disabled=busy||opening;
  $('si-cancel').disabled=busy||opening;dialog.querySelectorAll('[data-close="skc-dialog"]').forEach(button=>{button.disabled=busy||opening||singleBusy;});
  $('si-frame').hidden=stage==='pending'&&!entries.length;
  $('si-save-note').textContent=stage==='saved'?'SKC sudah masuk ke daftar Belum diambil.':stage==='pending'?'Periksa hasil sebelum mengirim data baru.':'Baris kosong tidak disimpan.';
  rows.forEach((row,index)=>{
   const errors=issues.get(index)||{},person=context&&D.employee(row.nik,context.employees);
   $('si-name-'+index).textContent=person?.nama||(row.nik?'NIK belum cocok':'—');$('si-job-'+index).textContent=person?.jabatan||'—';$('si-row-'+index).setAttribute('data-state',Object.keys(errors).length?'error':stage==='saved'?'saved':'draft');
   D.columns.forEach((col,number)=>{const control=$(cellId(index,number)),hint=$(`si-error-${index}-${number}`);control.disabled=locked;control.setAttribute('aria-invalid',errors[col.key]?'true':'false');hint.textContent=errors[col.key]||'';hint.hidden=!errors[col.key];g.TanggalInput.sync(control);});
  });
  dialog.querySelectorAll('[data-si-delete]').forEach(button=>{button.disabled=locked;});form.setAttribute('aria-busy',String(busy||opening));
 }
 function render(){
  g.TanggalInput.close(false);
  const control=(row,index,number)=>{const col=D.columns[number];return `<td><input id="${cellId(index,number)}" name="skc_${index}_${col.key}" type="text" data-si-cell="" data-row="${index}" data-column="${number}" value="${e(row[col.key])}" aria-label="Baris ${index+1}, ${e(col.label)}" aria-describedby="si-error-${index}-${number}" ${col.max?'maxlength="'+col.max+'"':''} ${number>=2?'inputmode="url" spellcheck="false"':''} placeholder="${number===0?'NIK karyawan':number===1?'DD/MM/YYYY':'Opsional'}"><span class="si-cell-error" id="si-error-${index}-${number}" hidden></span></td>`;};
  $('si-rows').innerHTML=rows.map((row,index)=>`<tr id="si-row-${index}"><th scope="row" class="si-number">${index+1}</th>${control(row,index,0)}<td class="si-identity" id="si-name-${index}"></td><td class="si-identity si-job" id="si-job-${index}"></td>${control(row,index,1)}${control(row,index,2)}${control(row,index,3)}<td class="si-delete-cell"><button type="button" class="icon-button" data-si-delete="${index}" aria-label="Hapus baris ${index+1}">${U.icon('close')}</button></td></tr>`).join('');
  rows.forEach((row,index)=>g.TanggalInput.mount($(cellId(index,1))));update();
 }
 function reset(){rows=Array.from({length:5},D.blank);issues.clear();entries=[];receipt=null;stage='draft';message('');render();g.FormGuard?.clean(form);}
 function inspect(){
  if(!context)return false;
  const result=D.validate(rows,context);entries=result.entries;issues=new Map(result.issues.map(item=>[item.index,item.errors]));update();
  if(!entries.length){message('Isi minimal satu SKC terlebih dahulu.');focus();return false;}
  if(issues.size){const [index,errors]=issues.entries().next().value;message(`${issues.size} baris perlu diperbaiki. SKC belum dikirim.`,'error');focus(index,Math.max(0,D.columns.findIndex(col=>Object.hasOwn(errors,col.key))));return false;}
  message(`${entries.length} SKC siap disimpan.`,'success');return true;
 }
 function confirmed(value){
  receipt=value;stage='saved';issues.clear();context.records.push(...value.skc.map(row=>({id:row.id,employeeId:row.karyawan_id,tanggalCuti:row.tanggal_cuti})));message(`${value.jumlah} SKC berhasil disimpan.`,'success');update();g.FormGuard?.clean(form);document.dispatchEvent(new CustomEvent('skc:batch-saved',{detail:{jumlah:value.jumlah}}));$('si-cancel').focus();
 }
 async function submit(action){
  if(!allowed()||busy||opening)return;if(action==='save'&&(!editable()||!inspect()))return;
  const seq=revision;busy=true;message(action==='check'?'Memeriksa penyimpanan terakhir…':`Menyimpan ${S.pending?.count||entries.length} SKC…`);update();
  try{const value=action==='check'?await S.check():action==='retry'?await S.retry():await S.save(entries.map(entry=>entry.data));if(seq!==revision||!allowed())return;busy=false;if(value)confirmed(value);else{stage='draft';message('Kiriman sebelumnya tidak tersimpan. Isian dapat diperbaiki dan dikirim kembali.');update();mark();}}
  catch(error){if(seq!==revision||!allowed()||error.stale)return;busy=false;stage=S.pending?'pending':'draft';message(stage==='pending'?`Hasil penyimpanan belum dikonfirmasi. ${error.message} Gunakan Periksa penyimpanan sebelum membuat kiriman baru.`:error.message,'error');update();mark();}
  finally{if(seq===revision){busy=false;update();}}
 }
 async function prepare(){
  await A.ready;if(!A.profile||!A.canWrite())throw new Error('Akun tidak memiliki akses menambah SKC.');
  const next=profileKey(),keep=identity===next&&!!S.pending&&rows.length;identity=next;revision++;busy=false;
  if(!keep){context=null;rows=Array.from({length:5},D.blank);issues.clear();entries=[];receipt=null;}
  stage=S.pending?'pending':'draft';if(S.pending)mode='excel';
  if(mode==='excel')await loadContext();message(stage==='pending'?`Ada kiriman ${S.pending.count} SKC yang belum dikonfirmasi. Periksa penyimpanan sebelum melanjutkan.`:'');render();g.FormGuard?.clean(form);
 }
 async function changeMode(next){
  if(!allowed()||busy||opening||singleBusy||S.pending||mode===next)return;
  const seq=revision;opening=true;update();
  try{
   if(next==='excel')await loadContext();if(seq!==revision||!allowed())return;
   if(g.FormGuard?.leave(mode==='excel'?form:single)===false)return;
   if(next==='form')await g.SkcFormUI.reset();if(seq!==revision||!allowed())return;
   mode=next;if(next==='excel')reset();else{rows=Array.from({length:5},D.blank);issues.clear();entries=[];stage='draft';message('');render();}
  }catch(error){if(seq===revision)U.showToast(error.message);}
  finally{if(seq===revision){opening=false;update();if(mode==='excel')focus();}}
 }
 for(const next of ['form','excel'])$('si-mode-'+next).addEventListener('click',()=>changeMode(next));
 $('si-add').addEventListener('click',()=>{if(!editable())return;const start=rows.length;while(rows.length<Math.min(start+5,D.maxRows))rows.push(D.blank());issues.clear();render();mark();focus(start);});
 $('si-help-toggle').addEventListener('click',()=>{$('si-help').hidden=!$('si-help').hidden;$('si-help-toggle').setAttribute('aria-expanded',String(!$('si-help').hidden));});
 $('si-cancel').addEventListener('click',()=>{if(!busy&&!opening)dialog.close();});$('si-check').addEventListener('click',()=>{if(!allowed()||busy||opening)return;if(stage==='pending')submit('check');else inspect();});$('si-retry').addEventListener('click',()=>submit('retry'));
 $('si-new').addEventListener('click',()=>{if(allowed()&&!busy&&!opening&&!S.pending){reset();focus();}});
 form.addEventListener('submit',event=>{event.preventDefault();submit('save');});
 form.addEventListener('reset',()=>queueMicrotask(()=>{if(allowed()&&!busy&&!S.pending&&dialog.open)reset();}));
 function edit(event){const input=event.target.closest('[data-si-cell]');if(!input||!editable())return;const row=Number(input.dataset.row),col=Number(input.dataset.column);rows[row][D.columns[col].key]=input.value;issues.delete(row);message('');update();mark();}
 form.addEventListener('input',edit);form.addEventListener('change',edit);
 form.addEventListener('click',event=>{const button=event.target.closest('[data-si-delete]');if(!button||!editable())return;const index=Number(button.dataset.siDelete);if(!D.empty(rows[index])&&!g.confirm(`Hapus isi baris ${index+1}?`))return;rows.splice(index,1);if(!rows.length)rows.push(D.blank());issues.clear();message('');render();mark();focus(Math.min(index,rows.length-1));});
 form.addEventListener('paste',event=>{
  const input=event.target.closest('[data-si-cell]');if(!input||!editable())return;const text=event.clipboardData?.getData('text/plain');if(!text||!/[\t\r\n]/.test(text))return;event.preventDefault();
  try{const row=Number(input.dataset.row),col=Number(input.dataset.column),result=D.paste(rows,text,row,col);rows=result.rows;issues.clear();message(`${result.count} baris ditempel. Periksa data sebelum menyimpan.`);render();mark();focus(row,col);}catch(error){message(error.message,'error');}
 });
 form.addEventListener('keydown',event=>{
  const input=event.target.closest('[data-si-cell]');if(!input||!editable()||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!['Tab','Enter'].includes(event.key))return;
  let row=Number(input.dataset.row),col=Number(input.dataset.column);if(event.key==='Enter')row+=event.shiftKey?-1:1;else{col+=event.shiftKey?-1:1;if(col<0){row--;col=D.columns.length-1;}if(col>=D.columns.length){row++;col=0;}}
  if(row<0||row>=D.maxRows){if(event.key==='Enter')event.preventDefault();return;}event.preventDefault();if(row>=rows.length){rows.push(D.blank());render();mark();}focus(row,col);
 });
 dialog.addEventListener('cancel',event=>{if(busy||opening||singleBusy){event.preventDefault();event.stopImmediatePropagation();}});
 dialog.addEventListener('click',event=>{if((busy||opening||singleBusy)&&event.target===dialog)event.stopImmediatePropagation();},true);
 dialog.addEventListener('close',()=>{g.TanggalInput.close(false);if(!S.pending){rows=[];entries=[];context=null;$('si-rows').replaceChildren();}if(A.canWrite())$('tracking-add-skc').focus();});
 document.addEventListener('akses:berubah',()=>{if(identity&&identity!==profileKey()){revision++;identity='';busy=false;opening=false;singleBusy=false;mode='form';rows=[];entries=[];context=null;issues.clear();single.reset();g.FormGuard?.clean(single);g.FormGuard?.clean(form);$('si-rows').replaceChildren();if(dialog.open)dialog.close();single.hidden=false;form.hidden=true;dialog.classList.remove('skc-excel-active');message('');}});
 g.SkcInputUI=Object.freeze({prepare,setFormBusy:value=>{singleBusy=!!value;update();},focus:()=>stage==='pending'?$('si-check').focus():focus(),get mode(){return mode;}});
})(window);
