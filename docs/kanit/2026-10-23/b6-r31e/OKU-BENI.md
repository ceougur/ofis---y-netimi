# 31e tur 11 Z4 — is/r31e-f, kod 26e6573 + b0ef5eb, test eki bu commit (taban aday 21 = 8def842)

## Bulgu (YÜKSEK; 007eb2e gerilemesi, v2.4.3'te yok)
- Z3 düzeltmesi (007eb2e) söz kolonunu `PROMISE = /\b(soz\w*|taahhut\w*)\b/` ile tanıyordu. Bu kalıp "Sözleşme Tutarı" sütununu da yakalıyordu.
  - Sonuç: ödeme sözü kalemi bütün sözleşme tutarını aldı.
  - Aday 21, tur11 senaryosu:
    - Ali Veli: Sözleşme Tutarı 50.000, Kalan 9.000, Söz Tutarı 3.000 → kalem 50.000.
    - Can Er: Sözleşme Tutarı 60.000, Kalan 5.000 → kalem 60.000.
    - Ayşe Kaya: Sözleşme Tutarı 40.000, Kalan 2.000, söz boş → kalem 40.000.
    - Nakit Akışı / Vade Takip Beklenen 153.300. v2.4.3'te 12.800, doğrusu 13.300.
- Aynı geniş kalıp `labelFor` ve vade girdisinin `promise` işaretinde de kullanılıyordu. "Sözleşme Son Ödeme" kalemi aday 21'de "Ödeme sözü" sayılıyordu (promise true).

## Karar (koordinatör, 23.10.2026) ve uygulama
- Söz tutarı sütunu yalnız "söz / sözü / ödeme sözü / taahhüt" sözcüğü ile "tutar" sözcüğünü birlikte taşıyan başlıktır: "Söz Tutarı", "Ödeme Sözü Tutarı", "Taahhüt Tutarı".
  - "Sözleşme …" başlıkları söz değildir. "Söz" geçen başka adlar da söz değildir.
  - Sütun yoksa ya da hücre boşsa önceki kural geçer.
- `server/lib/insight/dues.mjs`:
  - `PROMISE = /\b(soz|sozu|taahhut|taahhudu)\b/` (tam sözcük). Söz tutarı kolonu ayrıca `PROMISE_AMOUNT = /\btutar\w*\b/` ister.
  - Dönem kolonu süzgeci, `labelFor` ve `promise` işareti aynı kalıbı kullanır.
- Boş söz hücresi (b0ef5eb, kâhin b3t ile aynı): kalem söz kolonu yokmuş gibi hesaplanır. Tek dönem kolonu varsa min(dönem, Kalan), yoksa satır borcu.
  - Ayşe Kaya 2.000 (Kalan). v2.4.3'te bu satırın kalemi boştu (null).
- Ek karar: "Sözleşme Tarihi" ve "Sözleşme Başlangıç" vade / son ödeme / söz tarihi değildir, vade kalemi açmaz.
  - Aday 21'de de açmıyordu (`ham/sozlesme-tarihi-*.out`). Koruma testi eklendi.

## Tarama (aynı kalıp başka yerde)
- `debt-column.mjs` PROMISE_AMOUNT_HEADER zaten tam sözcük. A1 (söz sekmesi tanıma, söz tutarı borç değil) etkilenmez.
- dues.mjs STRONG / temporal tarih sınıflaması "soz" / "sozu" tam sözcük. "Sözleşme Son Ödeme" vade tarihi olarak kalır; doğru, çünkü son ödeme tarihidir.
  - Etiket: aday 21 "Ödeme sözü" → şimdi "Kira Bedeli" (tutar kolonu).
- BİLGİ (karar dışı, iki sürümde aynı): "Sözleşme Bitiş" tarih kolonu Vade Takip'te tutarsız "Yaklaşan" satır açıyor (Nur Ay, `ham/sozlesme-tarihi-*.out`, tutar null; Takvim'de kalem yok). Karar gerekirse koordinatöre.

