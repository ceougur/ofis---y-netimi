## DAR KONTROL — BİRLEŞİK TUR 6 (4a2e1d6c^1..4a2e1d6c)

Ortam: yük 0,05 / 4 çekirdek, boş bellek 12 GB, boş disk 5,5 GB. Başlangıçta disk 4,9 GB'tı. Kopyalarımın hepsi tam yoluyla silindi. Worktree temiz, commit ya da push yok.

Kısa sonuç: GERİLEME YOK. ORTA 1, DÜŞÜK 6. A2, D1, D2, E'nin asıl atlatmaları, F ve G doğru çalışıyor. Hız ölçümü yapılamadı (aşağıda nedeni var).

### GERİLEMELER
Yok. Aynı betikler eski kodda (4a2e1d6c^1) ve yeni kodda koşuldu; eski kodda geçip yenide düşen bir senaryo çıkmadı.

### BULGULAR

**ORTA-1 — Silme ve geri yükleme dış artışı örtüyor (A1).** Yer: `server/lib/integrity.mjs` noticeGrowth `explained` (:980–985) ve `server/lib/cash-opening.mjs` restoringCash (:215–235).
- Betik: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-b6-ajan/betik/a1.mjs`, S1 ve S1b. Çıktı: `…/dk-b6-ajan/a1-yeni-UTC.json`. İki saat diliminde aynı sonuç.
- Senaryo: iki tarama arasında kullanıcı açılış öncesi bir satırı siler (2 → 1), sonra Silinenler'den geri yükler (1 → 2). Aynı aralıkta dışarıdan bir Kasa girişinin tarihi açılış öncesine alınır (2 → 3).
- Sonuç: sayı 2 → 3 arttı ama günlük boş, zil yok. Mutabakat Testi'nde de, iş parçacığı taramasında da (`bulgu: []`) böyle.
- Kontrol (S2): silmeden sonra bir tarama olursa alarm geliyor ("1 → 3").
- Tarama 15 dakikada bir koştuğu için silip geri almak bu aralığa rahatça sığar.
- Tasarım notundaki BİLİNEN SINIR'dan farklı: o sınır sayının değişmediği durum (azalma + artış = 0; S9'da doğrulandı). Burada sayı gerçekten arttı.
- Kök neden: geri yükleme her satır için "açıklama hakkı" ekliyor, silme ise bu hakkı düşürmüyor. Böylece silinip geri gelen satır, dış yazımın artışını "açıklamış" sayılıyor.
- Neden ORTA: sakınca süzgecinden geçmedi. Kasa'da çift sayılan tutar bildirimsiz kalıyor (sarı uyarıdaki sayı yine görünüyor).
- En küçük düzeltme: sayı yerine kimlik kümesi tutmak.
  - Tarama, uyarı satırlarının kimliklerini saklar.
  - restoringCash, geri yüklemeden önce ve sonra kimlik kümesini alır ve "geri gelen kimlikler"i kaydeder.
  - Alarm koşulu: önceki kümede ve geri gelenlerde olmayan her yeni kimlik.
  - Bu, belgedeki "sayı aynı kaldı" sınırını da kapatır.

**DÜŞÜK-1 — İletideki sayılar yanıltıcı.** Yer: `integrity.mjs` NOTICE_GROWTH. S2'de ileti "1 → 3 hareket; kapının görmediği yazım" diyor; açıklanamayan yalnız 1 hareket. Öneri: "(1 → 3; 1'i kapının görmediği yazım)". Sakınca süzgeci: para değişmiyor, yalnız metin.

**DÜŞÜK-2 — Yeni testlerde dişsiz yerler.** Mutant koşusu `…/dk-b6-ajan/mutant-sonuc.txt` (yeni 12 mutant). Yakalananlar ve yaşayanlar ayrı bölümde. Yaşayan 5 mutantın her biri eksik bir testi gösteriyor; ürün davranışı bu durumlarda doğru. Sakınca: yalnız test.

**DÜŞÜK-3 — Yayın kapısı `git replace` ile atlatılabiliyor (E).** Yer: `tools/kanit.mjs` yapimAsamasiGate (`git show HEAD:<yol>`).
- `git replace <listenin blob'u> <boş liste blob'u>` + `--skip-worktree` birlikte uygulanınca: git status temiz, kapı geçiyor. CI de geçer, çünkü CI gerçek commit'teki dolu listeyi görür.
- Bunun için bilerek iki adım atmak gerekiyor; kaza ile olmaz.
- Öneri: `git --no-replace-objects show …` (kanit.mjs'nin gitIn çağrılarında da).
- Sakınca: para yok.

**DÜŞÜK-4 — Aynı kalıp Çek / Senet listesinde düzeltilmemiş; Fatura listesinde de aynı kod var.** Bu bir gerileme değil; eski kodda da aynı.
- Betik: `…/dk-b6-ajan/betik/cek-yaris.mjs` (resmî yarış betiğine eklediğim cek-tarih kipi).
- Yeni kodda 5/5, eski kodda 5/5 ön koşul oluştu; hepsi kırmızı. Kutu "0002-06-20" ya da "0026-07-20" oluyor.
- Yarışsız kontrol kipinde de 3/3 kırmızı: kutu "", "0002-06-07", "0020-06-07".
- Kök neden: `hof-cheques.js:715–719` onChange her geçerli tarih bölümünde loadList → HOF.swap çağırıyor ve çubuğu yeniden kuruyor. Bu, turda POS için düzeltilen sorunun aynısı.
- `hof-invoices.js:555–562` (Fatura listesinin data-filter tarih alanları) aynı kalıpta. Koşmadım, DOĞRULANMADI.
- Öneri: bu ekranlarda da HOF.swapKeeping (POS'taki `{ pending: false }` gibi).
- Sakınca: süzgeç tarihi bozuluyor, para etkisi yok.

**DÜŞÜK-5 — Kâhin koşucusundaki değişikliklerin testi yok (E).** ÖZET pay/payda, "değer değişti" notu ve fark dökümü hiçbir otomatik testte denetlenmiyor (test/ taramasında yalnız kos.mjs'nin kendisi çıktı). Formülü koddan okudum: başarısız = fark + okuma hatası + kaçan; tutarlı. Koşarak doğrulamadım (kâhin koşusu ağır).

**DÜŞÜK-6 — G koruma testi gerçek fikstürlerde hiç taban sapması görmüyor.** Taramada 18 `surum-*` klasörü var; `surum-nesneler` hariç 17 fikstür koşuldu, 18/18 test geçti. Fikstürlerin tamamında `sapmalar: []`, bütün yazımlar süzgeçli yolda, "yazılamadı" yok. Yani "zararlı aile" iddiası bugünkü fikstürlerde hiç çalışmıyor; dişi aşağıda ayrıca kanıtlandı. Bilgi notu.

### A1 tablosu (yeni kod; eski kod karşılaştırması için `a1-eski-*.json`)
| Yol | Önce → sonra | Alarm bekleniyor | Oldu |
|---|---|---|---|
| S1 sil + geri yükle (taramasız) + dış artış | 2 → 3 | evet | **hayır** |
| S1b aynısı, iş parçacığı taraması | 2 → 3 | evet | **hayır** |
| S2 sil, tarama, geri yükle + dış artış | 1 → 3 | evet | evet |
| S3, S3b, S3c açılışı sil + Silinenler'den geri yükle | — | — | geri yükleme 409 cash-opening-after-first; yol kapalı |
| S4 açılışı öne al (200), eski tarihe geri al | 2 → 0 | hayır | hayır; geri alma 409, sayı artamıyor |
| S5 dış tutar değişikliği | 2 → 2 | hayır (sapma bekleniyor) | bank:event sapması + günlük; Kasa 5.550 → 6.539 |
| S6 dış yeni satır | 2 → 3 | evet | evet (+ money:event) |
| S7 artış, azalma, artış, iki tarama | — | evet, her artışa bir kez | ilk 1, azalma 0, ikinci 1; yineleme yok |
| S8 iki geri yükleme | 2 → 4 | hayır | hayır |
| S9 sil + dış artış (sayı aynı; belgedeki BİLİNEN SINIR) | 2 → 2 | — | hayır, bilinen sınır |

Eski kodda S2, S6 ve S7 alarm vermiyordu; S6 ve S7'nin uyarı artışı bu turla kapandı. Para sayıları iki kodda aynı: S5'te Kasa 5.550 → 6.539, sayılar 2 / 3 / 4 aynı.

### A2 (`…/betik/a2.mjs`, iki saat dilimi aynı)
| Deneme | Yeni | Eski |
|---|---|---|
| Store dışı ekleme + düzeltme | RED | KABUL |
| En büyük rowid'li satır silinir, yeni satır aynı rowid'i alır (3), düzeltme | RED, satır yazılmadı | KABUL |
| Çok satırlı store dışı ekleme | RED | KABUL |
| Eski satırın tutar düzeltmesi | KABUL | KABUL |

### C (süzgeç çubuğu yarışı)
- Resmî betik, yeni kod, dört kip × 5: 20/20 geçti, her kipte ön koşul 5/5 oluştu.
- Eski kod, banka-tarih × 3: 3/3 kırmızı (kutu "0026-07-20"), ön koşul 3/3. Yani test eski kodda kırmızı.
- Yeni veri gizlenmiyor: gözcü düğüm çubuğun dışında yenilendi, yalnız çubuk korundu.

### E — atlatma denemeleri (`…/betik/e-kapi.mjs`; yeni / eski)
| Deneme | Yeni | Eski |
|---|---|---|
| skip-worktree / assume-unchanged | RET | GEÇTİ |
| Dosyayı sil | RET | RET |
| rm --cached + .gitignore | RET | GEÇTİ |
| Boş liste commit'lenmemiş | RET | GEÇTİ |
| Ayrık HEAD | RET | RET |
| Boş liste commit'li ya da boş listeli dal | GEÇTİ (CI'nin kâhin adımı ayrıca durdurur) | GEÇTİ |
| replace (tek başına) | GEÇTİ, ama status kirli olduğu için releaseGate durdurur | GEÇTİ |
| **replace + skip-worktree** | **GEÇTİ, status temiz** (DÜŞÜK-3) | GEÇTİ |

### Mutantlar (yeni 12)
- **Yakalananlar (değerle):**
  - M1 açıklama düşülmüyor: kurulumdaki "ön koşul" eşitliği kırıldı, 8 alt test iptal.
  - M2 işaret güncellenmiyor: 7 kırmızı.
  - M3 yarış denetimi kaldırıldı: 1 kırmızı.
  - M4 açılışta işaret yok: 1 kırmızı.
  - M5 birikimli açıklama: 5 kırmızı.
  - M6 `>=`: 1 kırmızı.
  - M7 araç ok = result.ok: 1 kırmızı.
- **Yaşayanlar (DÜŞÜK-2):**
  - M8: kapı varsayılan çağrıda commit'i okumuyor (`commit = false`), 11/11 yeşil. release.mjs'nin kullandığı varsayılan yolun commit karşılaştırması test edilmiyor.
  - M9: Vergi iletisi açılış GÜNÜnde de çıkıyor (`<=`). Açılış günü testi yok.
  - M10: geri yükleme başına satır sayısı yerine +1. Birden çok satır getiren geri yükleme (cari) testi yok.
  - M11: Mutabakat Günlüğü'nde `every` → `some`. Sapma ve uyarıyı birlikte taşıyan kayıt testi yok. Ürün doğru: S6 karışık kaydı "Sapma" adıyla yazdı.
  - M12: iş parçacığı taramasında restoredAt geç alınıyor. Yarış testi yalnız "geri yükleme anlık görüntüye girdi" sırasını kuruyor; ters sıra hiç oluşmadı.

### G dişi
`surum-2.4.3-baslarken`'den türettiğim fikstüre başlıksız bir şüpheli alacak kaydı koydum (`…/betik/g-dis.mjs`). Koruma testi kırmızıya döndü: `doubtful:balance→party, doubtful:records→party`, Borç Yaz yolu "full (taban sapması (party))".
Daha önce cari satırının tutarını değiştirmeyi denedim (2.0.26 zinciri ve 2.4.3); bunlar göçte iz bırakmadı, sapma görülmedi.

### Ölçüm
- Asıl ölçüm yapılmadı (DENENMEYEN). Özel kilit iki saatten uzun boyunca doluydu: önce hız ölçümünüz, sonra c5a1cy-kos.sh (paylaşımlı kilit, pid 26142).
- Not: o koşunun zorlama yinelemeleri yük 0,01 iken uzun sürüyordu; asılı kalmış olabilir, bakmanızda yarar var.
- Hazır betik: `…/dk-b6-ajan/betik/olcum.sh`. Kopyayı RAM diskte tutar, açılışsız ve açılışlı Silinenler geri yüklemesi + Kasa yazımını yolla birlikte eski/yeni karşılaştırır. Koşmadan önce eski/mut kopyalarının yeniden açılması gerekir; ben sildim.
- Gösterge (kilitsiz, yük 0,06, salt okunur, temiz-100k'nın 001 dosyası: 11.554 Kasa satırı, açılış yok): cashBeforeOpening 2,5–4,7 ms. Geri yükleme başına iki kez, yani yaklaşık 6 ms ek.
- A2 satır başına bir Map okuması ekliyor; tarama yoluna yeni okuma girmiyor.

### Baş mimar kararlarının değerlendirmesi
- **A1:** Yanlış alarm yönünde güvenli; denenen meşru yolların hiçbiri alarm vermedi (geri yükleme, açılışı öne alma, yeniden açılış, iki şirket, yedek ve gün dönümü testleri yeşil). Ama karar metni "geri yüklemelerin açıklayamadığı artış" dediği için, silinip geri gelen satır dış artışı yasal olarak "açıklıyor". Uygulama kararla uyumlu; kaçan artış kararın kendisinden geliyor (ORTA-1).
- **A2:** Amaca uygun. Meşru düzeltme yolu bozulmadı. rowid'in yeniden kullanıldığı durum da RED.

### KULLANICIYA SORULMALI
Yok. ORTA-1 para ya da "kime kaç kez" kuralı değil, tespit tasarımı. Yalnız ORTA-1'in düzeltmesi A1 kararının metnini (sayı yerine kimlik) değiştirdiği için kullanıcıya gösterilmesi gerekir.

### DOĞRULANMADI
- Fatura listesindeki tarih süzgeci (DÜŞÜK-4): kod aynı, betikle koşulmadı.
- Geri yüklemenin iki ölçümü arasına başka bağlantıdan yazım girmesi (dar zaman penceresi).
- M12'nin tersine sırası (geri yükleme anlık görüntüden sonra) üründe zorlanamadı.

### DENENMEYEN
- Özel kilitli hız ölçümü.
- D1 iletisinin ekranda (toast) görünümü; yalnız API ve test iletisi okundu.
- Kâhin koşusu ve liste üreticisinin fark dökümü (ağır koşu).
- Windows (kaynakta yol ayırıcı ya da açık dosya varsayımı görmedim; CI Windows için ayrıca bakmadım).
- Şirket sıfırlama yolu.

### Dosyalar
Bütün ham çıktılar ve betikler `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-b6-ajan/` altında:
- A1 / A2: `a1-*.json`, `a2-*.json`
- Mutantlar: `mutant-sonuc.txt`, `mut-*.tap`
- C: `c-*.out`
- E: `e-*.out`
- G: `koruma*.tap`
- Betikler: `betik/`