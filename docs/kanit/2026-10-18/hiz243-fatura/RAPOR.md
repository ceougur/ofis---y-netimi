# 2.4.3 Hız Düzeltmesi — H2, H3, H5, H6 (18.10.2026)

Kaynak bulgular: `docs/kanit/2026-10-17/hiz-fatura/RAPOR.md` (fatura modülü yükte hız testi), `docs/2.4.3-IS-LISTESI.md` 57b, 57c, 57e, 57f.
Commit'ler (dal `worktree-agent-a477c416a56bc423c`, taban 6d235ac; ürün kodu 4d546e9 ile aynıydı): 5248ec5 (H2, H3), 2f581a5 (testler), a4735d0 (H5),
4d1624e (H6). `client/assets/hof-core.js`'e DOKUNULMADI (ortak çekirdek başka ajanda); gereken çekirdek değişikliği `hof-core-onerisi/`.

## Kök nedenler ve yapılanlar

| Bulgu | Kök neden (ölçülen) | Yapılan |
|---|---|---|
| H2 arka plan yenilemesi | (a) Faturada her Tab / miktar değişikliği toplamı sunucuya hesaplatır (`POST /invoices/calc`, yazmaz); hof-core.js her GET olmayan isteği "bu ekranda para/stok değişti" sayıyor → kritik stok rozeti `alertsSoon.now()` ile BEKLEMEDEN yeniden isteniyor (D1: 1.423 hesap → 1.611 rozet isteği). (b) Rozet her istekte 20.000 stok hareketini okuyor (44 ms). (c) Takvim (dues) her pencerede, başkasının her kaydında 2,8 MB baştan (D2: 10 dk'da 3,5 GB). (d) Menü rozetinin fatura sayısı (`invoices?tab=sale&pay=overdue&limit=1`) bütün listeyi şekillendiriyordu (295 ms). | Sunucu: rozet sonucu veri tabanına yazma olana dek saklanır (`total_changes` + `data_version`, işlem içinde kullanılmaz). Takvim içerik sürümü taşır; ekran `?since=` ile ister, içerik aynıysa "değişmedi" (97 bayt). İstemci (hof-promises.js): sürümle ister; yerelde düşürülen kalemde sürüm sıfırlanır. (a) için çekirdek yaması önerisi (aşağıda). |
| H3 fatura listesi | Uç her istekte 10.000 belgeyi ağır sütunlarıyla (alıcı/satıcı JSON'u, defter, ödeme) okuyup HER BİRİNİ şekillendiriyor, sonra 200'ünü gönderiyordu. | `list(user, query, page)`: süzgeç, ödeme durumu, sıralama, toplam hafif satırla; ağır sütun + tam şekil yalnız sayfadaki satırlar. PDF/Excel (sayfasız) eski yoldan. |
| H5 Daha Fazla 30 sn | Zorla üretildi: yükte arka plan yenilemesi (en sık 1,5 sn) her yazıldığında sürmekte olan "Daha Fazla"nın yanıtı eskir; liste kapısı üç kez yineler, araya hep yenileme girince bırakır → tıklama sessizce kaybolur. Önce ölçümünde D2'deki 6 bekleme aşımının 6'sı da "Daha Fazla Göster" adımında (araç adımı artık kaydediyor). | hof-invoices.js: Daha Fazla sürerken yeni arka plan yenilemesi başlatılmaz, bekletilir ve Daha Fazla bitince yapılır (değişiklik kaçmaz). |
| H6 düzen kayması | Kayan düğümün kaynağı ölçüldü (araç `clsBy`): CLS'nin büyük kısmı Fatura penceresinin KENDİSİ (`section.hof-modal`); pencere ortalanmış, liste / senaryo / form / kart arasında boyutu (formda genişliği de) değişince yeniden konumlanıyor. Yanıt tıklamadan 0,5 sn sonra gelince (yükte hep) tarayıcı bunu beklenmeyen kayma sayar. | hof-ui.css: Fatura penceresi her görünümde aynı boyut (1280 px × ekran yüksekliği − 36 px). |

## Önce / sonra (aynı araç, aynı veri kopyası, tohum 11, her düzey 600 sn, ortak e2e kilidi altında tek başına)

Veri: 4d546e9 koduyla programın API'sinden 10.000 fatura (300 cari, 200 ürün, 12 ay; Mutabakat Testi temiz; `ham/veri-hazirlama.log`). Sütunlar: **once** = 4d546e9,
**sonra** = 4d1624e (bu dal), **cekirdek** = 4d1624e + `hof-core-onerisi/hof-core.patch`. Tam tablo `ham/karsilastirma.md`; ham `ham/sonuc-*.json`.

| Ölçü | D1 once | D1 sonra | D1 cekirdek | D2 once | D2 sonra | D2 cekirdek |
|---|---|---|---|---|---|---|
| Doğruluk denetimi (9) | 9/0 | 9/0 | 9/0 | 9/0 | 9/0 | 9/0 |
| Belge (10 dk) | 85 | 88 | 86 | 222 | 332 | 350 |
| Sunucu CPU ort / en çok % | 49 / 87 | 29 / 56 | 31 / 62 | 105 / 109 | 98 / 107 | 93 / 109 |
| Olay döngüsü p99 en çok ms | 1.034 | 390 | 354 | 4.140 | 2.156 | 2.017 |
| stock/alerts adet · p50 ms | 1.611 · 55 | 1.655 · 3 | **613** · 47 | 1.840 · 997 | 2.264 · 508 | 1.674 · 539 |
| invoices (liste) adet · p50/p95 ms | 422 · 514/1.219 | 429 · 228/656 | 419 · 218/736 | 1.058 · 1.370/2.663 | 1.363 · 737/1.670 | 1.407 · 684/1.600 |
| dues adet · toplam MB | 500 · 1.405 | 488 · 1.135 | 492 · 1.133 | 1.258 · 3.563 | 1.288 · 3.386 | 1.283 · 3.411 |
| Ekran: liste açılışı p50/p95 | 506/1.651 | 467/1.091 | 577/1.143 | 2.268/4.066 | 1.594/2.678 | 1.585/2.597 |
| Ekran: cari arama p50/p95 | 195/839 | 193/799 | 196/842 | 1.821/2.887 | 844/1.875 | 824/1.922 |
| Ekran: Tab → Genel Toplam p50/p95 | 64/900 | 50/469 | 43/450 | 1.244/2.851 | 539/1.647 | 458/1.458 |
| Ekran: Kaydet ve Gönder → kart p50/p95 | 364/2.123 | 327/1.288 | 321/1.435 | 5.061/11.184 | 2.289/5.325 | 2.471/5.424 |
| Ekran: liste arama p50/p95 | 304/1.439 | 172/836 | 172/324 | 2.253/3.045 | 1.116/2.229 | 1.143/1.974 |
| Ekran: Daha Fazla p50/p95 | 780/1.979 | 469/968 | 546/1.611 | 2.543/7.556 | 2.340/4.543 | 2.204/4.021 |
| Ekran: fatura kartı p50/p95 | 144/3.123 | 81/827 | 119/412 | 2.966/5.127 | 1.499/3.010 | 1.008/2.534 |
| 30 sn bekleme aşımı (H5) | 0 | 0 | 0 | **6** | **0** | **0** |
| CLS pencere başına | 1,22–2,30 | 0,17–0,70 | 0,09–0,39 | 3,61–5,20 | 0,84–1,97 | 0,36–1,50 |
| CLS'de pencere (section.hof-modal) toplamı | 7,78 | 0,27 | 0,33 | 32,97 | 2,48 | 1,65 |

Yüksüz tek istemci (`ham/yalitik-*.json`, 12 tekrar ortancası, ms): liste (Satış, 200) 252 → 107; Tümü 387 → 145; Daha Fazla 261 → 103; numara araması 350 → 165;
menü rozeti (limit=1) 295 → 88; takvim ikinci istek (sürümle) 66 ms / 2,78 MB → 11 ms / 97 bayt; kritik stok rozeti 44 → 1; her istekten önce bir yazmayla liste
551 → 398, rozet 40 → 33 (yazma önbelleği geçersiz kılar — tasarım gereği).

D2'de istek adedi arttı (9.825 → 11.859): aynı 10 dakikada %50 fazla belge yazıldı (222 → 332) ve her kayıt açık pencerelere yenileme yayar; istek başına süre yarıya indi.

## Fark testi (H3) — sonuç aynı mı

- CI testi `test/fatura-liste-243-fark.test.mjs`: 1.010 belge (satış 568, alış 237, taslak 74, satıştan iade 84, alıştan iade 47, iptal 66, tahsilat 198, Gönderilecekler 131;
  sahte saat DURUR: aynı tarih/saatteki belgelerin sırası okuma sırasına kalır; yolun ortasında iki cari yeniden adlandırılır), **670 birleşim / 31.844 satır,
  0 fark** (sekme × sıralama × ödeme durumu + 400 tohumlu süzgeç/arama/tarih/belge türü/cari/kalem/offset/limit, bozuk limit dahil) + POS peşinli satışlar
  (posCash) 18 dilim, 0 fark. Referans: sayfasız `list()` (eski algoritma, PDF/Excel yolu) + eski ucun dilimlemesi, bayt bayt.
- GERÇEK ESKİ KODLA (`arac/fark-10k.mjs`, `bitis/fark-10k.json`): 10.000 faturalı verinin iki kopyasında 4d546e9 ve 4d1624e sunucuları ayrı süreçte;
  **524 birleşim / 84.469 satır, 524 bayt bayt aynı, 0 fark** (sekme × sıralama × ödeme durumu 224 + 300 tohumlu arama/tarih/belge türü/cari/kalem/offset
  0–20.000/limit). Aynı istekler eskide 73,8 sn, yenide 44,4 sn.

## Kırmızı / yeşil ve mutasyon

| Test | Eski kod (4d546e9) | Yeni |
|---|---|---|
| test/hiz-243-arka-plan.test.mjs (3) | 0/3 (sürüm yok; rozet hareketleri yeniden okur) | 3/3 |
| test/fatura-liste-243-fark.test.mjs (ilk 3) | 1/3 (rozet isteği 568 belgeyi ağır okudu; referans yok) | 4/4 (POS eklendi) |
| e2e hiz-243-arka-plan | 10 geçti, 3 kaldı (istek sürümsüz, yanıt tam) | 13/13 |
| e2e fatura-243-daha-fazla-yaris (ön koşul 4/4 tur oluştu) | 1 geçti, 8 kaldı (4/4 tur Daha Fazla gelmedi) | 9/9 |
| e2e fatura-243-duzen-kaymasi | 3 geçti, 4 kaldı (pencere 4 görünümde yer değiştirdi, kayma 0,538); H2/H3/H5 sonrası a4735d0'da da aynı | 7/7 (0,000) |
| çekirdek önerisi testi (hof-core-onerisi) | 1/2 (calc olay yayımlıyor) | 2/2 (yamalı kopyada) |

Mutasyon (`mutasyon/`, ayrı kopyada, tek tek): 12 mutasyon, 11 yakalandı. M7 (cari sıralaması kart adıyla) ve M11 (aramada alıcı adı yok) ilk turda KAÇTI →
fark testine yeniden adlandırılan cari eklendi → ikinci turda yakalandı; M4 (saklanan rozet listesinin paylaşılması) ilk turda kaçtı → programın içinden
çağıran denetimi eklendi → yakalandı. M6 (hafif satırda taslak/iptal ödeme durumu) EŞDEĞER mutant: ödeme süzgeci bu değerleri hiç seçmez, toplam yalnız
kesilmiş belgeyi sayar — çıktıda fark doğuramaz (shape() ile aynı tutuldu).

## Çekirdek (hof-core.js) için önerilen değişiklik — ana oturum uygular

`hof-core-onerisi/hof-core.patch` (5 satır) + `hiz-243-hesap-defter.test.mjs.txt` (test/hiz-243-hesap-defter.test.mjs olarak eklenir; mevcut çekirdekte 1/2
kırmızı, yamalıda 2/2). `noteLedgerChange`: yalnız hesaplayan / ön izleyen POST'lar (`/invoices/calc`, `/invoices/view-preview`, `/<modül>/import/preview`)
`ledger:changed` yayımlamaz. Etki (D1 cekirdek sütunu): kritik stok rozeti 1.655 → 613 istek, API isteği toplamı 6.650 → 5.509.

## Etkilenen e2e ve tam test (4d1624e, ortak kilit altında tek tek, `tools/kanit.mjs kos`; `bitis/ozet.log`, `../hiz243-e2e-*.json`)

hiz-243-arka-plan 13/13 · fatura-243-daha-fazla-yaris 9/9 · fatura-243-duzen-kaymasi 7/7 · senaryo-214 48/48 · senaryo-222 56/56 · banka-230-hareket-yaris 37/37 ·
banka-210-kart-onbellek 49/49 · banka-210-daha-fazla 31/31 · acilis-yanit-yaris 12/12 · senaryo-rapor 82/82 · senaryo-216 54/54 · senaryo-223 29/29 ·
senaryo-224 63/63 · senaryo-pos-220 113/113 · senaryo-entegrator-240 73/73 · senaryo-ebelge-242 21/21 · senaryo-ebelge-243 18/18 · e2e (ana) 50/50.
Tam `npm test`: **# tests 2696 / pass 2696 / fail 0 / cancelled 0 / skipped 0** (çıkış 0; `../hiz243-npm-test.json`).

## DENENEN

- Önce/sonra D1 ve D2 (aynı araç, aynı 10.000 faturalı veri, tohum 11, kilit altında tek başına — ders 15); doğruluk denetimleri (bakiye, stok, Kasa, tutar kâhini,
  Mutabakat Testi, numara benzersiz/boşluksuz/tarih sırası, çift belge, sahte EDM yinelenen numara) her koşuda 9/9.
- H3 fark testi iki yoldan: CI'de tohumlu 1.010 belge + POS, bayt bayt; yerelde GERÇEK eski kod (4d546e9) ile 10.000 belgede 524 birleşim (ders 5: kâhin eski kodun kendisi).
- H5 ve H6 zorla üretildi (ders 20): ön koşul her denemede ölçüldü (H5 4/4 tur oluştu); eski kodda kırmızı, yeni kodda yeşil; H6 H2/H3/H5 sonrası kodda da kırmızıydı
  (H2 düzeltmesi H6'yı kapatmadı → ayrı düzeltme).
- Kırmızı kanıtlar ayrı kopyalarda (`hiz243-eski-4d546e9`, `hiz243-sonra-a4735d0`; ders 23/25); mutasyon 12 (11 yakalandı, 1 eşdeğer).
- Güncellik: başka oturumun kaydı takvime/rozete eskisi kadar çabuk geliyor (e2e hiz-243-arka-plan: yeni kalem, kapanan kalem, rozet dolup boşalma);
  senaryo-214/222, banka-230-hareket-yaris, banka-210-kart-onbellek, acilis-yanit-yaris yeşil.
- Görsel: Fatura penceresi liste / senaryo / form / kart ekran görüntüleri (`kirmizi-yesil/fatura-243-*.png`).

## DENENMEYEN

- D3 (5 ekran + 15 API) bu turda koşulmadı (görev D1 + D2 istedi). Windows / Edge / gerçek ağ / gerçek EDM; CI (push yok, ana oturum okuyacak).
- Çekirdek yaması yalnız ölçüm kopyasında denendi (cekirdek sütunu) ve testi yazıldı; depoya girmedi (hof-core.js başka ajanda).
- `test:senaryo-fatura-243` bu dalda yok (fatura ajanının dalında) — koşulmadı.

## BİLİNEN SINIRLAR

- Yazmadan sonraki ilk liste/rozet/takvim isteği ödeme durumlarını baştan hesaplıyor (toplu kapama 10.000 faturada ~300 ms; önbellek her yazmada geçersiz —
  doğruluk için bilerek). Yükte (D2) sunucu hâlâ tek çekirdekte doyuyor (CPU ort 93–98 %); kuyruk yarıya indi ama kalktı demek değil. Artımlı kapama hesabı ayrı iş.
- Takvim (dues): sürüm, içerik DEĞİŞMEDİYSE büyük yanıtı önler (yüksüz 2,78 MB → 97 bayt). Sürekli satış girilen yükte içerik neredeyse her kayıtta değiştiği için
  kazanç küçük (D1 −19 %, D2 −5 % bayt). Yanıtın 2,5 MB'ı 6.248 vadesi geçmiş fatura kalemi (bir yıl geriye); şerit en çok 40 pil gösteriyor. Sunucunun yalnız ilk N
  kalemi + sayıları göndermesi ürün kararı (uyarı ufku) — öneri, yapılmadı.
- Numara araması yüksüz 165 ms (tek carili sonuçta kapama cari başına yoldan; eski yolla aynı sonucu korumak için değiştirilmedi).
- Kalan düzen kayması form içindeki alanlardan (label.hof-field, satır ekleme) — kullanıcı eylemiyle ilgili, pencere kayması değil.
- Liste kapısının aynı aç kalma riski Banka / Cari / Stok / Çek listelerinde de var (aynı HOF.listGate + 3 deneme); fatura dışındakiler bu işin kapsamında
  değil — genel çözüm çekirdekte (arka plan yenilemesi Daha Fazla sürerken başlamasın) önerilir.
- Ölçümde görülen ve fatura ajanının alanında kalanlar: "Tümünü Gönder: Bu belge şu anda gönderiliyor / zaten iletildi" (iki kişi aynı bekleyeni gönderiyor, program
  doğru reddediyor), 1 UND_ERR_SOCKET (H4).
