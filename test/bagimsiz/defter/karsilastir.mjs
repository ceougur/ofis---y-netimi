// Karşılaştırıcı: kahin.py beklenenleri ↔ programın API'den okunan değerleri (kuruş). Okunamayan değer (null) fark sayılır (ders 4).
const tl = v => (v === null || v === undefined ? "okunamadı" : (v / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function karsilastir(beklenen, program) {
  const denetimler = [];
  const ekle = (ad, b, p, bicim = tl) => denetimler.push({ ad, beklenen: b, program: p, ok: p !== null && p !== undefined && b === p, bicim });
  for (const k of beklenen.kontrolSirasi) {
    const p = program.kontroller?.[k];
    if (!p) {
      ekle(`mizan ${k}`, "var", null, String);
      continue;
    }
    ekle(`mizan ${k} borç = alacak`, true, program.kontroller[`${k}:dengeli`], String);
    const b = beklenen.kontroller[k];
    for (const hesap of [...new Set([...Object.keys(b), ...Object.keys(p)])].sort()) ekle(`mizan ${k} ${hesap}`, b[hesap] || 0, p[hesap] || 0);
  }
  const son = program.son || {};
  for (const [ad, v] of Object.entries(beklenen.cari)) ekle(`cari ${ad}`, v, son.cari ? (son.cari[ad] ?? null) : null);
  for (const [kod, q] of Object.entries(beklenen.stok)) ekle(`stok ${kod}`, q, son.stok ? (son.stok[kod] ?? null) : null, String);
  for (const [ay, v] of Object.entries(beklenen.kdv)) {
    ekle(`KDV ${ay} hesaplanan (391)`, v.hesaplanan, son.kdv?.[ay]?.hesaplanan ?? null);
    ekle(`KDV ${ay} indirilecek (191)`, v.indirilecek, son.kdv?.[ay]?.indirilecek ?? null);
  }
  const y = son.yaslandirma;
  ekle("yaşlandırma TOPLAM", beklenen.yaslandirma.toplam, y ? y.toplam : null);
  for (const ad of new Set([...Object.keys(beklenen.yaslandirma.cariler), ...Object.keys(y?.cariler || {})])) ekle(`yaşlandırma ${ad}`, beklenen.yaslandirma.cariler[ad] || 0, y ? y.cariler[ad] || 0 : null);
  return { denetimler };
}

export function rapor({ denetimler }) {
  const fark = denetimler.filter(d => !d.ok);
  const satir = d => `  ${d.ok ? "✓" : "✗"} ${d.ad}: program ${d.bicim(d.program)} · kâhin ${d.bicim(d.beklenen)}`;
  return [`${denetimler.length - fark.length}/${denetimler.length} denetim tuttu.`, ...(fark.length ? ["FARKLAR:", ...fark.map(satir)] : [])].join("\n");
}
