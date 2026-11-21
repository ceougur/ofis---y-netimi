import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
ACIK = ("KARARIN SÖYLEMEDİĞİ ALT DURUM (sürücü bakımı 4 raporu KULLANICIYA SORULMALI 1; ders 43 — bakiyenin 120 / 128 / 129 / 644 dağılımı seçenekler arasında farklı): şüpheliye almadan ÖNCE bağsız "
        "ödemeyle kapanmış faturaya şüpheliye almadan SONRA BAĞLI tahsilat. Kâhin (S192 tek kuyruk + 05.11 kararı (2) 24 = A 'bağ hedefini her durumda kapatır; hedefi önceden kapatmış bağsız ödeme "
        "serbest kalır ve kendi tarihinde yeniden dağılır'): serbest kalan bağsız ödeme şüpheliye almadan önceki tarihinde başka kalemi kapatır → bağlı fatura şüpheliye alma gününde açık sayılır → "
        "tahsilat 128'den (karşılık 644'e çözülür). Program: faturanın şüpheli payı tahsilat anındaki kuyruktan (fatura bağsızla kapanmış → pay 0) → tahsilat 120'den, 128 yerinde kalır. Toplam "
        "(120 + 128) aynı. En küçük örnek (sürücü bakımı 4 'ek-bag-sonra'): F1 1.000 (vade 10.01), F2 1.000 (vade 20.01), F3 2.000; P1 bağsız 1.000 (15.01) → Şüpheliye Al 1.000 (01.02) → P2 1.000 "
        "F1'e bağlı (10.02): kâhin 120 = 2.000 / 128 = 0, program 120 = 1.000 / 128 = 1.000. v2.4.9'da 2.4.9 kuralı (Kapatılacak Fatura bağlı tahsilat 120 — README K3) — gerileme değil, Ç5 / tur 3c sonrası alan. "
        "Bu kayıttan SONRAKİ aynı carinin alacak satırları farkın sonucu (kâhinde açık şüpheli daha az → 120'ye; programda 128'e).")
yeni = [
    {"kod": "R-S192-BAG-SONRA/r1", "kapsam": "adim", "senaryo": "rastgele-1", "olay_turu": ["tahsilat", "alacak_yaz", "satis_iade_faturasi"],
     "idler": ["P308", "467", "P309", "P348", "P355", "P363", "I413", "P420", "P446", "P542"], "anahtarlar": ["ana:120", "ana:128", "ana:129", "ana:644"], "sinif": "R",
     "kimlik": "SORU (sürücü bakımı 4 — S192 + 24 = A)", "aciklama": "rastgele-1 C4: P308 (24.07, F109'a bağlı; F109 şüpheliye almadan (01.07) önce bağsızla kapanmıştı) → kâhin 128'den 472.560 (karşılık 460.117 çözülür), program 120'den. " + ACIK},
    {"kod": "R-S192-BAG-SONRA/r2", "kapsam": "adim", "senaryo": "rastgele-2", "olay_turu": ["tahsilat"], "idler": ["P253", "P263", "P284"],
     "anahtarlar": ["ana:120", "ana:128", "ana:129", "ana:644"], "sinif": "R", "kimlik": "SORU (sürücü bakımı 4 — S192 + 24 = A)",
     "aciklama": "rastgele-2 C3: P253 (07.08, F88'e bağlı; F88 şüpheliye almadan (01.07) önce bağsızla kapanmıştı) → kâhin 128'den 100.381, program 120'den. " + ACIK},
]
d["kurallar"] += yeni
lines = ["{", f' "aciklama": {json.dumps(d["aciklama"], ensure_ascii=False)},', f' "bakim4_kalkan": {json.dumps(d["bakim4_kalkan"], ensure_ascii=False)},', ' "kurallar": [']
lines += [f"  {json.dumps(k, ensure_ascii=False)}," for k in d["kurallar"]]
lines[-1] = lines[-1].rstrip(",")
lines += [" ]", "}"]
open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
json.load(open(p, encoding="utf-8"))
print(len(d["kurallar"]))
