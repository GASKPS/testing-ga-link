(function (g) {
  'use strict';
  const fields = ['nik', 'nama', 'departemen', 'jabatan', 'lokasi_hunian', 'blok', 'nomor_kamar', 'tanggal_masuk_hunian'];
  const limits = { nik: 40, nama: 150, departemen: 150, jabatan: 150, lokasi_hunian: 150, blok: 100, nomor_kamar: 100, tanggal_masuk_hunian: 150 };
  function validate(source, mapping) {
    const selected = fields.map(key => mapping[key]).filter(value => value !== '' && value != null);
    if (!selected.length) return { rows: [], errors: ['Pilih setidaknya satu kolom dari file.'], skipped: 0 };
    if (new Set(selected.map(String)).size !== selected.length) return { rows: [], errors: ['Setiap kolom tujuan harus memakai kolom file yang berbeda.'], skipped: 0 };
    const rows = [], errors = [];
    let skipped = 0;
    source.forEach((values, index) => {
      const row = Object.fromEntries(fields.map(key => [key, mapping[key] === '' || mapping[key] == null ? '' : String(values[Number(mapping[key])] ?? '').trim()]));
      if (fields.every(key => !row[key])) { skipped++; return; }
      if (fields.some(key => row[key].length > limits[key])) errors.push('Baris ' + (index + 2) + ': isian terlalu panjang.');
      rows.push(row);
    });
    return { rows, errors, skipped };
  }
  function uploadFailure(error, {publishing = false, published = false} = {}) {
    const message = String(error?.message || 'Pembaruan belum dapat disimpan.');
    if (published) return {uncertain: false, message: 'Data mess sudah tersimpan, tetapi informasi pembaruan belum dapat ditampilkan. Muat ulang halaman.'};
    if (/DELETE requires a WHERE clause/i.test(message)) return {uncertain: false, message: 'Upload mess ditolak oleh database. Percobaan ini tidak mengganti data aktif. Fungsi upload perlu diperbarui oleh pengelola sebelum mencoba lagi.'};
    const code = String(error?.code || '');
    const databaseRejected = /^[0-9A-Z]{5}$/.test(code) && !code.startsWith('08') && code !== '40003';
    if (!publishing || databaseRejected) return {uncertain: false, message: message + ' Percobaan ini tidak mengganti data mess aktif.'};
    return {uncertain: true, message: 'Status penyimpanan belum dapat dipastikan. Muat ulang informasi pembaruan dan periksa waktu, petugas, serta jumlah data sebelum mengunggah ulang. Detail: ' + message};
  }
  g.MessImport = Object.freeze({ validate, uploadFailure });
})(window);