## Nasıl bozulur
- Söz kalıbı yeniden genişler: "Sözleşme Tutarı" söz tutarı sayılır.
- "Söz" sözcüğü geçen ama "tutar" sözcüğü geçmeyen para kolonu (ör. "Söz Öncesi Ödenen") söz tutarı sayılır.
- Boş söz hücresinde kalem kaybolur, dönem tutarını Kalan'sız alır ya da satır borcunu atlar.
- "Sözleşme Son Ödeme" kalemi "Ödeme sözü" etiketi alır.
- "Sözleşme Tarihi" / "Başlangıç" vade kalemi açar.

## Kanıt
- Yeniden üretim. Betik `betik/tablo-kos.mjs`; senaryolar `betik/z3-komsu.json` (tur11), `betik/tarih.json`, `betik/bitis.json`.
  - v2.4.3: `ham/tur11-senaryo-v243.out`.
  - Aday 21: `ham/tur11-senaryo-aday21-8def842.out`.
  - b0ef5eb: `ham/tur11-senaryo-b0ef5eb.out`. Ali 3.000, Can 5.000, Ayşe 2.000; Nakit / Vade 13.300.
  - v2.4.3 ile b0ef5eb arasındaki 500 fark Z1 / Z2 kararlarından gelir (Ece 1.000 → 500, Gül Kalan 0 → kalem yok, Ayşe +2.000).
- Kırmızı → yeşil: `ham/kirmizi-aday21-8def842-yeni-testler.out`. Aday 21'in ayrı kopyasında yeni testler 2/2 kırmızı. İletide görülen nedenler:
  - Ali 50.000 ≠ 3.000, Ayşe 40.000 ≠ 2.000, Can 60.000 ≠ 5.000.
  - Jale promise true.
  - Nakit 154.000 ≠ 14.000.
- `komsu-testler` 1188/1188 (b0ef5eb).
- Bağımsız cari kâhini (is/kahin-244; dokunulmadı; `KAHIN_PROGRAM_KOKU`, program b0ef5eb, kâhin ayrı kopyada):
  - `kahin-cari-81fd1b1-tum`: 30 senaryo, 3667/3667, 0 fark (b3t).
  - `kahin-cari-6bc10ff-tum`: 31 senaryo, 3701/3701, 0 fark, mutasyon 62–64 yakalandı (b3u).
- Mutasyon:
  - `mutasyon-kimlik-bag` 48/49 (b0ef5eb, eski test dosyasıyla). **M49 (söz tutarı "tutar" sözcüğü istemez) yakalanmadı**: testte söz sözcüğü taşıyan tutarsız para kolonu yoktu.
  - Eksik test eklendi: "Söz Öncesi Ödenen" (söz sözcüğü var, tutar yok) → söz kalemi Kalan 6.000, 1.500 değil. Ayrıca "Taahhüt Tutarı" 2.500 ve "Ödeme Sözü Tutarı" 1.000 söz tutarıdır.
    - Aday 21'de kırmızı: `ham/kirmizi-aday21-8def842-m49-testi.out` (Mert 1.500 ≠ 6.000; Nakit 5.000 ≠ 9.500).
    - Yeni kodda yeşil: `tablo-borc-r31e-yesil` 4/4, `tablo-borc-tum` 64/64.
  - `mutasyon-kimlik-bag-z4` (MUT_SEC=M48,M49,M50, yeni testle) 3/3 yakalandı.
  - Öbür 46 mutasyon tam koşuda yakalandı. Test yalnız eklendiği için yakalananlar azalmaz.
  - Tur 11 mutasyonları:
    - M48: söz kalıbı yeniden geniş (`soz\w*`).
    - M49: söz tutarı "tutar" sözcüğü istemez.
    - M50: boş sözde dönem kolonu yoksa kalem satır borcunu almaz.
- e2e (flock altında, b0ef5eb): run 50/50, senaryo-kayit-tahsilat-244 (zil / Tahsil Et) 46/46, senaryo-216 54/54, senaryo-210 57/57, senaryo-226 25/25, senaryo-k8-230 17/17, senaryo-cari-243 48/48, senaryo-rapor 90/90, senaryo (Tablodan Aktar) 47/47, senaryo-219 42/42, uiux-a-243 51/51, uiux-ui11-244 153/153, senaryo-kayit-bag-31e 43/43.
- `goc-v243` 46/46 (b0ef5eb). Kanıttaki "+1 değişmiş dosya" yalnız sonradan eklenen birim testi; göç onu kullanmaz, ürün kodu b0ef5eb.
