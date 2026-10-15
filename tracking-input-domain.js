(function(g){
 'use strict';
 const maxRows=100;
 const columns=[
  {key:'namaDokumen',label:'Nama dokumen',max:240},
  {key:'tanggalMasuk',label:'Tanggal masuk',max:20},
  {key:'bu',label:'BU',options:['KPS','HJF','OST','Lainnya']},
  {key:'jenis',label:'Jenis dokumen',max:100},
  {key:'nomorDokumen',label:'Nomor dokumen',max:100},
  {key:'officeId',label:'Office'},
  {key:'noteDokumen',label:'Catatan',max:3000},
  {key:'posisiAwal',label:'Posisi saat ini',max:140},
  {key:'tanggalPosisiAwal',label:'Sejak tanggal',max:20},
  {key:'statusAwal',label:'Status saat ini',options:g.TrackingDomain.STATUS}
 ];
 const clean=value=>String(value??'').trim();
 const normal=value=>clean(value).normalize('NFC').toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
 function date(value){
  const text=clean(value);let result=text,match;
  if((match=text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)))result=match[3]+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');
  try{g.TrackingDomain.dayNumber(result);return result;}catch{throw new Error('Gunakan tanggal DD/MM/YYYY atau YYYY-MM-DD yang valid.');}
 }
 function blank(context){return {namaDokumen:'',tanggalMasuk:context.today,bu:'',jenis:'',nomorDokumen:'',officeId:context.officeId||'',noteDokumen:'',posisiAwal:'',tanggalPosisiAwal:'',statusAwal:''};}
 function empty(row,context){return !['namaDokumen','bu','jenis','nomorDokumen','noteDokumen','posisiAwal','tanggalPosisiAwal','statusAwal'].some(key=>clean(row[key]))&&(!clean(row.tanggalMasuk)||dateOrText(row.tanggalMasuk)===context.today)&&(!clean(row.officeId)||row.officeId===(context.officeId||''));}
 function dateOrText(value){try{return date(value);}catch{return clean(value);}}
 function office(value,context){
  const text=clean(value),available=context.offices.filter(o=>o.aktif||o.id===context.officeId);
  const exact=available.find(o=>o.id===text);if(exact)return exact.id;
  const named=available.filter(o=>normal(o.nama)===normal(text));return named.length===1?named[0].id:'';
 }
 function initial(row,context){
  const errors={},data={};if(!['posisiAwal','tanggalPosisiAwal','statusAwal'].some(key=>clean(row[key])))return {data,errors};
  data.posisi_awal=clean(row.posisiAwal);if(!data.posisi_awal)errors.posisiAwal='Isi posisi dokumen saat ini.';else if(data.posisi_awal.length>140)errors.posisiAwal='Posisi maksimal 140 karakter.';
  data.status_awal=g.TrackingDomain.STATUS.find(value=>normal(value)===normal(row.statusAwal));if(!data.status_awal)errors.statusAwal='Pilih status dokumen saat ini.';
  try{data.tanggal_posisi_awal=date(row.tanggalPosisiAwal);if(data.tanggal_posisi_awal>context.today)errors.tanggalPosisiAwal='Tanggal posisi tidak boleh setelah hari ini.';try{if(data.tanggal_posisi_awal<date(row.tanggalMasuk))errors.tanggalPosisiAwal='Tanggal posisi tidak boleh sebelum tanggal masuk.';}catch{}}catch(err){errors.tanggalPosisiAwal=err.message;}
  return {data,errors};
 }
 function validate(rows,context){
  if(rows.length>maxRows)throw new Error('Maksimal 100 baris untuk satu penyimpanan.');
  const entries=[],issues=[];
  rows.forEach((row,index)=>{
   if(empty(row,context))return;
   const errors={},data={nama_dokumen:clean(row.namaDokumen),nomor_dokumen:clean(row.nomorDokumen),catatan:clean(row.noteDokumen)};
   if(!data.nama_dokumen)errors.namaDokumen='Isi nama dokumen.';
   if(data.nama_dokumen.length>240)errors.namaDokumen='Nama maksimal 240 karakter.';
   try{data.tanggal_masuk=date(row.tanggalMasuk);}catch(err){errors.tanggalMasuk=err.message;}
   data.bu=columns[2].options.find(value=>normal(value)===normal(row.bu));if(!data.bu)errors.bu='Pilih KPS, HJF, OST, atau Lainnya.';
   const type=clean(row.jenis),standard=['FORM','EM','IM'].find(value=>normal(value)===normal(type));
   if(standard){data.jenis_dokumen=standard;data.jenis_lainnya='';}
   else{data.jenis_dokumen='Lainnya';data.jenis_lainnya=type.replace(/^lainnya\s*:\s*/i,'').trim();if(!data.jenis_lainnya||normal(type)==='lainnya')errors.jenis='Isi FORM, EM, IM, atau tulis jenis lainnya.';else if(data.jenis_lainnya.length>100)errors.jenis='Jenis lainnya maksimal 100 karakter.';}
   data.office_id=context.administrator?office(row.officeId,context):context.officeId;
   if(!data.office_id)errors.officeId='Pilih office yang tersedia.';
   if(data.nomor_dokumen.length>100)errors.nomorDokumen='Nomor maksimal 100 karakter.';
   if(data.catatan.length>3000)errors.noteDokumen='Catatan maksimal 3000 karakter.';
   const condition=initial(row,context);Object.assign(data,condition.data);Object.assign(errors,condition.errors);
   if(Object.keys(errors).length)issues.push({index,errors});
   entries.push({index,data});
  });
  return {entries,issues};
 }
 function tsv(text){
  if(text.length>1000000)throw new Error('Tempelan terlalu besar. Gunakan maksimal 100 baris.');
  const matrix=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
   const char=text[i];
   if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;continue;}
   if(char==='"'&&cell===''&&!closed){quoted=true;continue;}
   if(char==='\t'){row.push(cell);cell='';closed=false;}
   else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);matrix.push(row);row=[];cell='';closed=false;}
   else{if(closed&&char.trim())throw new Error('Format tempelan belum sesuai. Salin langsung sel dari Excel.');cell+=char;}
  }
  if(quoted)throw new Error('Tanda kutip pada tempelan belum lengkap.');
  row.push(cell);matrix.push(row);while(matrix.length&&matrix.at(-1).every(value=>!clean(value)))matrix.pop();return matrix;
 }
 const aliases={namadokumen:'namaDokumen',namaperihaldokumen:'namaDokumen',namaperihal:'namaDokumen',tanggalmasuk:'tanggalMasuk',bu:'bu',jenis:'jenis',jenisdokumen:'jenis',nomor:'nomorDokumen',nomordokumen:'nomorDokumen',office:'officeId',catatan:'noteDokumen',note:'noteDokumen',notedokumen:'noteDokumen',posisiawal:'posisiAwal',posisisaatini:'posisiAwal',sejaktanggal:'tanggalPosisiAwal',tanggalposisiawal:'tanggalPosisiAwal',statussaatini:'statusAwal',statusawal:'statusAwal',no:null};
 const header=value=>normal(value).replace(/[^a-z0-9]/g,'');
 function paste(rows,text,startRow,startColumn,context){
  if(!Number.isInteger(startRow)||startRow<0||startRow>=maxRows||!Number.isInteger(startColumn)||startColumn<0||startColumn>=columns.length)throw new Error('Pilih sel input yang tersedia.');
  const matrix=tsv(text);if(!matrix.length)return {rows:rows.map(row=>({...row})),count:0};
  let mapping=matrix[0].map((_,i)=>columns[startColumn+i]?.key),data=matrix;
  const known=matrix[0].filter(value=>Object.hasOwn(aliases,header(value))).length;
  if(known>=2){mapping=matrix[0].map(value=>{const key=header(value);if(!Object.hasOwn(aliases,key))throw new Error('Kolom "'+clean(value)+'" tidak dikenali. Gunakan kolom input dokumen.');return aliases[key];});if(new Set(mapping.filter(Boolean)).size!==mapping.filter(Boolean).length)throw new Error('Judul kolom tidak boleh berulang.');data=matrix.slice(1);if(data.some(row=>row.length>mapping.length))throw new Error('Ada sel di luar judul kolom tempelan. Lengkapi judul kolom terlebih dahulu.');}
  else if(matrix.some(row=>row.length>columns.length-startColumn))throw new Error('Kolom tempelan melewati batas tabel. Mulai dari kolom yang sesuai.');
  if(startRow+data.length>maxRows)throw new Error('Maksimal 100 baris untuk satu penyimpanan.');
  const result=rows.map(row=>({...row}));while(result.length<startRow+data.length)result.push(blank(context));
  data.forEach((values,index)=>values.forEach((value,col)=>{const key=mapping[col];if(!key)return;let next=value;const options=columns.find(c=>c.key===key)?.options;if(options)next=options.find(option=>normal(option)===normal(value))||value;if(['tanggalMasuk','tanggalPosisiAwal'].includes(key)&&clean(value))next=dateOrText(value);if(key==='officeId')next=context.administrator?office(value,context)||value:context.officeId;result[startRow+index][key]=next;}));
  return {rows:result,count:data.length};
 }
 function definite(error){const code=String(error?.code||'');return ['PGRST202','PGRST205'].includes(code)||(/^[0-9A-Z]{5}$/.test(code)&&!code.startsWith('08')&&code!=='40003');}
 g.TrackingInputDomain=Object.freeze({columns,maxRows,date,blank,empty,office,initial,validate,paste,tsv,definite});
})(window);
