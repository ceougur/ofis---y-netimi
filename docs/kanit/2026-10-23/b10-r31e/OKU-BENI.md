# 31e tur 15 — tutar kolonu olmayan sekme notsuz düşmez — is/r31e-f, kod 26bb456 + 35a7711 (taban aday 22 = 49072ca; tur 14 sonrası a4274a5)

## Bulgu (ORTA; Y1 kararı eksik uygulanmıştı; kâhin is/kahin-244 e546d4b, senaryo b3n-borc-kolonu-kisi-ozniteligi)
- "Takip" sekmesinde (Dosya No, Borçlu, Borçlu Telefon, Son Ödeme — tutar yok) kişiler Can Er / Ece Su Tablodaki Kişiler'de yok. Kendi sekmeleri için görünür not da yok; görünen tek not "Masrafli"yi adlandırıyor.
- Kâhinle yeniden üretim (ders 6), `ham/kahin-b3n-*.out`:
  - Aday 22 (ayrı kopya): 35 denetim, 2 fark (`k1:rapor:2026/701|702:gorunurVeyaNot`).
  - a4274a5: aynı 2 fark.
  - v2.4.3 (ayrı kopya): Takip satırlarının telefon numarası borç / kalem tutarı sayılıyordu (532.111.223.300 kuruş vb.; Y1 öncesi). Satırlar görünüyordu ama borç yanlıştı.
- Y1 kararı (23.10): "Borç kolonu yoksa (yalnız kişi / tarih kolonları; söz de yok) ya da iki tutar kolonu varken Kalan / toplam yoksa borç YOK (bütün raporlarda 0) ve satır görünür ya da raporda görünür not."
  - Tur 8'de yalnız ikinci kısım uygulanmıştı ("seçilemedi" notu).

## Uygulama
- `debt-column.mjs`:
  - `debtPlan` `noAmount`: tutar adayı yok ve seyrek borç kolonu yok.
  - `isDebtColumnMissing(plan, columns)` = noAmount ve sekmede söz / taahhüt kolonu (PROMISE_HEADER) yok.
- `reports.mjs`:
  - Kayıt `debtMissing` taşır.
  - `tableNotes` sekmeyi adlandıran not yazar: "“Takip” sekmesinde borç sütunu yok: bu satırlar borç olarak sayılmadı. Borç için “Kalan Borç”, “Toplam Borç” ya da “Tutar” başlıklı bir sütun ekleyin." Biçim Y1 "seçilemedi" notuyla aynı.
  - Tablodaki Kişiler ve `routes/reports.mjs` (Vadeler, Nakit Akışı) aynı süzgeci kullanır; Sekme süzgecinde yalnız seçili sekmenin notu çıkar.
- Takvim'de bu satırların kalemleri zaten görünür (tutarsız); not eklenmedi.
- Söz sekmesi (söz tarihi / söz tutarı; A1) not açmaz. Borçlar değişmez.
- Beklentisi değişen test: tur 8 Y1 testi (`test/tablo-borc-r31e.test.mjs`).
  - Tutar kolonu olmayan dört sekme (BorcluTel, BorcluSicil, BorcluTCHatali, BorcIletisim — yalnız telefon / TC / sicil) artık notla.
  - Neden: tur 8'deki beklenti kararın "görünür not" kısmını içermiyordu.
  - Eski kodda (a4274a5) kırmızı: `kirmizi-a4274a5-tur8-y1-beklentisi`, 1/4. Yeni kodda yeşil.
- Görünür etki: yalnız kişi / telefon kolonlu bir rehber sekmesi de Kişiler, Vadeler ve Nakit Akışı'nda bu notu alır (Y1 metni "yalnız kişi / tarih kolonları").

## Nasıl bozulur
- Not hiç yazılmaz.
- Not söz sekmesine de yazılır (A1 aykırı).
- Not yalnız Kişiler'de çıkar (Vadeler / Nakit'te yok) ya da yalnız onlarda çıkar.
- Seyrek "Kalan Borç" kolonlu sekme yanlışlıkla "borç sütunu yok" notu alır.
- Sekme süzgeci notu süzmez.
- Borçlar değişir.

## Kanıt
- Yeniden üretim (kendi betiği): `betik/tablo-kos.mjs` + `betik/takip.json`.
  - v2.4.3: `ham/takip-v243.out`.
  - Aday 22: `ham/takip-aday22-49072ca.out`.
  - 26bb456: `ham/takip-26bb456.out`.
  - 26bb456 sonucu: Kişiler'de yalnız Hale 1.000 ve notlar Masrafli + Takip + Rehber; SozTarihYalniz notsuz. Vadeler / Nakit aynı notlar; Takvim notları değişmedi.
- Kırmızı → yeşil:
  - Yeni testler aday 22 ve a4274a5 ayrı kopyalarında 2/2 kırmızı. Neden iletide: Takip / Rehber notları yok; borçlar aynı.
  - Yeni kodda: `tablo-borc-r31e-yesil` 13/13 (tur 11–15), `tablo-borc-tum` 102/102 (tablo-borc ×3 + kalan-borc ×2), `komsu-testler` 1199/1199.
- Mutasyon `mutasyon-kimlik-bag-dar` (MUT_SEC: M58–M60, M63–M67), 35a7711 temiz ağaçta: 8/8 yakalandı.
  - Yeni mutasyonlar:
    - M63: not yok.
    - M64: söz sekmesi de not alır.
    - M65: Vadeler / Nakit süzgeci eski.
    - M66: Kişiler süzgeci eski.
    - M67: seyrek kolon sayılmaz.
  - İlk koşu, test dosyası koşu sırasında değiştirildiği için GEÇERSİZ sayıldı (ders 23 / 25 ailesi: kopyalar eski tur 8 beklentisini aldı). Aynı adla yeniden koşuldu; bu dosya ikinci koşudur.
- e2e (flock altında, 35a7711): run 50/50, senaryo-kayit-tahsilat-244 46/46, senaryo-rapor 90/90, uiux-ui11-244 153/153, senaryo (Tablodan Aktar) 47/47, senaryo-cari-243 48/48, senaryo-216 54/54, senaryo-219 42/42, senaryo-kayit-bag-31e 43/43.
- `goc-v243` 46/46.
- Bağımsız cari kâhini `kahin-cari-e546d4b-tum` (is/kahin-244 e546d4b, koşu anında `git -C /home/user/wt/kahin-244 log -1`; dokunulmadı; ayrı kopya, `KAHIN_PROGRAM_KOKU`, program 35a7711): 34 senaryo, 3845/3845, 0 fark (b3n dahil).

## Yalnız rapor (düzeltilmedi — kullanıcı kararı DONDURMA, 14:42 UTC)
- Koddan (denenmedi): yalnız ödenen kolonu ("Tahsil Edilen") olan sekmede tutar adayı var (noAmount yanlış), borç kolonu yok ve "seçilemedi" notu da yok. Kişiler notsuz düşer; aday 22'de de aynı (gerileme değil).
