"""WK 20: yeni / değişen senaryolar ESKİ kâhinle (taban 39d6c28d, değişiklikten ÖNCE alınmış kopya) — beklenen sınıf ÖNCEDEN yazıldı (ders 7, 38).
Kullanım: python3 -I eski_kahinle.py <eski kahin klasörü> <yeni kahin klasörü (senaryolar.py buradan)> <kip: ham | notr>
  ham  : eski kahin.py aynen.
  notr : eski kahin.py + YALNIZ iki hata satırı etkisiz (kural EKLENMEDİ): S59-a hatası yerine eski yol (iş Atlandı kalır, deneme sayılır),
         S61-a hatası yerine S37 yolu (alınır, gönderim anında 'Atlandı — Telefonsuz') — not defterindeki kopyada metin değişimiyle (notr_kopya.py).
Çıktı TAP + # tests/pass/fail; 'ok' = sonuç ÖNCEDEN yazılmış beklenen sınıfla aynı (kırmızı beklenen yerde kırmızı, beklenen nedenle)."""
import importlib.util
import sys

sys.dont_write_bytecode = True
eski, yeni, kip = sys.argv[1], sys.argv[2], sys.argv[3]
spec = importlib.util.spec_from_file_location("kahin", f"{eski}/kahin.py")
kahin = importlib.util.module_from_spec(spec)
sys.modules["kahin"] = kahin
spec.loader.exec_module(kahin)
sys.path.insert(0, yeni)
import senaryolar  # noqa: E402  (eski kahin modülü sys.modules'ta — senaryolar onu kullanır)

assert senaryolar.kahin is kahin

S59A = ("istisna", "KULLANICIYA SORULMALI S59-a")
S61A = ("istisna", "KULLANICIYA SORULMALI S61-a")
# (sınıf, beklenen neden parçası — değerle kırmızıda ilk farkın yolunda geçmeli)
BEKLENEN_HAM = {
    "S70-01": S59A, "S70-02": S59A, "S70-03": S59A, "S70-04": S59A, "S70-05": S59A, "S70-06": S59A,
    "S71-01": S61A, "S71-02": S61A,
    "R3T-01": ("deger", "onceki_uyari"),     # telefonsuz C sayılmıyor: T3 sayı 1 ↔ 2, son 30.10 ↔ 01.11, T4 uyarısı yok
    "SW3-03": ("deger", "onceki_uyari"),     # T2 sayı 2 ↔ 3
    "S61-02": ("deger", "onceki_uyari"),     # T3 uyarısı yok ↔ {1}
}
BEKLENEN_NOTR = dict(BEKLENEN_HAM)
for k in ("S70-01", "S70-02", "S70-03", "S70-04", "S70-05", "S70-06"):
    BEKLENEN_NOTR[k] = ("deger", "isler")       # iş Atlandı kalır (kontroller.Kn.isler / isler.Tn/X.durum)
for k in ("S71-01", "S71-02"):
    BEKLENEN_NOTR[k] = ("deger", "yeniden")     # kişi alınır (yeniden.Yn), gönderim anında Atlandı — Telefonsuz
beklenen = BEKLENEN_NOTR if kip == "notr" else BEKLENEN_HAM

gecen = kalan = 0
i = 0
for s in senaryolar.tum_senaryolar():
    on = next((k for k in beklenen if s["ad"].startswith(k + "-")), None)
    if on is None:
        continue
    i += 1
    sinif, parca = beklenen[on]
    try:
        b = kahin.hesapla(senaryolar.girdi(s))
        farklar = senaryolar.elle_denetle(s, b)
        if not farklar:
            gercek, ayrinti = "ayni", "elle = eski model"
        else:
            def yol(f):                                    # fark satırı: "<ad> <kısmi> [<seçim>…] <yol>: elle … ≠ model …" — yalnız <yol> (senaryo adı nedene sayılmaz)
                return f.split("…] ", 1)[1].split(": elle", 1)[0] if "…] " in f else ""
            uyan = [f for f in farklar if parca in yol(f)]
            gercek = "deger" if uyan else "deger-baska-neden"
            ayrinti = f"{len(farklar)} fark (yollar: {sorted(set(yol(f) for f in farklar))}); beklenen nedenli ilk: {(uyan or farklar)[0][:400]}"
    except Exception as e:  # noqa: BLE001
        gercek, ayrinti = "istisna", f"{type(e).__name__}: {str(e)[:300]}"
        if parca not in str(e):
            gercek = "istisna-baska-neden"
    tamam = gercek == sinif
    if tamam:
        gecen += 1
        print(f"ok {i} - {s['ad']} — beklenen {sinif} ({parca}): {ayrinti}")
    else:
        kalan += 1
        print(f"not ok {i} - {s['ad']} — beklenen {sinif} ({parca}), gelen {gercek}: {ayrinti}")
print(f"1..{gecen + kalan}")
for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {n}")
sys.exit(0 if kalan == 0 and gecen == len(beklenen) else 1)
