"""beklenen-farklar.json'a V1–V4 farklarını karar numarasıyla ekler (değerler fark-dok çıktısından AYNEN). Kullanım: beklenen-ekle.py <beklenen-farklar.json> <fark-yeni.json>"""
import json, sys

path, actual_path = sys.argv[1], sys.argv[2]
doc = json.load(open(path, encoding="utf-8"))
actual = json.load(open(actual_path, encoding="utf-8"))["farklar"]
V1, V2, V3, V4 = "TYKF V1 Satış Kartı Tutarı Düzenlenmiş", "TYKF V2 Satış Kartı İadeyle Küçülmüş", "TYKF V3 Satış Kartı Faturasız İade", "TYKF V4 Kartı Kapat"
T = "kapanış düzeltme turu (12.11): "
V2NOT = (T + "ORTA-1 düzeltmesi — satışla açılan kart, faturasız stok iadesiyle 700'e küçülse de KENDİ satışını taşır (S110 = A; kaynak kartın açılış izinden); elle Borç 500 "
         "vadesiyle (+30) AYRI kalem. İade 800 bağsız ödemedir (2.4.5 KS7 a): vadesi en önce gelenden (S2) satışın kart dışı 300'ünü ve 1. taksiti (500) kapatır (S50). "
         "v2.4.9 iadeyi tarih sırasıyla önce elle Borç'a yazıyordu (taksit 500 + 200, Borç kalemi yok); 8d6ea9c9 akan saatte kartı tanımadığı için v2.4.9 ile aynı sayıyı "
         "veriyordu. Bakiye iki sürümde 700. TOPLU SORU TS-K1 (düzeltme turu raporu): kullanıcı teyidi bekleniyor.")
KARAR = {
    (V1, "gecikmis"): ("S110 + S1 + S91 + B1", T + "kart 800'e düzenlendi; kart KENDİ satışının 800'ünü taşır (S110 = A, kaynak kartın açılış izinden — ORTA-1 düzeltmesi), satışın kart dışı 200'ü vadesiz kalem (S1: belge gününde vadeli) — gecikmiş 1. taksit 500 + 200 = 700; elle Borç 500 vadesi +30 (gecikmiş değil). v2.4.9: yalnız geciken taksit 500. (8d6ea9c9: 1.200 — kart elle borcu içine alıyordu, GERİLEME.)"),
    (V1, "kart1.taksitler"): ("S50 + M1e", T + "taksit kalanı tek kuyruktan: kart 800, taksitler 500 + 500 → kart tutarını aşan 200 son taksitten kırpılır (kalan 300). v2.4.9 kart ekranı 500 gösteriyordu (Vade Takip'i kendisi de 300: '2. taksit (kalan)')."),
    (V1, "vadeTakip"): ("S110 + S1 + S91", T + "satışın kart dışı 200'ü 'Tahsil Edilecek Borç' kalemi (satış günü); elle Borç 500 kendi vadesinde aynen. (8d6ea9c9: tek kalem 700 @satış günü, Borç 500 @vade KAYIP — GERİLEME.)"),
    (V1, "zil"): ("S110 + S1 + S91", T + "zilde satışın kart dışı 200'ü (gecikmiş) + 1. taksit 500."),
    (V2, "gecikmis"): ("S110 + S2 + S50 + KS7(a)", V2NOT),
    (V2, "kart1.durum"): ("S110 + S2 + S50 + KS7(a)", V2NOT),
    (V2, "kart1.sekme"): ("S110 + S2 + S50 + KS7(a)", V2NOT),
    (V2, "kart1.taksitler"): ("S110 + S2 + S50 + KS7(a)", V2NOT),
    (V2, "vadeTakip"): ("S110 + S2 + S50 + KS7(a)", V2NOT),
    (V2, "zil"): ("S110 + S2 + S50 + KS7(a)", V2NOT),
    (V3, "gecikmis"): ("S2 + S50 + KS7(a) + B1", T + "faturasız stok iadesi 300 bağsız ödemedir (2.4.5 KS7 a): vadesi en önce gelen kalemi — 1. taksiti (−20) — 200'e indirir (S2, S50); gecikmiş 200. v2.4.9 iadeyi tarih sırasıyla elle Borç'a yazıyordu (Borç 200, taksitler 500 + 500). 8d6ea9c9 ile AYNI (bu turun farkı değil)."),
    (V3, "kart1.taksitler"): ("S2 + S50 + KS7(a)", T + "iade 300 vadesi en önce gelen 1. taksiti 200'e indirir (kart seçilmeden gelen bağsız ödeme taksiti kapatır — S50)."),
    (V3, "vadeTakip"): ("S110 + S2 + S50 + KS7(a)", T + "kart kendi satışını taşır, elle Borç 500 vadesinde tam (v2.4.9: iade Borç'u 200'e indiriyordu); 1. taksit (kalan) 200."),
    (V3, "zil"): ("S2 + S50 + KS7(a)", T + "zilde 1. taksitin kalanı 200."),
    (V4, "kart1.taksitler"): ("M1e", T + "KAPSAM DIŞI GÖZLEM (kapanış dar kontrolü; Ç5-B öncesi kodda da aynı — bu turun farkı DEĞİL, kural yazılmadı): Kartı Kapat kalanı kuyrukta kartın bağıdır (M1e), kapatılan kartın ödenmemiş taksitlerini kapatır → satır 'Ödendi / kalan 0' (v2.4.9: 'Kapalı / kalan 300'). Kartın kendi Tahsil Edilen 300 / Kalan 600 değişmedi; bakiye 0."),
}
have = {(row["cari"], row["alan"]) for row in doc["farklar"]}
added = 0
for row in actual:
    key = (row["cari"], row["alan"])
    if key in have:
        continue
    if key not in KARAR:
        raise SystemExit(f"KARAR YOK: {key} {row['eski']} → {row['yeni']}")
    karar, note = KARAR[key]
    doc["farklar"].append({"cari": row["cari"], "alan": row["alan"], "eski": row["eski"], "yeni": row["yeni"], "karar": karar, "not": note})
    added += 1
extra = " Kapanış düzeltme turu (12.11.2026): V1–V4 (açılıştan sonra değişen satış kartı; Kartı Kapat) — 15 fark."
if isinstance(doc.get("aciklama"), str) and "V1–V4" not in doc["aciklama"]:
    doc["aciklama"] += extra
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(path, "a", encoding="utf-8").write("\n")
print("eklendi", added, "toplam", len(doc["farklar"]))
