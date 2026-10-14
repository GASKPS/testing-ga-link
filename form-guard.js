/* Unsaved changes stay in memory only. No draft data is stored in the browser. */
(function(g){
'use strict';
const baselines=new WeakMap(),forced=new WeakSet(),watched=new WeakSet();
const supported=f=>f instanceof HTMLFormElement&&!/search|filter|login/.test(f.id)&&!f.hasAttribute('data-no-guard');
function value(f){return JSON.stringify([...f.elements].filter(x=>!['submit','button','reset'].includes(x.type)&&!['ga-password-show'].includes(x.id)).map(x=>[x.name||x.id,x.type==='file'?[...x.files].map(f=>[f.name,f.size,f.lastModified]):['checkbox','radio'].includes(x.type)?x.checked:x.value]));}
function clean(f){if(supported(f)){baselines.set(f,value(f));forced.delete(f);}}
function forms(root=document){return root instanceof HTMLFormElement?[root]:[...root.querySelectorAll('form')];}
function dirty(f){return supported(f)&&(forced.has(f)||(baselines.has(f)&&baselines.get(f)!==value(f)));}
function visible(f){return !f.closest('[hidden]')&&(!f.closest('dialog')||f.closest('dialog').open)&&!document.getElementById('app-shell')?.hidden;}
function leave(root=document){const changes=forms(root).filter(f=>visible(f)&&dirty(f));if(!changes.length)return true;
 if(!g.confirm('Ada perubahan yang belum disimpan. Tinggalkan perubahan ini?'))return false;
 changes.forEach(f=>{f.reset();clean(f);});return true;
}
function observe(root){
 forms(root).filter(supported).forEach(f=>{if(watched.has(f))return;watched.add(f);clean(f);f.addEventListener('reset',()=>queueMicrotask(()=>clean(f)));});
 const dialogs=root instanceof HTMLDialogElement?[root]:[...root.querySelectorAll('dialog')];
 dialogs.forEach(d=>{if(watched.has(d))return;watched.add(d);const open=d.showModal.bind(d),close=d.close.bind(d);
  d.showModal=(...args)=>{open(...args);forms(d).forEach(clean);};
  d.close=(...args)=>{if(g.Akses&&!g.Akses.profile)forms(d).forEach(clean);if(leave(d))close(...args);};
  d.addEventListener('cancel',event=>{if(!leave(d))event.preventDefault();});
 });
}
document.addEventListener('focusin',event=>{const f=event.target.form;if(supported(f)&&!baselines.has(f))clean(f);},true);
// Programmatic picker changes are compared with the form snapshot on leaving.
document.addEventListener('click',event=>{
 const b=event.target.closest('button,a');if(!b)return;
 if(b.matches('[data-logout],[data-open-profile]')&&!leave()){event.preventDefault();event.stopImmediatePropagation();return;}
 if(b.matches('[data-profile-tab],[data-access-cancel],#ga-users-refresh,#ga-profile-back')){
  const root=b.matches('[data-access-cancel],#ga-users-refresh')?document.getElementById('ga-access-editor'):document.getElementById('profile-page');
  if(root&&!leave(root)){event.preventDefault();event.stopImmediatePropagation();}
 }
 if(b.id==='employee-photo-remove')forced.add(document.getElementById('employee-form'));
},true);
document.addEventListener('submit',event=>{if(event.target.id==='ga-users-search-form'&&!leave(document.getElementById('ga-access-editor'))){event.preventDefault();event.stopImmediatePropagation();}},true);
let lastHash=location.hash;
g.addEventListener('hashchange',event=>{if(!leave()){history.replaceState(null,'',location.pathname+location.search+lastHash);event.stopImmediatePropagation();return;}lastHash=location.hash;},true);
g.addEventListener('beforeunload',event=>{if(forms().some(f=>visible(f)&&dirty(f))){event.preventDefault();event.returnValue='';}});
observe(document);new MutationObserver(()=>observe(document)).observe(document.documentElement,{childList:true,subtree:true});
g.FormGuard=Object.freeze({clean,leave,dirty,touch:f=>{if(supported(f))forced.add(f);}});
})(window);
