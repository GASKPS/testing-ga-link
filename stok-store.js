(function (g) {
  'use strict';
  const A = g.Akses;
  async function rpc(name, args, write = false) {
    try { return await A.rpc(name, args, write); }
    catch (error) {
      if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code)) {
        throw Object.assign(new Error('Menu stok belum diaktifkan di database. Administrator perlu menjalankan SQL Stok & Opname.'), {setup: true});
      }
      throw error;
    }
  }
  g.StokStore = Object.freeze({
    page: (tab, query, page, kind) => rpc('stok_halaman', {p_tab: tab, p_cari: query, p_halaman: page, p_jenis: kind}),
    items: () => A.all('stok_item', '*', {aktif: true}, 'nama'),
    saveItem: (data, item) => rpc('stok_simpan_item', {p_data: data, ...(item ? {p_id: item.id, p_versi: item.versi} : {})}, true),
    transaction: (id, data, rows) => rpc('stok_catat_transaksi', {p_id: id, p_data: data, p_baris: rows}, true),
    start: (id, crew, note) => rpc('stok_mulai_opname', {p_id: id, p_crew: crew, p_catatan: note}, true),
    detail: id => rpc('stok_detail_opname', {p_id: id}),
    saveCount: (opname, rows, finish) => rpc('stok_simpan_opname', {p_id: opname.id, p_versi: opname.versi, p_baris: rows, p_selesai: finish}, true),
    review: (opname, action, reason) => rpc('stok_periksa_opname', {p_id: opname.id, p_versi: opname.versi, p_tindakan: action, p_alasan: reason}, true),
    backup: () => rpc('stok_ekspor')
  });
})(window);
