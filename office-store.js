(function(g){
 'use strict';
 const A=g.Akses;
 let records=[];
 g.OfficeStore=Object.freeze({
  get records(){return records;},
  async list(){records=await A.all('kantor','*',{},'nama');return records;},
  async create(name,active=true){return A.rpc('simpan_office',{p_data:{nama:name.trim(),aktif:active}},true);},
  async setActive(office,active){return A.rpc('simpan_office',{p_id:office.id,p_versi:office.versi,p_data:{nama:office.nama,aktif:active}},true);},
  name(id){return records.find(o=>o.id===id)?.nama||'';}
 });
})(window);
