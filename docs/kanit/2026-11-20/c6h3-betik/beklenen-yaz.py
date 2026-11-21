# Gerçek fark listesinden (C6H3_FARK_YAZ) beklenen-farklar.json'u KARAR NUMARALARIYLA yazar; kural eşleşmeyen fark varsa DURUR (açıklanamayan = bulgu).
# Kullanım: python3 -I beklenen-yaz.py <farklar.json> <beklenen-farklar.json>
import json
import sys

rows = json.load(open(sys.argv[1], encoding="utf-8"))
K1 = "K1 (KG-1 A, M-01…M-07, S47; 30.10 açılış düzeni)"
out = []
bad = []
for r in rows:
    alan, sinif, kip = r["alan"], r["sinif"], r["kip"]
    if alan in ("mizan.500", "mizan.519") and kip == "kilitsiz":
        karar = K1 + (" + KG-16 A" if sinif == "acilis" else "")
        note = ("modül açılışlarının karşı hesabı 500 Açılış ve Devir Bakiyeleri → 519 Eşleştirilecek Açılış Bakiyeleri (Bilanço V.G, Kesin Değil 'Tamamlanmamış Açılış'); kilitli kopyada "
                "açılışlar donmuş dönemde (2.4.9 kuralıyla donar, Ç3) — fark yok")
        if sinif == "acilis":
            note += "; 'Açılış bakiyesi' açıklamalı işaretsiz elle borç 1.500,00 onay beklerken açılış sayılır (KG-16 A — S-Ç5-1)"
    elif alan == "stok":
        karar = "çekirdek §13 + kitap §5.1 (dönemsel ağırlıklı ortalama)"
        note = "v2.4.9'un stok değeri (Rapor Merkezi Stok Hareket Özeti) miktar × kartın (son alış) birim fiyatı; 2.5.0 dönem sonu değerlemesi (dönem başı + yılın alışları − alış iadeleri) / miktar"
    elif alan in ("kar", "smm"):
        karar = "KG-11 A (YÜKSEK-1)" + (" + S-06" if sinif == "stok" else "")
        note = "v2.4.9'da satışların maliyeti yok (6 / 7 hareketi = kâr); 2.5.0 Gelir Tablosu satışların maliyeti tahminini düşer: fark = −smm"
        if sinif == "stok":
            note += "; parasız giriş (sayım farkı) dönem sonu değerlemesine girer → 2025'te satışların maliyeti eksi"
    elif alan.startswith("cari.musteri.borclu") and sinif == "supheli":
        karar = "BANKA-MODULU-PLAN §3.11b (12.10.2026)"
        note = "şüpheli alacağa alınan cari v2.4.9 Cari Listesi'nde borçlu; defterde iki sürümde de 128 → Bilanço I.C'de 128 satırında, 120 satırında değil (sayı aynı: 128 = 1.500,00)"
    else:
        bad.append(r)
        continue
    out.append({**r, "karar": karar, "not": note})
if bad:
    print("AÇIKLANAMAYAN FARK (bulgu):")
    for r in bad:
        print("  ", r)
    sys.exit(2)
doc = {
    "aciklama": "v2.4.9 (fikstür v249.json) → bugünkü kod (Ç6-HESAP tur 3) farkları; her biri karar numarasıyla. Kilitli kopyada açılışlar 2.4.9 kuralıyla donar (Ç3 — 500 kalır); stok ve kâr farkları iki kipte aynı.",
    "farklar": out,
}
json.dump(doc, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(sys.argv[2], "a", encoding="utf-8").write("\n")
print(f"{len(out)} fark yazıldı")
