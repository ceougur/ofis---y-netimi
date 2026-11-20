# Ç7b TUR 2d — RAPOR (iş bitti; PUSH YOK)

**Dal ve taban**
- Dal: `worktree-agent-a187e057786d3b7e4`.
- Taban: `c7b2d-taban` (f0f1b88e). Worktree'yi `git reset --hard` ile sıfırladım, ucu doğruladım.
- Uç: **9d933883**, 7 commit, hepsi benim. Commit'lenmemiş iş yok, çalışan arka plan işim yok.
- Ortam: yük 1,6 / 4 çekirdek, boş bellek 7 GB, boş disk 8,8 GB. Kendi taban worktree kopyalarımı sildim.

## Değişen gözlenebilir davranış (önce → sonra)

**Fatura formu (yalnız alış faturası)**
- Önce: alan yoktu.
- Sonra: Tedarikçinin Fatura No'dan sonra **"KDV İndirim Dönemi"** açılır listesi var.
  - Seçenekler fatura ayından ("Aralık 2026 (Fatura Ayı)", varsayılan) izleyen yılın Aralık'ına kadar: Aralık 2026 faturasında 13 ay.
  - Tab ile alana gelinir, ok tuşuyla seçilir.
  - Tarih değişince seçenekler yeniden kurulur. Seçili ay yeni aralıkta kalmazsa fatura ayına döner ve görünür yazı çıkar: "Seçili dönem (Aralık 2027) yeni fatura tarihinin aralığında değil; KDV İndirim Dönemi fatura ayına alındı."
- Satış, iade ve makbuz formlarında alan yok.
- Belge kartında dönem belge ayından farklıysa "KDV İndirim Dönemi: Ocak 2027" satırı çıkar.
- Düzenle formu kayıtlı dönemle dolu açılır.
- PDF, UBL ve Excel dışa aktarma değişmedi.

**Sunucu doğrulaması** (400 dönüşleri, `field: vatPeriod`)
- Belge ayından önceki ay → `vat-period-range`: "KDV İndirim Dönemi faturanın ayından (Aralık 2026) önce olamaz."
- İzleyen yılın Aralık'ından sonraki ay → `vat-period-range`: "… en geç Aralık 2027 olabilir (fatura yılını izleyen yılın sonu)."
- Biçim yanlışsa → `vat-period`.
- Alış dışı türde dolu değer → `vat-period-kind`. Alıştan iade de dahil; değer sessizce yok sayılmıyor.
- Belge ayı seçilirse `''` saklanır; alan boşken tarih değişirse dönem yeni ayı izler.
- Taslak, Düzenle ve taslağı kesme yolları aynı denetimden geçer. Tekrarla ile kopyala dönemi taşımaz.

**KDV Mahsup Fişi** — örnek: Aralık 2026'da satış KDV'si 2.000, alış P1 200, alış P2 400 (31.12, dönemi Ocak); Ocak'ta satış 200, alış 100.
- Önce: Aralık İ 600.
- Sonra:
  - Aralık H 2.000 / İ 200 / ödenecek 1.800.
  - Ocak H 200 / İ 500 / devreden 300.
- Defter maddesi değişmedi: Aralık mahsubundan sonra 31.12'de 191 = 400 bekliyor. Ocak mahsubundan sonra 191 = 391 = 0, 190 = 300, 360 = −1.800.
- Mahsubu yapılmış aya alınan fatura o ayı "Mahsuptan Sonra Değişti" gösterir; engel yok (EK-1 M8 (6)).
- Mahsubu yapılmış aydan çıkarılan KDV S4 ile sonraki mahsuba taşınır; iki kez indirilmez. Örnek: Şubat İ = kendi 300 − taşınan 300 = 0.
- İptal Et, faturayı dönem ayının İ'sinden düşürür.

**Kilit izi** (tur 2c kararı (2))
- `LOCK_SQL_VERSION` 2.5.1 → **2.5.2**, B-7 düzeniyle.
- `rule_shift_lock`: geçiş günü ayarı, yalnız değer doluysa.
- `vat_offsets_rule_lock`: mahsubun kural sürümü, yalnız `rule_version` doluysa ve tarih ≤ kilit.
- v2.4.9 verisinde güncellemeden sonra yanlış alarm yok (period-lock ve ledger:snapshot temiz); 2.5.1 tanımının izi değişmiyor.
- Kapı dışı değişiklik "Donmuş Dönemin Kaynağı Değişti" olarak görünüyor.

