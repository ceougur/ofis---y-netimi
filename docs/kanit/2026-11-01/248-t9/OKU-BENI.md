# 2.4.8 son aday — T9 ÖLÇEK (01.11.2026)

Kod: is/t9-248, Aday 2 ucu b2e7bf19 (ürün kodu DEĞİŞMEDİ). Betikler: `test/t9-248/` (npm test dışında), betik commit'i e3f61ded.
Ortam: linux x64, 4 çekirdek, 15 GB, Node v22.22.0. Ölçümler tek tek (`flock /tmp/destekofis-olcum.lock`, ders 15), her ölçüm verinin TAZE kopyasında.
Dış istek yok (ders 30): HUKUK_LICENSE_URL=http://127.0.0.1:9; Meta = ayrı süreçte yerel sahte Graph (test/whatsapp-sahte-graph.mjs), kapıcı = yerel gerçek
bulut/kapi/kapi.mjs, lisans servisi sahte. Durum bildirimleri GERÇEK yoldan: sahte Meta → kapıcı → tünel → programın uzak dinleyicisi → /wa/kanca.
Saat sahte (config.now; ders 13/22): Ölçüm 1 02.11.2026 10:00 (+03) akar; sınır ve Ölçüm 2 durur.

VERİ: 29.10 mobil ölçümünün verisi (docs/kanit/2026-10-29/mobil-ozet-olcum; `tools/olcek-210.mjs --asama veri`, programın kendi API'siyle: 2 şirket,
001'de 3.014 cari / ~100.000 para satırı, 002 ~12.000) — AYNI kopya (önce/sonra aynı veri). Açılışta 2.4.8 göçü (v44) koşar.
Geçmiş (Ölçüm 2): `wa-gecmis-uret.mjs` ile programın kendi API'si ve işçisiyle 40 toplu gönderim × 2.000 kişi (03.11.2025 → 25.03.2026), arada Başarısızları
Yeniden Dene (131026) ve Sonucu Belirsiz → işteki Yine de Gönder zincirleri. KULLANICI KARARI (01.11 ~15:45 UTC "40 gönderimde ölç"): 100 yerine 40.
SAKLANAN KOPYALAR (olası düzeltmeden sonra aynı veriyle yeniden ölçüm için; silinmedi):
- `/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/t9-4c8e1d/taban-2910` (209 MB; 2.4.7 verisi, göç öncesi)
- `/tmp/claude-0/-home-user/2a941a30-cea4-5380-a679-f28a541c21a1/scratchpad/t9-4c8e1d/gecmis-40` (563 MB; v44, 58 toplu iş / 80.126 iş satırı)

## Koşular (kanit.mjs kos kayıtları bu klasörde; ayrıntı sonuc-*.json)
| Kayıt | Komut | Çıkış | Hüküm |
|---|---|---|---|
| mobil-ozet-1 / -2 | `node test/t9-248/mobil-ozet-olcum.mjs <taban>/data <iş> <json> 60` | 0 / 0 | BELİRSİZ (ölçüm betiği test özeti basmaz; 29.10'daki gibi) |
| wa-sinir-1 | `wa-gonderim-olcum.mjs --kip sinir` | 0 | GEÇTİ 13/13 — ama kanca 401 (düzenek hatası, aşağıda); GEÇERSİZ sayıldı |
| wa-sinir-2 | aynı (düzenek düzeltildi) | 0 | GEÇTİ 16/16 |
| wa-yuk-1-kesildi-… | `--kip yuk` ilk deneme | — | arka plan süre sınırında (30 dk) kesildi; yalnız A/B/C evreleri; D yok |
| wa-yuk-1 | `wa-gonderim-olcum.mjs --kip yuk` | 0 | GEÇTİ 17/17 |
| tumunu-sec-baslat | `tumunu-sec-baslat.mjs` | 0 | GEÇTİ 3/3 |
| gecmis-uret-1 | geçmiş üretimi ilk deneme | 1 | BAŞARISIZ: Ödeme Hatırlatma'da gecikmiş borçlu yok → program 400 (doğru); betik düzeltildi |
| gecmis-uret-a | 0–33 | (SIGTERM) | YARIDA: sahte Meta süreci ~66.000 iletiden sonra yığın sınırında düştü (düzenek); 33 gönderim + 1 yarım iş kaldı, kendi pid'im durduruldu |
| gecmis-uret-b | 34–39 (a'nın çıktısından) | 1 | 2/3: "Yine de Gönder zinciri" denetimi bu 6'lık parçada üretilmez (i%9=4 yok) — zincir a'da üretildi (anyway_links 12, inherit_of 12) |
| gecmis-olcum-40-0-429 | 40 gönderim, ilk deneme | 1 | 10/13: kapıcının dakikada 600 kanca sınırı (test aşırı hızlı) → betik hızı ayarlandı |
| gecmis-olcum-40-1 / 0 / 40-2 | `wa-gecmis-olcum.mjs --veri <gecmis-40 | taban>` | 0 / 0 / 0 | GEÇTİ 13/13, 12/12, 13/13 |
| kaynak-tarayan-testler | lisans izolasyonu + platform + Meta izolasyonu | 0 | GEÇTİ 15/15 (ilk koşu yeni betikte Windows'ta kırılan `new URL(…).pathname` kalıbını yakaladı; düzeltildi) |

Bütçe: plan sayı vermiyor ("2.000 carilik toplu gönderim sırasında masaüstü p95", §9). Ölçüt: 2.1.0 düzeni ve "kullanıcıyı bekleten > 2 sn" (CLAUDE.md Hız:
bütçeyi az aşanlar BİLİNEN SINIR); 29.10 mobil C (p95 172–393 ms, en çok 1,6 sn) kabul edilmişti.

## Ölçüm 1 — 2.000 kişilik toplu gönderim (wa-yuk-1, işçi kendi zamanlayıcısıyla, iletiler arası 1 sn, basamak TIER_2K)
Masaüstü uçları p50/p95/en çok ms (tek kullanıcı art arda — 29.10 yöntemi):
| Uç | A gönderimsiz (62 sn) | D gönderim sürerken (2.882 sn, 1.017 tur) |
|---|---|---|
| Cari Listesi | 165/219/273 | 188/254/424 |
| Cari Arama | 45/78/82 | 51/79/339 |
| Cari Kartı | 15/144/170 | 18/129/284 |
| Kasa | 596/764/838 | 655/859/1.064 |
| Rapor: Cari Listesi | 175/236/242 | 214/274/376 |
| Rapor: Banka Bakiye | 435/528/642 | 454/597/717 |
| Rapor: Kasa Hareketleri | 1.020/1.388/1.488 | 1.074/1.352/1.920 |
| Banka Hareketleri | 8/11/12 | 11/20/44 |
| WhatsApp Gönderimleri | 2/3/5 | 5/8/23 |
| Gönderim ayrıntısı (2.000 kişi) | — | 41/60/77 |
| Gönderim durumu | 2/3/4 | 5/10/36 |
| Olay döngüsü p99 / en çok | 1.019 / 1.489 | 1.037 / 1.878 |
Sonuç: gönderim SÜRERKEN masaüstü bütçe içinde (en çok 1,9 sn — Kasa Hareketleri raporu, gönderimsizde de 1,5 sn). 2.000/2.000 teslim/okundu, Meta'ya giden
2.000 (çift yok), Bu Ay 2.000 (≈ 1,8 USD). Kanca: 4.976 bildirim, hepsi 200, p50 6 / p95 906 / en çok 1.470 ms (masaüstü isteklerinin arkasında sıra).
İşçi verimi: yük altında 2.000 ileti 48 dk (1,44 sn/ileti); yüksüz iş başına 31–39 ms (sınır koşuları), 33–36 ms (Ölçüm 2).
Süreç belleği (RSS): en çok 1.123 MB (önizleme/başlatma evresinde), gönderim boyunca 669–786 MB, son 781 MB.
24 SAATTE 250 (wa-sinir-2, TIER_250, saat durur): 1. pencerede Meta'ya tam 250, teslim 250, kalan 1.750 "Sınır Nedeniyle Bekliyor"; saat 24 sa 1 dk ileri → iş
kendiliğinden sürdü, toplam 500 (1.500 bekliyor). Kanca 10/10 olay 200.

ÖNİZLEME ve BAŞLATMA (BULGU 1): süre ms (iki deneme), 2.000 cari:
| Seçim | wa-sinir-1 | wa-sinir-2 | wa-yuk-1 | gecmis 0 | gecmis 40-0-429 | gecmis 40-1 | gecmis 40-2 |
|---|---|---|---|---|---|---|---|
| Ekstre Geçen Ay | 22.441 / 22.647 | ✓ | 23.177 / 22.715 | 26.271 / 26.629 (+26.585 eş zamanlı) | 27.347 / 27.836 (+27.466) | 24.915 / 25.767 (+25.902) | 28.354 / 28.414 (+29.256) |
| Ekstre Bu Ay | 23.208 / 21.696 | ✓ | 22.534 / 23.919 | 25.532 / 27.041 | 26.393 / 26.662 | 24.780 / 25.821 | 27.010 / 27.570 |
| Son 3 Ay | 21.541 / 21.840 | ✓ | 23.138 / 24.059 | — | — | — | — |
| Tüm Hareketler | 24.207 / 21.913 | ✓ | 24.693 / 23.475 | 27.094 / 27.121 | 28.646 / 29.201 | 26.927 / 27.776 | 29.576 / 31.043 |
| Özel Aralık | 22.737 / 22.898 | ✓ | 23.421 / 23.032 | — | — | — | — |
| Ödeme Hatırlatma (8 gönderilecek) | 22.662 / 23.082 | ✓ | 23.606 / 22.993 | — | — | — | — |
| Tümünü Seç (3.012) | 33.866 / 33.833 | ✓ | 39.848 / 37.666 | tumunu-sec-baslat: 44.022 | | | |
| BAŞLAT (POST batches) | 23.332 | 25.150 | 25.892 | 28.419 | 26.634 | 27.605 | 27.423 |
(✓: wa-sinir-2'de aynı seçimler 200; sayılar sonuc-wa-sinir-2.json.) Tümünü Seç BAŞLAT (3.014): 41.498 ms — istemcinin 30 sn sınırını aşar.
AYRI SÜREÇTEKİ yoklayıcı (başka kullanıcının cari araması, 200 ms'de bir; normalde p50 53–57 ms): önizleme sırasında en çok 27.260 / 26.381 / 25.773 / 29.097 ms,
başlatma sırasında en çok 26.429 / 28.258 / 27.426 / 27.220 ms (gecmis 40-0-429, 0, 40-1, 40-2) — bütün ofis o süre kadar bekler.
Profil (onizleme-profil-ozeti.txt): 22,76 sn önizlemenin 22,68 sn'si queue.mjs:513 `load` → accounts().detail(id) (her cari için tam cari kartı); bunun 18,93 sn'si
routes/accounts.mjs:546 `openingEntryOf` — SQLite planlayıcısı `idx_account_entries_source (source=?)` dizinini seçiyor (EXPLAIN: "SEARCH … USING INDEX
idx_account_entries_source (source=?)" + "TEMP B-TREE FOR ORDER BY"), cari başına ~8 ms (57.227 satır). Aynı sorgu her cari kartı açılışında da koşar (2.4.6'dan).
EKRANDA (client/assets/hof-whatsapp-api.js, hof-core.js — koddan): önizleme beklerken "Önizleme hazırlanıyor…"; tür / dönem / "Yine de Gönder" seçimi her
değiştiğinde ve "Yeni Gönderim"de önizleme YENİDEN istenir; Gönder onayından sonra düğme pasif, başka gösterge yok; istek 30 sn'yi aşarsa "Sunucu zamanında
yanıt vermedi." + önizleme yeniden yüklenir (bir kesinti daha) — toplu iş SUNUCUDA AÇILMIŞ olur (tumunu-sec-baslat: 1 iş, 3.014 kişi); aynı istek kimliğiyle
yeniden basma ikinci iş açmaz (doğrulandı).

## Ölçüm 2 — geçmiş birikimi: 0 gönderim ↔ 40 gönderim (iki koşu)
20 gönderimlik ara kopya ALINMADI (üretim parça parça yürüdü; 34'lük ara kopya da yer açarken silindi) → ara nokta yerine boş geçmiş (0) aynı betikle ölçüldü.
| Ölçü | 0 (taban, göç dahil) | 40-1 | 40-2 |
|---|---|---|---|
| Veri: toplu iş / iş satırı / defter talebi | 0 / 0 / 0 | 58 / 80.126 / 72.155 | aynı |
| Açılış (ms) | 6.800 (v44 göçü dahil) | 6.309 | 6.709 |
| Bakım turu maintain() p50/en çok ms | 1 / 2 | 176 / 182 | 203 / 210 |
| Bakım turu, yeni 2.000'lik işten sonra p50 | 84 | 151 | 145 |
| probeWritable (×200) | 0 ms | 0 ms | 0 ms |
| Gönderimler ilk 30 p50/p95 | 2 / 4 | 7 / 9 | 7 / 9 |
| Daha Fazla Göster (30'luk sayfa, sonuna kadar) | — (boş) | 2 / 6 (2 sayfa, 58 satır, hepsi bir kez) | 2 / 6 |
| Tarih süzgeci (ay / gün / yalnız Başlangıç / yalnız Bitiş) p50 | 2/1/1/2 | 3/1/1/5 | 3/1/1/5 |
| Eski 2.000 kişilik gönderim ayrıntısı | — | 55 / 70 ms, 1,41 MB | 53 / 57 ms |
| Bu Ay sayımı / dolu ay (Mart 8.683) p50 | 2 / 1 | 16 / 46 | 18 / 65 |
| Yeni işin yürütülmesi, iş başına p50/p95/en çok | 33 / 45 / 252 | 34 / 49 / 915 | 36 / 50 / 951 |
| Kanca, tek bildirim p50/p95/en çok | 5 / 8 / 16 | 12 / 16 / 45 | 12 / 17 / 30 |
| Eski iletiye geç "read" (300 wamid) | — | 5 / 10 / 22 | 7 / 11 / 39 |
| Masaüstü 60 sn: Gönderim durumu / Bu Ay p50 | 5 / 5 | 28 / 23 | 28 / 23 |
| Masaüstü olay döngüsü en çok | 271 | 262 | 244 |
| RSS en çok | 579 MB | 593 MB | 660 MB |
| Şirket dosyası 001 | 185 → 240 MB (tek 2.000'lik gönderimle) | 434 MB | 434 MB |
| Makine defteri whatsapp-gonderim.sqlite | 3,1 MB | 104,7 → 107,8 MB | aynı |
Defter (40): claims 72.155, claim_keys 72.167, outcomes 72.155, accepts 72.028, deliveries 70.689, attempt_deliveries 70.689, anyway_links 12, wa_jobs.inherit_of 12.
Dosya dökümü (dosya-dokumu.txt): wa_jobs 175,8 MB — 125 MB'ı sayfa içi KULLANILMAYAN yer (PDF önce satırda [pdf_blob] tutulup kesinleşince boşaltılıyor), ayrıca
45 MB boş sayfa listesi; yük yalnız 50 MB. Finans tabloları toplamından büyük. Yedek VACUUM INTO ile sıkışık alınır (canlı dosya büyür).
Yarım iş (veri notu): gecmis-uret-a kesilince 03.03.2026'daki bir iş "Sürüyor" kaldı (1.339 Meta Kabul Etti, 660 bekliyor → sonra Duraklatıldı); sonraki iki
aynı dönem gönderiminde o 660 kişi "Zaten Kuyrukta" elendi (§7a 9; program doğru).

## Ölçüm 3 — mobil özet (29.10 yöntemi aynen; aynı veri kopyası)
| | 29.10 (03e0f55a) | 01.11 koşu 1 | 01.11 koşu 2 |
|---|---|---|---|
| A özetsiz: Cari Listesi p95 / olay en çok (ms) | 246 / 313 | 213 / 235 | 224 / 240 |
| B1 1 kullanıcı: süre (ms) / bayt / olay en çok | 3.180–3.717 / 450.372 / 913–1.074 | 2.920–3.181 / 450.401 / 744–892 | 2.850–3.256 / 450.400 / 731–850 |
| B3 3 kullanıcı: süre / bayt / olay en çok | 9.671–10.152 / 1.348.161 / 933–1.041 | 8.034–8.240 / 1.348.581 / 886–1.029 | 8.294–8.512 / 1.348.580 / 833–955 |
| C özet art arda + masaüstü: uçların p95 aralığı / en çok / olay en çok | 172–393 / 1.604 / 1.157 | 154–285 / 1.343 / 953 | 101–313 / 1.576 / 1.197 |
| D telefon: özet okuma+çözme / canlı Kasa | 59–63 / 1.030–1.229 | 43–73 / 827–1.062 | 48–67 / 807–1.074 |
| E /api/mobil/cash · overview · bank (bayt) | 341 · 1.624 · 1.118 | 341 · 1.512 · 1.060 | 341 · 1.512 · 1.060 |
Sonuç: gerileme yok; B1/B3 bir miktar hızlı, boyut +~30–420 B. ("/api/workspace/accounts" 404 sütunu 29.10'daki gibi betiğin yanlış yolu.)

## BULGULAR (yeniden üretilmiş)
1. ÖNERİ YÜKSEK — toplu gönderim önizlemesi ve başlatması sunucuyu 21–31 sn (2.000 cari), 34–44 sn (Tümünü Seç, 3.012) KİLİTLİYOR; geçmiş (40 gönderim) önizlemeye ~0–2 sn ekliyor (veri gürültüsü içinde). 9 koşuda yinelendi (wa-yuk ilk deneme dahil).
   Bütün kullanıcılar/mobil/kanca bekler (ayrı süreç yoklayıcı en çok 25,8–29,1 sn). Her gönderimde en az iki kez, seçim değiştikçe bir kez daha. ~3.000 caride
   başlatma istemcinin 30 sn sınırını aşar: ekran hata der, iş açılmış olur. Kök neden ve satırlar yukarıda (queue.mjs:513 detail; accounts.mjs:546 dizin seçimi).
   Doğrusal (~11–14 ms/cari): 200 cari ~2,5 sn. Emsal: 2.4.7 M-H2 (mobil özet 10 sn kesinti, düzeltildi).
2. DÜŞÜK — bakım turu (60 sn'de bir, olay döngüsünde) geçmişle büyüyor: 1–2 ms → 176–203 ms (40 gönderim). 100 gönderim ÖLÇÜLMEDİ.
3. DÜŞÜK — şirket dosyası büyümesi: 40 gönderimde +249 MB (185 → 434 MB), çoğu wa_jobs'taki PDF'ten kalan sayfa boşluğu (125 MB) + boş liste (45 MB).
GÖZLEM (bulgu değil): kapıcı ofis başına dakikada 600 kanca geçirir (fazlası 429, Meta yeniden dener) — ani 4.000 bildirimde 2.440 × 429 (test hızı); üretim hızında 0.
Uzun kesintiden sonra birikmiş bildirim gecikmeli gelebilir → BİLİNEN SINIR adayı.

## DÜZENEK HATALARI (ürün değil; düzeltilip yeniden koşuldu — ders 4/6/14)
- wa-sinir-1: kanca 401 "İstek kapıcıdan gelmedi" — uzak güvenlik saati DURAN iş saatine bağlıydı, kapıcı işaretinin zaman payı gerçek saate göre → remoteNow gerçek saat.
- wa-yuk ilk deneme: Rapor "cari-mizan" kimliği yok (404; ders 3) → cari-listesi + banka-bakiye; arka plan 30 dk sınırında kesildi → 2 sa sınır + 5 dk'da bir ara özet.
- Geçmiş üretimi: Ödeme Hatırlatma'da kimse yoksa 400 (doğru) → aynı gün Bu Ay ekstresi; sahte Meta süreci yığın sınırında düştü → okunan iletiler hemen atılıyor.
- gecmis-olcum-40-0-429: kanca hızı kapıcı sınırını aştı → dakikada ≤ 500, örnekler tek bildirim, kalanı 100'lük olay.

## DENENMEYEN
- 100 gönderim × 2.000: kullanıcı kararıyla 40'ta kesildi; 2.4.9'da GitHub'da. 20 gönderimlik ara nokta (kopya yok; 0 ↔ 40 ölçüldü).
- Ölçüm 1 yük koşusunun ikinci tekrarı (D evresinde aşım yok; önizleme/başlatma aşımı 9 koşuda yinelendi).
- Windows / müşteri makinesi (daha yavaş CPU'da 2.000 caride de 30 sn aşılabilir — ölçülmedi); tarayıcıdan W4 ekranı (yalnız API + istemci kodu okundu).
- Gerçek Meta / Cloudflare; Yol 2 (imzalı) kanca; iki şirketin aynı anda gönderimi; WhatsApp gönderimi sırasında mobil özet.
- "Daha Önce Gönderildi" (R3) yüksek eşleşmeli önizleme (40'lık geçmiş Mart'ta bitiyor, Ekim/Kasım seçiminde elenen 0).
- 250 sınırında birkaç güne yayılan işin sonuna kadar (2 pencere görüldü); 1.000.000 satır / 30 kullanıcı.
