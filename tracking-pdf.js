(function (g) {
  'use strict';
  let dependencies;
  const text = value => String(value == null || value === '' ? '—' : value);
  const dateText = value => value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value + 'T00:00:00Z')) : '—';
  function script(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => { el.remove(); reject(new Error('Komponen PDF belum dapat dimuat. Coba lagi.')); };
      document.head.append(el);
    });
  }
  async function font(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Huruf untuk laporan PDF belum dapat dimuat. Coba lagi.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  function ready() {
    if (!dependencies) dependencies = (async () => {
      if (!g.jspdf?.jsPDF) await script('vendor/jspdf.umd.min.js');
      if (!g.jspdf.jsPDF.API.autoTable) await script('vendor/jspdf.plugin.autotable.min.js');
      const [regular, bold] = await Promise.all([font('vendor/DejaVuSans.ttf'), font('vendor/DejaVuSans-Bold.ttf')]);
      return { regular, bold };
    })().catch(error => { dependencies = null; throw error; });
    return dependencies;
  }
  function create(records, filters, fonts, generatedAt = new Date()) {
    const D = g.TrackingDomain, rows = D.filterDocuments(records, filters, false);
    if (!rows.length) throw new Error('Tidak ada dokumen aktif yang sesuai filter untuk diunduh.');
    const doc = new g.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
    doc.addFileToVFS('GA-Regular.ttf', fonts.regular); doc.addFont('GA-Regular.ttf', 'GA', 'normal');
    doc.addFileToVFS('GA-Bold.ttf', fonts.bold); doc.addFont('GA-Bold.ttf', 'GA', 'bold');
    doc.setProperties({ title: 'Tracking Dokumen Aktif', subject: 'Ringkasan posisi terakhir dokumen aktif', creator: 'GA Services', author: 'GA Services' });
    const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jayapura', year: 'numeric', month: 'long', day: '2-digit' }).format(generatedAt).replace(/\s+/g, '_');
    const printed = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jayapura', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(generatedAt) + ' WIT';
    const selected = [filters.query && 'Pencarian: ' + filters.query, filters.bu && 'BU: ' + filters.bu, filters.status && 'Status: ' + filters.status, filters.office && 'Office: '+(filters.officeNama||rows[0]?.asalDokumen||filters.office), filters.dateFrom && 'Dari: '+dateText(filters.dateFrom), filters.dateTo && 'Sampai: '+dateText(filters.dateTo)].filter(Boolean).join(' | ') || 'Seluruh dokumen aktif';
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 12;
    doc.setFont('GA', 'normal').setFontSize(8.5);
    const allFilterLines = doc.splitTextToSize(selected, width - margin * 2), filterLines = allFilterLines.slice(0, 3);
    if (allFilterLines.length > 3) filterLines[2] = filterLines[2].slice(0, -2) + '…';
    const top = 36 + filterLines.length * 4;
    function header() {
      doc.setFont('GA', 'bold').setFontSize(15).setTextColor(0, 0, 0);
      doc.text('Tracking Dokumen Aktif', margin, 16);
      doc.setFont('GA', 'normal').setFontSize(8.5).setTextColor(0, 0, 0);
      doc.text('GA Services', margin, 23);
      doc.text(printed, width - margin, 16, { align: 'right' });
      doc.text(rows.length.toLocaleString('id-ID') + ' dokumen', width - margin, 23, { align: 'right' });
      doc.text(filterLines, margin, 30, { lineHeightFactor: 1.33 });
    }
    doc.autoTable({
      startY: top, margin: { top, bottom: 17, left: margin, right: margin },
      showHead: 'everyPage', rowPageBreak: 'avoid', theme: 'grid',
      styles: { font: 'GA', fontSize: 8.2, cellPadding: 2.1, overflow: 'linebreak', valign: 'top', textColor: [0, 0, 0], lineColor: [218, 226, 234], lineWidth: 0.15 },
      headStyles: { font: 'GA', fontStyle: 'bold', fillColor: [224, 234, 245], textColor: [0, 0, 0], fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      head: [['No', 'Tanggal Mulai', 'Nama dokumen', 'Nomor dokumen', 'Jenis', 'BU', 'Status', 'Posisi sekarang', 'Tanggal Perpindahan', 'Note Perpindahan']],
      body: rows.map((d, i) => [String(i + 1), dateText(d.tanggalMasuk), text(d.namaDokumen), text(d.nomorDokumen), text(D.typeText(d)), text(d.bu), text(d.statusTerakhir), text(d.posisiSekarang), dateText(d.perpindahanTerakhir), text(d.notePerpindahanTerakhir)]),
      columnStyles: Object.fromEntries([10, 22, 39, 25, 16, 12, 27, 31, 26, 65].map((cellWidth, i) => [i, { cellWidth, ...(i === 0 ? { halign: 'center' } : {}) }])),
      willDrawPage: header
    });
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page++) {
      doc.setPage(page).setFont('GA', 'normal').setFontSize(8).setTextColor(0, 0, 0);

      doc.text('Posisi terakhir pada saat laporan dibuat', margin, height - 8);
      doc.text('Halaman ' + page + ' dari ' + total, width - margin, height - 8, { align: 'right' });
    }
    return { doc, count: rows.length, filename: 'Tracking_Dokumen_' + day + '.pdf' };
  }
  g.TrackingPDF = Object.freeze({ ready, create });
})(window);
