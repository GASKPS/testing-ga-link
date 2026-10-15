/* Draft SKC tetap di memori. Penyimpanan sesi hanya berisi kunci dan jumlah kiriman. */
(function(g){
 'use strict';const A=g.Akses,D=g.SkcInputDomain,I=g.TrackingInputDomain,prefix='ga:skc-input32:';
 let identity='',generation=0,pending=null,busy=false;
 const owner=()=>A.profile?.id||'',key=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 function marker(value){try{if(value)g.sessionStorage.setItem(prefix+value.owner,JSON.stringify({owner:value.owner,key:value.key,count:value.count,created:value.created}));else g.sessionStorage.removeItem(prefix+owner());return true;}catch{return false;}}
 function restore(){try{const p=JSON.parse(g.sessionStorage.getItem(prefix+owner())||'null');if(p?.owner===owner()&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(p.key)&&Number.isInteger(p.count)&&p.count>0&&p.count<=D.maxRows)return {...p,rows:null};}catch{}return null;}
 function sync(){if(identity!==key()){identity=key();generation++;busy=false;pending=owner()?restore():null;}}
 function requireWriter(){sync();if(!owner()||!A.canWrite())throw new Error('Akun tidak memiliki akses menambah SKC.');}
 const current=(seq,id)=>seq===generation&&identity===key()&&owner()===id&&A.canWrite();
 function stale(){const error=new Error('Akun berubah. Buka kembali input SKC.');error.stale=true;return error;}
 function receipt(value,p){
  if(value?.pemilik!==p.owner||value?.kunci!==p.key||value?.jumlah!==p.count||!Array.isArray(value.skc)||value.skc.length!==p.count)throw new Error('Server belum mengonfirmasi seluruh SKC. Periksa penyimpanan.');
  const ids=new Set(),expected=p.rows?new Set(p.rows.map(row=>D.normal(row.nik)+'|'+row.tanggal_cuti)):null,seen=new Set();
  for(const row of value.skc){if(typeof row?.id!=='string'||!row.id||ids.has(row.id)||typeof row.karyawan_id!=='string'||!row.karyawan_id||typeof row.nik!=='string'||!row.nik.trim())throw new Error('Hasil penyimpanan SKC belum lengkap.');I.date(row.tanggal_cuti);const pair=D.normal(row.nik)+'|'+row.tanggal_cuti;if(seen.has(pair)||expected&&!expected.has(pair))throw new Error('Hasil penyimpanan SKC tidak sesuai kiriman.');ids.add(row.id);seen.add(pair);}
  return value;
 }
 async function run(check){
  requireWriter();if(busy)throw new Error('Penyimpanan SKC sedang diproses.');if(!pending)throw new Error('Tidak ada kiriman SKC yang perlu diperiksa.');if(!check&&!pending.rows)throw new Error('Periksa penyimpanan terakhir sebelum mengisi ulang.');
  const seq=generation,p=pending;busy=true;
  try{
   const value=await A.rpc(check?'status_input_skc32':'simpan_skc_excel32',{p_kunci:p.key,p_pemilik:p.owner,...(check?{}:{p_rows:p.rows})},true);
   if(!current(seq,p.owner))throw stale();if(check&&value===null){marker(null);pending=null;return null;}
   const result=receipt(value,p);marker(null);pending=null;return result;
  }catch(error){if(!current(seq,p.owner))throw stale();if(!check&&I.definite(error)){marker(null);pending=null;}if(['PGRST202','42883'].includes(error.code))throw new Error('Pasang SQL Pembaruan32 untuk menyimpan SKC melalui Excel.');throw error;}
  finally{if(seq===generation)busy=false;}
 }
 function uuid(){if(g.crypto.randomUUID)return g.crypto.randomUUID();const bytes=g.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const value=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return [value.slice(0,8),value.slice(8,12),value.slice(12,16),value.slice(16,20),value.slice(20)].join('-');}
 function save(rows){
  requireWriter();if(pending)throw new Error('Periksa kiriman SKC sebelumnya dahulu.');if(!Array.isArray(rows)||!rows.length||rows.length>D.maxRows)throw new Error('Isi 1 sampai 100 SKC.');
  pending={owner:owner(),key:uuid(),count:rows.length,created:new Date().toISOString(),rows:JSON.parse(JSON.stringify(rows))};
  if(!marker(pending)){pending=null;throw new Error('Browser belum dapat menyimpan kunci kiriman. Izinkan penyimpanan sesi atau buka Portal di tab browser lain.');}return run(false);
 }
 document.addEventListener('akses:berubah',sync);sync();
 g.SkcInputStore=Object.freeze({save,retry:()=>run(false),check:()=>run(true),get pending(){sync();return pending?{owner:pending.owner,key:pending.key,count:pending.count,canRetry:!!pending.rows}:null;}});
})(window);
