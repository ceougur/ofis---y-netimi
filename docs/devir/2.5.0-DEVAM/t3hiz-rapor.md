# TEK ADAY HIZ DÜZELTMESİ (t3hiz): rapor

**Özet:** Kararın KÖTÜ yollarının hiçbiri artık ana dala göre %10'u aşmıyor. Bu sonuç kilitsiz ve kilitli kipte, ana · taban · uç sırasıyla iki tur ölçülerek alındı. Yolların çoğu ana daldan da hızlı. Davranış aynen kaldı; 100 bin satırlık dökümler bayt bayt aynı.

Kalan tek sınır yol Alt Hesap Mizanı (Ç7a'nın yolu). Bunun için baş mimar kararı gerekiyor; ayrıntı aşağıda.

Push yapılmadı. Uç `5e8784f9`; ürün kodu `0e252c6c` ile aynı, sonraki commit'ler yalnız test, belge ve kanıt. Ağaç temiz; izlenmeyen tek şey `node_modules` bağı.

## 1. Yol → gerileten commit → kök neden → düzeltme

| Yol | Gerileten | Kök neden (9c09f18d) | Düzeltme |
|---|---|---|---|
| Şüpheli kaydı olan şirkette her yazım (evrak, fatura, iptal, Borç Yaz; temiz veride +27–30 ms) | 8d10b8c4 (tur 3c İş 1) | `lib/bank/doubtful.mjs:128` linkedShares ön denetimi. VEYA'lı EXISTS, cari başına bütün evrak olaylarını dolaşıyor (~13 ms/cari). | **H1:** aynı koşul, üç ayrı kolun UNION'ı (`LINKED_CHEQUE_PARTIES_SQL`). **H1b:** zaten aday olan cari sorulmuyor (küme birleşim). |
| cari kartı (şüpheli + bağlı), bağlı / bağsız tahsilat, Mizan ailesi, Cari Listesi, Alacak Yaşlandırma | 8d10b8c4; c0c8d1fc (İş 2, `allocatedMinor`); 41f38493 (3d, `shareOf`) | Bağlı alacaklı carinin kuyruk girdisi her doubtfulState çağrısında baştan kuruluyor (~75 ms). Nedeni `lib/obligation-input.mjs` :221 / :230 / :152 sorgu planları: idx_account_entries_source taraması ve evrak VEYA taraması. Bir istekte aynı ayırıcı 3–9 kez koşuyor. | **H2:** tek cari yolunda `+source` ve eski planın sırası (`ORDER BY source_id, rowid`); evrak VEYA'sı `rowid IN (… UNION …)`. Satır kümesi ve sıra aynı. **H3:** işlem dışında, aynı veri durumunda (store · total_changes · data_version) kurulum, kesit ve aday kümesi paylaşılıyor. Kesit belleği saf işlevin belleği; anahtar: kurulum + satır + aynı gün include değerleri + `view.open`. İşlem içinde bellek yok. |
| Yazımın sınırı / yanıtı | (ana dalda da vardı) | `routes/accounts.mjs:334`: ids'li liste bütün şirketin ayırıcısını koşturuyor. | **H4:** `openByAccount({ parties: ids })`. Ayırıcı cari başına bağımsız. |
| Borç Yaz (kapı, Ç7a verisi) | c1 (+20 ms) ve a3 cdd7e586 (+25 ms, tek ölçüm) | Asıl pay c1'inki. | H1 + H2 + H4 yetti; Ç7a'ya ayrı düzeltme gerekmedi. |
| Alt Hesap Mizanı | 5ba59cbc (Ç7a tur 2, K-14) | `money-lines.mjs` periodGroups'ta satır başına `CASE WHEN COVER_SQL` ve ifadeyle gruplama (100 bin satırda 231 → 270 ms). | **Düzeltilemedi.** Davranışı aynı dört yeniden yazım denendi, hiçbiri hızlandırmadı. Biri 114 dönemde bayt bayt aynıydı ama 428 ms sürdü. Kod geri alındı. |

Tur 3a / 3b (taşıma), tur 2f ve sürücü iş miktarını değiştirmedi. Kararın kilitli ölçümündeki "Hesabı Atanmamış listesi 1124 → 1299" bu ayrıştırmada yeniden üretilemedi (+%2).

## 2. Önce / sonra (ms, en iyi / ortanca; ana c53a757a · taban 9c09f18d · uç)
Ölçüm düzeni: sıra ana → taban → uç × 2, her blok taze kopya, 5 tekrar, `flock -x`. Olay döngüsü en çok değerleri karşılaştırma dosyalarında.

**Kilitsiz** (geçersiz blok: yalnız t3c taban ×1):
- cari kartı (şüpheli + bağlı): 185/215 · 496/502 · **123/149**
- YAZIM bağlı tahsilat (şüpheli cari): 367/394 · 1432/1534 · **325/382**
- YAZIM tahsilat (şüphelisiz cari): 306/321 · 417/423 · **168/188**
- Borç Yaz (kapı, Ç7a verisi): 259/275 · 302/350 · **161/177**
- Evrak: 49/55 → **12/17**; fatura: 187/214 → **69/89**; iptal: 97/105 → **59/69**; fatura kaydı: 182/197 → **78/84**
- Mizan, Yevmiye, Hesap Planı Mizanı, Defter Mutabakatı, Mutabakat Testi, Alacak Yaşlandırma, Cari Listesi: ana'ya göre %0–9
- Eşikte (tek ölçüt):
  - Alt Hesap Mizanı.
  - Cari Listesi (ılık) 1,09 / 1,11; taban da +7 %.
  - t2 betiğinde Yevmiye bütün zaman 1,11 / 1,11 (uç ↔ taban 1,00). Ayrıca yapılan hedefli ölçümde yeniden üretilmedi: ana 2.989 / uç 3.020; Mutabakat Testi ana 7.091 / uç 7.272.

**Kilitli** (geçersiz blok yok):
- cari kartı (şüpheli + bağlı): 172/179 · 472/514 · **121/126**
- YAZIM bağlı tahsilat: 341/365 · 1400/1474 · **315/341**
- YAZIM tahsilat (şüphelisiz): 287/301 → **167/180**
- Borç Yaz (kapı): 290/312 → **161/183**
- Mizan, Mutabakat Testi, Alacak Yaşlandırma, Cari Listesi, Hesabı Atanmamış listesi: −%3 … +%5
- Alt Hesap Mizanı 1,09 / 1,10 (sınırda). Açılış Olabilir listesi ortancada eşikte.
- c7a ve t2 ikinci koşuda ölçüldü; ilk koşu iş süre sınırında kesildi (kesik dosya kanıtta).

**Alt Hesap Mizanı hedefli ayrıştırması** (iki tur × 7 tekrar): ana 252/265, a1 ≈ ana, a2 286/289, uç 284/293 → **+%13 / +%11**.

## 3. Eşdeğerlik ve testin dişi
- **Kalıcı test** `test/t3hiz-esdegerlik-250.test.mjs`, iki TZ'de **4 / 4**. 9c09f18d kopyasında **4 / 4 kırmızı**; neden `LINKED_CHEQUE_PARTIES_SQL` / `LINKED_MEMO_TEST` yok.
  - Sınıflar: şüpheli + bağlı nakit / çek, bağsız, kısmi şüpheli, bağlı tahsilatlı faturanın iptali, yalnız evrak bağlı şüpheli carisi, kayıttan sonra kesilen faturaya bağlı çek (bağlı kural ≠ bağsız kural), yalnız bağsız evraklı şüpheli carisi, şüphelisiz kalabalık cari (peşinler, geriye tarihli vadeli borç), faturayla ciro.
  - Aşamalar: kilitli ↔ açık; yazım (yeni faturaya bağlı, ayırt edici), kapı reddi, store dışı yazım, başka bağlantının yazımı, geri alınan işlem; iki şirket.
  - Hakemler: eski sorgu ve gövde testte aynen; 9c09f18d hakemi `test/fixtures/t3hiz-esdegerlik-250-hakem.json`, iki TZ'de bayt bayt aynı.
  - Aynı gün iki bağlı tahsilat sınıfı hakeme girmiyor (ayırıcının UUID sırası, ders 31); yalnız bellekli ↔ belleksiz ve kesit anahtarı sınamasında.
- **Mutasyon** `test/t3hiz-esdegerlik-250-mutasyon.mjs`: **14 / 14 değerle**, "bir carinin payı atlanır" dahil. İlk tarama 8 / 14'tü:
  - eşdeğer çıkan M7 değiştirildi,
  - sınıf verisi ayırt edici yapıldı,
  - geri alınan işlem vakası eklendi.
- **100 bin satır, taban ↔ uç tam döküm** (dışa açık yüz + ayırıcı + liste + kart + yevmiye 120/128/129) **BAYT BAYT AYNI**:
  - hazir3c: 1.897 satır, 503.880.829 bayt
  - temiz: 1.896 satır, 503.640.858 bayt
  - Döküm süresi 770 → 234 sn.

## 4. Komşu / kâhin / ekran (iki TZ, `tools/kanit.mjs kos`)
- Komşu: 353 dosya (taramayla), **3.905 / 3.905** iki TZ'de.
- `test:kahin-defter` **187 / 187**; `test:kahin-cari` **17.253 / 17.253** (iki TZ).
- senaryo-supheli-230 **67 / 67**; senaryo-supheli-kuyruk-250 **15 / 15**; senaryo-banka-210 **428 / 428** (iki TZ).

## 5. Ana oturumun yeniden koşacağı komutlar ve beklenen sayılar
- `TZ=Europe/Istanbul` ve `TZ=UTC` ile `node --test test/t3hiz-esdegerlik-250.test.mjs` → 4 / 4. 9c09f18d archive kopyasında (test + hakem kopyalanmış) → 4 kırmızı, yukarıdaki nedenle.
- `node test/t3hiz-esdegerlik-250-mutasyon.mjs --kopya <uç archive kopyası>` → 14 / 14.
- Kâhin: 187 / 187 ve 17.253 / 17.253. Komşu listesi `docs/kanit/2026-11-19/t3hiz-komsu-dosyalari.txt` → 3.905.
- Hız: `timeout 7000 bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3hiz-a/hiz3.sh kilitsiz uc2 5` (ve `kilitli`), ardından `python3 -I …/t3hiz-a/karsilastir3.py …/t3hiz-a/hiz3-*-<kip>.txt` → KÖTÜ 0 (Alt Hesap Mizanı sınırda).
  - Gereken kopyalar `/dev/shm/t3hiz/` altında duruyor: k-ana, k-s3, k-uc2, hazir3c-kaynak, tohum7-kaynak.
- 100 bin satır: `bash …/t3hiz-a/esd.sh uc2 hazir3c /dev/shm/t3hiz/hazir3c-kaynak` → BAYT BAYT AYNI 1.897 satır.

## 6. Commit'ler
| Commit | İçerik |
|---|---|
| 9d18000d | Tasarım §19.9 |
| 52214100 | H1–H4 |
| dac15f8b | Test + mutasyon |
| 0e252c6c | H1b |
| dfe8a663 | Ayırt edici sınıflar + yeni hakem |
| d7ccb034 | Geri alınan işlem vakası |
| e68f6eb1 | Kanıt |
| 0b4f6508 | Tasarım sonuç |
| 742040a1 | Tasarım: kilitli + Alt Hesap Mizanı |
| 5e8784f9 | Kanıt |

## 7. BAŞ MİMAR KARARI GEREKİYOR
1. **Alt Hesap Mizanı (Ç7a tur 2, 5ba59cbc), +%13 / +%11 (hedefli ölçüm).** Öndeki iki ölçümde sınırda kaldı (en iyi +%3–10, ortanca +%7–15). Seçenekler:
   - (a) Satıra yazılan "açılışta sayılmış" bayrağı ya da dönem tablosu. Göç / yeni alan gerektirir, bu turun dışında.
   - (b) Daha iyi bir eşdeğer SQL için Ç7a sahibine ayrı tur.
   - (c) BİLİNEN SINIR (~+35 ms / 100 bin satır).
   - **Öneri: (c).** Gerekçe: mutlak fark küçük, rapor 0,5 sn altında.
2. **H2 ve H4 ana dalda da çalışan yolları değiştiriyor.** Bunlar fatura servisinin tek cari kuyruk girdisi (cari kartı, obligationsFor) ve cari servisinin ids'li listesi. Davranış 100 bin satır dökümüyle ve testle aynı, ama tek dar kontrol bu farkı da görmeli.

## 8. DOĞRULANMADI / ÖLÇÜLEMEDİ
- **Yazım kapısındaki tekrar hesap** H1 / H2 ile ucuzladı ama ortadan kalkmadı: işlem içinde paylaşılan bir bellek, store.tx'in işlem kimliği olmadan kanıtlanamıyor ve db.mjs yazılamaz.
- **Ölçüm koşulları:**
  - Ön ölçümün d3 bölümü ÖLÇÜLEMEDİ: kilit alınamadı, başka oturum ortak kilidi tutuyordu. Sonradan önce / sonra ölçümünde kapsandı.
  - d1 ayrıştırmasının t3 … s3 blokları başka yük yüzünden yük > 2 ile GEÇERSİZ sayıldı; yalnız ayrıştırma için okundu.
- **Kural ihlali:** hakem üretimini bir kez yük 4,4 iken başlattım (kural 3,5). Ölçüm değildi ama kural ihlali.
- **Koşulmayanlar:** tam npm test ve Windows CI (ana oturum).

## 9. Not defteri klasörleri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/t3hiz-a` — betikler ve ham çıktılar; aynıları `docs/kanit/2026-11-19/t3hiz-*` ve `t3hiz-betik/` altında.
- `/dev/shm/t3hiz` — kod kopyaları (k-ana, k-s3, k-uc2, k-a3, k-s1, k-s2, k-hakem) ve veri kaynakları; 1,6 GB.

Ortam: yük 0,3 / 4 çekirdek, bellek boş 12 GB, disk boş 6,9 GB.