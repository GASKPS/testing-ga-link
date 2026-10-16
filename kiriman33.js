/* Receipts survive lost responses. Only a request marker is kept in sessionStorage. */
(function(g){'use strict';
 const A=g.Akses,clone=v=>JSON.parse(JSON.stringify(v));
 const identity=()=>A.profile?[A.profile.id,A.profile.peran,A.profile.office_id,A.profile.aktif,A.profile.akses_portal].join('|'):'';
 function uuid(){if(g.crypto?.randomUUID)return g.crypto.randomUUID();const b=new Uint8Array(16);g.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
 function create(area,config){let signature='',generation=0,pending=null,busy=false;
  const storageKey=()=>`ga-request33:${area}:${A.profile?.id||''}`;
  function marker(){try{if(pending)g.sessionStorage.setItem(storageKey(),JSON.stringify({...pending,payload:undefined}));else g.sessionStorage.removeItem(storageKey());return true;}catch{return false;}}
  function sync(){const next=identity();if(next===signature)return;signature=next;generation++;busy=false;pending=null;
   if(!A.profile)return;try{const saved=JSON.parse(g.sessionStorage.getItem(storageKey())||'null');if(saved&&saved.owner===A.profile.id&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(saved.key)&&Number.isInteger(saved.count)&&saved.count>0&&saved.count<=10000)pending={owner:saved.owner,key:saved.key,office:saved.office||null,kind:saved.kind,count:saved.count||0,time:saved.time,payload:null};}catch{}
  }
  function info(){sync();return pending?Object.freeze({owner:pending.owner,key:pending.key,office:pending.office,kind:pending.kind,count:pending.count,time:pending.time,canRetry:pending.payload!==null}):null;}
  function clear(){pending=null;marker();}
  function validate(value,p){if(value?.pemilik!==p.owner||value?.kunci!==p.key||!config.valid(value,p))throw new Error('Konfirmasi penyimpanan belum lengkap. Periksa penyimpanan.');return value;}
  async function run(action,office,kind,payload){sync();if(busy)throw new Error('Penyimpanan sebelumnya masih berjalan.');if(!A.profile?.aktif||!A.profile?.akses_portal)throw new Error('Akses Portal GA tidak aktif.');
   if(action==='save'){if(pending)throw new Error('Periksa kiriman sebelumnya sebelum membuat kiriman baru.');pending={owner:A.profile.id,key:uuid(),office,kind,payload:clone(payload),count:Array.isArray(payload)?payload.length:payload.baris?.length||1,time:new Date().toISOString()};if(!marker()){pending=null;throw new Error('Browser belum dapat menyimpan kunci kiriman. Izinkan penyimpanan sesi atau buka portal pada tab lain.');}}
   if(!pending)throw new Error('Tidak ada kiriman yang perlu diperiksa.');if(action==='retry'&&pending.payload===null)throw new Error('Isian lama tidak disimpan di browser. Gunakan Periksa penyimpanan.');
   const p=pending,seq=generation;busy=true;
   try{const value=await config.call(action,p);if(seq!==generation||signature!==identity()){const err=new Error('Akun berubah. Buka kembali menu dengan akun yang aktif.');err.stale=true;throw err;}
    if(action==='check'&&value===null){clear();return null;}const receipt=validate(value,p);clear();return receipt;
   }catch(err){if(seq===generation&&!err.stale&&err.code&&/^(P0001|22|23|40001|42501|PGRST20[25]|42P01|42883)/.test(err.code)){clear();}throw err;
   }finally{if(seq===generation)busy=false;}
  }
  document.addEventListener('akses:berubah',sync);
  return Object.freeze({get pending(){return info();},get busy(){sync();return busy;},save:(office,kind,payload)=>run('save',office,kind,payload),retry:()=>run('retry'),check:()=>run('check')});
 }
 g.Kiriman33=Object.freeze({create,uuid,identity});
})(window);
