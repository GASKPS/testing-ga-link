(function(g){
'use strict';const A=g.Akses;
const CONDITIONS=['Baik','Rusak Ringan','Rusak Berat'];
const TYPES=['HT','HP','PC','Printer'];
function proofUrl(value){
 const v=String(value||'').trim();if(!v)return '';let u;
 try{u=new URL(v);}catch{throw new Error('Isi link Google Drive yang valid atau kosongkan.');}
 if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.username||u.password||u.port||(u.pathname==='/'&&!u.search)||v.length>3000)throw new Error('Gunakan link https://drive.google.com/.');
 return u.href;
}
const sameHolder=(a,b)=>a.kind===b.kind&&(a.kind==='admin'||a.employeeId===b.employeeId);
const person=v=>!v||v.jenis==='admin'?{kind:'admin',nik:'',nama:'Admin/Gudang'}:{kind:'employee',employeeId:v.karyawan_id||v.id,nik:v.nik,nama:v.nama,jabatan:v.jabatan};
const columns='*,pemegang:karyawan(id,nik,nama,jabatan)';
const map=v=>({id:v.id,aktif:v.aktif!==false,jenis:v.jenis,nomor:v.nomor_seri,merek:v.merek,kondisi:v.kondisi,pemegang:person(v.pemegang),pemegangAwal:person(v.pemegang_awal),revision:v.versi,tanggalTerakhir:v.tanggal_serah_terima_terakhir,history:[]});
function holderId(h){if(h?.kind==='admin')return null;if(h?.kind==='employee'&&h.employeeId)return h.employeeId;throw new Error('Pilih karyawan dari daftar atau Admin/Gudang.');}
const fields=f=>({jenis:f.jenis,nomor_seri:f.nomor,merek:f.merek,kondisi:f.kondisi});
const mapEvent=x=>({id:x.id,urutan:x.urutan,tanggal:x.tanggal,dari:person(x.pemegang_asal),kepada:person(x.penerima),kondisiSebelum:x.kondisi_sebelum,kondisi:x.kondisi,buktiUrl:x.link_bukti,catatan:x.catatan,namaPetugas:x.nama_petugas,dicatatPada:x.dicatat_pada});
async function historyPage(id,page=1){const h=await A.rpc('halaman_riwayat',{p_jenis:'perangkat',p_id:id,p_halaman:page});return {history:h.data.map(mapEvent),historyTotal:h.total,historyPage:h.halaman};}
async function get(id){const [v,h]=await Promise.all([A.one('perangkat',id,columns),historyPage(id)]);return {...map(v),...h};}
g.DeviceDomain=Object.freeze({CONDITIONS,TYPES,today:g.TrackingDomain.today,dayNumber:g.TrackingDomain.dayNumber,proofUrl,sameHolder});
g.DeviceStore=Object.freeze({historyPage,
 async list(){return (await A.all('perangkat',columns,{},'dibuat_pada')).map(map).reverse();},get,
 async heldHt(employeeId){return (await A.all('perangkat',columns,{pemegang_id:employeeId,jenis:'HT'})).map(map);},
 async heldAssets(employeeId){if(!employeeId)throw new Error('Karyawan belum dipilih.');return (await A.all('perangkat','id,jenis,nomor_seri',{pemegang_id:employeeId},'jenis')).map(v=>({id:v.id,aktif:v.aktif!==false,jenis:v.jenis,nomor:v.nomor_seri}));},
 async create(f){if(!A.superAdmin())throw new Error('Hanya Super Admin yang boleh menambah perangkat.');const v=await A.rpc('simpan_perangkat',{p_data:{...fields(f),pemegang_id:holderId(f.pemegang)}},true);return get(v.id);},
 async update(id,f){if(!A.superAdmin())throw new Error('Hanya Super Admin yang boleh mengedit perangkat.');await A.rpc('simpan_perangkat',{p_id:id,p_versi:f.expectedRevision,p_data:fields(f)},true);return get(id);},
 async handover(id,f){await A.rpc('catat_serah_terima',{p_id:id,p_versi:f.expectedRevision,p_data:{penerima_id:holderId(f.penerima),tanggal:f.tanggal,kondisi:f.kondisi,link_bukti:proofUrl(f.buktiUrl),catatan:f.catatan}},true);return get(id);}
});
})(window);
