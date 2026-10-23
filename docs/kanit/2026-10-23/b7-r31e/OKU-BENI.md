# 31e tur 12 Z5 / Z6 — is/r31e-f, kod 96cadc0 (taban aday 22 = 49072ca)

## Bulgular (dar kontrol tur 12; ikisi DÜŞÜK ama para: beklenen tahsilat)
- **Z5** (26e6573 gerilemesi; v2.4.3'te ve aday 21'de yok).
  - Neden: aday 22'de PROMISE `\b(soz|sozu|taahhut|taahhudu)\b` tam sözcüktü; "Taahhütname Tarihi" ve "Taahhütlü Ödeme Tarihi" söz sayılmıyordu. STRONG kalıbı ise `taahhut\w*` ile hâlâ kalem açıyordu.
  - Sonuç: kalem satır borcunu aldı (Gül 2.500, Işıl 4.500). v2.4.3'te bu kalemler söz tutarıydı (500 / 800).
  - Kalem Ödeme Sözü listesinden ve taksit kartlı kayıtta (routes/dues.mjs:73) düşüyordu.
- **Z6** (v2.4.3'te de): "Söz Miktarı" / "Taahhüt Miktarı" söz tutarı sayılmıyordu. Fırat 3.000 (söz 600), Hakan 3.500 (söz 700).

## Karar (koordinatör) ve uygulama (`server/lib/insight/dues.mjs`)
- Söz ailesi:
  - Taahhüt ailesi önek olarak söz sayılır: `PROMISE = /\b(soz|sozu|taahhut\w*|taahhud\w*)\b/`.
  - Söz ailesi tam sözcüktür (söz, sözü). Dışarıda kalan yalnız "sözleşme…".
  - STRONG kalıbına `taahhud\w*` eklendi; "Taahhüdü Tarihi" vade kolonudur. Aday 22'de bu kolonun kalemi yoktu.
- Söz tutarı:
  - Söz sözcüğü + "tutar" ya da "miktar" sözcüğü: `PROMISE_AMOUNT = /\b(tutar\w*|miktar\w*)\b/`, tek yardımcı `isPromiseAmountHeader`.
  - "Söz Miktarı" sayı rolündedir, para değildir. Bu yüzden söz tutarı adayı para ya da sayı rolündeki kolondur.
- Koruma (önek genişlemesinin yan etkisi):
  - Dönem kolonundan yalnız söz TUTARI başlığı dışlanır.
  - Önceki `!PROMISE` süzgeci "Taahhütlü Ücret"i de dışlıyordu. "Taahhütlü Ücret 450 + Kalan 1.350" kalemi 1.350'ye kayıyordu; aday 22 ve v2.4.3'te 450.
  - Şimdi 450 (`ham/telekom-*.out`; aradaki sürümde ölçüldü, düzeltildi).

## Nasıl bozulur
- Taahhüt yine tam sözcük olur; "taahhüd" öneki düşer.
- STRONG "Taahhüdü Tarihi"yi tanımaz.
- "Miktar" söz tutarı sayılmaz.
- Söz tutarı adayı yalnız para rolünden seçilir.
- Dönem süzgeci söz sözcüğünü dışlar ("Taahhütlü Ücret").
- Söz kalıbı yeniden genişler ("Sözleşme").
- Söz tutarı tutar / miktar sözcüğü istemez.

## Kanıt
- Yeniden üretim. Betik `betik/tablo-kos.mjs`. Senaryolar:
  - `betik/soz-baslik-genis.json`: tur12 soz-baslik.json + Taahhüt Miktarı, Taahhütlü, Ödeme Taahhüdü, Taahhütname tek kolon, Telekom.
  - `betik/telekom.json`.
  - `betik/a1-kisiler.json`.
- Sürüm çıktıları:
  - v2.4.3: `ham/soz-baslik-v243.out`.
  - Aday 22 (ayrı kopya): `ham/soz-baslik-aday22-49072ca.out`.
  - 96cadc0: `ham/soz-baslik-96cadc0.out`. Gül 500, Işıl 800, Fırat 600, Hakan 700, Kaan 650 (söz); "Sözleşme Ödeme Tarihi" söz değil (Ece 20.000).
- Kırmızı → yeşil:
  - `ham/kirmizi-aday22-49072ca-yeni-testler.out`: aday 22'nin ayrı kopyasında yeni testler 2/2 kırmızı. İletide: Fırat 3.000 ≠ 600, Gül 2.500 / söz değil, Hakan 3.500, Işıl 4.500 / söz değil, Kemal kalemi yok; Nakit 15.050 ≠ 4.450.
  - Yeni kodda: `tablo-borc-r31e-yesil` 6/6 (tur 11 + 12), `tablo-borc-tum` 66/66, `komsu-testler` 1192/1192.
- Mutasyon `mutasyon-kimlik-bag-dar` (MUT_SEC: M40, M46–M56) 12/12 yakalandı.
  - M48 / M49 yeni koda uyarlandı.
  - Yeni mutasyonlar:
    - M51: taahhüt tam sözcük.
    - M52: taahhud öneki yok.
    - M53: STRONG'da taahhud yok.
    - M54: miktar yok.
    - M55: söz tutarı yalnız para rolü.
    - M56: dönem süzgeci söz sözcüğünü dışlar.
  - 55 mutasyonun dizgesi kodda tek kez geçiyor (denetlendi).
- e2e (flock altında, 96cadc0): run 50/50, senaryo-kayit-tahsilat-244 (zil / Tahsil Et) 46/46, senaryo-rapor 90/90, uiux-ui11-244 153/153.
- Bağımsız cari kâhini `kahin-cari-e5d2cda-tum` (is/kahin-244 e5d2cda; dokunulmadı; ayrı kopya, `KAHIN_PROGRAM_KOKU`, program 96cadc0): 32 senaryo, 3744/3744, 0 fark.

## Açık (DÜŞÜK, karar dışı; 2.5.0 adayı)
- A1 tutarlılığı: `debt-column.mjs` PROMISE_AMOUNT_HEADER (söz tutarı borç değil) hâlâ tam sözcük `soz|sozu|taahhut|taahhudu`.
  - Yalnız "Taahhüt Tutarı" kolonu olan sekme: Kişiler'de borç sayılmaz.
  - Yalnız "Taahhütname Tutarı" kolonu olan sekme: Kişiler'de borç 700 (`ham/a1-kisiler-96cadc0.out`); Takvim aynı kolonu söz tutarı sayıyor. Aday 22'de de borç 700 idi.
  - Debt-column'a öneki tümden eklemek "Taahhütlü Ücret"i de borçtan çıkarırdı (5b'ye aykırı).
  - Öneri: debt-column'da "tam sözcük söz ailesi YA DA (taahhüt öneki + tutar / miktar)".