**Şirket Verisini Sıfırla** (tur 2c kararı (3)): "Tüm Hareketleri Sil" artık `ledger.ruleShiftThrough`'u da siliyor.

**Göç 52**: `invoices.vat_period TEXT NOT NULL DEFAULT ''`. Yalnız sütun ekler, değer yazmaz (eski faturalar = belge ayı), tekrar koşulabilir.

**Kılavuz**: KDV Mahsup Fişi maddesinin altına "KDV İndirim Dönemi (geç gelen alış faturası)" maddesi eklendi. PDF yeniden üretildi ve `client/kilavuz`'a kopyalandı.

## Yeni ve değişen testler — tabanda kırmızı, yenide iki TZ'de yeşil
- **`test/c7b-kdv-donemi-250`** (5 test): tabanda 5 kırmızı.
  - (1) aralık dışı değer kabul ediliyor (beklenen 400, gelen 200).
  - (2) Aralık İ 600 (beklenen 200).
  - (3)–(4) sütun yok.
  - (5) iade kabul ediliyor (200).
- **`test/c7b-goc52-kilit-izi-250`** (3 test, v2.4.9'un gerçek kodundan veri): tabanda 3 kırmızı.
  - (a) "göç 52 sütunu ekledi".
  - (b) "geçiş günü: güncel kilit izi değişmeli".
  - (c) Sıfırla'dan sonra geçiş günü hâlâ `2026-09-30`.
- **`test/e2e/senaryo-kdv-donemi-250`** (19 denetim): tabanda 1 geçti / 4 kaldı (açılır liste yok).
- **BEKLENTİ BİLEREK DEĞİŞTİ:**
  - `c7b-kilit-izi-250`: 2.5.1 → 2.5.2.
  - `defter-kaynak-iz-250`: `vat_offsets.rule_version` istisnası kaldırıldı; tabanda "kilit izinde OLMAYAN … vat_offsets.rule_version" kırmızısı.
  - `donmus-defter-250`, `donmus-defter-yasam-250`, `kural-farki-kapi-disi-250`: göç 51 → 52; tabanda "51 !== 52".
- Yeni kodda 7 dosya, 49 / 49, iki TZ.
- Dondurma yarışı zorlaması (`c7b-goc52`, bitir ve gözlem kipleri): her kipte 2 / 2 ön koşul gerçekleşti ve yeşil.

## Mutantlar — 10'u da yakalandı (her biri 2 koşu × 2 TZ)
- M1 alanı yok say (hep belge ayı).
  - İlk tanımı etkisizdi (`[] &&` hiçbir şeyi değiştirmiyordu), bu yüzden "kaçtı" göründü.
  - `const period = month` olarak yeniden tanımlanıp koşuldu; yakalandı.
- M2a, M2b: üst sınır bir ay erken / bir ay geç.
- M2c: alt sınır bir ay erken.
- M3a, M3b: kilit izinde geçiş günü / mahsup kural sürümü eki yok.
- M3c: ek sürüme bağlı değil (2.5.1 koşusunda yanlış alarm).
- M4: Sıfırla geçiş gününü silmiyor.
- M5a: göç sütunu varsayılansız (NULL).
- M5b: göç belge ayını yazıyor.

## Komşular, ekran senaryoları, kâhin
- **G2 komşu** (taramayla 323 dosya, iki TZ): her TZ'de 3401 / 3402.
  - Tek kırmızı iki TZ'de aynı: `test/acilis-onarimi-hiz-250` "eşdeğerlik".
  - Tabanda da aynı kırmızı; Ç7b öncesi kodda (c7b2-taban) yeşil. Yani tur 2–2c'den kalma, tur 2d'nin değil.
  - Kök nedeni yeniden ürettim: v2.0.26 fikstüründe kilit 07.10.2026. Kilitli bir carisiz Kasa hareketi (08.08.2026) 649/770 → .90 alt hesabına geçiyor (K-01 / K-02). Bu bir Kural Değişikliği Farkı uyarısı veriyor (fark 0, breakdown boş). Beklenen döküm Ç7b öncesi kodla üretilmiş.
  - Testi değiştirmedim; tur 2e'nin işi.
- **Fatura / KDV ekran senaryoları** (taramayla 46 dosya + senaryo-211, iki TZ): 92 / 92 koşu çıkış 0, kalan 0.
- **Defter kâhini** (`npm run test:kahin-defter`) iki TZ: 183 / 187. Dört fark tabandakiyle aynı (K_EYLUL 191 / 391, K_SON 191 / 391); yeni kırmızı yok.
- **Kılavuz**:
  - `test:kilavuz-metin` 954 / 954; metin denetimi 880 / 880 ad.
  - `pdf-denetle` 39 / 39.
  - PDF metninde "KDV İndirim Dönemi" geçiyor.

## Sürücü için
- Program alanı: gövdede **`vatPeriod`** (YYYY-AA; `''` = belge ayı).
- `test/bagimsiz/muhasebe-surucu/program.mjs` 501–502. satırdaki `body.__kdvIndirimAyi = …; delete body.__kdvIndirimAyi;` yerine `body.vatPeriod = v.indirim_ayi`.
- Kâhinin `duzeltmeler[].indirim_ayi`'si için Düzenle yolu: `POST /api/workspace/invoices/:id/edit` gövdesinde `vatPeriod`.
- Sürücü dosyasına dokunmadım.

## Ana oturumun yeniden koşacağı komutlar ve beklenen sayılar
Hepsi `HUKUK_LICENSE_URL=http://127.0.0.1:9`, iki TZ.
- `node --test test/c7b-kdv-donemi-250.test.mjs test/c7b-goc52-kilit-izi-250.test.mjs test/c7b-kilit-izi-250.test.mjs test/defter-kaynak-iz-250.test.mjs test/donmus-defter-250.test.mjs test/donmus-defter-yasam-250.test.mjs test/kural-farki-kapi-disi-250.test.mjs` → **49 / 49**. Tabanda: yeni iki dosya 8 / 8 kırmızı, değişen beşte 5 kırmızı.
- `PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 node test/e2e/senaryo-kdv-donemi-250.mjs` → **19 geçti, 0 kaldı**.
- `npm run test:kahin-defter` → **183 / 187** (aynı dört fark).
- Komşu listesi: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2d-ana/komsu.txt` → 3401 / 3402 (yalnız acilis-onarimi-hiz-250).
- Mutant betiği: `python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2d-ana/mutant.py <worktree> <çıktı>`.

## Ekran yürüyüşü adımları (ana oturum)
1. Alış faturası formunu açın (Hizmet ve Gider Alışı). Tarihi 31.12.2026 yapın.
2. Tedarikçinin Fatura No → Tab → KDV İndirim Dönemi → ok tuşu → Ocak 2027 → kaydedin.
3. Belge kartında "KDV İndirim Dönemi: Ocak 2027" görünmeli.
4. KDV Özeti → KDV Mahsup Fişi: Aralık İ'sinde bu fatura yok, Ocak'ta var.
5. Düzenle ile dönemi Şubat 2027'ye alın → Ocak İ düşer, Şubat İ artar.
6. Tarihi 15.12.2025 yapın → seçenekler Aralık 2025 – Aralık 2026 olur; Aralık 2027 seçiliyse fatura ayına döner ve uyarı yazısı görünür.
7. Bir satış formu açın → alan görünmemeli.

Benim ekran görüntülerim: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2d-ana/ekran/kdv-donemi-kart.png` ve `kdv-donemi-tarih.png` (aynı klasörde).
- İlk görüntüde alan tek sütundaydı ve "Aralık 2025 (Fatura Ay" kesiliyordu.
- Alanı iki sütun genişliğine (`grid-column: span 2`) aldım. Ekran telefon genişliğinde denenmedi.

## Commit'ler
- 8c5757e5 tasarım notu §14 (koddan önce)
- 90080c95 göç 52 + sunucu + mahsup seçimi + test
- b5e13224 kilit izi eki + Sıfırla eki + testler
- 39de5de6 fatura formu + ekran senaryosu
- a44e4e5f kılavuz + PDF
- 339eaa2d Kanıt (`docs/kanit/2026-11-19/c7b2d-*`)
- 9d933883 tasarım notu §14.10

## BAŞ MİMAR KARARI GEREKİYOR
- **B-11 — KDV Özeti (Beyanname Hazırlığı) belge ayına göre grupluyor** (`routes/report-center.mjs` kdv-ozeti, `substr(issue_date,1,7)`). Dönemi ileri alınmış alış faturası raporda belge ayında, mahsupta dönem ayında görünür.
  - (A) Alış satırları `vat_period`'a göre gruplanır, aralık süzgeci de döneme uygulanır (report-center izni gerekir).
  - (B) Rapor belge ayında kalır, dipnot eklenir.
  - **Öneri: A.** Raporun adı beyanname hazırlığı; KDVK 29/3'te indirim dönemi beyannamenin dönemidir.
- **B-12 — `invoices.vat_period` kilit izinde değil.** Kilitli Aralık faturasının dönemi Ocak ise açık Ocak mahsubu bu alana bağlı. Program yolundan değişemez (kilitte Düzenle 409 veriyor), ama kapı dışı değişiklik izsiz kalır.
  - (A) LOCK_SQL'e `invoices(id, vat_period)` eklenir (dolu olanlar, since 2.5.2).
  - (B) Gerekçeli istisna.
  - **Öneri: A**, `integrity.mjs` izniyle sonraki turda.
- **Yeni bulgu — Sıfırla ↔ KDV mahsubu:** "Tüm Hareketleri Sil" `vat_offsets`'i silmiyor (`MOVEMENT_TABLES`'ta yok; 2.4.3'ten beri).
  - Yeniden ürettim, tabanda da aynı. Sıfırlanan şirkette mizan faturasız 360 −200 / 391 +200 gösteriyor; Mutabakat Testi bunu yakalamıyor (ok true).
  - Kanıt: `docs/kanit/2026-11-19/c7b2d-bulgu-sifirla-kdv-mahsup.txt`.
  - **Öneri:** `app.mjs` `MOVEMENT_TABLES`'a `"vat_offsets"` + kalıcı test, ayrı küçük iş. Bu tur dosya sınırı dışındaydı (`app.mjs` yalnız geçiş günü eki).
- **acilis-onarimi-hiz-250 eşdeğerliği** tabanda kırmızı (yukarıda kök neden). Tur 2e'de beklenti değişikliği olarak ele alınmalı.

## KULLANICIYA SORULMALI
- Yok. "Mahsubu yazılmış aya alma / aydan çıkarma"nın cevabı kitapta var: EK-1 M8 (6) "Engel konmaz" ve S4 = A (§2.3). Kilitli aya alma ayrıca denetlenmiyor, çünkü dönem ≥ belge ayı olduğundan belge kilitliyse kayıt / Düzenle zaten 409 veriyor (§14.2).

## DOĞRULANMADI
- Görev metnindeki kılavuz maddesinin ikinci yarısı ("Kartı Kapat'ın kalanı borçta bırakması") bugünkü kodla çelişiyor. Onay metni "carinin borcundan düşülür" diyor; 'Borçta Kalsın' TUR 3'ün işi. **Kılavuza yazılmadı**; TUR 3'te yazılmalı.

## DENENMEYEN
- Windows (CI).
- Tam `npm test` (görev gereği).
- 100 bin satırda hız ölçümü: `figureTable`'a tek toplu SQL eklendi, ölçülmedi (ders 53, ana oturumun hız kabulüne).
- Telefon genişliğinde form.
- Gelen e-Fatura kutusundan alınan alış faturasında alanın ekrandan seçilmesi (yalnız varsayılan `''` yolu koda bakılarak).
- İki şirketli kurulum.

## Not defteri klasörleri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2d-ana`: kanıt hamları, `e2e-log/`, `ekran/`, `mutant.py`, `komsu.sh`, `e2e.sh`, `kanit-topla.sh`.
- Taban worktree kopyalarını (`c7b2d-taban-wt`, `c7b2d-onc7b-wt`) ve tar kopyasını sildim.
