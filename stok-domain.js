(function (g) {
  'use strict';
  const quantity = value => {
    if (value == null || String(value).trim() === '') return null;
    const raw = String(value).trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,3})?$/.test(raw)) throw new Error('Jumlah harus angka positif atau nol, maksimal 3 angka desimal.');
    const n = Number(raw);
    if (!Number.isFinite(n) || n > 99999999999.999) throw new Error('Jumlah terlalu besar.');
    return Math.round(n * 1000) / 1000;
  };
  const difference = (physical, recorded) => {
    const p = quantity(physical), r = quantity(recorded);
    return p == null || r == null ? null : (Math.round(p * 1000) - Math.round(r * 1000)) / 1000;
  };
  const label = value => value == null ? 'Belum dihitung' : value < 0 ? 'Kurang' : value > 0 ? 'Lebih' : 'Sesuai';
  const format = value => value == null ? '—' : new Intl.NumberFormat('id-ID', {maximumFractionDigits: 3}).format(Number(value));
  const summary = rows => rows.reduce((s, row) => {
    const d = difference(row.fisik, row.stok_catatan);
    s.total++; if (d == null) s.belum++; else if (d === 0) s.sesuai++; else s.selisih++;
    return s;
  }, {total: 0, belum: 0, sesuai: 0, selisih: 0});
  g.StokDomain = Object.freeze({quantity, difference, label, format, summary});
})(typeof window === 'undefined' ? globalThis : window);
