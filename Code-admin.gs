// ===== TAMBAHAN UNTUK PANEL ADMIN (buat file baru "Admin" di Apps Script, tempel semua) =====
// 1) Project Settings > Script properties > tambah ADMIN_KEY = kata sandi panjang acak (min. 20 karakter)
// 2) Di Code.gs, fungsi doPost: tepat setelah baris `const d = JSON.parse(...)` tambahkan:
//      if (String(d.a).indexOf("adm_") === 0) return out(admin(d));
// 3) Deploy > Manage deployments > edit > Version: New version
const FIN_HEAD = ["Tanggal", "Tipe", "Kategori", "Jumlah", "Keterangan"];
function finSheet() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName("Keuangan");
  if (!s) { s = ss.insertSheet("Keuangan"); s.appendRow(FIN_HEAD); }
  return s;
}
function admin(d) {
  const key = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!key || d.key !== key) return { error: "Kunci admin salah" };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ps = SpreadsheetApp.getActive().getSheetByName("Pesanan");
    const head = ps.getRange(1, 1, 1, ps.getLastColumn()).getValues()[0];
    if (d.a === "adm_orders")
      return { rows: rows("Pesanan").map(r => ({ _row: r._row, Kode: r.Kode, Nama: r.Nama, Tipe: r.Tipe, Produk: r.Produk, Tahap: r.Tahap, Update: fmt(r.Update), Catatan: r.Catatan, Link: r.Link, Kurir: r.Kurir, Resi: r.Resi })) };
    if (d.a === "adm_set") {
      const row = +d.row; if (!(row >= 2)) return { error: "baris tidak valid" };
      Object.keys(d.f || {}).forEach(k => { const c = head.indexOf(k); if (c > -1) ps.getRange(row, c + 1).setValue(clean(d.f[k])); });
      const u = head.indexOf("Update"); if (u > -1) ps.getRange(row, u + 1).setValue(new Date());
      CacheService.getScriptCache().remove("stats");
      return { ok: true };
    }
    if (d.a === "adm_addorder") {
      const o = d.o || {}; o.Update = new Date();
      ps.appendRow(head.map(h => h === "Update" ? o.Update : clean(o[h] || "")));
      return { ok: true };
    }
    if (d.a === "adm_fin") {
      const v = finSheet().getDataRange().getValues(); v.shift();
      return { rows: v.map((r, i) => ({ _row: i + 2, tgl: r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, "yyyy-MM-dd") : String(r[0]), tipe: r[1], kat: r[2], jml: +r[3] || 0, ket: r[4] })) };
    }
    if (d.a === "adm_finadd") {
      const x = d.x || {}, j = Math.abs(+x.jml);
      if (!(j > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(x.tgl) || (x.tipe !== "masuk" && x.tipe !== "keluar")) return { error: "data tidak valid" };
      finSheet().appendRow([new Date(x.tgl), x.tipe, clean(x.kat).slice(0, 40), j, clean(x.ket).slice(0, 120)]);
      return { ok: true };
    }
    if (d.a === "adm_findel") { const r = +d.row; if (!(r >= 2)) return { error: "baris tidak valid" }; finSheet().deleteRow(r); return { ok: true }; }
    return { error: "aksi tidak dikenal" };
  } finally { lock.releaseLock(); }
}
