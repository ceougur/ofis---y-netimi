# 31e tur 14 — yalın söz / taahhüt kolonu para kolonu değil — is/r31e-f, kod 2bcaa71 (taban aday 22 = 49072ca; tur 13 sonrası f8e9ae4)

## Bulgu (ORTA; f8e9ae4 gerilemesi + para)
- Tur 13'te söz tutarı tek tanıma geçti. Aday 22'nin yalın söz kolonunu ayıran denetimleri (tek tutar, Genel Toplam'ın öbürü, not adayları) bu geçişle kalktı. Yalın söz kolonu: "Ödeme Sözü" altına tutar yazılmış, tutar / miktar sözcüğü yok.
- f8e9ae4'te:
  - Ali "Ödeme Sözü" 1.500 Tablodaki Kişiler'de ve Açılış Bakiyesi ön dolumunda borç.
  - "Tutar" + "Ödeme Sözü" sekmesinde "borç sütunu seçilemedi" notu çıkıyor; Deniz borçsuz.
- Aday 22'de:
  - Ali'nin söz kalemi tutarı "Ödeme Sözü" kolonundan 1.500.
  - Deniz borçsuz ve notsuz.

## Karar (koordinatör; A1 "Ödeme Sözü tutarı borç değil") ve uygulama
- Söz / taahhüt ailesi başlığı (`PROMISE_HEADER`) üç biçimde sınıflanır:
  - Tutar / miktar taşıyorsa: söz tutarı (borç değil, söz kalemi).
  - Dönem sözcüğü taşıyorsa ("Taahhütlü Ücret", "Taahhütlü Kira"; `EXPECTED_AMOUNT_HEADER`): normal sınıflanır (5b).
  - İkisi de yoksa: PARA KOLONU SAYILMAZ. Borç adayı değildir, söz kalemi tutarı da olmaz (Z6 aynen).
- Tek tanım `debt-column.mjs` `isBarePromiseHeader`. İki yerde dışlar:
  - `amountCandidates`: borç düzeni, Tablodaki Kişiler.
  - `dues.mjs` `moneyLike`: kalem tutarı.

## Nasıl bozulur
- Yalın söz kolonu borç olur (Kişiler, Açılış Bakiyesi).
- Yalın söz kolonu söz kalemi tutarı olur.
- Yalın söz kolonu tutar sayısına katılıp gerçek borcu siler ya da not açar.
- Dönem sözcüklü söz kolonu ("Taahhütlü Ücret") borçtan / dönemden düşer.
- Kalan'ı boş satırda yalın söz kolonu borç olur.

## Kanıt
- Yeniden üretim. Betik `betik/tablo-kos.mjs`, senaryo `betik/soz-yalin.json`.
  - v2.4.3: `ham/soz-yalin-v243.out`.
  - Aday 22 (ayrı kopya): `ham/soz-yalin-aday22-49072ca.out`.
  - f8e9ae4: `ham/soz-yalin-f8e9ae4.out`.
  - 2bcaa71: `ham/soz-yalin-2bcaa71.out`.
- 2bcaa71'de:
  - Kişiler: Deniz 4.000, Ece 3.000, Fikret 450, Gaye 3.000, Irmak 1.800. Ali, Banu, Cem, Hakan yok; not yok.
  - Takvim: Ali boş, Deniz 4.000 / 4.000.
  - Vade / Nakit 12.250 (aday 22 ve f8e9ae4: 9.750).
- v2.4.3'te Ali 1.500 ve Deniz 1.000 ("Ödeme Sözü" kolonundan) Kişiler'de borçtu. 2.4.4 A1 kararıyla ikisi de söz tutarı / borç değil.
- Komşu senaryolar: `betik/soz-borc.json`, `betik/telekom.json`. Takvim ve Kişiler f8e9ae4 ile birebir (`ham/komsu-*-2bcaa71.out`).
- Kırmızı → yeşil:
  - Yeni testler aday 22'nin ayrı kopyasında 3/3 kırmızı (`kirmizi-aday22-49072ca-yeni-testler`): Deniz yok; Ali kalemi 1.500; Nakit 9.750.
  - f8e9ae4 kopyasında 3/3 kırmızı (`kirmizi-f8e9ae4-yeni-testler`): Kişiler +Ali 1.500 −Deniz 4.000; Ali kalemi 1.500 / 1.500; Nakit 9.750.
  - Yeni kodda: `tablo-borc-r31e-yesil` 11/11 (tur 11–14), `komsu-testler` 1197/1197.
- Mutasyon `mutasyon-kimlik-bag-dar` (MUT_SEC: M31, M33, M48–M62) 17/17 yakalandı.
  - Yeni mutasyonlar:
    - M60: yalın söz borç adayı olur.
    - M61: yalın söz kalem tutarı olur.
    - M62: dönem sözcüğü denetimi yok.
  - M31 / M33 (Y1) dizgeleri değişen satırlara uyarlandı. Bu iki mutasyon yeni satırlarla bulunamıyordu, tarama yakaladı. 61 mutasyonun dizgesi kodda tek kez geçiyor.
- e2e (flock altında, 2bcaa71): run 50/50, senaryo-kayit-tahsilat-244 46/46, senaryo-rapor 90/90, uiux-ui11-244 153/153, senaryo (Tablodan Aktar) 47/47, senaryo-cari-243 48/48, senaryo-216 54/54, senaryo-219 42/42, senaryo-kayit-bag-31e 43/43.
- `goc-v243` 46/46.
- Bağımsız cari kâhini `kahin-cari-e546d4b-tum` (is/kahin-244 e546d4b, koşu anında log -1; dokunulmadı; ayrı kopya, program 2bcaa71): 34 senaryo, 3843/3845.
  - Tur 14 senaryosu b3x-yalin-soz-ve-tutar yeşil; mutasyon 70 yakalandı.
  - Kalan 2 fark tur 15'in bulgusu: b3n "Takip" sekmesi, Can Er / Ece Su için görünür not yok. Tur 15'te ayrı commit ile düzeltiliyor.
