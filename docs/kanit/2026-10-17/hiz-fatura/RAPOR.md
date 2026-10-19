# Fatura Modülü — Yükte Hız Testi (2.4.3, 17.10.2026)

Ürün kodu, testler ve git DEĞİŞMEDİ. Bütün betik ve çıktılar bu klasörde. Maliyet 0 TL (sahte EDM, ağa çıkılmadı; `HUKUK_LICENSE_URL=http://127.0.0.1:9`).

## Özet (kullanıcının gördüğü p95, ms)

| Ölçü (ekrandan) | Çıta | D1 (5 ekran) | D2 (8 ekran + 2 API) | D3 (5 ekran + 15 API) |
|---|---|---|---|---|
| Form açılışı (senaryo tık → form hazır) | < 1.000 | **489 ✓** | **811 ✓** | **318 ✓** |
| Cari arama (son tuş → liste) | < 500 | 1.303 ✗ | 3.335 ✗ | 4.360 ✗ |
| Ürün arama (son tuş → liste) | < 500 | 1.303 ✗ | 3.339 ✗ | 4.840 ✗ |
| Kaydet ve Gönder (onay "evet" → kart) | < 2.000 | 2.115 ✗ (sınırda) | 10.048 ✗ | 16.429 ✗ |
| Fatura listesi açılışı (menü → satırlar, 10.000+ belge) | < 1.500 | 1.536 ✗ (sınırda) | 3.427 ✗ | 5.012 ✗ |
| Toplam güncellenmesi (Tab → Genel Toplam) | — | 845 | 2.821 | 4.154 |
| PDF açılışı (indirme bitti) | — | 1.406 | 2.835 | 5.736 |
| Rapor (Satış Faturaları, Bu Yıl) | — | 1.032 | 3.903 | 4.374 |
| Hata (beklenen 409 hariç) | 0 | **0 ✓** | 7 ✗ | 29 ✗ |
| Doğruluk (numara + tutarlılık) | %100 | **9/9 ✓** | **9/9 ✓** | **9/9 ✓** |

Ortanca (p50) değerler D1'de iyi (arama ~195 ms, form ~220 ms, Kaydet ve Gönder ~410 ms, liste ~520 ms); D2'de çoğu 1,3–5 sn, D3'te 2–11 sn.
**Para ve numara doğruluğu yükte hiç bozulmadı; yavaşlama kuyruktan.** Ayrıntılı tablolar aşağıda.

## Kurulum

- **Kod:** depo `/home/user/ofis---y-netimi`, sürüm 2.4.3, HEAD `fd57ee3` (ağaç temiz).
- **Makine:** Intel Xeon 2,10 GHz, **4 çekirdek**, 15 GB bellek, Linux, Node v22.22.0, Playwright Chromium (başsız). Disk başta 13 GB boş.
  Sunucu, tarayıcılar, yük üreticisi ve sahte EDM **aynı makinede** (gerçek ağ yok).
- **Sunucu:** ayrı süreç (`fork`), üretimdeki gibi yalnız `edocEnabled + edocLive` (diğer ayarlar createApp varsayılanı), gerçek dosya SQLite.
  Lisans denetimi kapalı (`enforce:false`), zamanlanmış yedek kapalı. Ortam: Test (TEF/TEA serisi).
- **Sahte EDM:** `test/einvoice-mock.mjs` (`startMockEdm`). Ölçüm sürecinde çalışıyor; gönderim/durum/iptal SOAP'la yapılıyor.
- **Veri (programın kendi API'siyle, kopya yok):** 300 cari (110 e-Fatura mükellefi firma, 100 şahıs TCKN, 1 perakende 11111111111,
  49 mükellef olmayan firma, 40 tedarikçi), 200 ürün; 12 aya yayılmış **10.000 fatura**: 6.422 satış (e-Fatura/e-Arşiv, gönderilmiş),
  2.500 alış, 730 satıştan iade, 348 alıştan iade (e-Arşiv), 376 iptal. Ödeme: açık, tam/kısmi nakit, çek/senet.
  Satır sayıları: 22.735 fatura kalemi, 20.233 stok hareketi, 13.806 cari hareketi, 964 çek/senet. Ret 0; Mutabakat Testi temiz.
  **Hazırlama süresi 512 sn** (cari+ürün 2 sn, faturalar 507 sn; 3 eşzamanlı istek). Ham: `ham/veri-hazirlama.log`, `ham/hazir.json`.
- **Düzeyler:** her biri taze veri kopyasında, **600 sn** yük (+ giriş ve denetim), sırayla, `flock` ile tek başına (ders 15). Tohum 11.
  - D1: 5 ekran kullanıcısı (rol Muhasebe + "Finans raporları" yetkisi; Muhasebe rolü tek başına Rapor Merkezi'ni açamıyor), API yok.
  - D2: 8 ekran + 2 API = 10. D3: 5 ekran + 15 API = 20.
- **Ekran kullanıcısı (gerçek Chromium, ayrı oturum):** tuş arası 40–80 ms, işlem arası 1–3 sn. Döngü (ağırlık): Satış faturası %45
  (Stoktan Satış → cari ara/seç → 3–5 kalem: ürün ara/seç, miktar, fiyat, KDV seç → %35 kısmi nakit → %80 Kaydet ve Gönder / %20 Kaydet, Sonra
  Gönder → kart → %40 PDF), alış %10, iade (karttan İade) %7, e-Arşiv iptal (önce Durum Sorgula) %6, liste (numara ara, temizle, Daha Fazla
  Göster ×1–2) %15, Gönderilecekler (+ Tümünü Gönder) %8, Rapor Merkezi → Satış Faturaları %9.
- **API kullanıcısı:** aynı karışım API'den, 0,5–1,5 sn bekleme (satış Kaydet ve Gönder / Sonra Gönder + kartı gönder, alış, iade, Durum
  Sorgula + iptal, liste/arama/sayfa, cari/ürün arama, kart + PDF, rapor, Gönderilecekler).
