(function(g){
 'use strict';
 const A=g.Akses,S=g.OfficeStore,$=id=>document.getElementById(id);
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let request=0,busy=false;
 function option(o){return '<option value="'+e(o.id)+'">'+e(o.nama)+(o.aktif?'':' (Nonaktif)')+'</option>';}
 function fill(select,selected,all=false){
  const rows=S.records.filter(o=>all||o.aktif||o.id===selected);
  select.innerHTML='<option value="">'+(all?'Semua office':'Pilih office')+'</option>'+rows.map(option).join('');
  select.value=selected||'';
 }
 async function documentOffice(selected){
  await S.list();
  const id=A.administrator()?(selected||A.profile?.office_id||''):A.profile?.office_id||'';
  fill($('doc-source'),id);$('doc-source').disabled=!A.administrator();
  $('doc-source-help').textContent=A.administrator()?'Pilih office dokumen.':'Office mengikuti akun Anda.';
 }
 async function accountOffice(person){
  $('ga-access-office').disabled=true;$('ga-access-save').disabled=true;
  try{await S.list();}finally{if($('ga-access-form').dataset.userId===person.id)$('ga-access-save').disabled=false;}
  if($('ga-access-form').dataset.userId!==person.id)return;
  fill($('ga-access-office'),person.office_id);
  $('ga-access-office').disabled=!A.administrator();
 }
 async function trackingOffice(){
  const seq=++request;
  if(!A.profile){$('tracking-office-notice').hidden=true;return;}
  await S.list();if(seq!==request)return;
  const select=$('filter-office'),old=select.value;
  if(A.administrator()){fill(select,old,true);select.disabled=false;}
  else{
   const id=A.profile.office_id,office=S.records.find(o=>o.id===id);
   select.innerHTML='<option value="'+e(id||'')+'">'+e(office?.nama||'Office belum ditetapkan')+'</option>';select.disabled=true;
  }
  const notice=$('tracking-office-notice');notice.hidden=A.administrator()||!!A.profile.office_id;
  notice.textContent='Office akun belum ditetapkan. Hubungi Administrator untuk membuka dan mencatat dokumen. Menu lain tetap dapat digunakan.';
  if($('ga-profile-office'))$('ga-profile-office').textContent=A.administrator()?'Akses dokumen: semua office':'Office: '+(S.name(A.profile.office_id)||'Belum ditetapkan');
 }
 function drawManager(){
  $('ga-office-list').innerHTML=S.records.map(o=>'<li class="ga-user-row"><div><strong>'+e(o.nama)+'</strong><span class="ga-user-status'+(o.aktif?'':' inactive')+'">'+(o.aktif?'Aktif':'Nonaktif')+'</span></div><button class="ga-profile-button" type="button" data-toggle-office="'+e(o.id)+'">'+(o.aktif?'Nonaktifkan':'Aktifkan')+'</button></li>').join('');
 }
 async function loadManager(){if(!A.administrator())return;await S.list();drawManager();}
 $('ga-office-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]'),msg=$('ga-office-message');
  if(busy||!A.administrator()||!form.reportValidity())return;busy=true;button.disabled=true;msg.hidden=false;
  try{await S.create($('ga-office-name').value,$('ga-office-active').checked);form.reset();g.FormGuard?.clean(form);await loadManager();await trackingOffice();msg.textContent='Office ditambahkan. Tetapkan office akun melalui tab Hak Akses.';}
  catch(error){msg.textContent=error.message;}finally{busy=false;button.disabled=false;}
 });
 $('ga-office-list').addEventListener('click',async event=>{
  const button=event.target.closest('[data-toggle-office]');if(!button||busy||!A.administrator())return;
  const office=S.records.find(o=>o.id===button.dataset.toggleOffice);if(!office)return;
  busy=true;button.disabled=true;const msg=$('ga-office-message');msg.hidden=false;
  try{await S.setActive(office,!office.aktif);await loadManager();await trackingOffice();msg.textContent=office.nama+' '+(office.aktif?'dinonaktifkan. Dokumen lama tetap dapat dilihat dan dikelola.':'diaktifkan.');}
  catch(error){msg.textContent=error.message;}finally{busy=false;button.disabled=false;}
 });
 g.OfficeUI=Object.freeze({documentOffice,accountOffice,loadManager,name:id=>S.name(id)});
 document.addEventListener('akses:berubah',()=>trackingOffice().catch(err=>g.PortalUI.showToast(err.message)));
 document.addEventListener('data:muat-ulang',()=>trackingOffice().catch(err=>g.PortalUI.showToast(err.message)));
 A.ready.then(()=>trackingOffice()).catch(err=>g.PortalUI.showToast(err.message));
})(window);
