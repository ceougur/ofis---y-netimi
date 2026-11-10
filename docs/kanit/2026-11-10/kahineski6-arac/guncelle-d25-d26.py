#!/usr/bin/env python3
"""Bakım 6: d25 / d26'nın kararla (S99 A — SK-13; S102–S105 A) DEĞİŞEN elle beklentileri — değerler bu betikte ELLE (kâhin koşulmadan karar metinlerinden).
Kullanım: python3 -I guncelle-d25-d26.py <senaryolar klasörü>"""
import json
import os
import sys

D = sys.argv[1]


def yaz(ad, s):
    with open(os.path.join(D, ad), "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1)
        f.write("\n")


def oku(ad):
    with open(os.path.join(D, ad), encoding="utf-8") as f:
        return json.load(f)


# ── d25 R3: SK-13 → S99 A (fatura listesi = takvim; belge durumu verilen avansı kalem sayan tek kuyruktan): Ödeme 200 (01.03) · satış 100 (05.03) · tahsilat 150 (10.03)
#    tahsilat önce avans (vade 01.03) → avans 50; fatura 100 AÇIK. acikToplam = fatura 100 (elle kayıt yok) = 10.000; bakiye 15.000 → eşit değil (avans kalemi 50 listede değil).
s = oku("d25-c5-s98-avans-sirasi.json")
s["elleYok"] = [k for k in s["elleYok"] if k not in ("k1:fatura:R3F:acik", "k1:cari:R3:acikToplam")]
s["elleBeklenen"].update({"k1:fatura:R3F:acik": 10000, "k1:cari:R3:acikToplam": 10000, "k1:cari:R3:acikEsitBakiye": False})
s["elleBelirsiz"] = [p for p in s["elleBelirsiz"] if "R3" not in json.dumps(p, ensure_ascii=False)]
s["aciklama"] = s["aciklama"].replace(
    "R3 aynı örnek satış faturasıyla: takvim / gecikmiş net, faturanın BELGE durumu YAZILMAZ (SK-13).",
    "R3 aynı örnek satış faturasıyla: takvim / gecikmiş net; faturanın BELGE durumu bakım 5'te yazılmıyordu (SK-13) — bakım 6: S99 A ile fatura listesi takvimle AYNI (Açık 100, avans 50).")
if not s["elleYok"]:
    del s["elleYok"]
if not s["elleBelirsiz"]:
    del s["elleBelirsiz"]
yaz("d25-c5-s98-avans-sirasi.json", s)

# ── d26: S9–S13 artık DEĞERLİ (S102 / S103 / S104 / S105 = A; SK-13 ← S99 A); G1 / G2 (Y5-7, KS8) aynen
s = oku("d26-c5-bakim5-susan.json")
yeni = {
    # S9 (S102 A): Borç 1.000 (01.06) · X 300 (02.06) · Y 300 (03.06) + tahsilat 1.000 (03.06) → aynı günün (Y) netleşmesi kalır, önceki günün X'i açılır: X 300 açık, Y 0, Borç 0, avans 300
    "k1:hareket:s9b:kalan": 0, "k1:hareket:s9x:kalan": 30000, "k1:hareket:s9y:kalan": 0, "k1:cari:S9:gecikmis": 0,
    "k1:takvim:hareket:s9x": {"amount": 30000, "dueDate": "2026-06-02", "direction": "out", "label": "Ödenecek Borç", "state": "overdue", "days": -13, "cari": "S9", "person": "Sk Dokuz"},
    "k1:vadeTakip:hareket:s9x": {"amount": 30000, "date": "2026-06-02", "direction": "out"},
    "k1:projeksiyon:hareket:s9x": {"amount": 30000, "date": "2026-06-02", "direction": "out"},
    "k1:takvim:hareket:s9b": "yok", "k1:vadeTakip:hareket:s9b": "yok", "k1:projeksiyon:hareket:s9b": "yok",
    "k1:takvim:hareket:s9y": "yok", "k1:vadeTakip:hareket:s9y": "yok", "k1:projeksiyon:hareket:s9y": "yok",
    "k1:cari:S9:acikToplam": -30000, "k1:cari:S9:acikEsitBakiye": False,
    # S10 (S103 A): Ödeme 500 (01.03) · alış 300 (05.03) → avans 200 · tahsilat 500 (10.03) → avans 0, tedarikçinin avansı 300 (kalem değil); alış 'Ödendi'
    "k1:fatura:S10F:acik": 0, "k1:takvim:fatura:S10F": "yok", "k1:cari:S10:gecikmis": 0,
    "k1:takvim:hareket:s10o": "yok", "k1:vadeTakip:hareket:s10o": "yok", "k1:projeksiyon:hareket:s10o": "yok",
    "k1:cari:S10:acikToplam": 0, "k1:cari:S10:acikEsitBakiye": False,
    # S11 (S104 A): tahsilat 500 (01.03; alınan avans) · Alacak 200 (05.03, vade 30.04) · Ödeme 300 (10.03) → vade sırası: avans önce → avans 200, Alacak 200 açık
    "k1:hareket:s11a:kalan": 20000, "k1:cari:S11:gecikmis": 0,
    "k1:takvim:hareket:s11a": {"amount": 20000, "dueDate": "2026-04-30", "direction": "out", "label": "Ödenecek Borç", "state": "overdue", "days": -46, "cari": "S11", "person": "Sk Onbir"},
    "k1:vadeTakip:hareket:s11a": {"amount": 20000, "date": "2026-04-30", "direction": "out"},
    "k1:projeksiyon:hareket:s11a": {"amount": 20000, "date": "2026-04-30", "direction": "out"},
    "k1:takvim:hareket:s11o": "yok", "k1:vadeTakip:hareket:s11o": "yok", "k1:projeksiyon:hareket:s11o": "yok",
    "k1:cari:S11:acikToplam": -20000, "k1:cari:S11:acikEsitBakiye": False,
    # S12 (S105 A): Ödeme 300 (01.03) · Alış İadesi 200 (05.03) · alış 250 (10.03) → önce iade: iade alacağı 0, avans 250 (S96 kalemi; 02.03'ten gecikmiş)
    "k1:takvim:hareket:s12o": {"amount": 25000, "dueDate": "2026-03-01", "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue", "days": -106, "cari": "S12", "person": "Sk Oniki"},
    "k1:vadeTakip:hareket:s12o": {"amount": 25000, "date": "2026-03-01", "direction": "in"},
    "k1:projeksiyon:hareket:s12o": {"amount": 25000, "date": "2026-03-01", "direction": "in"},
    "k1:cari:S12:gecikmis": 25000, "k1:takvim:fatura:S12F": "yok",
    "k1:takvim:cariToplam:S12": 25000, "k1:vadeTakip:cariToplam:S12": 25000, "k1:projeksiyon:cariToplam:S12": 25000,
    "k1:vadeTakip:fatura:S12F": "yok", "k1:projeksiyon:fatura:S12F": "yok",
    "k1:cari:S12:acikToplam": 0, "k1:cari:S12:acikEsitBakiye": False,
    # S13 (SK-13 ← S99 A): Ödeme 200 · satış 100 · tahsilat 150 → fatura listesi takvimle aynı: Açık 100, avans 50
    "k1:fatura:S13F:acik": 10000, "k1:cari:S13:acikToplam": 10000, "k1:cari:S13:acikEsitBakiye": False,
}
s["elleBeklenen"].update(yeni)
s["elleYok"] = [k for k in s["elleYok"] if k not in yeni]
s["elleBelirsiz"] = [p for p in s["elleBelirsiz"] if not any(("cari %s " % c) in " ".join(p if isinstance(p, list) else [p]) for c in ("S9", "S10", "S11", "S12", "S13"))]
s["aciklama"] = ("2.5.0 bakım 5 C17 + bakım 6 C18 — bakım 5'te kâhinin SUSTUĞU durumlar; bakım 6'da S9–S13 kararla DEĞERLİ: S9 S102 A (SK-9 A — aynı günün netleşmesi kalır, önceki günün X'i "
                 "açılır: X 300, Y 0, avans 300), S10 S103 A (SK-10 A — avansın alışla kapanışı kesin: alış Ödendi, tedarikçinin avansı 300), S11 S104 A (SK-11 A — Ödeme vade sırasıyla: avans 200, "
                 "Alacak 200 açık), S12 S105 A (SK-12 A — önce iade: iade alacağı 0, avans 250), S13 SK-13 ← S99 A (fatura listesi takvimle aynı: Açık 100, avans 50). G1 / G2 Y5-7 (yalın olmayan — KS8: "
                 "müşteriye Ödeme önce iade geri ödemesi, artanı avans) AYNEN: G1'de sonraki tahsilat vadesi avanstan ÖNCE olan Borç'u kapatıyor — kâhin YAZAR (Borç 300, avans 200, gecikmiş 500); G2'de "
                 "Borç avanstan SONRA doğuyor — susar (KS8 × S98 kararda yok — §18 Y6-10). Sayaçlar G2 yüzünden yazılmaz.")
s["dayanak"] = "KARARLAR.md §17 Y5-3 … Y5-7; §18 Y6-1, Y6-2, Y6-10"
yaz("d26-c5-bakim5-susan.json", s)
print("d25, d26 güncellendi")