- **Ölçüm:** ekranda olay → DOM'da beklenen sonuç (ör. aranan carinin `li[data-id]`'si; Genel Toplam = kâhinin tutarı; kart rozetleri).
  "Kaydet ve Gönder → kart": onay penceresindeki "evet" tıkından kartın görünmesine (sunucu kaydı + sahte EDM'ye gönderim dahil); onay
  penceresinin gelişi ayrı satırda. Arama süreleri programın kendi 180 ms'lik yazım gecikmesini (debounce) içerir.
  Tarayıcı ağ süreleri `requestfinished.timing()`; sunucu süreci CPU / RSS / olay döngüsü gecikmesi (monitorEventLoopDelay) 15 sn'de bir;
  uzun görevler (Long Tasks API) ve layout-shift (PerformanceObserver) her pencerede; yazılan her alan yazımdan sonra okunup karşılaştırıldı.
- **Doğruluk (koşu sonu, her düzey):** (1) cari bakiyesi farkı = yük üreticisinin kendi defteri (yalnız 200 dönen yazımlar; tutar bağımsız
  kâhinle: tam sayı kuruş, satır başına KDV, yarım yukarı), (2) stok farkı = defter, (3) Kasa (100) farkı = defter, (4) her belgenin tutarı
  = kâhin, (5) `GET /ledger/integrity` temiz, (6) koşuda yazılan belge sayısı = 200 dönen kayıt (çift fatura yok), (7) her seri/yılda
  numaralar benzersiz + boşluksuz + tarih sırasıyla uyumlu (hazırlanan 12 ay dahil BÜTÜN veri), (8) kendi numaramızla yinelenen belge yok,
  (9) sahte EDM'ye giden numaralar benzersiz.

## Çıtayı aşanlar — ölçüm (tahmin değil)

1. **Sunucu ana iş parçacığı D2 ve D3'te doymuş.** Sunucu süreci CPU'su 15 sn'lik örneklerin tamamında ~105–116 % (bir çekirdek dolu),
   olay döngüsü gecikmesi p99 D2'de 0,7–3,5 sn, D3'te 1,9–4,1 sn (D1'de 47–875 ms). Yüksüz 2–5 ms süren uçlar yükte 1,2–2,4 sn (p50) bekliyor:
   `POST /invoices/calc` yüksüz 2 ms → D2 p50 1.212 / D3 2.436 ms; `GET /accounts/search` 5 ms → 1.391 / 2.335 ms; `GET /invoices/items`
   3 ms → 1.309 / 2.363 ms. Yani arama ve toplam süresi programın o uçtaki işi değil, **önündeki kuyruk**.
2. **Kuyruğu dolduran istekler (ölçülen):**
   - Tarayıcı isteklerinin **%47 (D1) – %59 (D2)'si arka plan yenilemesi** (kullanıcı tıklamadan): D1'de 10 dakikada 5 pencere
     `stock/alerts` 1.619, `dues` 497, `invoices` (liste) 420, `tasks/liens/plans/cheques/bank/badge` ~150'şer istek attı; D2'de (8 pencere)
     arka plan 5.700 istek, fatura listesi 958 kez. Her kayıt bütün açık pencerelere yenileme yaydığı için **ekran kullanıcısı sayısı yükü API
     kullanıcısından fazla büyütüyor**: D2 (8 ekran + 2 API) sunucuyu D3 (5 ekran + 15 API) kadar doyurdu.
   - Yüksüz tek istemci ölçümünde (`ham/yalitik.json`, 10.000 fatura, 12 tekrar ortancası): **fatura listesi** bir sayfa (200 satır) için
     215 ms (Satış sekmesi) / 354 ms (Tümü), "Daha Fazla" 207 ms, **numara araması (1 satır dönüyor) 267 ms** — uç her istekte bütün listeyi
     hesaplayıp sonra dilimliyor (`routes/invoices.mjs` `GET /api/workspace/invoices`: `list(...)` → `slice(offset, offset+limit)`), yanıt
     ~240 KB. `dues` 55 ms ama yanıt **2,8 MB** (her pencere, her değişiklikte); `cheques` 25 ms / 307 KB; `stock/alerts` 35 ms (yanıt 21 bayt).
   - `POST /api/workspace/invoices` (kaydet + EDM'ye gönderim) tarayıcıdan p50 123 ms (D1) → 2.366 ms (D2) → 7.128 ms (D3); API'den
     "Satış (Kaydet ve Gönder)" p50 4,1 sn (D2) / 8,3 sn (D3). Gönderim sahte EDM'ye SOAP; kayıt + numara + gönderim aynı istekte.
3. **D1 sınırda aşımlar** (Kaydet ve Gönder p95 2.115 ms, liste p95 1.536 ms, arama p95 1,3 sn): p50 iyi, kuyruk dalgalı (olay döngüsü p99 en çok
   875 ms; 5 Chromium + sunucu aynı 4 çekirdekte, load1 en çok 3,6).

## Hatalar (beklenen 409'lar hariç)

- **"EDM'ye bağlanılamadı: UND_ERR_SOCKET"** — D1 0, D2 2, D3 19 (Gönder 7, Durum Sorgula 7, İptal 4, Tümünü Gönder 1) + 2 "buyer-check-failed"
  (aynı neden) + 1 "einvoice-uncertain" (kopan gönderimin sonucu). Program doğru davrandı (numara harcamadı ya da belgeyi "belirsiz" işaretledi,
  doğruluk denetimleri temiz). **Kök neden AYRILMADI:** sahte EDM ölçüm sürecinde (D3'te 15 API işçisi + Playwright ile aynı olay döngüsü);
  bağlantı ~5 sn boşta kalınca yeniden kullanımı zorla üretme denemesi (bekleme 1,0–6,0 sn, 48 deneme) **0 hata** verdi (`ham/keepalive-yeniden.log`).
  Ürün mü (EDM istemcisinde kopan bağlantıyı yinelememe — güncelleyicide düzeltilen sınıfın benzeri) test düzeni mi (yük altındaki sahte sunucu)
  ayırmak için sahte EDM ayrı süreçte yeniden koşulmalı (ders 20).
- **Kaydedilip gönderilemeyen e-Belge:** koşuda yazılanların e-durum dağılımında "issued/none" (numaralı, gönderilmemiş, Gönderilecekler'de değil,
  kartta "e-Belge Gönder" ile yeniden gönderilebilir): D2 5, D3 46 (+ 9 iptal/none). "Kaydet ve Gönder" 200 döner, gönderim hatası yanıtın
  `autoSend` alanında/bildirimde. Hangi hatayla düştükleri araç tarafından kaydedilmedi (araç sınırı); aynı koşudaki UND_ERR_SOCKET ile birlikte
  arttı. Kullanıcı bunları ancak bildirimden ya da listedeki rozetten fark eder — **yükte gönderilmeyen belge sayısı görünür bir uyarıyla
  toplanmalı mı, karar ürün sahibinde.**
- **30 sn bekleme aşımı (ekran):** D2 4, D3 1 — liste arama / aramayı temizle / Daha Fazla / Gönderilecekler adımlarından birinde (araç adımı
  kaydetmedi; ekran görüntüleri `ham/hata-D2-*.png`, `ham/hata-D3-*.png` liste görünümünde). Aday: liste arka planda yeniden çizilirken
  tıklanan düğme ("Daha Fazla Göster") — doğrulanmadı.
- D2'de 1 ekran hatası **aracın veri seçimi** (perakende 11111111111 carisine 30.000 TL üstü e-Arşiv; program doğru reddetti) — ürün hatası değil.
- Karakter kaybı **0** (3 düzey, her yazılan alan okundu), sayfa (JS) hatası **0**.

## Tarayıcı

- Uzun görev (Long Tasks) toplamı pencere başına 10 dakikada 1,1–9,2 sn, en uzun tek görev 113–294 ms (donma algısı sınırı ~200 ms'nin
  biraz üstü, seyrek). Yük arttıkça sayı azalıyor (tarayıcı bekliyor, çalışmıyor).
- **Layout-shift (CLS) yüksek:** pencere başına koşu boyunca 0,6–2,5 (D1), 3,5–5,8 (D2/D3). Ölçüm bütün oturumu (birçok pencere açılıp kapanması,
  liste yeniden çizimi) toplar; tek sayfa yüklemesinin Web Vitals CLS'iyle karşılaştırılamaz. Ancak D2/D3'te iki katına çıkması, geç gelen
  yanıtlarla (arka plan yenilemesi) içeriğin kullanıcının gözü önünde kaydığını gösteriyor — "ekran yanıp sönmesi / kayma" şikâyetiyle ilgili
  ayrıca ekran kaydıyla bakılmalı.

## Denenmeyenler

- Gerçek EDM (bilerek: maliyetsiz/sahte EDM). Gerçek EDM gönderim tavanı önceki ölçümde ~320/dk (`docs/kanit/2026-10-16/edm-hiz`).
- Windows, Edge, gerçek ağ (personel bilgisayarı → sunucu); sunucu ve tarayıcılar ayrı makinelerde değil.
- Uzun koşu (her düzey 10 dk), 30+ kullanıcı, 100.000+ fatura, iki şirket, yedekleme sırasında yük, çek/senetli ve taksitli ekran satışı,
  hizmet satışı / iskonto / tevkifat ekrandan, e-Fatura iptali (önce GİB/alıcı gerekir), Toplu PDF/Excel/ZIP, liste PDF'i.
- Lisans denetimi açık (üretimde açık), zamanlanmış yedek açık.
- Olay döngüsünü dolduran işin CPU profili (hangi işlev) — yalnız uç bazında ölçüldü.

## Sınırlar

- Aynı 4 çekirdekte sunucu + 5–8 Chromium + yük üreticisi + sahte EDM: tarayıcılar sunucuyla CPU paylaşıyor (load1 en çok 5,6). Sunucu yine de tek
  çekirdeği sürekli doldurdu (~110 %), bu yüzden doyma sunucunun kendisinde; ama mutlak süreler gerçek kurulumdan (sunucu ayrı makine) kötü olabilir.
- Sahte EDM anında yanıt verir; gerçek EDM gecikmesi "Kaydet ve Gönder" süresine eklenir.
- "Arama" süresi programın 180 ms'lik yazım gecikmesini içerir (çıta 500 ms ile bu gecikme arasında 320 ms kalır).
- Ölçüm aracının ilk D1 koşusu (`ilk-D1-arac-hatali/`) araç kusurları yüzünden (iptal yanıtı yakalanmadı, "Sonra Gönder" belgesinin yer tutucu
  numarasıyla arama) atıldı; düzeltilip üç düzey baştan koşuldu. Duman koşuları `duman/`.
- Para alanları kâhinle kuruşu kuruşuna karşılaştırıldı; KDV oranı stok kartında olmadığı için ekranda satır satır seçildi (programın tasarımı).

## Yeniden üretme

```
cd /tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz-fatura
KLASOR=$PWD/tam node hiz.mjs veri                    # ~9 dk; tam/veri
./kos.sh                                             # D1, D2, D3 (flock, her biri 600 sn, tohum 11) → tam/sonuc-D*.json
KLASOR=$PWD/tam node yalitik.mjs > tam/yalitik.json  # yüksüz uç süreleri
node keepalive-yeniden.mjs                           # UND_ERR_SOCKET zorla üretme denemesi
node rapor.mjs tam D1 D2 D3                          # tablolar
```
Ham sonuçlar: `ham/sonuc-D1.json`, `ham/sonuc-D2.json`, `ham/sonuc-D3.json` (her işlem türü + durum kodları, ağ uçları, sunucu örnekleri,
tarayıcı ölçüleri, bütün hata kayıtları, denetimler), `ham/yalitik.json` (bu ölçümde rapor ucu 403: rapor yetkisi düzey başında veriliyor, yalıtık kopyada verilmedi), `ham/kosu-*.log`. Veri kopyaları silindi.

## Ayrıntılı tablolar
| Düzey | Ekran | API | Süre (sn) | Belge | Belge/dk | Belge/sn | Ekran hata | API beklenmeyen hata | Karakter kaybı | Sayfa (JS) hatası | Denetim |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 | 5 | 0 | 636 | 84 (ekran 84) | 7.9 | 0.13 | 0 | 0 | 0 | 0 | 9 geçti / 0 kaldı |
| D2 | 8 | 2 | 635 | 213 (api 132, ekran 81) | 20.1 | 0.34 | 6 | 1 | 0 | 0 | 9 geçti / 0 kaldı |
| D3 | 5 | 15 | 630 | 644 (api 600, ekran 44) | 61.4 | 1.02 | 2 | 27 | 0 | 0 | 9 geçti / 0 kaldı |

### Kullanıcının ekranda gördüğü süre (ms) — p50 / p95 / p99 / en çok (adet)
| İşlem | D1 | D2 | D3 |
|---|---|---|---|
| Liste açılışı (menü → satırlar) | 521 / 1536 / 1616 / 1616 (n=80) | 2059 / 3427 / 3639 / 3639 (n=79) | 2994 / 5012 / 5172 / 5172 (n=42) |
| Gönderilecekler sekmesi | 499 / 1151 / 1151 / 1151 (n=10) | 623 / 2031 / 2031 / 2031 (n=8) | 143 / 459 / 459 / 459 (n=5) |
| Raporlar açılışı | 1343 / 2571 / 2571 / 2571 (n=7) | 3145 / 6684 / 6684 / 6684 (n=10) | 4329 / 4624 / 4624 / 4624 (n=3) |
| Yeni Fatura tık → senaryo ekranı | 258 / 987 / 1469 / 1469 (n=76) | 480 / 1552 / 3634 / 3634 (n=73) | 151 / 533 / 704 / 704 (n=41) |
| Rapor açılışı (Satış Faturaları, Bu Yıl) | 692 / 1032 / 1032 / 1032 (n=7) | 2783 / 3903 / 3903 / 3903 (n=10) | 3332 / 4374 / 4374 / 4374 (n=3) |
| Form açılışı (senaryo tık → form hazır) | 219 / 489 / 532 / 532 (n=76) | 372 / 811 / 982 / 982 (n=73) | 135 / 318 / 581 / 581 (n=41) |
| Cari arama (son tuş → liste) | 195 / 1303 / 1835 / 1835 (n=76) | 1822 / 3335 / 3402 / 3402 (n=73) | 2828 / 4360 / 4903 / 4903 (n=41) |
| Ürün arama (son tuş → liste) | 196 / 1303 / 1823 / 1859 (n=295) | 1820 / 3339 / 3861 / 4370 (n=278) | 2826 / 4840 / 4918 / 5344 (n=159) |
| Liste arama (Enter → sonuç) | 272 / 1046 / 1046 / 1046 (n=15) | 2143 / 3129 / 3129 / 3129 (n=11) | 2798 / 3837 / 3837 / 3837 (n=8) |
| Toplam güncellenmesi (Tab → Genel Toplam) | 57 / 845 / 1566 / 2239 (n=295) | 1289 / 2821 / 3419 / 3930 (n=278) | 2326 / 4154 / 4808 / 5231 (n=159) |
| Liste aramayı temizle (Enter → 200 satır) | 339 / 1748 / 1748 / 1748 (n=15) | 2065 / 3180 / 3180 / 3180 (n=11) | 2375 / 4191 / 4191 / 4191 (n=8) |
| Daha Fazla Göster (sayfa çevirme) | 802 / 1536 / 1557 / 1557 (n=20) | 3793 / 7737 / 7737 / 7737 (n=12) | 3622 / 4922 / 4922 / 4922 (n=10) |
| Kaydet tık → onay sorusu | 420 / 1176 / 1529 / 1529 (n=84) | 2147 / 4087 / 4706 / 4706 (n=82) | 2390 / 4388 / 4516 / 4516 (n=44) |
| Kaydet ve Gönder → kart | 407 / 2115 / 3608 / 3608 (n=57) | 5189 / 10048 / 10407 / 10407 (n=47) | 11038 / 16429 / 17285 / 17285 (n=31) |
| PDF açılışı (indirme tamam) | 416 / 1406 / 1689 / 1689 (n=30) | 1644 / 2835 / 3334 / 3334 (n=25) | 2362 / 5736 / 5736 / 5736 (n=13) |
| Alış Kaydet → kart | 335 / 464 / 464 / 464 (n=9) | 1388 / 2681 / 2681 / 2681 (n=11) | 2286 / 4507 / 4507 / 4507 (n=6) |
| Kaydet, Sonra Gönder → kart | 286 / 911 / 911 / 911 (n=10) | 1562 / 2929 / 2929 / 2929 (n=15) | 741 / 2373 / 2373 / 2373 (n=4) |
| Fatura kartı açılışı | 200 / 1862 / 1862 / 1862 (n=16) | 2244 / 4189 / 4189 / 4189 (n=14) | 4159 / 5500 / 5500 / 5500 (n=7) |
| Durum Sorgula → kart | 331 / 1013 / 1013 / 1013 (n=8) | 5437 / 6621 / 6621 / 6621 (n=5) | 4517 / 5677 / 5677 / 5677 (n=4) |
| İptal Et → kart (İptal Edildi) | 475 / 770 / 770 / 770 (n=8) | 6092 / 7795 / 7795 / 7795 (n=5) | 8473 / 11597 / 11597 / 11597 (n=4) |
| Tümünü Gönder → yanıt | 423 / 605 / 605 / 605 (n=4) | 8088 / 15959 / 15959 / 15959 (n=5) | — |
| İade tık → iade formu hazır | 269 / 987 / 987 / 987 (n=8) | 1987 / 4815 / 4815 / 4815 (n=9) | 4441 / 4517 / 4517 / 4517 (n=3) |
| İade Kaydet → kart | 356 / 519 / 519 / 519 (n=8) | 2189 / 4371 / 4371 / 4371 (n=9) | 2365 / 3623 / 3623 / 3623 (n=3) |

### Tarayıcının ağdan gördüğü istek süresi (ms, istek → yanıt sonu) — p50 / p95 / p99 / en çok (adet); en sık 25 uç
| Uç | D1 | D2 | D3 |
|---|---|---|---|
| `GET /api/workspace/stock/alerts` | 53 / 659 / 1057 / 2500 (n=1619) | 999 / 2310 / 3083 / 4788 (n=1858) | 1809 / 3037 / 3689 / 4487 (n=442) |
| `POST /api/workspace/invoices/calc` | 5 / 676 / 1336 / 2225 (n=1402) | 1212 / 2839 / 3546 / 5254 (n=1334) | 2436 / 4195 / 5117 / 7082 (n=748) |
| `GET /api/workspace/invoices/last-prices` | 7 / 681 / 1182 / 1730 (n=590) | 1190 / 2813 / 3281 / 3834 (n=556) | 2382 / 4346 / 4671 / 5197 (n=318) |
| `GET /api/workspace/dues` | 610 / 1169 / 1632 / 1928 (n=497) | 1280 / 2477 / 3331 / 4033 (n=1258) | 1992 / 3308 / 3785 / 4641 (n=439) |
| `GET /api/workspace/invoices` | 515 / 1157 / 1548 / 1840 (n=420) | 1409 / 2740 / 3534 / 5110 (n=958) | 2248 / 3697 / 4356 / 4522 (n=538) |
| `GET /api/workspace/invoices/items` | 6 / 723 / 1249 / 1501 (n=295) | 1309 / 2899 / 3540 / 3901 (n=279) | 2363 / 4329 / 4698 / 5075 (n=159) |
| `GET /api/workspace/invoices/:id` | 209 / 1177 / 1719 / 2237 (n=184) | 1036 / 2777 / 3727 / 4247 (n=249) | 1287 / 3853 / 4326 / 4326 (n=54) |
| `GET /api/workspace/tasks` | 157 / 899 / 1217 / 1378 (n=154) | 838 / 2035 / 2537 / 3700 (n=464) | 1772 / 2889 / 3964 / 4587 (n=379) |
| `GET /api/workspace/liens` | 108 / 874 / 1123 / 1233 (n=149) | 672 / 1972 / 2954 / 3088 (n=456) | 1693 / 2919 / 3540 / 4059 (n=374) |
| `GET /api/workspace/plans` | 84 / 812 / 1049 / 1381 (n=149) | 693 / 1923 / 2690 / 3981 (n=456) | 1727 / 3011 / 3416 / 5077 (n=374) |
| `GET /api/workspace/cheques` | 168 / 1022 / 1406 / 1471 (n=149) | 842 / 2145 / 2566 / 3507 (n=456) | 1901 / 3047 / 3649 / 4442 (n=374) |
| `GET /api/workspace/bank/badge` | 568 / 1425 / 1840 / 2142 (n=149) | 1406 / 2296 / 2939 / 3311 (n=456) | 1917 / 3106 / 4323 / 4657 (n=374) |
| `GET /api/workspace/invoices/meta` | 5 / 831 / 921 / 1113 (n=101) | 1302 / 2777 / 2878 / 3074 (n=101) | 2170 / 4453 / 4830 / 4830 (n=54) |
| `GET /api/workspace/bank/choices` | 34 / 665 / 1488 / 1488 (n=84) | 1264 / 2893 / 3626 / 3626 (n=82) | 2351 / 4209 / 5155 / 5155 (n=44) |
| `POST /api/workspace/invoices` | 123 / 1630 / 3379 / 3379 (n=84) | 2366 / 8926 / 9956 / 9956 (n=82) | 7128 / 15777 / 17147 / 17147 (n=44) |
| `GET /api/workspace/accounts/search` | 9 / 819 / 1214 / 1214 (n=76) | 1391 / 2819 / 3182 / 3182 (n=73) | 2335 / 3928 / 4643 / 4643 (n=41) |
| `GET /api/chat` | 4 / 931 / 1762 / 1762 (n=75) | 1075 / 2544 / 3020 / 3229 (n=120) | 2195 / 3730 / 4425 / 4425 (n=75) |
| `GET /api/workspace/client-state` | 6 / 698 / 1071 / 1071 (n=55) | 1281 / 2825 / 3400 / 3400 (n=88) | 2405 / 3734 / 3755 / 3755 (n=55) |
| `GET /api/workspace/case-notes` | 4 / 878 / 1119 / 1119 (n=55) | 953 / 2449 / 3498 / 3498 (n=88) | 1526 / 2852 / 3948 / 3948 (n=55) |
| `GET /api/workspace/invoices/:id/fatura.pdf` | 413 / 1405 / 1679 / 1679 (n=30) | 1643 / 2819 / 3332 / 3332 (n=25) | 2360 / 5731 / 5731 / 5731 (n=13) |
| `GET /api/workspace/report-center/fatura-satis` | 412 / 1064 / 1064 / 1064 (n=12) | 1912 / 3152 / 3436 / 3436 (n=23) | 3287 / 4311 / 4311 / 4311 (n=5) |
| `GET /api/auth/me` | 9 / 257 / 257 / 257 (n=10) | 13 / 78 / 78 / 78 (n=16) | 12 / 87 / 87 / 87 (n=10) |
| `GET /api/trpc/sheets.getRows` | 360 / 1559 / 1559 / 1559 (n=10) | 1219 / 1938 / 1938 / 1938 (n=16) | 2767 / 3199 / 3199 / 3199 (n=10) |
| `GET /api/workspace/overview/mizan` | 162 / 1198 / 1198 / 1198 (n=8) | 1449 / 2589 / 2589 / 2589 (n=13) | 2564 / 3806 / 3806 / 3806 (n=3) |
| `POST /api/workspace/invoices/:id/e-refresh` | 56 / 689 / 689 / 689 (n=8) | 5205 / 6146 / 6146 / 6146 (n=5) | 4407 / 5610 / 5610 / 5610 (n=4) |
| `GET /api/workspace/report-center` | 10 / 1013 / 1013 / 1013 (n=7) | 1687 / 3982 / 3982 / 3982 (n=10) | 3287 / 3524 / 3524 / 3524 (n=3) |
| `GET /api/events` | 319846 / 353515 / 353515 / 353515 (n=5) | 334838 / 353209 / 353209 / 353209 (n=9) | 314145 / 324540 / 324540 / 324540 (n=8) |
| `GET /api/public/info` | 4 / 39 / 39 / 39 (n=5) | 8 / 37 / 37 / 37 (n=8) | 10 / 46 / 46 / 46 (n=5) |
| `POST /api/auth/login` | 50 / 66 / 66 / 66 (n=5) | 48 / 55 / 55 / 55 (n=8) | 50 / 52 / 52 / 52 (n=5) |

### API yük üreticisinin gördüğü süre (ms, HTTP gidiş-dönüş) — p50 / p95 / p99 / en çok (adet) · durum kodları
| İşlem | D1 | D2 | D3 |
|---|---|---|---|
| Alış faturası | — | 791 / 4547 / 4706 / 4706 (n=37) 200:37 | 2489 / 4006 / 4752 / 5123 (n=143) 200:143 |
| Liste açılışı (200 satır) | — | 1284 / 3124 / 3401 / 3401 (n=57) 200:57 | 2858 / 4551 / 4917 / 23888 (n=200) 200:200 |
| Liste arama | — | 1558 / 4050 / 4392 / 4392 (n=30) 200:30 | 3002 / 4715 / 5909 / 6225 (n=157) 200:157 |
| Satış (Kaydet, Sonra Gönder) | — | 1458 / 2573 / 2573 / 2573 (n=15) 200:15 | 2331 / 3899 / 4257 / 4257 (n=81) 200:81 |
| Liste sayfa çevirme | — | 1774 / 3723 / 3723 / 3723 (n=17) 200:17 | 2895 / 4572 / 5028 / 5028 (n=85) 200:85 |
| e-Belge Gönder (kart) | — | 4753 / 9890 / 9890 / 9890 (n=15) 200:15 | 6171 / 13924 / 17200 / 17200 (n=81) 200:72 502 integrator-unreachable:7 502 buyer-check-failed:2 |
| Cari arama (form) | — | 1356 / 2994 / 2994 / 2994 (n=19) 200:19 | 2186 / 3998 / 4532 / 4532 (n=99) 200:99 |
| Ürün arama (form) | — | 898 / 3122 / 3122 / 3122 (n=19) 200:19 | 1822 / 3114 / 4089 / 4089 (n=99) 200:99 |
| Satış (Kaydet ve Gönder) | — | 4071 / 10067 / 13946 / 13946 (n=69) 200:69 | 8348 / 16206 / 18303 / 20221 (n=309) 200:309 |
| Satıştan iade | — | 758 / 1402 / 1402 / 1402 (n=11) 200:11 | 1915 / 3521 / 4559 / 4559 (n=67) 200:67 |
| Gönderilecekler listesi | — | 650 / 2961 / 2961 / 2961 (n=16) 200:16 | 2531 / 3934 / 4247 / 4247 (n=62) 200:62 |
| Durum Sorgula | — | 3032 / 5634 / 6587 / 6587 (n=32) 200:32 | 4919 / 8240 / 10240 / 10361 (n=103) 200:93 502 integrator-unreachable:7 409 einvoice-not-sent:3 |
| İptal (e-Arşiv) | — | 4243 / 8889 / 8889 / 8889 (n=16) 200:15 502 integrator-unreachable:1 | 7164 / 11650 / 12427 / 12427 (n=58) 200:50 502 integrator-unreachable:4 409 einvoice-processing:3 409 einvoice-uncertain:1 |
| Rapor (Satış Faturaları) | — | 1507 / 2245 / 2245 / 2245 (n=4) 200:4 | 3047 / 4580 / 4863 / 4863 (n=43) 200:43 |
| Fatura kartı | — | 837 / 2240 / 2240 / 2240 (n=12) 200:12 | 2360 / 3749 / 4742 / 4742 (n=64) 200:64 |
| PDF | — | 468 / 1983 / 1983 / 1983 (n=12) 200:12 | 1755 / 3389 / 3784 / 3784 (n=64) 200:64 |

### Sunucu süreci (15 sn'lik örnekler) ve makine
| Düzey | CPU ort. % (1 çekirdek = 100) | CPU en çok % | RSS en çok MB | Olay döngüsü p99 en çok (ms) | Olay döngüsü en çok (ms) | load1 en çok (4 çekirdek) | Boş bellek en az MB |
|---|---|---|---|---|---|---|---|
| D1 | 47 | 90 | 686 | 875 | 1258 | 3.64 | 12090 |
| D2 | 105 | 110 | 777 | 3460 | 3460 | 5.61 | 10800 |
| D3 | 111 | 116 | 808 | 4058 | 4058 | 4.46 | 12159 |

### Tarayıcı (pencere başına, koşu boyunca): uzun görev toplamı / adedi / en uzun (ms), layout-shift (CLS)
- D1: ekran01 4796/64/159 CLS 1.1747 · ekran02 9053/115/259 CLS 1.6901 · ekran03 7461/93/183 CLS 2.4787 · ekran04 7908/90/237 CLS 0.6130 · ekran05 4839/66/221 CLS 1.6401
- D2: ekran01 5721/82/192 CLS 4.6738 · ekran02 5672/80/162 CLS 3.4888 · ekran03 5218/71/195 CLS 5.0712 · ekran04 5244/75/113 CLS 5.7888 · ekran05 4045/57/151 CLS 4.9515 · ekran06 5111/63/226 CLS 4.2864 · ekran07 9234/104/200 CLS 3.5218 · ekran08 7996/84/294 CLS 4.3543
- D3: ekran01 2467/33/188 CLS 4.4815 · ekran02 2806/36/222 CLS 4.3989 · ekran03 1979/29/116 CLS 4.9254 · ekran04 1826/23/213 CLS 4.8969 · ekran05 1075/16/114 CLS 4.1311

### Doğruluk denetimleri
**D1**
- ✓ cari bakiyeleri: program farkı = bağımsız defter (67 cari değişti; uyuşmayan 0)
- ✓ stok miktarları: program farkı = bağımsız defter (149 ürün; uyuşmayan 0)
- ✓ Kasa (100): program farkı 408704 = defter 408704
- ✓ fatura tutarı: kâhin = program (84 belge; uyuşmayan 0)
- ✓ Mutabakat Testi (ledger/integrity) temiz
- ✓ çift fatura yok: koşuda yazılan 84 belge = 200 dönen kayıt 84
- ✓ numaralar: 6 seri/yıl, 7573 numaralı belge — benzersiz + boşluksuz + tarih sırası (sorun yok)
- ✓ kendi numaramızla yinelenen belge yok (0)
- ✓ sahte EDM: koşuda 65 gönderim, yinelenen numara 0

**D2**
- ✓ cari bakiyeleri: program farkı = bağımsız defter (140 cari değişti; uyuşmayan 0)
- ✓ stok miktarları: program farkı = bağımsız defter (189 ürün; uyuşmayan 0)
- ✓ Kasa (100): program farkı 373676.7 = defter 373676.7
- ✓ fatura tutarı: kâhin = program (213 belge; uyuşmayan 0)
- ✓ Mutabakat Testi (ledger/integrity) temiz
- ✓ çift fatura yok: koşuda yazılan 213 belge = 200 dönen kayıt 213
- ✓ numaralar: 6 seri/yıl, 7662 numaralı belge — benzersiz + boşluksuz + tarih sırası (sorun yok)
- ✓ kendi numaramızla yinelenen belge yok (0)
- ✓ sahte EDM: koşuda 137 gönderim, yinelenen numara 0

**D3**
- ✓ cari bakiyeleri: program farkı = bağımsız defter (253 cari değişti; uyuşmayan 0)
- ✓ stok miktarları: program farkı = bağımsız defter (200 ürün; uyuşmayan 0)
- ✓ Kasa (100): program farkı 560645.25 = defter 560645.25
- ✓ fatura tutarı: kâhin = program (644 belge; uyuşmayan 0)
- ✓ Mutabakat Testi (ledger/integrity) temiz
- ✓ çift fatura yok: koşuda yazılan 644 belge = 200 dönen kayıt 644
- ✓ numaralar: 6 seri/yıl, 7989 numaralı belge — benzersiz + boşluksuz + tarih sırası (sorun yok)
- ✓ kendi numaramızla yinelenen belge yok (0)
- ✓ sahte EDM: koşuda 364 gönderim, yinelenen numara 0

### Hata kayıtları (ilk 15)
**D1** ekran: yok · API: yok · karakter kaybı: yok · sayfa hatası: yok

**D2** ekran: `ekran01: page.waitForFunction: Timeout 30000ms exceeded.`; `ekran04: Kaydet, Sonra Gönder: hata Cari (alıcı): 30.000 TL üstü e-Arşiv faturada nihai tüketicinin gerçek TC kimlik numarası, adı soyadı ve adresi zorunludur (11111111111 yazılamaz).`; `ekran06 Tümünü Gönder: 1 gönderilemedi: EDM'ye bağlanılamadı: UND_ERR_SOCKET`; `ekran02: page.waitForFunction: Timeout 30000ms exceeded.`; `ekran01: page.waitForFunction: Timeout 30000ms exceeded.`; `ekran07: page.waitForFunction: Timeout 30000ms exceeded.` · API: `İptal (e-Arşiv) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}` · karakter kaybı: yok · sayfa hatası: yok

**D3** ekran: `ekran01: page.waitForFunction: Timeout 30000ms exceeded.`; `ekran01 iptal TEA2026400003005: 502 {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}` · API: `e-Belge Gönder (kart) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `İptal (e-Arşiv) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `Durum Sorgula 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `İptal (e-Arşiv) 409 einvoice-processing {"ok":false,"error":"e-Arşiv fatura EDM'de henüz işleniyor; iptal ancak işlem bitince yapılabilir. Birkaç dakika sonra Durum Sorgula ile bakıp yeniden deneyin.","code":"einvoice-processing"}`; `İptal (e-Arşiv) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `e-Belge Gönder (kart) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `e-Belge Gönder (kart) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `Durum Sorgula 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `İptal (e-Arşiv) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `e-Belge Gönder (kart) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `e-Belge Gönder (kart) 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `Durum Sorgula 409 einvoice-not-sent {"ok":false,"error":"Bu belge henüz entegratöre gönderilmedi.","code":"einvoice-not-sent"}`; `e-Belge Gönder (kart) 502 buyer-check-failed {"ok":false,"error":"Alıcının e-Fatura mükellefiyeti entegratöre sorulamadı (EDM'ye bağlanılamadı: UND_ERR_SOCKET). Belge numara verilmeden Gönderilecekler'de kaldı; bağlantı düzelince yeniden gönderi`; `Durum Sorgula 502 integrator-unreachable {"ok":false,"error":"EDM'ye bağlanılamadı: UND_ERR_SOCKET","code":"integrator-unreachable","detail":"","integratorCode":""}`; `İptal (e-Arşiv) 409 einvoice-uncertain {"ok":false,"error":"Son e-Belge gönderiminin sonucu belirsiz (entegratöre bağlantı koptu; belge ulaşmış olabilir). Önce Durum Sorgula: belge entegratörde yoksa yeniden gönderilir ya da değiştirilir."` · karakter kaybı: yok · sayfa hatası: yok

### Belge durumu dağılımı (koşuda yazılanlar: tür/profil/durum/e-durum)
- D1: sale/TEMELFATURA/issued/sent 27, sale/EARSIVFATURA/issued/sent 30, sale/EARSIVFATURA/cancelled/cancelled 8, purchase/KAGIT/issued/none 9, sale_return/KAGIT/issued/none 8, sale/TEMELFATURA/issued/waiting 2
- D2: purchase/KAGIT/issued/none 48, sale/TEMELFATURA/issued/sent 56, sale/EARSIVFATURA/cancelled/cancelled 20, sale_return/KAGIT/issued/none 20, sale/EARSIVFATURA/issued/sent 61, sale/TEMELFATURA/issued/none 3, sale/EARSIVFATURA/issued/none 2, sale/EARSIVFATURA/issued/waiting 3
- D3: purchase/KAGIT/issued/none 149, sale/TEMELFATURA/issued/none 17, sale/TEMELFATURA/issued/sent 171, sale/EARSIVFATURA/issued/sent 148, sale/EARSIVFATURA/cancelled/cancelled 43, sale_return/KAGIT/issued/none 70, sale/EARSIVFATURA/cancelled/none 9, sale/EARSIVFATURA/issued/none 29, sale/EARSIVFATURA/issued/processing 2, sale/EARSIVFATURA/issued/waiting 4, sale/EARSIVFATURA/cancelled/waiting 1, sale/TEMELFATURA/issued/waiting 1
