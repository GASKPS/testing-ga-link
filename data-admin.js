(function(g){
'use strict';
const A=g.Akses, U=g.PortalUI, e=U.escape;
function buttons(kind,id,version,label,active=true){
 if(!A.administrator())return '';
 return `<button type="button" class="button ${active?'button-danger':'button-secondary'}" data-delete-kind="${e(kind)}" data-delete-id="${e(id)}" data-delete-version="${version}" data-delete-label="${e(label)}" data-delete-action="${active?'hapus':'aktifkan'}">${active?'Hapus':'Aktifkan kembali'}</button>`;
}
function insert(anchor,container,html){const at=document.getElementById(anchor);if(!at)return;let node=document.getElementById(container);if(!node){node=document.createElement('span');node.id=container;at.before(node);}node.innerHTML=html;}
g.DataAdmin=Object.freeze({buttons,documentButton:d=>insert('edit-document','delete-document-slot',buttons('dokumen',d.id,d.revision,d.namaDokumen)),employeeButton:p=>insert('employee-detail-edit','delete-employee-slot',buttons('karyawan',p.id,p.revision,p.nama,p.aktif))});
const modal=document.createElement('dialog');modal.className='dialog confirm-delete';modal.setAttribute('aria-labelledby','delete-title');
modal.innerHTML='<div class="dialog-header"><div><h2 id="delete-title">Hapus data?</h2><p id="delete-caption"></p></div></div><div class="dialog-body"><strong id="delete-name"></strong><p id="delete-description"></p><p id="delete-error" class="form-error" role="alert" hidden></p></div><div class="dialog-actions"><button id="delete-cancel" type="button" class="button button-secondary">Batal</button><button id="delete-confirm" type="button" class="button button-danger">Hapus</button></div>';
document.body.append(modal);let selected=null,busy=false;
const $=id=>document.getElementById(id);
$('delete-cancel').onclick=()=>{if(!busy)modal.close();};modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
document.addEventListener('click',event=>{const b=event.target.closest('[data-delete-kind]');if(!b||!A.administrator()||busy)return;
 selected={p_jenis:b.dataset.deleteKind,p_id:b.dataset.deleteId,p_versi:Number(b.dataset.deleteVersion),p_tindakan:b.dataset.deleteAction};
 const activate=selected.p_tindakan==='aktifkan';$('delete-title').textContent=activate?'Aktifkan kembali?':'Hapus data?';$('delete-name').textContent=b.dataset.deleteLabel;
 $('delete-caption').textContent=activate?'Data akan tersedia kembali untuk digunakan.':'Periksa data yang dipilih sebelum melanjutkan.';
 $('delete-description').textContent=activate?'Riwayat yang tersimpan tetap terhubung.':['karyawan','perangkat'].includes(selected.p_jenis)?'Data yang sudah digunakan akan dinonaktifkan. Data yang belum digunakan dihapus permanen. Perangkat yang masih dipegang harus dikembalikan terlebih dahulu.':selected.p_jenis==='dokumen'?'Dokumen dan seluruh riwayat perpindahannya akan dihapus permanen.':'Catatan ini akan dihapus permanen.';
 $('delete-error').hidden=true;$('delete-confirm').textContent=activate?'Aktifkan kembali':'Hapus';modal.showModal();$('delete-cancel').focus();
});
$('delete-confirm').onclick=async()=>{if(busy||!selected)return;busy=true;$('delete-confirm').disabled=$('delete-cancel').disabled=true;
 try{const result=await A.rpc('kelola_penghapusan',selected,true);modal.close();
  for(const id of ['detail-dialog','employee-detail-dialog','device-history-dialog','agenda-detail']){const d=$(id);if(d?.open)d.close();}
  document.dispatchEvent(new CustomEvent('data:muat-ulang'));document.dispatchEvent(new CustomEvent('employees:changed'));document.dispatchEvent(new CustomEvent('devices:changed'));U.showToast('Data berhasil '+result.hasil+'.');
 }catch(err){$('delete-error').textContent=err.message;$('delete-error').hidden=false;}
 finally{busy=false;$('delete-confirm').disabled=$('delete-cancel').disabled=false;}
};

})(window);
