# Ç7b TUR 2e — RAPOR (iş bitti; PUSH YOK)

Dört maddenin hepsi kapandı.
- Üç maddede ürün kodu düzeltildi: B-11, B-12 ve Sıfırla ↔ KDV mahsubu.
- Onarım eşdeğerliği (madde 4) ürün hatası çıkmadı. Testin beklentisi karar numarasıyla değişti; `lib/ledger-rule-shift.mjs`'e dokunmadım.
- Bütün koşular iki TZ'de yeşil.
- Ortam: yük 1,2 / 4 çekirdek, bellek boş 6 GB, disk boş 7,7 GB.

**Dal:** `worktree-agent-a91bbac2a6427046a`
- Taban: `c7b2e-taban` = 9d933883. `git reset --hard` ile sıfırladım ve ucu doğruladım.
- Uç: **b9ba393e**. 11 commit, hepsi benim.
- Commit'lenmemiş iş yok. Çalışan arka plan işim yok.

## Değişen gözlenebilir davranış (önce → sonra)

Örnek veri: Aralık 2026'da satış 10.000 + KDV 2.000. Alış P1 1.000 + 200. Alış P2 2.000 + 400 (31.12, KDV İndirim Dönemi Ocak 2027). Ocak'ta satış 1.000 + 200, alış P3 500 + 100.

**1. KDV Özeti (Beyanname Hazırlığı) — B-11 = A**
- Önce: rapor alışları belge ayında gösteriyordu. Aralık'ta İndirilecek KDV 600, Ödenecek 1.400; Ocak'ta İndirilecek 100. KDV Mahsup Fişi ise Aralık 200, Ocak 500 diyordu, yani ikisi ayrışıyordu.
- Sonra: Aralık'ta Alış 1 belge / 200, Ödenecek 1.800. Ocak'ta Alış 2 belge / matrah 2.500 / KDV 500. Rapor ile mahsup fişi her ayda aynı.
- Dönemi ileri alınmış alış faturası, dönem ayının **ilk gününde** sayılır. Hem ay grubu hem aralık süzgeci bu güne göre çalışır.
- Satış, SMM ve iki tür iade belge tarihinde kalır.
- Ekranda: "Bu Yıl" açılışında "Şubat 2027 · Alış · 2.000 / 400" görünüyor. Ekran görüntüsü: `docs/kanit/2026-11-19/c7b2e-ekran-kdv-ozeti-donem.png`.
- Kılavuza bir cümle eklendi: "KDV Özeti'nde de dönemi ileri alınan alış faturası seçilen dönemde görünür." PDF yeniden üretildi.

**2. Kilit izi — B-12 = A**
- Önce: kilitli P2'nin dönemi kapı dışında Ocak'tan Şubat'a değiştirilince kilit izi değişmiyordu. Açık Ocak'ın mahsup İ'si 500'den 100'e sessizce düşüyordu.
- Sonra: `invoices_vat_period_lock` eklendi (since 2.5.2; LOCK_SQL_VERSION aynı kaldı). Yalnız dolu dönemli faturalar ize girer.
- Kapı dışı değişiklik artık "Donmuş Dönemin Kaynağı Değişti" olarak görünüyor.
- v2.4.9 verisinde güncellemeden sonra yanlış alarm yok.

**3. Şirket Verisini Sıfırla — iki kip de**
- Önce: sıfırlamadan sonra faturalar 0 oluyor, `vat_offsets` kalıyordu. Mizanda 191 −200 / 360 −1.800 / 391 +2.000 görünüyordu, Mutabakat yeşildi. Mahsup listesinde "Aralık — Güncel Değil" kalıyor, aynı ayın mahsubu "zaten mahsup edildi" diye engelleniyordu.
- Sonra: mahsuplar da siliniyor. 191 / 190 / 360 / 391 = 0, liste boş, Mutabakat yeşil, yeni mahsup sıfırdan yazılıyor.
- Not: "Tümünü Sıfırla" da aynı listeyi kullandığı için aynı hata orada da vardı; ikisi birlikte düzeldi.

## Madde 4'ün kök nedeni

