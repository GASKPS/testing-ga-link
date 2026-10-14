(function(g){
'use strict';const A=g.Akses,bucket='logo_link_kerja';
function url(value,optional=false){const raw=String(value||'').trim();if(!raw&&optional)return '';let u;try{u=new URL(raw);}catch{throw new Error('Isi alamat link lengkap dengan http:// atau https://.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password||/\s/.test(raw))throw new Error('Alamat link harus berupa http:// atau https:// yang valid.');return raw;}
async function list(){const rows=await A.all('link_kerja','*',{},'urutan'),client=await A.requireClient(),paths=[...new Set(rows.map(v=>v.logo_path).filter(Boolean))];let logos=new Map();if(paths.length){const {data,error}=await client.storage.from(bucket).createSignedUrls(paths,3600);if(error)throw new Error('Logo link belum dapat dimuat. Coba muat ulang.');logos=new Map(data.map(v=>[v.path,v.signedUrl||'']));}return rows.map(v=>({...v,logoUrl:logos.get(v.logo_path)||''}));}
async function prepare(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Pilih logo JPG, PNG, atau WebP, maksimal 12 MB.');
 const image=await createImageBitmap(file);try{const scale=Math.min(1,320/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob||blob.size>204800)throw new Error('Logo terlalu besar. Gunakan gambar yang lebih sederhana.');return blob;}finally{image.close();}
}
async function remove(path){if(!path)return;const client=await A.requireClient(true);const {error}=await client.storage.from(bucket).remove([path]);if(error)throw error;}
async function save(data,id,version,{blob=null,replaceLogo=false,oldPath=''}={}){
 if(!A.superAdmin())throw new Error('Hanya Administrator dan Super Admin yang boleh mengelola Link Kerja.');
 const owner=A.profile.id,client=await A.requireClient(true);let uploaded='';const payload={...data,tombol:data.tombol.map(v=>({...v,url:url(v.url,!data.aktif)}))};
 if(replaceLogo){if(blob){const extension=blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':'webp';uploaded=owner+'/'+crypto.randomUUID()+'.'+extension;const {error}=await client.storage.from(bucket).upload(uploaded,blob,{contentType:blob.type,upsert:false});if(error)throw new Error('Logo belum berhasil diunggah. Coba kembali.');}payload.logo_path=uploaded;}
 let result;try{if(A.profile?.id!==owner||!A.superAdmin())throw new Error('Sesi berubah. Buka kembali pengaturan link.');result=await A.rpc('simpan_link_kerja',{p_data:payload,p_id:id,p_versi:version},true);}catch(error){if(uploaded&&g.FotoKaryawan.certainFailure(error))try{await remove(uploaded);}catch{}throw error;}
 if(replaceLogo&&oldPath&&oldPath!==uploaded)try{await remove(oldPath);}catch{}
 return result;
}
g.LinkStore=Object.freeze({list,save,prepare,url});
})(window);
