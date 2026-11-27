# Cari kâhini bakımı 27 — rapor taslağı (KARARLAR.md §39)

## Özet
- S249 = A, S251 = A, S250 = C kâhine işlendi; bakım 26'nın SK-48 (azaltma) ve SK-50 (iadeli Düzenle) susmaları KALKTI, SK-49 aynen (neden metninde "S250 = C").
- Yeni SUS: SK-51 (UÇ) — kapanmış VE ödemeli kendi kartında azaltma (KAPSAM'ın kolları saymıyor; S250'nin azaltma karşılığı).
- Program ↔ kâhin iki TZ'de 24.613/24.613 (0 fark); bakım 26'nın P-1'i kapandı; yapım aşaması listesi 0 → 0.

## Değişen / kalkan susmalar
| Kural | Girdi satırı | Kâhin |
|---|---|---|
| S249 = A (a) ödemeli | §1 seçenek A + KAPSAM "(a) ödemeli kart" | kart yeni tutarla yeniden kurulur, ödeme tek kuyrukta, fazla = avans (d57 K3, d58 T1, d59 U1 / U2) |
| S249 = A (b) kapanmış tahsilatsız | KAPSAM "(b) … (S235 = B: kart AÇIK kurulur)" | AÇIK kurulur (d58 T2, d59 U4) |
| S249 = A (c) açık tahsilatsız | §1 "açık / tahsilatsız kartta 900 → 600 ise kart 3 × 200" | 3 × 200 (d58 T3 — P-1 kapandı) |
| §36 KAPSAM (e) kendi kart kolu | KAPSAM "kendi kart için GEÇERSİZDİR" | kalktı; Mevcut Borç kartında aynen |
| SK-51 (yeni SUS) | KAPSAM "kararın söylemediği alt durum → SUS" | kapanmış + ödemeli azaltma (d59 U3) |
| S251 = A | §2 seçenek A + KAPSAM "REDDEDİLİR; … DEĞİŞMEZ" | ret, sayılar Düzenle'siz (d58 R4, d59 U5 / U6); iade iptalinden sonra olağan (U7) |
| S250 = C | §3 | SK-49 SUS aynen, neden "BİLİNEN SINIR (kullanıcı kararı S250 = C)" (d58 R3) |

## Sayılar
- Öz test 8.855/8.855 (iki TZ) · G3 665/665, BEKLENMEYEN 0 (83 değişen: S249 51, S251 30, GENEL 2) · elle fark 112/112 · yeni / değişen elle 475/475 (ilk koşuda) · eski kâhin kırmızısı 68/475.
- Program ↔ kâhin: ilk koşu 24.610/24.613 (bağdaştırıcı okuma eşlemesi — reddedilen Düzenle'den sonra kart okunmuyordu; düzeltildi), son 24.613/24.613 UTC + Europe/Istanbul. Program ↔ eski kâhin 638/642.

## KULLANICIYA SORULMALI
- SK-51 (UÇ): A açık kurulur (program GÖZLEMİ) / B kapanış korunur / C (ÖNERİ) Uç durum böyle kalsın.
