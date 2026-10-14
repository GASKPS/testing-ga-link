(function(g){
'use strict';const A=g.Akses;
const identity='id,aktif,pernah_digunakan,nik,nama,jabatan,jabatan_id,golongan,nomor_hp,kamar_mess,versi,data_jabatan:jabatan(id,nama,urutan),tanggal_efektif_kerja,periode_tahunan:pengaturan_tahunan(karyawan_id)';
const map=v=>({id:v.id,aktif:v.aktif!==false,pernahDigunakan:!!v.pernah_digunakan,nik:v.nik,nama:v.nama,jabatan:v.data_jabatan?.nama||v.jabatan,jabatanId:v.jabatan_id,urutan:v.data_jabatan?.urutan??null,golongan:v.golongan,noHp:v.nomor_hp,kamarMess:v.kamar_mess,foto:v.foto||'',fotoPath:v.foto_path||'',tanggalEfektifKerja:v.tanggal_efektif_kerja||'',tanggalEfektifTerkunci:Array.isArray(v.periode_tahunan)?v.periode_tahunan.length>0:!!v.periode_tahunan,revision:v.versi});
const fields=f=>({nik:f.nik,nama:f.nama,jabatan_id:f.jabatanId,golongan:f.golongan,nomor_hp:f.noHp,kamar_mess:f.kamarMess,tanggal_efektif_kerja:f.tanggalEfektifKerja||null});
const compare=(a,b)=>(a.urutan??Infinity)-(b.urutan??Infinity)||a.nama.localeCompare(b.nama,'id-ID',{sensitivity:'base'})||a.id.localeCompare(b.id);
async function save(id,f){
 if(!A.superAdmin())throw new Error('Hanya Super Admin yang boleh mengelola karyawan.');
 const data=fields(f);let path='';
 if(f.photoEdited){path=f.photoBlob?await g.FotoKaryawan.upload(f.photoBlob):'';data.foto_path=path;}
 let result;
 try{result=await A.rpc('simpan_karyawan',{p_data:data,...(id?{p_id:id,p_versi:f.expectedRevision}:{})},true);}
 catch(err){if(path&&g.FotoKaryawan.certainFailure(err))try{await g.FotoKaryawan.remove(path);}catch{}throw err;}
 if(f.photoEdited&&f.oldPhotoPath&&f.oldPhotoPath!==path)try{await g.FotoKaryawan.remove(f.oldPhotoPath);}catch{}
 return map(result);
}
g.EmployeeStore=Object.freeze({compare,
 async list({photos=false}={}){const rows=(await A.all('karyawan',identity+(photos?',foto,foto_path':''),{},'nama')).map(map).sort(compare);return photos?g.FotoKaryawan.hydrate(rows):rows;},
 async get(id){const row=map(await A.one('karyawan',id,identity+',foto,foto_path'));return(await g.FotoKaryawan.hydrate([row]))[0];},
 async create(f){return save(null,f);},async update(id,f){return save(id,f);}
});
})(window);
