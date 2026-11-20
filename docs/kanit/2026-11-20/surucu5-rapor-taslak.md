# Muhasebe sürücüsü bakımı 5 — rapor taslağı (adım adım; kapsayıcı yeniden başlarsa buradan sürer)

## Hazırlık
- Worktree `git reset --hard c7b-aday` = df7e93ca (Ç7b aday: toplu kâhin bakımı 14 birleşimi), `git log --oneline -4` doğrulandı.
- `node_modules` bağı ana ağaca. Ortam: yük 1,6 / 4 çekirdek, bellek boş 9 GB, disk boş 6,5 GB.
- Okundu: CLAUDE.md, BAGIMSIZ-DOGRULAMA-PRENSIBI, sürücü (kos.mjs, program.mjs, karsilastir.py, siniflama.json, gerileme.py), kâhin README 'Senaryo dili' + 'Kâhin bakımı 14',
  kahin-toplu14-rapor 'SÜRÜCÜ İÇİN' 1–6, c7b3b-rapor C, c7bt-rapor C, karar dosyası surucu5-kararlar.md, surucu4-rapor.
- Eski kod kopyası: `git archive c7b2-taban ':!docs/kanit'` → scratchpad/surucu5-a293/eski (88 MB).

## Adım 1 — taban koşusu (bakım ÖNCESİ sürücü, c7b-aday)
- İki TZ, --paralel 2, flock -s olcum.lock, ~33 dk. kanit: BAŞARISIZ (çıkış 1) · 7.750/7.946 geçti, 50 başarısız, 146 atlanan.
- Sınıflar: AYNI 7.242 · U 508 · P 18 · K 0 · R 2 · SINIFLANMADI 20 · ÖLÇÜLEMEDİ 124 · SUSMA 22 (adım 4, ara 8) · red farkı 0 · uygulanamayan 0.
- Kırmızılar: s40 / s60 / s121 Kartı Kapat adımları (C7b6-KAPAT ↔ Borçta Kalsın; s60 TK2 `eski` güncel Kartı Kapat'a eşleniyor), s91 mz0 UTC (yeni; TE1 açıldı),
  s91 mz1 R (eski R-B5), s118 af1 F1 program 50.000 ↔ kâhin 20.000 (S200 Açık Faturalar — yeni, incelenecek), P6 (s81, s82, s94, s103), P4 (s14).
- R-S192-BAG-SONRA (rastgele-1 / -2) ATEŞLEMEDİ (bakım 4'te R idi) — incelenecek. P7 ATEŞLEMEDİ (program artık kartı açıyor).
- Döküm: surucu5-onceki-dokum.txt; kanıt surucu5-onceki.json / .log.gz / -ozet.json.gz.

## Adım 2 — eşlemeler (not defterinde hazırlandı, taban koşusu bitince yerine konur)
- karsilastir.py: C7b6-KAPAT (ETIKET / KIMLIK / degistir / bugun_olay dönüşümü) KALKTI; BEKLEYEN_ONEK'ten "Ç7b" kalktı (Ç7b kuralları sınanan kodda);
  `susmalar` "S213" S192 gibi yalnız listelenen raporda (önceki kod S192 dışındaki her kaydı S168 sayardı); Excel kartı programın eşlediği cariyle (`esle_cari`);
  "atlandi" (programın atladığı Excel satırı) uygulanamayan listesine (sessiz geçmez).
- program.mjs: `taksit_kapat {eski: true}` → Kartı Kapat + göç 53 işareti '2.4.9' (yalnız sütun varsa; eski sürüm aşamasında v2.4.9 kendisi kapatır);
  Excel kartı = yüklemeden önce olmayan + aynı adlı TEK yeni kart (önceki `.at(-1)` ad araması aynı adlı iki kişide yanlış kartı bulabiliyordu), bağlandığı cari → `esle_cari`,
  açılmadıysa "atlandi"; kartlar raporu Excel kartını eşlenen cariyle süzer.
- siniflama.json: P7 ×3 KALKTI; R-B5-YEREL-GUN-UTC/RAPOR-MZ0 eklendi (mz1'deki UTC günü kuralının aynısı, s91 mz0).
- Eşleme commit 4959ab79 (kos.mjs başlık notu dahil). Sınama koşusu (11 senaryo, iki TZ): s40 / s60 / s121 Kartı Kapat AYNI; s60 TK2 göç işareti '2.4.9';
  s91 TE1 / TE2 / TE3 kâhinin carisine bağlı, kt1 / g1a / g1b AYNI; kalan: s118 af1 (aşağıda), s91 mz0 / mz1 R (UTC).
- ATEŞLEME TARAMASI (taban koşusu, eski siniflama): ateşlemeyen U-S58, U-S69, U-S15 ×2 (Ç7b tur 3 programda), R-S192-BAG-SONRA ×2 (S212 = A tek aday düzeltme
  9db9b69d; ek-bag-sonra c7b-aday'da AYNI, c7b2-taban'da eski fark 120 1.000 / 128 1.000 ↔ kâhin 2.000 / 0), OLC-S87/RAPOR → kalktı.

## Adım 3 — s118 af1 (S200 × Açık Faturalar) kök neden
- En küçük örnek ek-s200-acik-fatura (s118'in C1 kısmı: F1 50.000 vade 10.02, BY1 30.000 vade 15.03, 01.02 Mevcut Borç kartı 60.000, 16.02 gecikmiş + Açık Faturalar):
  c7b-aday iki TZ: gecikmiş 20.000 AYNI; Açık Faturalar F1 program 50.000 ↔ kâhin 20.000. c7b2-taban aynı 50.000; v2.4.9 aynı 50.000 (gecikmiş 0 — eski kuyruk).
- Kök: server/routes/invoices.mjs openItems — Açık Faturalar `net` istemez (v2.0.23 Bulgu 2 D yorumu: "Açık Faturalar raporu ve fatura kartı faturanın kendi açığını gösterir");
  kâhin 'fatura durumu' görünümü kartın tükettiği kısmı kapanmış sayar (README R5 / M1e, bakım 14 İ1). Karar metni (S200 = A) Açık Faturalar'ı söylemiyor → R, kullanıcıya.
- Sürücü: R-S200-ACIK-FATURALAR-KART-PAYI (s118, af1 + af3 aynı kök).

## KULLANICIYA SORULMALI (taslak)
1. Mevcut Borç kartının içine aldığı faturanın Açık Faturalar ve Yaşlandırma raporundaki kalanı (S200 / M1e; rapor kuralı — bakiye ve cari kartının Gecikmiş Borç'u
   iki okumada AYNI). Örnek: F1 50.000 (vade 10.02) + Borç Yaz 30.000, 01.02'de Mevcut Borç kartı 60.000 (S200 = A: BY 30.000 + F1'in 30.000'i), 16.02.
   A (kâhin): F1 kalan 20.000 (kartın aldığı kısım kartın taksitlerinde) — cari kartı Gecikmiş Borç 20.000 ile aynı.
   B (program bugün, v2.0.23'ten beri): F1 kalan 50.000, 6 gün gecikmiş görünür (kartın 30.000'i 01.03 / 01.04 vadeli taksitte de görünür).
   UÇ DURUM DEĞİL — en küçük örnek 2 (ek-mevcut-borc-tum-fatura: elle borç yok, "Carinin Mevcut Borcu" kartı 50.000 faturanın tamamını alır): program Açık Faturalar'da
   F1 50.000 (6 gün gecikmiş), cari kartı Gecikmiş Borç 0; kâhin F1'i listelemez. v2.4.9 aynı (gerileme değil). Öneri A (yaşlandırma raporu cari kartının gecikmişiyle ve Vade Takip'le aynı sayıyı göstermeli; kartın kendi faturası
   zaten rapora girmiyor — "taksitli faturalar taksit kartında izlenir"). Yaygın programlar: doğrulanmış kaynak okunmadı.
