/* Only a receipt key is stored in sessionStorage. Document drafts stay in memory. */
(function(g){
 'use strict';
 const A=g.Akses,D=g.TrackingInputDomain,prefix='ga:tracking-input28:';
 let identity='',generation=0,preferenceRevision=0,mode='form',loaded=false,loading=null,preferenceBusy=false,pending=null,batchBusy=false;
 const signature=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 const owner=()=>A.profile?.id||'';
 function changed(){document.dispatchEvent(new CustomEvent('tracking:input-mode',{detail:{mode}}));}
 function marker(value){try{const key=prefix+(value?.owner||owner());if(value)g.sessionStorage.setItem(key,JSON.stringify({owner:value.owner,key:value.key,count:value.count,created:value.created}));else g.sessionStorage.removeItem(key);}catch{}}
 function restore(){
  try{const value=JSON.parse(g.sessionStorage.getItem(prefix+owner())||'null');if(value&&value.owner===owner()&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value.key)&&Number.isInteger(value.count)&&value.count>0&&value.count<=D.maxRows)return {...value,rows:null};}catch{}
  return null;
 }
 function sync(){const next=signature();if(identity!==next){identity=next;generation++;mode='form';loaded=false;loading=null;preferenceBusy=false;batchBusy=false;pending=owner()?restore():null;changed();}return generation;}
 function requireWriter(){sync();if(!owner()||!A.canWrite())throw new Error('Akun tidak memiliki akses mencatat dokumen.');}
 function current(seq,id){return seq===generation&&signature()===identity&&owner()===id&&A.canWrite();}
 function stale(){const error=new Error('Akun berubah. Buka kembali input dokumen.');error.stale=true;return error;}
 async function load(){
  await A.ready;sync();if(!owner()||!A.canWrite())return mode;if(loaded)return mode;if(loading)return loading;
  const seq=generation,id=owner(),revision=preferenceRevision;
  loading=(async()=>{try{const value=await A.rpc('preferensi_input_dokumen28',{});if(!current(seq,id)||revision!==preferenceRevision)return mode;if(value?.pemilik!==id||!['form','excel'].includes(value?.mode))throw new Error('Preferensi input belum dapat dibaca.');mode=value.mode;loaded=true;changed();return mode;}finally{if(seq===generation)loading=null;}})();
  return loading;
 }
 async function setMode(next){
  requireWriter();if(!['form','excel'].includes(next))throw new Error('Pilih Form atau Excel.');if(preferenceBusy)throw new Error('Pilihan input sedang disimpan.');
  const seq=generation,id=owner();preferenceRevision++;preferenceBusy=true;
  try{const value=await A.rpc('simpan_preferensi_input_dokumen28',{p_mode:next,p_pemilik:id},true);if(!current(seq,id))throw stale();if(value?.pemilik!==id||value?.mode!==next)throw new Error('Pilihan input belum dikonfirmasi.');mode=next;loaded=true;changed();return mode;}
  finally{if(seq===generation)preferenceBusy=false;}
 }
 function uuid(){
  if(g.crypto.randomUUID)return g.crypto.randomUUID();
  const bytes=g.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
 }
 function receipt(value,p){
  if(value?.pemilik!==p.owner||value?.kunci!==p.key||value?.jumlah!==p.count||!Array.isArray(value?.dokumen)||value.dokumen.length!==p.count||value.dokumen.some(doc=>!doc||typeof doc.id!=='string'||!doc.id)||new Set(value.dokumen.map(doc=>doc.id)).size!==p.count)throw new Error('Server belum mengonfirmasi seluruh dokumen. Periksa penyimpanan sebelum melanjutkan.');
  return value;
 }
 async function run(check){
  requireWriter();if(batchBusy)throw new Error('Penyimpanan sedang diproses.');if(!pending)throw new Error('Tidak ada penyimpanan yang perlu diperiksa.');if(!check&&!pending.rows)throw new Error('Periksa penyimpanan terakhir sebelum mengisi ulang.');
  const seq=generation,p=pending;batchBusy=true;
  try{
   const value=check?await A.rpc('status_input_dokumen28',{p_kunci:p.key,p_pemilik:p.owner},true):await A.rpc('simpan_dokumen_excel28',{p_rows:p.rows,p_kunci:p.key,p_pemilik:p.owner},true);
   if(!current(seq,p.owner))throw stale();
   if(check&&value===null){marker(null);pending=null;return null;}
   const result=receipt(value,p);marker(null);pending=null;return result;
  }catch(error){
   if(!current(seq,p.owner))throw stale();
   if(!check&&D.definite(error)){marker(null);pending=null;}
   throw error;
  }finally{if(seq===generation)batchBusy=false;}
 }
 function save(rows){
  requireWriter();if(pending)throw new Error('Periksa penyimpanan sebelumnya dahulu.');if(!Array.isArray(rows)||!rows.length||rows.length>D.maxRows)throw new Error('Isi 1 sampai 100 dokumen.');
  pending={owner:owner(),key:uuid(),count:rows.length,created:new Date().toISOString(),rows:JSON.parse(JSON.stringify(rows))};marker(pending);return run(false);
 }
 document.addEventListener('akses:berubah',()=>{sync();load().catch(()=>{});});
 g.TrackingInputStore=Object.freeze({load,setMode,save,retry:()=>run(false),check:()=>run(true),get mode(){sync();return mode;},get pending(){sync();return pending?{key:pending.key,owner:pending.owner,count:pending.count,canRetry:!!pending.rows}:null;}});
 sync();load().catch(()=>{});
})(window);
