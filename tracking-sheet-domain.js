(function(g){
 'use strict';
 const T=g.TrackingDomain,I=g.TrackingInputDomain,maxRows=500;
 const columns=[{key:'tanggal',label:'Tanggal perpindahan'},{key:'tujuan',label:'Tujuan / pemegang baru',max:140},{key:'status',label:'Status baru',options:T.STATUS},{key:'catatan',label:'Catatan',max:3000}];
 const clean=v=>String(v??'').trim(),normal=v=>clean(v).normalize('NFC').toLocaleLowerCase('id-ID').replace(/\s+/g,' '),head=v=>normal(v).replace(/[^a-z0-9]/g,'');
 const defaults=(doc,today)=>({tanggal:today,tujuan:'',status:doc.statusTerakhir,catatan:''});
 const same=(a,b)=>columns.every(col=>String(a[col.key]??'')===String(b[col.key]??''));
 function validate(changes,records,today){
  if(changes.size>maxRows)throw new Error('Maksimal 500 perubahan dalam satu penyimpanan. Gunakan filter untuk membagi pekerjaan.');
  const entries=[],issues=new Map(),byId=new Map(records.map(doc=>[doc.id,doc]));
  changes.forEach((draft,id)=>{
   const errors={},doc=byId.get(id),row=draft.values,data={id,versi:draft.doc.revision,tujuan:clean(row.tujuan),status:T.STATUS.find(value=>normal(value)===normal(row.status)),catatan:clean(row.catatan)};
   if(!doc)errors.conflict='Dokumen tidak tersedia lagi. Batalkan isian baris ini.';
   else if(T.isFinal(doc.statusTerakhir))errors.conflict='Dokumen sudah selesai. Batalkan isian baris ini.';
   else if(doc.revision!==draft.doc.revision)errors.conflict='Posisi atau data berubah. Periksa posisi terbaru, lalu gunakan versi terbaru.';
   if(!Number.isInteger(data.versi)||data.versi<0)errors.conflict='Versi dokumen belum tersedia. Muat kembali daftar.';
   if(!data.tujuan)errors.tujuan='Isi tujuan atau pemegang baru.';else if(data.tujuan.length>140)errors.tujuan='Tujuan maksimal 140 karakter.';
   if(!data.status)errors.status='Pilih status yang tersedia.';
   try{data.tanggal_perpindahan=I.date(row.tanggal);const min=doc?.perpindahanTerakhir||doc?.tanggalMasuk||draft.doc.perpindahanTerakhir||draft.doc.tanggalMasuk;if(min&&data.tanggal_perpindahan<min)errors.tanggal='Tanggal tidak boleh sebelum posisi terakhir.';if(data.tanggal_perpindahan>today)errors.tanggal='Tanggal tidak boleh setelah hari ini.';}catch(err){errors.tanggal=err.message;}
   if(data.catatan.length>3000)errors.catatan='Catatan maksimal 3000 karakter.';
   if(Object.keys(errors).length)issues.set(id,errors);
   entries.push({id,data});
  });return {entries,issues};
 }
 const aliases={no:null,kode:'kode',kodedokumen:'kode',dokumen:'nama',namadokumen:'nama',namaperihaldokumen:'nama',posisisekarang:'posisi',statussaatini:'statusLama',bu:'bu',office:'office',tanggalperpindahan:'tanggal',tanggal:'tanggal',tujuan:'tujuan',tujuanpemegangbaru:'tujuan',pemegangbaru:'tujuan',statusbaru:'status',status:'status',catatan:'catatan',noteperpindahan:'catatan'};
 function paste(changes,text,startRow,startColumn,visible,records,today){
  if(!Number.isInteger(startRow)||startRow<0||startRow>=visible.length||!Number.isInteger(startColumn)||startColumn<0||startColumn>=columns.length)throw new Error('Pilih sel perpindahan yang tersedia.');
  const matrix=I.tsv(text);if(!matrix.length)return {changes:new Map(changes),count:0};
  let mapping=matrix[0].map((_,i)=>columns[startColumn+i]?.key),data=matrix,withCode=false;
  if(matrix[0].filter(v=>Object.hasOwn(aliases,head(v))).length>=2){mapping=matrix[0].map(v=>{if(!Object.hasOwn(aliases,head(v)))throw new Error('Kolom "'+clean(v)+'" tidak dikenali.');return aliases[head(v)];});if(new Set(mapping.filter(Boolean)).size!==mapping.filter(Boolean).length)throw new Error('Judul kolom tidak boleh berulang.');data=matrix.slice(1);withCode=mapping.includes('kode');if(mapping.some(k=>['nama','posisi','statusLama','bu','office'].includes(k))&&!withCode)throw new Error('Sertakan kolom Kode saat menempel seluruh tabel.');}
  if(!mapping.some(key=>columns.some(col=>col.key===key)))throw new Error('Tempelan belum memuat kolom perpindahan.');
  if(data.some(row=>row.length>mapping.length)||mapping.some(k=>k===undefined))throw new Error('Kolom tempelan melewati batas input perpindahan.');
  if(data.length>maxRows||(!withCode&&startRow+data.length>visible.length))throw new Error('Tempelan melewati jumlah dokumen yang tampil atau batas 500 perubahan.');
  const result=new Map([...changes].map(([id,draft])=>[id,{doc:{...draft.doc},values:{...draft.values},defaults:{...draft.defaults}}])),used=new Set(),byCode=new Map();
  records.forEach(doc=>{if(!byCode.has(doc.kode))byCode.set(doc.kode,[]);byCode.get(doc.kode).push(doc);});
  data.forEach((values,index)=>{
   let doc=visible[startRow+index];
   if(withCode){const code=clean(values[mapping.indexOf('kode')]),found=byCode.get(code)||[];if(found.length!==1)throw new Error('Kode "'+code+'" tidak ditemukan atau tidak unik.');doc=found[0];}
   if(!doc||T.isFinal(doc.statusTerakhir))throw new Error('Baris '+(index+1)+': dokumen tidak aktif.');
   if(used.has(doc.id))throw new Error('Satu dokumen hanya boleh muncul sekali dalam tempelan.');used.add(doc.id);
   const old=result.get(doc.id),draft=old||{doc:{...doc},values:defaults(doc,today),defaults:defaults(doc,today)};
   values.forEach((value,col)=>{const key=mapping[col];if(!key||!columns.some(c=>c.key===key))return;let next=value;if(key==='tanggal'&&clean(value)){try{next=I.date(value);}catch{}}if(key==='status')next=T.STATUS.find(s=>normal(s)===normal(value))||value;draft.values[key]=next;});
   if(same(draft.values,draft.defaults))result.delete(doc.id);else result.set(doc.id,draft);
  });
  if(result.size>maxRows)throw new Error('Maksimal 500 perubahan dalam satu penyimpanan.');
  return {changes:result,count:data.length};
 }
 g.TrackingSheetDomain=Object.freeze({columns,maxRows,defaults,same,validate,paste});
})(window);