- **Kayıt:** `cash:cash-57559235…`, 08.08.2026 "Açılış" carisiz Kasa girişi, 200.000 TL. Fikstür v2.0.26 verisi; kilit 07.10.2026.
- **Donmuş ↔ canlı:** donmuş defter 2.4.9 kuralıyla 100 / 649 (alt hesapsız). Canlı türetme K-01 (§2.1) ile 100 / 649.90.
- Bu tek madde Kural Değişikliği Farkı uyarısı veriyor.
- **Neden "fark 0, döküm boş":** `difference` ve `breakdown` ana hesap düzeyinde toplanıyor. Fark yalnız alt hesaplar arasında olduğu için 649'un bakiyesi değişmiyor; madde sayısı ise 1.
- Ç7b öncesi kodda fark yok. Bunu yeniden ürettim.
- **B-8 ölçüsü:** §13 başlığı, §4 (5) ve §13.4 (6) açıkça ".90 alt hesapları Kural Farkı Düzeltme Fişi'yle eskisi gibi" diyor. B-8 yalnız KG-3, KG-8 ve F-08'i kapsıyor, yani bu kaydı kaçırmıyor; uyarı tasarımın sonucu.
- **Fişle kapanıyor:** önizleme 08.10.2026, B 649 / A 649.90, 200.000 TL. Fiş yazılınca Mutabakat eski dökümle birebir (ok true).
- **"Farksız uyarı" ayrı hata değil:** Yönetim satırı tutarı yalnız sıfırdan farklıysa yazıyor ("1 madde … Kural Farkı Düzeltme ile…"). `breakdown` istemcide gösterilmiyor.
- **Test değişikliği** (BEKLENTİ BİLEREK DEĞİŞTİ, K-01 §2.1 / §13 / §4 (5) / §13.4 (6)):
  - Yalnız Mutabakat bölümü değişti; öteki bölümler eski dökümle aynı.
  - Test, rule-diff'in tam olarak bu tek madde olduğunu denetliyor, sonra fişi yazıp Mutabakat'ın eski dökümle aynı olduğunu doğruluyor.
  - Ön koşul ürünün durumundan kuruluyor: açılıştaki dondurma `runPending` ile bitiriliyor (dondurma sürerken uyarı çıkmıyordu, yani yarış vardı).
  - Fikstür ve beklenen döküm dosyası değişmedi.

## Mutabakat Testi yetim mahsubu neden yakalamıyor

- Beklenen 391 / 191 / 190 / 360 (`routes/ledger.mjs` expected) etkin mahsupları `vat_offsets`'in kendisinden ekliyor. Yevmiyedeki mahsup maddesi de aynı satırdan türüyor.
- Bu yüzden yetim mahsup iki tarafa eşit giriyor, fark sıfır çıkıyor.
- Saklı mahsubu o ayın gerçek hareketiyle karşılaştıran tek yer `tax.mjs offsetList`'in "Güncel Değil" işareti; o da yalnız uyarı.
- Kapıya dokunmadım (ayrı karar).

## Testler

**Kırmızı (eski kod) — her birinin nedeni iletide okundu**

| Test | Eski kodda kırmızı nedeni |
|---|---|
| `c7b-kdv-ozeti-donem-250` (yeni, 4 test) | 4 / 4 kırmızı. Aralık KDV 660 ≠ kâhin 200 (Aralık İ 200); "400 + 140 = 540"; Düzenle |
| `c7b-sifirla-kdv-mahsup-250` (yeni, 2 test) | 2 / 2 kırmızı: "faturalar ve KDV mahsupları silindi" (iki kipte de mahsup sayısı 0 yerine 2) |
| `defter-kaynak-iz-250` (değişti) | "kilit izinde OLMAYAN … invoices.vat_period" |
| `c7b-goc52-kilit-izi-250` (değişti) | "kilitli faturanın KDV İndirim Dönemi: güncel kilit izi değişmeli" |
| `senaryo-kdv-donemi-250` (ekran, D adımı eklendi) | 20 geçti / 2 kaldı: "Bu dönemde kayıt yok" |
| `acilis-onarimi-hiz-250` (değişti) | Yeni beklenti Ç7b öncesi kodda (c7b2-taban) kırmızı: kural farkı yok, fiş 409. Eski test tabanda zaten kırmızıydı. |

- `defter-kaynak-iz-250` taraması artık KDV mahsubunun sorgularını (`tax.mjs offsetList`) da kapsıyor. `vat_offsets.reversed_at` gerekçeli istisna olarak eklendi (yalnız listede gösteriliyor).

