(function(g){
 'use strict';
 const A=g.Akses,S=g.TrackingInputStore,D=g.TrackingInputDomain,$=id=>document.getElementById(id),form=$('document-form'),dialog=$('document-dialog');
 const ids=['doc-initial-position','doc-initial-date','doc-initial-status'];let busy=false,waiting=false,editing=false,identity='',locks=null,sequence=0;
 const key=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 const hasInitial=()=>!editing&&ids.some(id=>$(id).value.trim());
 function sync(){
  const locked=busy||waiting;
  if(locked&&!locks)locks=[...form.elements,...dialog.querySelectorAll('[data-close]')].map(el=>({el,disabled:el.disabled}));
  if(locked)locks.forEach(({el})=>{el.disabled=true;});
  else if(locks){locks.forEach(({el,disabled})=>{el.disabled=disabled;});locks=null;}
  dialog.querySelectorAll('[data-close]').forEach(button=>{button.disabled=busy;});
  ids.forEach(id=>{$(id).disabled=editing||locked;$(id).required=hasInitial();});
  $('doc-initial-fields').hidden=editing;$('doc-initial-recovery').hidden=!waiting;
  $('doc-initial-check').disabled=busy;$('doc-initial-retry').disabled=busy;$('doc-initial-retry').hidden=!S.pending?.canRetry;
  $('doc-initial-date').min=$('doc-date').value;$('doc-initial-date').max=g.TrackingDomain.today();
 }
 function configure(isEditing){sequence++;identity=key();editing=isEditing;busy=false;waiting=false;sync();}
 async function save(data){
  if(identity!==key()||!A.canWrite())throw new Error('Akun berubah. Buka kembali input dokumen.');
  const row={namaDokumen:data.namaDokumen,tanggalMasuk:data.tanggalMasuk,bu:data.bu,jenis:data.jenisDokumen==='Lainnya'?data.jenisDokumenLainnya:data.jenisDokumen,nomorDokumen:data.nomorDokumen,officeId:A.administrator()?data.officeId:A.profile.office_id,noteDokumen:data.noteDokumen,posisiAwal:data.posisiAwal,tanggalPosisiAwal:data.tanggalPosisiAwal,statusAwal:data.statusAwal};
  const result=D.validate([row],{today:g.TrackingDomain.today(),officeId:A.profile.office_id,administrator:A.administrator(),offices:g.OfficeStore.records});
  if(result.issues.length)throw new Error(Object.values(result.issues[0].errors).join(' '));
  const seq=sequence;busy=true;sync();
  try{const receipt=await S.save(result.entries.map(entry=>entry.data));if(seq!==sequence||identity!==key())throw new Error('Akun berubah.');return {id:receipt.dokumen[0].id,statusTerakhir:receipt.dokumen[0].status_terakhir};}
  finally{if(seq===sequence){busy=false;waiting=!!S.pending;sync();}}
 }
 async function recover(retry){
  if(busy||identity!==key()||!A.canWrite())return;const seq=sequence;busy=true;sync();
  try{
   const value=retry?await S.retry():await S.check();if(seq!==sequence||identity!==key())return;
   waiting=false;busy=false;sync();
   if(value){g.FormGuard?.clean(form);dialog.close();document.dispatchEvent(new CustomEvent('tracking:batch-saved',{detail:{jumlah:value.jumlah}}));g.PortalUI.showToast(`${value.jumlah} dokumen berhasil disimpan.`);}
   else{g.PortalUI.formError('document-error','Kiriman sebelumnya tidak tersimpan. Data dapat diperbaiki dan disimpan kembali.');g.FormGuard?.touch(form);}
  }catch(error){if(seq===sequence){waiting=!!S.pending;g.PortalUI.formError('document-error',error.message);}}
  finally{if(seq===sequence){busy=false;sync();}}
 }
 ids.forEach(id=>{$(id).addEventListener('input',sync);$(id).addEventListener('change',sync);});$('doc-date').addEventListener('change',sync);
 $('doc-initial-check').addEventListener('click',()=>recover(false));$('doc-initial-retry').addEventListener('click',()=>recover(true));
 dialog.addEventListener('cancel',event=>{if(busy){event.preventDefault();event.stopImmediatePropagation();}},true);
 document.addEventListener('akses:berubah',()=>{if(identity&&identity!==key()){sequence++;busy=false;waiting=false;sync();form.reset();g.FormGuard?.clean(form);identity='';}},true);
 g.TrackingInitialUI=Object.freeze({configure,hasInitial,save,sync});
})(window);
