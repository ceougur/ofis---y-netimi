// Karşılaştırıcı: kahin.py beklenenleri ↔ programın API'den okunan değerleri (kuruş). Okunamayan değer (null) fark sayılır (ders 4).
const tl = v => (v === null || v === undefined ? "okunamadı" : (v / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const ZORUNLU = ["153", "190", "191", "193", "360", "391", "500", "689"];

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
    // Vergi, stok ve açılış hesapları sıfır olsa da her noktada denetlenir (MM3/MM4: "sıfırlandı" iddiası ayrıca görünsün).
    for (const hesap of [...new Set([...ZORUNLU, ...Object.keys(b), ...Object.keys(p)])].sort()) ekle(`mizan ${k} ${hesap}`, b[hesap] || 0, p[hesap] || 0);
  }
  const son = program.son || {};
  for (const [ad, v] of Object.entries(beklenen.cari)) ekle(`cari ${ad}`, v, son.cari ? (son.cari[ad] ?? null) : null);
  for (const [kod, q] of Object.entries(beklenen.stok)) ekle(`stok ${kod}`, q, son.stok ? (son.stok[kod] ?? null) : null, String);
  for (const [ay, v] of Object.entries(beklenen.kdv)) {
    ekle(`KDV ${ay} hesaplanan (391)`, v.hesaplanan, son.kdv?.[ay]?.hesaplanan ?? null);
    ekle(`KDV ${ay} indirilecek (191)`, v.indirilecek, son.kdv?.[ay]?.indirilecek ?? null);
  }
  // 31b-MM3: Stopaj ve Tevkifat Özeti — kâhinin satırları (tarih|cari) taraf ve işaretli tutarlarıyla; 360 tarafı özeti
  for (const [ay, v] of Object.entries(beklenen.stopajOzet || {})) {
    const p = son.stopajOzet ? son.stopajOzet[ay] : null;
    for (const [anahtar, satir] of Object.entries(v.satirlar)) {
      const ps = p ? p.satirlar[anahtar] ?? {} : null;
      ekle(`stopaj ${ay} ${anahtar} taraf`, satir.taraf, ps ? ps.taraf ?? null : null, String);
      for (const alan of ["matrah", "stopaj", "tevkifat"]) ekle(`stopaj ${ay} ${anahtar} ${alan}`, satir[alan], ps ? ps[alan] ?? null : null);
    }
    ekle(`stopaj ${ay} Bizim Ödeyeceğimiz Stopaj`, v.bizimStopaj, p ? p.bizimStopaj : null);
    ekle(`stopaj ${ay} Bizim Ödeyeceğimiz Tevkifat`, v.bizimTevkifat, p ? p.bizimTevkifat : null);
  }
  // 31b-MM8: yevmiye aynı gün sırası
  for (const [gun, v] of Object.entries(beklenen.yevmiyeSira || {})) ekle(`yevmiye sırası ${gun}`, v, son.yevmiyeSira ? son.yevmiyeSira[gun] ?? null : null, String);
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
