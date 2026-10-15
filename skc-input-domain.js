(function(g){
 'use strict';
 const I=g.TrackingInputDomain,columns=[{key:'nik',label:'NIK',max:100},{key:'tanggalCuti',label:'Tanggal cuti'},{key:'formCutiUrl',label:'Link Form Cuti',max:3000},{key:'exitUrl',label:'Link Exit',max:3000}],maxRows=100;
 const clean=value=>String(value??'').trim(),normal=value=>clean(value).normalize('NFC').toLocaleLowerCase('id-ID');
 const blank=()=>({nik:'',tanggalCuti:'',formCutiUrl:'',exitUrl:''});
 const empty=row=>columns.every(col=>!clean(row[col.key]));
 function employee(nik,people){const matches=people.filter(p=>p.aktif!==false&&normal(p.nik)===normal(nik));return clean(nik)&&matches.length===1?matches[0]:null;}
 function validate(rows,context){
  if(rows.length>maxRows)throw new Error('Maksimal 100 baris dalam satu penyimpanan.');
  const entries=[],issues=[],seen=new Map();
  rows.forEach((row,index)=>{
   if(empty(row))return;
   const errors={},person=employee(row.nik,context.employees),data={nik:clean(row.nik)};
   if(!data.nik)errors.nik='Isi NIK karyawan.';else if(data.nik.length>100)errors.nik='NIK maksimal 100 karakter.';else if(!person)errors.nik='NIK tidak ditemukan, tidak unik, atau karyawan sudah nonaktif.';
   try{data.tanggal_cuti=I.date(row.tanggalCuti);}catch(error){errors.tanggalCuti=error.message;}
   for(const [key,field] of [['formCutiUrl','link_form_cuti'],['exitUrl','link_exit']]){try{data[field]=g.SkcDomain.driveLink(row[key]);}catch(error){errors[key]=error.message;}}
   if(person&&data.tanggal_cuti){
    const key=person.id+'|'+data.tanggal_cuti;
    if(seen.has(key))errors.nik='NIK dan tanggal cuti sama dengan baris '+(seen.get(key)+1)+'.';else seen.set(key,index);
    if(context.records.some(r=>r.employeeId===person.id&&r.tanggalCuti===data.tanggal_cuti))errors.tanggalCuti='SKC untuk karyawan dan tanggal ini sudah ada.';
   }
   entries.push({index,data});if(Object.keys(errors).length)issues.push({index,errors});
  });return {entries,issues};
 }
 const aliases={no:null,nomor:null,nik:'nik',nikkaryawan:'nik',nama:'nama',namakaryawan:'nama',jabatan:'jabatan',tanggal:'tanggalCuti',tanggalcuti:'tanggalCuti',tglcuti:'tanggalCuti',linkformcuti:'formCutiUrl',formcuti:'formCutiUrl',linkgoogledriveformcuti:'formCutiUrl',linkexit:'exitUrl',exit:'exitUrl',linkgoogledriveexit:'exitUrl'};
 function paste(rows,text,startRow,startColumn){
  if(!Number.isInteger(startRow)||startRow<0||startRow>=rows.length||!Number.isInteger(startColumn)||startColumn<0||startColumn>=columns.length)throw new Error('Pilih sel input SKC terlebih dahulu.');
  const matrix=I.tsv(text);if(!matrix.length)return {rows:rows.map(row=>({...row})),count:0};
  const head=value=>normal(value).replace(/[^a-z0-9]/g,'');let data=matrix,mapping=matrix[0].map((_,index)=>columns[startColumn+index]?.key);
  if(matrix[0].filter(value=>Object.hasOwn(aliases,head(value))).length>=2){
   mapping=matrix[0].map(value=>{if(!Object.hasOwn(aliases,head(value)))throw new Error('Kolom "'+clean(value)+'" tidak dikenali.');return aliases[head(value)];});
   if(new Set(mapping.filter(Boolean)).size!==mapping.filter(Boolean).length)throw new Error('Judul kolom tidak boleh berulang.');
   if(mapping.some(key=>['nama','jabatan'].includes(key))&&!mapping.includes('nik'))throw new Error('Sertakan kolom NIK untuk mencocokkan nama karyawan.');
   if(!mapping.some(key=>columns.some(col=>col.key===key)))throw new Error('Tempelan belum memuat isian SKC.');data=matrix.slice(1);
  }
  if(mapping.some(key=>key===undefined)||data.some(row=>row.length>mapping.length))throw new Error('Kolom tempelan melewati batas. Urutannya: NIK, Tanggal cuti, Link Form Cuti, Link Exit.');
  if(startRow+data.length>maxRows)throw new Error('Tempelan melewati batas 100 baris.');
  const result=rows.map(row=>({...row}));while(result.length<startRow+data.length)result.push(blank());
  data.forEach((values,index)=>values.forEach((value,column)=>{const key=mapping[column];if(!columns.some(col=>col.key===key))return;let next=value;if(key==='tanggalCuti'&&clean(value)){try{next=I.date(value);}catch{}}result[startRow+index][key]=next;}));
  return {rows:result,count:data.length};
 }
 g.SkcInputDomain=Object.freeze({columns,maxRows,blank,empty,employee,validate,paste,normal});
})(window);
