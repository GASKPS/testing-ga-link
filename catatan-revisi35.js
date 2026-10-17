/* Three-way note comparison. No network, storage, or automatic writes. */
(function(g){'use strict';
 const K=g.Keep35,fields=['judul','dokumen','warna','tanggal','jenis_id'];
 const labels={judul:'Judul',dokumen:'Isi catatan',warna:'Warna',tanggal:'Tanggal',jenis_id:'Jenis'};
 function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
 const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 function snapshot(note){return{id:note.id,versi:note.versi,judul:note.judul34||'',dokumen:K.documentFor(note),warna:note.warna35||'netral',tanggal:note.tanggal_pengingat||null,jenis_id:note.jangkauan34==='pribadi'?null:note.jenis_id35||null,jenis_mode:!note.jenis_id35?'lama':'umum',jangkauan:note.jangkauan34};}
 function plan(base,draft,latest){
  const before=snapshot(base),now=snapshot(latest),merged={...draft,...now,tindakan:'simpan'},conflicts=[],changed=[];
  const scopeChanged=base.id!==latest.id||base.pemilik34!==latest.pemilik34||base.office_id34!==latest.office_id34||base.jangkauan34!==latest.jangkauan34;
  for(const field of fields){if(!same(draft[field],before[field])){changed.push(field);merged[field]=draft[field];if(!same(now[field],before[field])&&!same(now[field],draft[field]))conflicts.push(field);}}
  if(merged.jenis_id===draft.jenis_id&&changed.includes('jenis_id'))merged.jenis_mode=draft.jenis_mode;
  return{merged,conflicts,changed,scopeChanged,labels:conflicts.map(f=>labels[f])};
 }
 g.CatatanRevisi35=Object.freeze({same,snapshot,plan,fields,labels});
})(window);
