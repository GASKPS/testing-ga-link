/* Pending metadata excludes document contents. Retries reuse an immutable payload. */
(function(g){
 'use strict';const A=g.Akses,D=g.TrackingInputDomain,M=g.TrackingSheetDomain,prefix='ga:tracking-move29:';
 let identity='',generation=0,pending=null,busy=false;
 const owner=()=>A.profile?.id||'',key=()=>{const p=A.profile;return p?[p.id,p.peran,p.office_id,p.aktif,p.akses_portal].join('|'):'';};
 function marker(p){try{if(p)g.sessionStorage.setItem(prefix+p.owner,JSON.stringify({owner:p.owner,key:p.key,count:p.count,created:p.created}));else g.sessionStorage.removeItem(prefix+owner());return true;}catch{return false;}}
 function restore(){try{const p=JSON.parse(g.sessionStorage.getItem(prefix+owner())||'null');if(p&&p.owner===owner()&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(p.key)&&Number.isInteger(p.count)&&p.count>0&&p.count<=M.maxRows)return {...p,rows:null};}catch{}return null;}
 function sync(){if(identity!==key()){identity=key();generation++;busy=false;pending=owner()?restore():null;}}
 function requireWriter(){sync();if(!owner()||!A.canWrite())throw new Error('Akun tidak memiliki akses mencatat perpindahan.');}
 const current=(seq,id)=>generation===seq&&identity===key()&&owner()===id&&A.canWrite();
 function stale(){const err=new Error('Akun berubah. Muat kembali daftar dokumen.');err.stale=true;return err;}
 function uuid(){if(g.crypto.randomUUID)return g.crypto.randomUUID();const b=g.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const x=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return [x.slice(0,8),x.slice(8,12),x.slice(12,16),x.slice(16,20),x.slice(20)].join('-');}
 function receipt(value,p){
  if(value?.pemilik!==p.owner||value?.kunci!==p.key||value?.jenis!=='pindah'||value?.jumlah!==p.count||!Array.isArray(value.dokumen)||value.dokumen.length!==p.count)throw new Error('Server belum mengonfirmasi seluruh perpindahan. Periksa penyimpanan.');
  const expected=p.rows?new Map(p.rows.map(row=>[row.id,row])):null,ids=new Set();
  for(const doc of value.dokumen){if(typeof doc?.id!=='string'||!doc.id||ids.has(doc.id)||!Number.isInteger(doc.versi)||!g.TrackingDomain.STATUS.includes(doc.status_terakhir)||typeof doc.posisi_sekarang!=='string'||!doc.posisi_sekarang.trim())throw new Error('Hasil perpindahan belum lengkap. Periksa penyimpanan.');if(expected&&(!expected.has(doc.id)||doc.versi<=expected.get(doc.id).versi))throw new Error('Hasil perpindahan tidak sesuai kiriman. Periksa penyimpanan.');D.date(doc.perpindahan_terakhir);ids.add(doc.id);}
  return value;
 }
 async function run(check){
  requireWriter();if(busy)throw new Error('Penyimpanan sedang diproses.');if(!pending)throw new Error('Tidak ada kiriman yang perlu diperiksa.');if(!check&&!pending.rows)throw new Error('Periksa penyimpanan terakhir sebelum mengisi ulang.');
  const seq=generation,p=pending;busy=true;
  try{const value=check?await A.rpc('status_input_tracking29',{p_jenis:'pindah',p_kunci:p.key,p_pemilik:p.owner},true):await A.rpc('simpan_perpindahan_excel29',{p_rows:p.rows,p_kunci:p.key,p_pemilik:p.owner},true);if(!current(seq,p.owner))throw stale();if(check&&value===null){marker(null);pending=null;return null;}const result=receipt(value,p);marker(null);pending=null;return result;}
  catch(err){if(!current(seq,p.owner))throw stale();if(!check&&D.definite(err)){marker(null);pending=null;}throw err;}
  finally{if(seq===generation)busy=false;}
 }
 function save(rows){requireWriter();if(pending)throw new Error('Periksa kiriman sebelumnya dahulu.');if(!Array.isArray(rows)||!rows.length||rows.length>M.maxRows||new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Isi 1 sampai 500 dokumen yang berbeda.');pending={owner:owner(),key:uuid(),count:rows.length,created:new Date().toISOString(),rows:JSON.parse(JSON.stringify(rows))};if(!marker(pending)){pending=null;throw new Error('Browser belum dapat menyimpan kunci kiriman. Izinkan penyimpanan sesi atau buka Portal di tab browser lain.');}return run(false);}
 async function list(){await A.ready;requireWriter();if(!A.administrator()&&!A.profile.office_id)throw new Error('Office akun belum ditetapkan. Hubungi Administrator.');const seq=generation,id=owner(),rows=await A.all('dokumen','id,kode,nama_dokumen,tanggal_masuk,jenis_dokumen,jenis_lainnya,nomor_dokumen,bu,office_id,status_terakhir,posisi_sekarang,perpindahan_terakhir,versi',A.administrator()?{}:{office_id:A.profile.office_id},'id');if(!current(seq,id))throw stale();return rows.map(d=>({id:d.id,kode:d.kode,namaDokumen:d.nama_dokumen,tanggalMasuk:d.tanggal_masuk,jenisDokumen:d.jenis_dokumen,jenisDokumenLainnya:d.jenis_lainnya,nomorDokumen:d.nomor_dokumen,bu:d.bu,officeId:d.office_id,asalDokumen:g.OfficeStore.name(d.office_id),statusTerakhir:d.status_terakhir,posisiSekarang:d.posisi_sekarang,perpindahanTerakhir:d.perpindahan_terakhir,revision:d.versi}));}
 document.addEventListener('akses:berubah',sync);sync();
 g.TrackingSheetStore=Object.freeze({list,save,retry:()=>run(false),check:()=>run(true),get pending(){sync();return pending?{owner:pending.owner,count:pending.count,key:pending.key,canRetry:!!pending.rows}:null;}});
})(window);
