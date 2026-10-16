(function(g){'use strict';
 const maxRows=100,columns=[{key:'nik',label:'NIK'},{key:'tanggalCuti',label:'Tanggal cuti'},{key:'formCutiUrl',label:'Link Form Cuti'},{key:'exitUrl',label:'Link Exit'}],clean=v=>String(v??'').trim(),normal=v=>clean(v).normalize('NFC').toLowerCase();
 const blank=()=>({nik:'',tanggalCuti:'',formCutiUrl:'',exitUrl:''}),empty=r=>!columns.some(c=>clean(r[c.key]));
 function employee(nik,employees){const list=employees.filter(p=>p.aktif!==false&&normal(p.nik)===normal(nik));return list.length===1?list[0]:null;}
 function validate(rows,context){if(rows.length>maxRows)throw new Error('Maksimal 100 baris per kiriman.');const entries=[],issues=[],seen=new Set();rows.forEach((row,index)=>{if(empty(row))return;const errors={},person=employee(row.nik,context.employees),data={nik:clean(row.nik)};
  if(!person)errors.nik='NIK tidak ditemukan, nonaktif, atau lebih dari satu.';else data.nik=person.nik;
  try{data.tanggal_cuti=g.TrackingInputDomain.date(row.tanggalCuti);}catch(err){errors.tanggalCuti=err.message;}
  for(const[key,dest]of[['formCutiUrl','link_form_cuti'],['exitUrl','link_exit']])try{const url=clean(row[key]);if(url.length>3000)throw new Error('Link maksimal 3000 karakter.');data[dest]=g.SkcDomain.driveLink(url);}catch(err){errors[key]=err.message;}
  if(person&&data.tanggal_cuti){const key=person.id+'|'+data.tanggal_cuti;if(seen.has(key)||context.existing.some(r=>r.employeeId===person.id&&r.tanggalCuti===data.tanggal_cuti))errors.tanggalCuti='SKC karyawan dan tanggal ini sudah ada atau berulang.';seen.add(key);}
  entries.push({index,data});if(Object.keys(errors).length)issues.push({index,errors});});return{entries,issues};
 }
 const aliases={nik:'nik',nikkaryawan:'nik',tanggalcuti:'tanggalCuti',tglcuti:'tanggalCuti',formcuti:'formCutiUrl',linkformcuti:'formCutiUrl',linkgoogledriveformcuti:'formCutiUrl',exit:'exitUrl',linkexit:'exitUrl',linkgoogledriveexit:'exitUrl',nama:null,namakaryawan:null,jabatan:null,no:null,nomor:null},header=v=>normal(v).replace(/[^a-z0-9]/g,'');
 function paste(rows,text,row,col){const matrix=g.TrackingInputDomain.tsv(text);if(!matrix.length)return{rows:rows.map(r=>({...r})),count:0};let data=matrix,mapping=matrix[0].map((_,i)=>columns[col+i]?.key);const known=matrix[0].filter(v=>Object.hasOwn(aliases,header(v))).length;
  if(known>=2){mapping=matrix[0].map(v=>{const h=header(v);if(!Object.hasOwn(aliases,h))throw new Error('Kolom "'+clean(v)+'" tidak dikenali.');return aliases[h];});if(!mapping.includes('nik'))throw new Error('Sertakan judul NIK untuk mencocokkan nama dan jabatan otomatis.');if(new Set(mapping.filter(Boolean)).size!==mapping.filter(Boolean).length)throw new Error('Judul kolom tidak boleh berulang.');data=matrix.slice(1);if(data.some(r=>r.length>mapping.length))throw new Error('Ada sel di luar judul kolom.');}
  else if(matrix.some(r=>r.length>columns.length-col))throw new Error('Tempelan melewati batas kolom. Mulai dari NIK atau sertakan judul kolom.');
  if(row<0||row+data.length>maxRows)throw new Error('Maksimal 100 baris per kiriman.');const next=rows.map(r=>({...r}));while(next.length<row+data.length)next.push(blank());data.forEach((line,i)=>line.forEach((v,j)=>{if(mapping[j])next[row+i][mapping[j]]=v;}));return{rows:next,count:data.length};
 }
 g.SkcInputDomain=Object.freeze({maxRows,columns,blank,empty,employee,validate,paste});
})(window);