**Yeşil (yeni kod, iki TZ)**
- 7 dosya: 66 / 66.
- Ekran senaryosu: 22 / 22.
- Dondurma zorlaması (gozlem, bitir): onarım testinde 2 / 2, göç 52 testinde 1 / 1; her koşuda ön koşul gerçekleşti, sonuç yeşil.

**Karşı mutantlar** (değerle, her biri iki TZ'de koşuldu)
- M1 belge ayı, M1b özet belge tarihi, M1c süzgeç belge tarihi, M1d ayın son günü, M2 kilit izinde dönem yok, M2b ek sürüme bağlı değil, M3 Sıfırla mahsubu silmez, M3b yalnız Tümünü Sıfırla: **8 / 8 yakalandı.**
- M4 / M4b (B-8 kuralları sızar): onarım testinde **kaçtı**, çünkü fikstürün kilitli döneminde kayıt tahsilatı ya da iade KDV'si yok. Aynı iki mutant B-8'in kendi testi `c7b-gecis-gunu-250`'de iki TZ'de yakalandı.

**Komşular, ekran senaryoları, kâhin**
- G2 komşu (tur 2d listesi ∪ taramayla değişen dosyaları ve API yollarını anan testler, 388 dosya): iki TZ'de 4024 / 4024.
- Ekran senaryoları (taramayla 58): iki TZ'de 58 / 58, çıkış 0.
- `npm run test:kahin-defter`: iki TZ'de 183 / 187. Dört fark tabandakiyle aynı (K_EYLUL ve K_SON, 191 / 391); yeni kırmızı yok.
- Kılavuz: metin denetimi 954 / 954 (880 / 880 ad), `pdf-denetle` 39 / 39; yeni cümle PDF metninde var.

## Ana oturumun yeniden koşacağı komutlar

Hepsi `HUKUK_LICENSE_URL=http://127.0.0.1:9`, iki TZ.
- `node --test test/c7b-kdv-ozeti-donem-250.test.mjs test/c7b-sifirla-kdv-mahsup-250.test.mjs test/defter-kaynak-iz-250.test.mjs test/c7b-goc52-kilit-izi-250.test.mjs test/acilis-onarimi-hiz-250.test.mjs test/c7b-kdv-donemi-250.test.mjs test/kilit-izi-alanlar-250.test.mjs` → **66 / 66**.
- Tabanda (yalnız test dosyaları kopyalanarak): yeni iki dosya 4 + 2 kırmızı; değişen ikide birer kırmızı.
- `PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 node test/e2e/senaryo-kdv-donemi-250.mjs` → **22 / 0**; tabanda 20 / 2.
- `npm run test:kahin-defter` → **183 / 187**.
- Komşu: `…/scratchpad/c7b2e-ana/komsu.sh <TZ> <ad>` (liste `komsu.txt`) → 4024 / 4024.
- Mutant: `python3 -I …/scratchpad/c7b2e-ana/betik/mutant.py <git worktree kopyası> <çıktı>`.

## Ekran yürüyüşü adımları
1. 31.12.2026 tarihli alış faturası girin, KDV İndirim Dönemi Ocak 2027. Raporlar → Tüm Raporlar → KDV Özeti → Geçen Ay / elle Ocak: fatura "Ocak 2027 · Alış" satırında olmalı.
2. Aralık aralığında görünmemeli.
3. KDV Mahsup Fişi Oluştur önizlemesinde Ocak İ, raporun TOPLAM Alış'ına eşit olmalı.
4. PDF ve Excel ekranla aynı olmalı.
5. Düzenle ile dönemi Şubat'a alın: rapor Ocak'tan Şubat'a taşımalı.
6. Mahsup yazılmış şirkette Yönetim → Şirket Verisini Sıfırla → Tüm Hareketleri Sil.
7. Mizanda 191 / 360 / 391 / 190 sıfır olmalı, KDV Mahsup Fişi listesi boş olmalı, aynı ayın mahsubu yeniden yazılabilmeli.

## Commit'ler (sırayla)
- a1e7ef99 tasarım notu §15 (koddan önce)
- 84935f55 B-11 kod + test
- c471008e kılavuz + PDF
- 894d9d13 B-12 kod + testler
- 2a437942 Sıfırla + test
- 017042a2 onarım beklentisi
- b5aca8ce onarım testine ön koşul
- a9aad798 ekran senaryosu D adımı
- af3c6f6a §15.6
- df2a25fc Kanıt
- b9ba393e Kanıt (UTC ekran senaryoları)

## BAŞ MİMAR KARARI GEREKİYOR
1. **B-11'in gün yorumu.** Dönemi ileri alınan faturanın KDV günü dönem ayının **ilk günü** olarak kodlandı. Ay bazlı süzgeçlerin (Bu Ay, Geçen Ay, Bu Yıl) hepsinde sonuç hangi gün seçilse de aynı. Fark yalnız günlük aralıkta çıkıyor:
   - "Son 30 Gün" içinde, dönemi Ocak olan Aralık faturası 01.01'de sayılıyor; 11.01'den başlayan aralığa girmiyor.
   - "Tüm Zamanlar" (bugüne kadar), henüz başlamamış bir aya alınan faturayı o ay gelene kadar göstermiyor.
   - Gerekçe: iki bitişik aralığın toplamı birleşik aralığa eşit kalıyor, çift sayım yok. Programda ay kalemini ayın ilk gününe yazan bir örnek de var (`finance-report`).
   - Seçenekler: (A) bu hâliyle kalsın — **öneri**; (B) ayla çakışan her aralık faturayı içersin; bu durumda bitişik aralıklarda çift sayım olur.
2. **Kural farkının ana hesap kırılımı (DÜŞÜK).** Yalnız alt hesap kayan maddede `difference` 0 ve `breakdown` boş çıkıyor; ekran fark tutarını hiç yazmıyor. Düzeltmek için `lib/ledger-snapshots.mjs` (dosya sınırı dışında) değişmeli. Öneri: kırılımı alt hesap düzeyine almak, ileride.
3. **Güncelleme notu adayı.** Kilitli döneminde carisiz Kasa / Borç Yaz / Alacak Yaz hareketi olan her eski kurulum, güncellemeden sonra Kural Değişikliği Farkı uyarısı görecek (tasarım gereği; §4 (5)). Kural Farkı Düzeltme Fişi ile kapanıyor. Güncelleme notuna ve MA listesine yazılmalı.
4. **Kilit izi sürümü.** B-12'yi 2.5.2 tanımına ekledim. Yayımlanmamış geliştirme verisinde, tur 2d koduyla dondurulmuş ve dönemi dolu bir fatura içeren dosya alarm verebilir. Bilerek kabul edildi; kararın "numara değişmez" hükmüne uygun.

## KULLANICIYA SORULMALI
- Yok. Para ya da defter kuralı değişmedi; madde 4 kararla açıklanıyor.

## DOĞRULANMADI
- Madde 4 için kullandığım okuma: "B-8 yalnız üç alt defter kuralını kapsar". Bu, §13 başlığının metnine dayanıyor. CLAUDE.md'deki kısa ifade ("geçiş gününden önceki kilitli kayıtlar eski kuralda kalır") daha geniş okunabilir. Ana oturumun teyidi iyi olur.

## DENENMEYEN
- Windows (CI).
- Tam `npm test` (görev gereği).
- 100 bin satırda KDV Özeti hızı (ana oturumun Ç7b hız kabulüne).
- Telefon genişliği.
- İki şirketli kurulumda sıfırlama.
- Yeni KDV Özeti ve Sıfırla testleri dondurma zorlama kiplerinde koşulmadı: taze veride açılışta bekleyen dondurma yok, ön koşul oluşmuyor.

## Not defteri ve temizlik
- Klasör: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2e-ana` (betik/, mutant/, e2e-log/, ekran/, kanit/, komsu.sh, e2e.sh, kanit-topla.sh, yuk-*.sh).
- Kendi worktree kopyalarımı (c7b2e-taban, c7b2e-mutant) `--force` ile kaldırdım; c7b2e-onc7b arşiv kopyasını sildim.
- Ölçüm kilidi iki kez bir saatten uzun özel tutulduğu için yük koşuları gecikti. Bir saatlik bekleme bir kez doldu, UTC ekran senaryolarını yeni tek seferlik bekleme işiyle koştum.
- Hesapta ayrıca bir zamanlanmış hatırlatıcı kurmuştum (trig_01HDiEhRu1ws63NnWhkk7S5P, 10:22 UTC); ana oturuma düştü. Silmek istedim ama izin verilmedi. Bundan sonra kurmuyorum.