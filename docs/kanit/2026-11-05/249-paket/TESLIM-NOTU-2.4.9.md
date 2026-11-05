# DestekOfis 2.4.9 — Teslim Notu

> DURUM: SON ADAY 98b1f7ac BÜTÜN KOŞULAR YEŞİL (ana oturum okudu, 05.11.2026 12:01 UTC) — CI #985, Uzun Doğrulama #1207 27/27, windows.yml #72 + #73. Paket bu notla teslim edilir;
> PR → master birleştirme kullanıcının "birleştir"iyle (CLAUDE.md sınırı), yayını kullanıcı açar.

Paketlenen ağaç: **f8aed1f5** (dal `claude/compassionate-galileo-f9kghg`; ürün kodu **78976042** + sürüm commit'i 770cd6f9 → son aday **98b1f7ac**; 98b1f7ac..f8aed1f5 yalnız
CLAUDE.md + docs/2.4.9-IS-LISTESI.md). Paket ayrı temiz worktree'de (`git worktree add --detach /home/user/wt-paket-249 f8aed1f5`, kendi `npm ci`) üretildi; `tools/release.mjs` kapısı:
"f8aed1f CI YEŞİL, çalışma ağacı temiz" (`kanit.mjs ci HEAD`: yalnız belge değişti, hüküm 98b1f7a koşusundan — CI #985).

## Yayın açma bağlantısı

https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.9&target=master&title=DestekOfis%202.4.9

(Etiket v2.4.9 yayını açarken GitHub'da oluşur; hedef **master** — PR birleştirildikten SONRA açılır.)

## GitHub yayınına yüklenecek 5 dosya

| Dosya | Boyut | SHA-256 |
|---|---|---|
| destekofis-guncelleme-2.4.9.zip | 7.762.348 B (329 dosya) | 8b627046d8f368b718728b4ee7e175c129b8e6b166f4000c0e2068516c35395a |
| destekofis-guncelleme.json (imzalı, anahtar destekofis-2026-1) | 1.618 B | 57b61bbdba99715a4f6fd38723df84d06a0f9b39c80c426125b4518d1c9aa307 |
| DestekOfis-Kullanim-Kilavuzu.pdf ("Sürüm 2.4.9", 45 sayfa) | 5.106.520 B | 59a990a53eed6fbccd43da826dd5e1ad130493e48999a5e3e4346cb8de0f7417 |
| DestekOfis-Kurulum.exe (sürüm 2.4.9.0, simgeli) | 37.559.096 B | f3ddf92e94f8cf47d87655e1e88461b1e5c6fce8e284f4fb57805a16ce272c45 |
| DestekOfis-Kurulum.exe.sha256 | 89 B | 721ad25e113bd292af141fa0e62007ac1d9e79f1cff2045b15b4bc88e56c1e33 |

Kurulum 30 MB'ı aştığı için ayrıca iki parça + birleştirme dosyası verilir (bunlar yayına YÜKLENMEZ):
`DestekOfis-Kurulum.exe.parca0` (18.779.548 B, 7153942f…), `DestekOfis-Kurulum.exe.parca1` (18.779.548 B, 8c4b79bc…), `BIRLESTIR.bat` (ba6c1784…).
Üçünü (isterseniz .sha256 ile birlikte) aynı klasöre koyup BIRLESTIR.bat'a çift tıklayın; "TAMAM: Özet eşleşti" yazarsa oluşan DestekOfis-Kurulum.exe yayına yüklenir.
Tam liste: A-SHA256SUMS.txt (bu klasörde).

## Arşiv (GitHub'a YÜKLENMEZ)

- `DestekOfis-2.4.9-Arsiv-Belgeler-Kaynak-Denetim.zip`: bu teslim notu, sürüm notları (CHANGELOG, docs/2.4.9-DEGISIKLIKLER.md), iş listesi, tasarım notları (docs/2.4.9-tasarim),
  kanıtlar (docs/kanit/2026-11-03 … 2026-11-05), paket kanıtı (249-paket), OKU-BENI, SHA256SUMS.
- Kaynak paketi (git bundle, 204.058.933 B; HEAD + çalışma dalı + 42 etiket) zip'in dışında 5 parça: `DestekOfis-2.4.9-Arsiv-Kaynak.bundle.parca0 … parca4`; birleştirme ve beklenen
  özet OKU-BENI'de (bundle sha256 f7bdfec8…; klonda HEAD f8aed1f5, ağaç birebir, fsck çıkış 0). Özetler: B-ARSIV-SHA256SUMS.txt (bu klasörde).

## Sürüm notu (GitHub yayın metni)

**2.4.9 — Cari Silme Kuralı ve İyileştirmeler**
- Yeni: hareketi olan cari artık silinmez, Pasife Al önerilir (hareketsiz, yanlış açılmış cari silinir); müşteriye kredi kartıyla yapılmış ödemenin iadesi için Kredi Kartına İade; veri dosyası bozuk şirket ikinci onayla Yedeksiz Sil ile silinir.
- İyileştirmeler: WhatsApp bağlantısında Türkçe ve yerinde hata iletileri, teslim süresi Meta'nın varsayılanı (30 gün), Şablonları Denetle'den hemen sonra gönderim; iki kredi kartlı şirkette müşteriden POS tahsilatı; büyük cari listelerinde WhatsApp penceresi hızlandı; WhatsApp gönderimleri şirket dosyasını büyütmez; disk dolunca program kilitlenmez. Ayrıntı: docs/2.4.9-DEGISIKLIKLER.md.

(CHANGELOG.md 2.4.9 bölümüyle aynı; ayrıntı docs/2.4.9-DEGISIKLIKLER.md.)

## (a) Kısa özet

2.4.9 müşteri bulgusundan doğan **hareketli cari silinemez** kuralını getirir (C1: tutar taşıyan her kayıt hareket; Sil pasif + nedeni + Pasife Al; silinmiş cariye kayıt yazılmaz —
tahsilat, taksit kartı, stok yarışları dahil). Kredi kartı tarafında iki kartlı şirkette müşteriden POS tahsilatı yeniden girilir (P1, 2.4.3'ten beri kırıktı), müşteride Kredi Kartına İade
(P1-b) ve bu satırın her yerde doğru adı (UI tur A). Bozuk dosyalı şirket ikinci onayla **Yedeksiz Sil** ile silinir (S1). WhatsApp tarafında 2.4.8 elle kabul bulguları kapandı: teslim
süresi Meta varsayılanı 30 gün (W-T/W-6), Denetle önbelleği (W-2), Türkçe hata iletileri (W-4), Bildirim Yolu uyarısı (UI tur B), teslim süresi değişince "kime kaç kez" korunur
(W-KÖK + tur 2). Hız ve güvenilirlik: elle toplu WhatsApp alıcı listesi 2.000 caride ~25 sn → ~1 sn (B2), çok iadeli şirkette önizleme (R2), gönderim PDF'leri dosyayı büyütmez (B3, göç v45),
açılamayan şirket dosyası tutamak bırakmaz (B1), disk dolu / COMMIT hatasından sonra program kullanılmaz hâle gelmez (DB-TX). Kılavuz: Elle Bağla ön koşulları, Cariyi silmek, Yedeksiz Sil,
Kredi Kartına İade (K-1); kılavuz ekran denetimi yeniden çalışır ve CI'de (B4).

## (b) DENENEN

- **CI #985 (98b1f7ac, son aday):** YEŞİL — Linux Node 22/24 + Windows Node 22/24 + Chromium e2e + Doğrulama Kapısı + Dağıtım paketi (ana oturum okudu; f8aed1f5 hükmü bu koşudan, yalnız belge).
- **Uzun Doğrulama #1207 (98b1f7ac):** 27/27 iş YEŞİL (ana oturum okudu, 05.11 12:01 UTC).
- **windows.yml #72 + #73 (98b1f7ac):** YEŞİL — gerçek Windows'ta kurulum / servis / güncelleme / kaldırma, iki koşu (ders 18).
- **Tam kapı** (kod 78976042; docs/kanit/2026-11-05/249-tamkapi/NOT.md; ana oturum 132 kaydı okudu): tam npm test **4652/4652** (çıkış 0); ci.yml e2e satırı **85/85** (hepsi ilk denemede,
  5049/5049 denetim; yeni kilavuz-metin 277, pos-kart-249 383, yedeksiz-sil-249 33); ci.yml kâhinleri 8/8 (53.987; cari 8698/8698 cari_sil dahil); CI dışı senaryolar **16/16** (1.321; ui-ux-217,
  is-akisi-248, tarih-248 dahil); maliyet-tam 43.758/43.758. Bilinen kırmızılar 2.4.8 ile birebir (aşağıda (d)). WhatsApp kâhini TAM koşuldu (315+35+19+292+40): yeni fark ailesi yok;
  CIFT-16 ve J1-02 farkı kalktı.
- **Birleşik son dar kontrol** (xhigh, yeni ajan; fark 69f391a9..48735e51 — UI A + DB-TX tur 2 + W-KÖK tur 2 + UI B): **YÜKSEK 0 / ORTA 0 / DÜŞÜK 3** (hepsi 2.5.0 BİLİNEN SINIR, DURDURMA
  KURALI). Mutasyonlar: W-KÖK 7 (5 yakalandı, WM5 yakalanmadı, WM6 eşdeğer), DB-TX 6 (5 yakalandı, DM5 eşdeğer), UI A 10 (7 yakalandı, UM4c yakalanmadı, UM3b/UM10 eşdeğer), UI B 5/5.
  Kâhin W3-01: tur 2 öncesi 29 fark (aynı kişiye 2. ileti), güncel kodda 0.
- **İş başına dar kontroller** (her düzeltmeden sonra YALNIZ o farka, xhigh, yeni ajan; docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md): B1, B2, B3, W, W-KÖK, S1 (+tur 1), P1 (+tur 1, tur 2), C1 (+tur 1),
  R2, K-1 + B4, DB-TX — hepsinde son turda YÜKSEK/ORTA yok.
- **Bağımsız gözden geçirme** (xhigh; master...dal ürün farkı) YÜKSEK yok; ORTA-1 (Ayrıntılı Cari Ekstre'de Kredi Kartına İade "POS") UI tur A'da düzeldi; v2.4.8 verisinin göçü (v45), günlük
  akış iki sürümde, S1+B1 tutamak 0, R2 damgası, B3, W-2/W-4, ders 47 yeni toplu yollar sorunsuz. **UI/UX gezintisi** (72 ekran görüntüsü): YÜKSEK yok; 3 ORTA UI tur A/B'de düzeldi.
- **Kâhinler (kodu görmeyen ajanlar):** cari kâhini cari_sil — 46 senaryo 8.698/8.698 fark 0, mutant 166/166; C1 öncesi kodda 318 fark (297 "hareketli cari siliniyor" + 21 müşteri bulgusu
  belirtisi Kasa/mizan düşüşü); ana oturum yeniden koştu. WhatsApp kâhini W3 (etkin süre = max(kabul anındaki, güncel)): 292/292, kendi testi 315/315 iki TZ, mutasyon 170/170.
- **C1:** eski kodda beklenen nedenle kırmızı 7 test (T1, T4, T5, T7 accountsKept, T8, H14 POS, 002 şirketi; e2e'de ekrandan nakit tahsilatlı cari silindi, Kasa 2571 → 1821 = müşteri
  bulgusu); yeni kodda tam npm test 4486/4486 (a9547eed), mutasyon 17/17; C1 tur 1 eski 9/12 kırmızı, yeni 12/12 iki TZ, mutasyon 10/10, TAM npm test 4600/4600 (16a80a7d); kart açılışı p50
  +2,4 ms (bütçe +5), fatura listesi C1 öncesi düzeyinde.
- **P1 / P1-b / UI tur A:** eski kodda API 6/8 + e2e 33 kırmızı beklenen nedenle (tur 1), tur 2'de API 3 + e2e 5; yeni API 13/13 iki TZ, e2e pos-kart-249 383/383 (tam kapıda), cari-243 70/70.
- **S1 Yedeksiz Sil:** e2e yedeksiz-sil-249 33/33; dar kontrol + tur 1 YÜKSEK/ORTA yok.
- **W / W-KÖK:** W eski kodda 19 kırmızı beklenen nedenle, WhatsApp birim/API 455/455, 15/15 mutasyon; W-KÖK eski 13 kırmızı (10'u beklenen nedenle), yeni 16/16 iki TZ, mutasyon 9/9,
  WhatsApp 472/472 → 492/492; e2e whatsapp-ayar-248 118/118, şablon-248 50/50.
- **B1:** yerel Linux 19/22 kırmızı beklenen iletilerle → yeni 22/22, mutasyon m1–m4; Windows'ta düzeltmeden sonra 3 CI yeşili (ders 18, 48).
- **DB-TX:** eski kodda 0/9 (asıl hatayı örten "no such savepoint", sonraki her yazım 500), yeni 9/9; gerçek programda 9 para akışı RLIMIT_FSIZE / SQLITE_FULL altında asıl hata + yarım yazım yok +
  sınır kalkınca 200 + Mutabakat ok; TAM npm test 4610/4610 (3fdce131).
- **Ölçümler (boş makine, flock — ders 15; docs/kanit/2026-11-05/249-b2-b3-bos-makine/OKU-BENI.md):** B2 14/14 bütçe içinde — 2.000 kişi eski 24,5–27,5 sn (döngü kilitli) → 0,72–1,11 sn;
  Tümüne 3.021 eski 38,8 → 1,3–1,5 sn; 5.000 kişi 1,3–2,0 sn; R2 6/6 (çok iadeli Tümüne 4.021 1,4–1,7 sn, önizleme 4.014 1,1–1,3 sn). B3: 20.023 işte dosya artışı +75,3 MB (kabul ≤ 96,3),
  yedek VACUUM INTO 616 ms, göç v45 901 ms. Açılış HEAD ↔ 91d2a200 dönüşümlü 3 çift aynı aralıkta (gerileme yok).
- **CI kırmızıları (test hatası, ürün değil):** T35r Windows (sahte Meta gecikmesi) ve mobil-yazma-247 Y9 (`.toast` yarışı) zorla üretildi, düzeltildi; T35r Windows'ta 3 yeşil (ders 18).
- **Kılavuz:** PDF yeniden üretildi (sürüm 2.4.9); birleşimde client/kilavuz kopyasının eski kaldığı pakete girmeden yakalandı (pdf-denetle 38/39 → eşitlendi 48735e51 → 39/39; ders 42).
- **Paket (bu teslim; kanıt bu klasörde):** `release.mjs` kapısı yeşil (release-f8aed1f5.log). İmza programın kendi `verifyEnvelope` + `TRUSTED_UPDATE_KEYS` ile ok (anahtar destekofis-2026-1,
  sürüm 2.4.9), zip özeti/boyutu bildirgeyle aynı; `assessManifest` 2.4.8 / 2.4.7 / 2.4.6 / 2.4.5 / 2.1.0 ok, 2.4.9 NOT_NEWER; payload tahrifi ve imza baytı bozulması reddedildi
  (imza-dogrulama-249.out). Eski sürümlerin GERÇEK güncelleyicisi (git archive v2.4.8, v2.4.7) yerel sahte yayın sunucusuna karşı, GitHub API ve API 403 → yedek yol: dördü de "available 2.4.9",
  paket indirildi + özet doğrulandı; 2.4.9'un kendisi up-to-date ("SONUÇ: hepsi beklendiği gibi"; gerçek GitHub'a istek yok, HUKUK_LICENSE_URL=127.0.0.1:9) (guncelleyici-249.out). Kılavuz
  pdf-denetle **39/39** (45 sayfa; sunucunun verdiği kopya ve client/kilavuz sha256 59a990a5…; güncelleme zip'indeki client/kilavuz PDF'i de aynı sha) (pdf-denetle-249.out). Güncelleme zip'i
  329 dosya (server 235, client 88, CHANGELOG, README, package.json 2.4.9, docs/KURULUM-VE-KULLANIM.md, tools/backup.mjs, tools/mutabakat.mjs; 2.4.8'e göre tek fark yeni
  server/lib/account-movements.mjs); .env / .pem / .key / sqlite / test / kanıt dosyası YOK; içerikte özel anahtar başlığı, PEM başlangıç satırı, imza anahtarı dosya adı ve "GIZLI" deseni YOK (zip-denetim-249.out;
  desenler zip-denetle.py'de).
  Kurulum: Inno Setup + mingw windres; kurulum ve DestekOfis.exe başlatıcısında ICON + GROUP_ICON + VERSION kaynağı var ("simgesiz" uyarısı yok), FileVersion 2.4.9.0 (pe-kaynak-249.out).
  Parçalar: `cat parca0 parca1` = f3ddf92e…; BIRLESTIR.bat (CRLF 67/67) Wine'da certutil taklidiyle (Go ile derlenmiş, gerçek SHA-256 hesaplar) sınandı: sağlam parçalar "TAMAM: Özet
  eşleşti" (oluşan exe f3ddf92e…), parca1'de 1 bayt bozuk → "HATA: Özet TUTMUYOR" (birlestir-sina-249.out; Wine konsolu Türkçe harfleri bozuk gösterir, metin dosyada doğru). Kaynak paketi
  (git bundle) klonlandı: HEAD f8aed1f5, ürün kodu 98b1f7ac ata, ağaç birebir, fsck çıkış 0 (bundle-klon.out).
- **Uygulanan ders maddeleri:** 1, 2 (çıkış kodu + sayılar), 5 ve 40 (kâhinler kodu görmeyen ajanla; BAŞ MİMAR kararları aşağıda), 6, 7 ve 38 (kırmızı kanıt beklenen nedenle), 8 (CI dışı
  senaryolar), 10 (C1/P1 komşuları), 13, 15 (ölçümler flock ile, boş makinede), 16 (ana oturum yeniden koştu), 18 ve 48 (Windows iki+ koşu), 19, 20 (T35r, Y9 zorla üretildi), 21, 23 ve 25
  (eski kod ayrı kopyada, benzersiz klasör), 24 (disk okundu), 26 (CI kuyruğu: birikimli push), 29, 30, 33, 35, 36, 37, 41, 42, 43, 44, 45 (W-KÖK tur 2 gerilimi aşağıda), 46, 47.

## (c) DENENMEYEN

- **Gerçek Meta (WhatsApp Cloud API), gerçek Cloudflare tüneli, gerçek telefon** — kapsayıcıdan yapılamaz; yayından sonra sizin kurulumunuzda (D0). Yol 2 (WhatsApp'ı Bağla) birlikte kullanım
  (coex) D0'ı Tech Provider onayından sonra; o gün yalnız smb_message_echoes aboneliği gerekirse programın echo'yu yok sayması denetlenir (KARAR 05.11).
- **Windows'ta yerel tam kapı** (yerel kapı yalnız Linux / Node 22; Windows yalnız CI #985 + windows.yml #72/#73).
- **Tam kapıda koşulmayanlar** (249-tamkapi/NOT.md, adıyla): uzun koşular (Uzun Doğrulama'da), mutabakat kâhin modelleri; ölçek (T9), göç zinciri tam koşusu; cari kâhini `--legacy` /
  `--kural 2.4.5|2.4.6` kipleri; WhatsApp sürücüsü yol1/yol2 × UTC ve yavaş uç; CI dışı betiksiz yardımcı/zorla e2e dosyaları: banka-210-analiz-yaris, banka-210-fetch-yaris,
  banka-210-planli-yaris, banka-210-yaris, bildirim-yaris-zorla (2.4.9'da yeni), cpu-yavaslat, e2e-not-yaris, esc-kapat, esc-kapat-ozet, form-izolasyon-b4-yaris, pencere-yaris-zorla,
  senaryo-211-yaris-zorla, senaryo-222-yaris, senaryo-225-yaris, tarayici-kesme.
- **Ölçümler** (249-b2-b3-bos-makine/OKU-BENI.md): eski kod yalnız taban setinde 1 tekrar (bes-bin / gecmis / iade / önizleme / ekranda eski kod bugün ölçülmedi — 03.11 değerleriyle
  karşılaştırıldı); "gecmis" setinde silinmiş cari sınıfı yok (C1 kuralı); B3'te eski kod bugün ve 40 gönderim (BULGU 3 ile birebir) ölçülmedi; eşzamanlı çok kullanıcı ve Windows'ta ölçüm yok.
  B2 dar kontrolü: hareketi çok 5.000 cari ölçülmedi (tahmin 2,5–3 sn < 5 sn); kart iadesi/refund_of satırlı veri yalnız yapısal gerekçe; ekran ölçümü yeniden koşulmadı. B3 dar kontrolü:
  büyük dosya göç süresi yeniden ölçülmedi (bugünkü ölçümde göç v45 901 ms).
- **2.4.8'den devreden test borçları** (2.5.0): T9 100 gönderimlik geçmiş ölçümü; T1'in öbür 5 değişkesi.
- **Cari kâhini kapsam dışı:** H5 peşin, H6, H8, H10, H14, H13 tek başına; S3 A; Excel yolu, eşzamanlı yarış, kilitli dönem, yetkisiz, mobil yazma. Tablodan Aktar → tahsilat → Geri Al
  reddi (c14f) kâhine 2.5.0'da eklenir.
- **WhatsApp kâhini:** W-KÖK "uzayıp yeniden kısalma" (12 sa → 30 gün → 6 sa) sırası kâhinde senaryo değil (programda hücreyle denendi, N26 yakalandı).
- **C1 dar kontrolü doğrulamadı (DÜŞÜK):** POS komisyon satırı silinmiş sağlayıcı cariye; Geri Al'da karttan dönen satırlar.
- **DB-TX (DOĞRULANMADI, kuramsal):** iç seviyede geri alma düşerse seçici yakalama (plans.mjs:1174, plan-transfer.mjs:481) yarım yazım bırakabilir — gerçek SQLite'ta tetiklenemedi → 2.5.0.
- **Kurulumun Wine'da sessiz kurulumu/açılışı** (x64 kurulum; gerçek Windows'ta windows.yml #72/#73 koştu).
- **Ölçek 30 kullanıcı ve 1.000.000 satır** (planlı ölçek testi; CLAUDE.md PLANLI TEST).

## (d) BİLİNEN SINIRLAR

**Birleşik son dar kontrol (05.11; DURDURMA KURALI — 2.5.0 BİLİNEN SINIR, düzeltilmedi):**
- DÜŞÜK-1 (eksik test): queue.mjs:1670 `record.wabaId === row.waba_id` koşulunu hiçbir test sınamıyor (mutasyon WM5 25/25 yeşil). Ürün kodu doğru; 2.5.0'da hücre (bağlantı başka WABA'ya
  geçince eski WABA'nın kısa süreli işi için okuma 0, Süresi Doldu yok).
- DÜŞÜK-2 (eksik test): Ayrıntılı Cari Ekstre fatura kökenli satır dalı (report-center.mjs:2788, UM4c yakalanmadı) ve kayıt geçmişi ekran metni "(Kredi Kartına İade)" (hof-workspace.js:1067)
  testsiz; gerçek programda betikle doğru görüldü.
- DÜŞÜK-3 (GERİLEME, seyrek): hof-whatsapp-ayar.js:43 hookFailure — Meta yalnız hata kodu döndürüp ileti göndermezse "(Meta hata kodu N)" ekrandan düşüyor (önce görünüyordu); 2.5.0'da neden
  satırına kod eklenir.
- ÖNERİ (ŞÜPHE, üretilemedi): taze şablon okuması sürekli düşerse bakım her 60 sn'de WABA+şablon başına bir okuma yapar (geri çekilme yok) → 2.5.0'da düşen okumadan sonra 10 dk bekleme.

**C1 / cari:**
- S3 A: eski sürümde silinmiş hareketli carilere dokunulmaz (Silinenler'den geri yüklenebilir); bildirim fikri 2.5.0.
- POS sağlayıcı carisi gün sonuna yazılmamış KDV'li komisyon beklerken silinebiliyor → aktarım "sağlayıcı carisi bulunamadı" ile bekler, cari geri yüklenince tamamlanır (veri kaybı yok;
  2.4.8'den beri) → 2.5.0 (öneri: POS'ta sağlayıcı seçili cari silinmez).
- Aynı caride yüzlerce POS İptal İadesi fişinde silme engeli sayacı yavaş (çok nadir) → 2.5.0.
- Yanıt yanlış, veri yazılmıyor (2.4.7'den beri): stok düzeltmesinde hareket silinirse 409 ledger-integrity iletisi; kart tahsilatı / taksit düzeltilirken kayıt silinirse 200 boş yanıt → 2.5.0.

**P1 / kredi kartı:**
- Formdan POS tanımlanınca açıklama metni bayat kalır → 2.5.0.
- Kart açılışından önceki tarihli Kredi Kartına İade 400 iletisi tarihi söylemiyor (2.3.0'dan beri) → 2.5.0.
- Aynı istek kimliğiyle yineleme, araya ödeme silme / düzeltme girerse 400 (çift yazım yok; çok seyrek) → 2.5.0.

**S1 Yedeksiz Sil:**
- Yedek klasörü yazılamaz (SQLite 14/8/3), klasör yerinde dosya (EEXIST/ENOTDIR), disk G/Ç (EIO), EROFS durumlarında neden hâlâ İngilizce + tam yol (davranış doğru: ikinci onay açılıyor,
  klasör korunuyor) → 2.5.0.
- Değişiklik Geçmişi'nde şirket silme ayrıntısı (eski boşluk) → 2.5.0.

**WhatsApp:**
- W-KÖK SORU 2: Süresi Doldu ileti 24 saat sınır penceresinde sayılmaz (2.4.8'den gelen kural; kâhin `pencere_farkli_alici` ailesi 4 → 13, +9 W-KÖK'ün düzelttiği TTL senaryoları) → 2.5.0.
- Eski yedeğin geri yüklenmesi yedekten sonra görülen süre uzamasını unutur → aynı dönem kişiye 2 ileti (eski kodda da 2; çok koşul birlikte) → 2.5.0 (öneri: geri yüklemede günlükleri birleştir).
  Teorik sıra / saat geri alma durumu da 2.5.0.
- Aynı WABA'yı kullanan ikinci şirketin şablon kartı o şirkette önizleme / Denetle yapılana dek bayat; 2.4.8'de 72 sa gerçekten kabul edilmiş olsaydı program artık 30 gün bekler (güvenli taraf).
- Meta'da silinen şablon kartta "Gönderime Hazır" kalır (eski kodda da) → 2.5.0.
- B3: önceki sürümde oluşmuş dosya boşluğu kendiliğinden geri kazanılmaz (otomatik VACUUM yok — BAŞ MİMAR KARARI); "wa_jobs boş ≤ %10" ölçütü gerçek akışta %18,5 (kaynak durum
  bildirimleriyle satır büyümesi, PDF değil; ölçüt dar yazılmıştı).
- B3: 2.4.9 → 2.4.8 → 2.4.9 sürüm geri dönüşünde açık işte metin ile PDF ayrışabilir (sürüm geri dönüşü + iki kez 29 gün medya süresi gerekir) → 2.5.0.
- R2: aynı milisaniyede açılan iki kapsayan kartta iade hangi kartı küçültür belirsiz (duran sahte saatte görüldü; üretimde saat akar) → 2.5.0.
- Test borçları (ürün doğru) → 2.5.0: bakımın işin kendi WABA'sıyla değerlendirmesi (sahte Meta tek WABA); R2 önbelleğinin şirket başına olması; WhatsApp sürücü mutasyon denetimi 41/48
  (7 dişsiz eşleme, 2.4.8 ile aynı 7).
- Elle Bağla'da müşterinin kendi uygulamasındaki webhook Callback URL + Verify token: kılavuz "Bu iki değeri DestekOfis desteğinden alın." der (BAŞ MİMAR KARARI); kalıcı çözüm 2.5.0.

**Kılavuz / ekran:**
- Kılavuz ekran adı denetimi yalnız 7–8. bölüm; ad bulunamazsa sessiz geçer; kılavuzda eksik iki rapor adı ("Tahsildeki Çek ve Senetler", "Banka ve POS Hareketleri") → 2.5.0.
- UI/UX DÜŞÜK'leri → 2.5.0: D1 form düzeni, D2 Hesapsız seçeneği hata metni, D5 bozuk şirket rozeti, D6 binlik ayırıcı, D7 kılavuz s.17 eski görsel ("kurumsal" sözcüğü), D10 telefonda
  "Ödeme Yolu".
- Öbür e2e'lerde aynı `.toast` bekleme kalıbı taranacak (2.5.0).

**Güvenilirlik (öneri / kör nokta, 2.5.0):** store.run derinlik > 0 iken bağlantıda işlem yoksa fırlatsın (DB-TX KÖR NOKTA); her çağrıda yeni Intl.NumberFormat kuran desen (accounts.mjs tlText,
queue.mjs:105, integrity.mjs:60, doubtful.mjs:24, vouchers.mjs:772); cari `detail` tek istekte p50 ~30 ms (toplu yol detail kullanırsa bütçe aşılır).

**Tam kapı bilinen kâhin farkları (2.4.8 ile birebir):** mobil-erişim 31/42 (fark listesi değişmedi), mobil-yazma-tam 52/54 (E02 çifti), sayaç-karşılaştır 47/50 (U44/U48 programda
üretilemez, U47 S4), sayaç-sürücü BELİRSİZ (özet basmayan üretici; çıktı 2.4.8 ile bayt bayt aynı).

**2.4.8'den süren** (TESLIM-NOTU-2.4.8.md (d) — DURUM 11/12 listesi aynen geçerli; 2.4.9 iş listesi "C. SONRAYA"): dk18 bulguları (ertesi gün hatırlatma yeniden denemesi elenir; fiyatsız read
Bu Ay +1; Yol 2 imzasız 503); Tüm Hareketler PDF başlığında başlangıç tarihi yok; J10-03 boşuna PDF yükleme; bakım turu ~200 ms; cari kartı openingEntryOf ~12–15 ms; Yönetim → WhatsApp
"Son Deneme" teslim/okundu göstermiyor; veri dosyası kayıpken Birleşik Rapor 500; kâhin "Gittiği anki içerik" güncellemesi; Elle Bağla otomasyonu ertelendi (KARAR 03.11). BİLİNEN RİSK: Meta
opt-in ister, ürün kararı opt-out. Test altyapısı: mutabakat testleri her yıl 1 Ocak–30 Nisan arası yanlış kırmızı verebilir (motor modeli yıl bilmiyor; ürün doğru) — devir sürümünden önce.

## (e) KARARLAR

### KULLANICI KARARLARI (kaynak İL = docs/2.4.9-IS-LISTESI.md satırı)
- 03.11 ~18:10: SORU 1 → A (sonra 18:45'te değişti, aşağıda); SORU 2 → B1, B2, B3, B4 kapsamda; KAPSAM DONDU (A + B); her iş temiz bağlamlı yeni ajanla (İL 53–57).
- 03.11 ~18:45 (W SORU T0): Meta'nın utility'de izin verdiği en uzun özel süre 12 sa çıktı → **"30 gün (Meta varsayılanı)"**: program TTL göndermez/düzenlemez, ttlHours (72) kalkar, Süresi
  Doldu = Meta'nın bildirdiği değer yoksa 30 gün (İL 68–70).
- 03.11 ~18:48 (C1): S1 A (Silinenler'deki kayıt hareket sayılmaz), S2 A (sıfır tutarlı kart/taslak hareket sayılır), S3 A (eski sürümde silinmiş hareketli carilere dokunulmaz) (İL 71–73).
- 03.11 ~19:45: bozuk dosyalı şirket silme → **S1 kapsama girdi** (kapsam dondu kuralının kullanıcı kararıyla istisnası) (İL 86–90).
- 03.11 ~20:05: **W-KÖK 2.4.9'a alındı** — iş kabul anındaki teslim süresiyle değerlendirilir (İLKEYLE, ilke 2) (İL 102–104).
- 03.11 ~20:35: müşteride **Kredi Kartına İade** kutusu geri gelir (P1-b; yalnız o caride Kredi Kartı ile yapılmış Ödeme varsa; tutar üst sınırı yok) (İL 118–121).
- 03.11 ~21:00 (kâhin S10-6): süre kabulden sonra UZARSA önceden kabul edilmiş iş uzun süreyle → etkin süre = max(kabul anındaki, güncel); kabulde bilinmiyorsa 30 gün (İL 138–139).
- 03.11 20:46: "bana soracağın hususları en yaygın kullanımla uygula, küçük bulguları, nadir oluşan bulguları 2.5.0 bırak. paket teslim dahil tüm işlere devam et." (İL 153; 05.11 "başla" ile
  yeniden geçerli, İL 193).
- 04.11 ~01:15: DURDURMA KURALI — birleşik son dar kontrolden sonra yalnız YÜKSEK/ORTA; DÜŞÜK'ler (gerilemeler dahil) 2.5.0 BİLİNEN SINIR (İL 191).
- 05.11 ~10:10: **telefondan elle yazılan iletiler (smb_message_echoes) programa ALINMAZ**, "kime kaç kez" sayımına girmez — bugünkü davranış doğru, 2.5.0 işi değil; D0'da yalnız Meta bu
  aboneliği şart koşarsa echo'nun yok sayılması denetlenir (İL 218). Yol 2 D0: kullanıcının WhatsApp Business numarasıyla birlikte kullanım (KARAR 03.11, 2.4.8 İL 701; İL 217).

### BAŞ MİMAR KARARLARI (ders 40; kullanıcıya gösterilir — kaynak İL = docs/2.4.9-IS-LISTESI.md satırı)
- **W-KÖK TUR 2 — taze okuma kuralı (AYRICA; ders 45 ile gerilim):** bağımsız gözden geçirme DÜŞÜK-2'yi GERİLEME olarak buldu (v2.4.8'de 1 ileti, 2.4.9'da 2 ileti; nadir: müşterinin ≤12 sa
  özel süre koyup uzatması + ~13 sa okuma olmaması). 03.11 yetkisiyle İLKEYLE (ilke 2 "almış olabilirse elenir") A: **Süresi Doldu yazılmadan önce (yalnız etkin süre < 30 gün iken) o
  WABA + şablon için turda bir kez taze Meta okuması; okunamazsa o tur Süresi Doldu yazılmaz** (8f3fa4e7 queue.mjs) (İL 189). Bu kural **son aday aşamasında** verildi; ders 45 "son adayda
  yeni kural girmez (ilkeyle de olsa)" der. Gerekçe: kendi değişikliğimizin (W-KÖK) açtığı gerilemeyi kapatır, yeni davranış değil ilke 2'nin uygulaması; birleşik son dar kontrolden geçti
  (YÜKSEK/ORTA 0; WM5 eksik test ve geri çekilme önerisi 2.5.0). Kullanıcıya açıkça gösterilir (İL 203).
- W-KÖK SORU 1 (uzayıp yeniden kısalma: kabulde 12 sa → 30 gün → 6 sa): İLKEYLE (ilke 2) B — arada görülen en uzun süre (30 gün) geçer; kişi Daha Önce Gönderildi, Yine de Gönder açık (İL 157).
- B1-b: openUsageLedger + openWaLedger aynı düzeltmeye girer (aynı kusurun createApp yolundaki iki kopyası) (İL 58–60).
- B3: PDF ayrı tabloda (wa_job_pdfs, göç v45), iş kesinleşince silinir; **mevcut boşluk için otomatik VACUUM YOK** (BİLİNEN SINIR) (İL 64–65). B3 DÜŞÜK-2 KVKK testi ("her iş kendi PDF'ini
  gönderir") 2.4.9'da eklendi (İL 155).
- C1: silinmiş cariye tahsilat yarışı (ORTA, zorla üretildi) C1'e girer (İL 72–73); C1 tur 1'de stok satışı/düzeltmesinin silinmiş ürüne yazılması (2.4.7'den beri) aynı desende düzeltildi —
  BAŞ MİMAR ONAYI (İL 178).
- P1: KARAR REVİZYONU (ORTA bu sürümde) gereği 2.4.9'a girer, yeni para kuralı yok (İL 79–81). P1 DÜŞÜK-1 (Kredi Kartına İade kutusu kaldırılınca "Hareket düzeltildi" deyip satır kartta
  kalıyordu) SAKINCA SÜZGECİ ile ORTA'ya yükseltildi (İL 114–116).
- P1 SORU 1: hesapsız kart ödemesi Kredi Kartına İade bayrağı AÇMAZ (POS iadesinden ayırt edilemiyor; ödeme ✎ ile karta bağlanınca kutu çıkar) (İL 167).
- P1 tur 1 DÜŞÜK-2: "düzeltmede var olan satırlar korunur" yalnız VAR OLAN İADE satırlarını kapsar; iade olmayan satır PUT ile iadeye çevrilirken aynı denetim (card-refund-no-payment) (İL 174).
- W (kod ajanı önerdi, kabul): Denetle sürerken başlamış Meta okuması önbelleğe/kayda yazılmaz (templateEpoch; yarış zorla üretildi); noteListing kayıt açmaz, eski okumayı yazmaz, salt okunurda
  yazmaz; ttlHours'lu PUT bütünüyle 400 (İL 92–93). W DÜŞÜK-1: en küçük düzeltme (a) — noteListing teslim süresi alanını YAZMAZ (İL 98–99).
- S1: ikinci onay yalnız bozuk dosyada değil, yedek hangi nedenle düşerse düşsün açılır (disk dolu, klasör çakışması) — veri klasörü her durumda korunur (İL 109–110).
- Tablodan Aktar kartına aktarımdan sonra taksit tahsilatı girildiyse Geri Al: A — reddedilir (işlem görmüş belge geri alınmaz; program bugün de 409 `touched`); kâhine 2.5.0'da c14f (İL 163).
- DB-TX: 03.11 yetkisinin "nadir → 2.5.0" kuralına İSTİSNA — tetik nadir ama etki büyük (program kullanılamaz kalır, para kapısı atlanabilir), düzeltme küçük ve yerinde → 2.4.9'da (İL 171).
- Elle Bağla webhook Callback URL + Verify token: değer belgeye girmez, kılavuz "Bu iki değeri DestekOfis desteğinden alın." der; kalıcı çözüm 2.5.0 (İL 180).
- C1 DK DÜŞÜK-2 (POS sağlayıcı carisi): 03.11 yetkisiyle 2.5.0 (yaygın uygulama önerisi B: sağlayıcı seçili cari silinmez) (İL 160). P1 tur 2 SORU (A/B): A — 400 kalır, ileti ve seçici 2.5.0
  (İL 182).
- Sürüm commit'i: NOTICE_VERSION "2.4.8-1" (aydınlatma metni sürümü) metin değişmediği için dokunulmadı (İL 212).

### İLKEYLE UYGULANANLAR (WhatsApp "kime kaç kez" genel ilkesi, 31.10; İL = iş listesi satırı)
- W-KÖK (kullanıcı 20:05 ile 2.4.9'a alındı): iş KABUL ANINDAKİ teslim süresiyle değerlendirilir (ilke 2) (İL 102–104).
- W-KÖK SORU 1 uzayıp kısalma → arada görülen en uzun süre (ilke 2) (İL 157); W-KÖK TUR 2 taze okuma (ilke 2) — yukarıda BAŞ MİMAR KARARLARI'nda ayrıca (İL 189).
- Kâhin W tur 2: S10-7 Meta süreyi listeden kaldırırsa güncel değer 30 gün; S10-8 Süresi Doldu olmuş iş süre sonradan uzasa da yeniden açılmaz (İL 150–151).
- B2 (ilke 4 "çıkmaz yok"): kartın ekran eki hata verirse kişi elle alıcı listesinden sessizce DÜŞMEZ (eski kodda düşüyordu) — **davranış değişikliği notu** (İL 61–62, 213).
- C1: H14 POS İptal İadesi fişinin POS kaydı bağı da hareket sayıldı ("tutar taşıyan her kayıt" ilkesi 03.11; tasarım SQL'i bulmuyordu) (İL 144).

## (f) ELLE KABUL LİSTESİ (KANIT KURALI 5 — yayından sonra sizin kurulumunuzda; ekran adları docs/2.4.9-DEGISIKLIKLER.md'den, sürüm ajanı koddan doğruladı)

1. 2.4.9'a güncelleyin (ya da kurun) → program açılır, sürüm 2.4.9; Cari Listesi bakiyeleri önceki gibi.
2. **Hareketli cari:** tahsilatı olan bir cari kartında **Sil** pasif; altında **Silinemez:** nedeni ve Pasife Al önerisi görünür. Hareketsiz bir deneme carisi açıp silin → "silinecek (hareketi yok)"
   onayı, Silinenler'den geri yüklenebilir.
3. **İki kredi kartlı şirkette** müşteri carisinde **+ Tahsilat** → yol **POS** → kredi kartı sorulmadan kaydedilir; para POS'a gider.
4. **Kredi Kartına İade:** müşteriye şirket kartıyla bir **Ödeme** girin → tahsilat formunda **Kredi Kartına İade** kutusu görünür → işaretleyip kart seçin, kaydedin → kartın borcu azalır; cari
   hareketlerinde ve **Ayrıntılı Cari Ekstre**'de satır "Kredi Kartına İade" yazar (POS değil). Kartla ödemesi olmayan müşteride kutu yoktur.
5. **Yönetim → WhatsApp → Bilgilendirme Şablonları:** kırmızı teslim süresi uyarısı yok; **Şablonları Denetle ve Oluştur**'dan sonra onaylı şablonla gönderim hemen yapılabilir.
6. **Bağlantıyı Sına:** Bildirim Yolu kaydedilemiyorsa yeşil yerine uyarı + Türkçe neden satırı + ayrı "Meta iletisi:" satırı.
7. **WhatsApp Web ile Gönder** (büyük cari listesinde) alıcı listesi birkaç saniyede gelir; bu arada başka kullanıcı ekranları beklemez.
8. (İsteğe bağlı) Yönetim → Şirketler'de deneme şirketi **Şirketi Sil** → Esc ile kapatınca "Kaydedilmemiş Değişiklik" sorusu çıkmaz.
Bir adım beklenenden farklıysa bana yazın.

## (g) Sonraki adımlar (ana oturum)

Paket kanıtı commit'i (bu klasör) → push → CI hükmü (yalnız kanıt; ata koşusu) → PR (claude/compassionate-galileo-f9kghg → master) + PR CI yeşil → kullanıcının "birleştir"i → master CI →
kullanıcıya 5 dosya (+ parca0/parca1/BIRLESTIR.bat) + yayın bağlantısı + sürüm notu → kullanıcı yayını açar → yayındaki dosyalar bayt bayt + eski güncelleyiciler "available" → site PR'ı
(ceougur/destekofis web/indir/DestekOfis-Kullanim-Kilavuzu.pdf = 59a990a5…). Vergi kaydından sonra Yol 2 gizlileri ve Meta panel ayarları (kullanıcıyla).
