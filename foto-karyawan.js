(function(g){
'use strict';
const A=g.Akses,bucket='foto_karyawan',cache=new Map(),maxBytes=200*1024;
async function prepare(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Pilih foto JPG, PNG, atau WebP maksimal 12 MB.');
 const image=new Image(),url=URL.createObjectURL(file);
 try{
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Foto tidak dapat dibaca.'));image.src=url;});
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('Ukuran foto tidak valid.');
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  if(!context)throw new Error('Peramban belum mendukung pengolahan foto.');
  let side=900;
  for(let step=0;step<6;step++,side=Math.floor(side*.78)){
   const scale=Math.min(1,side/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.74,.62]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=maxBytes)return blob;}
  }
  throw new Error('Foto belum dapat diperkecil. Pilih foto lain.');
 }finally{URL.revokeObjectURL(url);}
}
async function upload(blob){
 if(!A.superAdmin())throw new Error('Foto karyawan dikelola Super Admin.');
 if(!blob||blob.size>maxBytes)throw new Error('Foto belum dikompres.');
 const client=await A.requireClient(),path=A.profile.id+'/'+crypto.randomUUID()+'.jpg';
 const {error}=await client.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw new Error(A.errorText(error));return path;
}
async function remove(path){if(!path)return;const client=await A.requireClient();await client.storage.from(bucket).remove([path]);cache.delete(path);}
function certainFailure(err){const code=String(err?.code||'');return /^[0-9A-Z]{5}$/.test(code)&&!code.startsWith('08')&&code!=='40003';}
async function urls(paths){
 const client=await A.requireClient(),unique=[...new Set(paths.filter(Boolean))],missing=unique.filter(p=>!cache.has(p)||cache.get(p).until<Date.now());
 if(missing.length){const {data,error}=await client.storage.from(bucket).createSignedUrls(missing,3600);if(error)throw new Error('Foto karyawan belum dapat dimuat. Muat ulang untuk mencoba kembali.');for(const row of data||[])if(row.signedUrl)cache.set(row.path,{url:row.signedUrl,until:Date.now()+3000000});}
 return Object.fromEntries(unique.map(p=>[p,cache.get(p)?.url||'']));
}
async function hydrate(rows){const paths=rows.map(r=>r.fotoPath),map=paths.some(Boolean)?await urls(paths):{};return rows.map(r=>({...r,foto:r.fotoPath?map[r.fotoPath]||'':r.foto||''}));}
async function migrate(progress){
 if(!A.superAdmin())throw new Error('Migrasi foto khusus Super Admin dan Administrator.');
 const client=await A.requireClient();let last='',count=0;
 while(true){let q=client.from('karyawan').select('id,versi,foto,foto_path,nama').neq('foto','').order('id').limit(10);if(last)q=q.gt('id',last);const {data,error}=await q;if(error)throw new Error(A.errorText(error));if(!data.length)break;
  for(const person of data){last=person.id;progress?.({count,name:person.nama});
   if(!/^data:image\/(jpeg|png|webp);base64,/.test(person.foto))throw new Error('Foto '+person.nama+' perlu diganti melalui Edit Karyawan. Format lama tidak dapat dimigrasikan. Foto aslinya tetap tersimpan.');
   const blob=await prepare(await (await fetch(person.foto)).blob()),path=await upload(blob);
   try{await A.rpc('simpan_foto_karyawan',{p_id:person.id,p_versi:person.versi,p_path:path},true);}catch(err){if(certainFailure(err))try{await remove(path);}catch{}throw new Error('Migrasi berhenti pada '+person.nama+': '+err.message+' Foto lama tidak dihapus sebelum penyimpanan berhasil.');}
   count++;progress?.({count,name:person.nama});
  }
 }
 document.dispatchEvent(new CustomEvent('employees:changed'));return count;
}
g.FotoKaryawan=Object.freeze({prepare,upload,remove,certainFailure,urls,hydrate,migrate,maxBytes});
document.addEventListener('akses:berubah',()=>{if(!A.profile)cache.clear();});
})(window);
