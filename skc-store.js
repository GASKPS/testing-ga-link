(function(g){
'use strict';const A=g.Akses,columns='*,karyawan:karyawan(id,nik,nama,jabatan)';
const map=v=>({id:v.id,employeeId:v.karyawan_id,nik:v.karyawan.nik,nama:v.karyawan.nama,jabatan:v.karyawan.jabatan,tanggalCuti:v.tanggal_cuti,formCutiUrl:v.link_form_cuti,exitUrl:v.link_exit,status:v.status,tanggalDiambil:v.tanggal_diambil||'',namaPengambil:v.nama_pengambil,nikPengambil:v.nik_pengambil,namaPetugas:v.nama_petugas_pengambilan,diambilPada:v.diambil_pada,revision:v.versi});
const compare=(a,b)=>a.tanggalCuti.localeCompare(b.tanggalCuti)||a.nama.localeCompare(b.nama,'id-ID')||a.id.localeCompare(b.id);
const get=async id=>map(await A.one('pengambilan_skc',id,columns));
g.SkcStore=Object.freeze({
 async list(){return (await A.all('pengambilan_skc',columns,{},'tanggal_cuti')).map(map).sort(compare);},get,
 async create(f){const v=await A.rpc('tambah_skc',{p_data:{karyawan_id:f.employeeId,tanggal_cuti:f.tanggalCuti,link_form_cuti:g.DeviceDomain.proofUrl(f.formCutiUrl),link_exit:g.DeviceDomain.proofUrl(f.exitUrl)}},true);return get(v.id);},
 async collect(id,expectedRevision){await A.rpc('ambil_skc',{p_id:id,p_versi:expectedRevision},true);return get(id);}
});
g.SkcDomain=Object.freeze({driveLink:g.DeviceDomain.proofUrl,compare});
})(window);
