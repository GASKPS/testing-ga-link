(function(g){
'use strict';const A=g.Akses;let owner='',value='kartu',request=0,pendingSave=null;
async function load(){await A.ready;if(pendingSave)try{await pendingSave;}catch{}const id=A.profile?.id||'',seq=++request;if(id!==owner){owner=id;value='kartu';}if(!id)return value;const data=await A.rpc('preferensi_saya');if(seq===request&&A.profile?.id===id)value=data.tampilan_karyawan==='daftar'?'daftar':'kartu';return value;}
async function save(next){if(!['kartu','daftar'].includes(next))throw new Error('Pilih Kartu atau Daftar.');const id=A.profile?.id;if(!id)throw new Error('Silakan masuk kembali.');const seq=++request,operation=A.rpc('simpan_preferensi_saya',{p_tampilan:next});pendingSave=operation;try{const data=await operation;if(seq!==request||A.profile?.id!==id)return value;owner=id;value=data.tampilan_karyawan;return value;}finally{if(pendingSave===operation)pendingSave=null;}}
document.addEventListener('akses:berubah',()=>{if(owner!==(A.profile?.id||'')){request++;owner=A.profile?.id||'';value='kartu';}});
g.PreferensiPortal=Object.freeze({load,save,get value(){return value;}});
})(window);
