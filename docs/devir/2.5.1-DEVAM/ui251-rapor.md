# 2.5.1 son aday — UI düzeltme turu raporu (UI-1 / UI-2 / UI-3 + D1)

Taban `t251-aday-taban` = 4c94030c. Dal: `worktree-agent-ab5e336bece8bb299`. Para, defter, KDV hesabı ve sunucu kuralı DEĞİŞMEDİ (yalnız `client/assets/` + yeni ekran senaryosu).
`server/routes/tax.mjs` ve `server/routes/report-center.mjs`'e DOKUNULMADI; `hof-report-center.js` ve `hof-tax.js` de değişmedi (KDV tur 8 ile çakışma yok — yerleşim yalnız CSS'te).

## 1. Değişen gözlenebilir davranışlar (önce → sonra)
1. **UI-1 — uzun hata bildirimi** (cari kartı → Ödeme / Borç × → Sil → Değersiz Alacak reddi; 760 harf, "Ne yapmalı:"):
   - Önce: 380 px, 22 satır / 426 px; pencere açıkken ÜST ORTADA; iletinin söylediği Değersiz satırının ×'ını örtüyor (1440×900'de × (601, 363) bildirimin altında;
     1366×768 (564, 231); 1280×720 (550, 183); 390×844 (19, 236)); ~30 sn'de kendiliğinden kapanıyor; üç ret 918 px'lik sütun, üçüncüsü ekrandan taşıyor;
     bildirimden sonra açılan "silinsin mi?" sorusunun iki düğmesini de örtüyordu (1366×768: örtülen 2).
   - Sonra: 720 px (ekran − 36 px'ten dar değilse), 8 satır / 208 px; pencere açıkken ALTTA ORTADA (1440×900 y 679–886; 1366×768 y 547–754; 1280×720 y 499–706);
     iletinin söylediği × düğmeleri (Değersiz satırının ×'ı, kaydın ×'ı) kart olduğu gibi, Şüpheli bölümü üstte ve ortadayken örtülmüyor (örtülen 0, 5 ekran boyu);
     süreyle KAPANMAZ (60 sn sonra yerinde), yalnız × ile; en çok iki uzun bildirim (üç retten sonra 2, 1440×900'de y 461–886); bildirimden SONRA açılan pencere
     (ör. Değersiz × → "silinsin mi?") açıkken gizlenir, o pencere kapanınca geri gelir. Telefonda (390×844, 360×640) metin kutusu ekranın yarısını geçmez,
     sığmayan metin kendi içinde kayar; iki uzun ret ekrana sığar (360×640: y 72–344 ve 354–626). Kopyala alt satırda, × sağ üstte.
   - "Uzun" = hata bildirimi ve (300 harften uzun ya da "Ne yapmalı:" içeren). 250 harflik hata, 400 harflik uyarı / bilgi ESKİSİ GİBİ.
   - Kısa bildirimler (uzun bildirim yokken) aynen: pencere açıkken üst ortada 380 px, pencere yokken sağ altta 380 px, süreyle kapanır.
2. **UI-2 — KDV Özeti tutar kartları**: önce 1366×768'de 6 kart tek satır, "Ödenecek KDV" ve "Sonraki Döneme Devreden KDV" dışarıda; 1280×720'de üç kart dışarıda.
   Sonra alçak ekranda da satıra sarılır: 1366×768 ve 1280×720 iki satır, altısı tam; 1440×900 iki satır, 1920×1080 tek satır (önceki gibi); telefonda 5 satır, sayfa yana
   kaymıyor. Öbür raporlar (ör. Satış Faturaları) alçak ekranda eskisi gibi tek satır (flex-wrap nowrap).
3. **UI-3 — KDV Mahsup Fişi → Mahsup Edilen Aylar**: önce tablo 878 px / kutu 760 px, en yeni mahsubun Geri Al'ı yalnız yana kaydırınca görünüyordu (her ekran boyunda).
   Sonra tutar başlıkları ("Hesaplanan (391)" …) ve "Mahsuptan Sonra Değişti" rozeti iki satıra kırılır: tablo 760/760 (1366×768, 1440×900, 1920×1080), 738/738 (834×1112),
   672/672 (768×1024); Geri Al kaydırmasız görünür. Tutarlar tek satırda kalır.
4. **D1 — Değersiz Alacak Yaz formu**: "kalanı 659 Diğer Olağandışı Gider'den düşer" → "kalanı 659 Diğer Olağan Gider ve Zararlar'dan düşer" (hesap planındaki ad,
   `server/lib/general-ledger.mjs` CHART["659"]; testte oradan okunur).

## 2. Değişen dosyalar
- `client/assets/hof-core.js` — `HOF.isLongToast`, uzun bildirim (`hof-toast-long`): süre sayacı yok, en çok 2; pencere derinliği eşitlemesi (`syncLongToasts`, `HOF.modal` açılış / kapanış).
- `client/assets/hof-ui.css` — uzun bildirim düzeni; `.hof-toast-long.is-behind`; KDV Özeti kart satırı (yalnız `max-height: 820px` sorgusunda, yalnız `.hof-rc-table.is-kdv` kardeşi olan kart satırı);
  `[data-vat-root]` mahsup tablosunda başlık ve rozet sarması.
- `client/assets/hof-accounts.js` — D1 metni (tek satır).
- `test/e2e/senaryo-ui251-gorunum.mjs` — YENİ ölçümlü ekran senaryosu (72 denetim).
- `docs/kanit/2026-11-28/ui251-*` — ham çıktılar, önce / sonra ekran görüntüleri (`ui251-ekran-once/`, `ui251-ekran-sonra/`), mutasyon tablosu.

## 3. TARAMA tablosu (ders 10)
| Tarama | Sonuç | Ne yapıldı |
|---|---|---|
| `git grep "Olağandışı Gider'den\|659 Diğer Olağan"` client/server/test/kılavuz | yalnız hof-accounts.js:1458 yanlış; hof-tax.js:38 "689 Diğer Olağandışı Gider ve Zararlar" DOĞRU (689'un adı) | yalnız 1458 değişti |
| `git grep "Ne yapmalı"` server/client | server/lib/bank/doubtful.mjs, server/lib/integrity.mjs | bu iki kaynaktan gelen her ret bundan böyle uzun (kalıcı) bildirim |
| e2e'de `Ne yapmalı` | senaryo-degersiz-iptal-m2t2-251 | koşuldu (iki TZ) |
| e2e'de Değersiz / writeoff | senaryo-degersiz-siniri-m2-251, senaryo-supheli-230 | koşuldu |
| e2e'de `data-vat-root` / vat-offset / kdv-ozeti | kdv-mahsup-sonrasi-251, kdv-zincir-251, kdv-donemi-250, kdv-devreden-251, c7b-kabul-250, defter-243 (+ banka-210, mobil-247: yalnız katalog / başka yol) | ilk altısı koşuldu |
| e2e'de `hof-rc-summary` | 14 dosya | KDV'li olanlar koşuldu; öbürlerinde kural eşleşmez (`:has(~ .is-kdv)`), "Satış Faturaları tek satır" denetimi yeni senaryoda |
| e2e'de `hof-toast` / `toastDuration` | 57 dosya | bildirim davranışı sınayanlar koşuldu: form-izolasyon-243 (süre, ×N, fare), gg243-kopyala (Kopyala), uiux-a/b-243, uiux-244-ux9-ux10, uiux-ui11-244, senaryo-211 (yazım düzeni ekranda) |
| birim testleri `hof-core.js / hof-ui.css / hof-accounts.js / hof-tax.js` okuyan | 13 dosya + yazim-duzeni + platform-tasinabilirlik | hepsi koşuldu |

## 4. Yeni test — kırmızı nedeni ve yeşili
`test/e2e/senaryo-ui251-gorunum.mjs` (sahte saat 15.04.2026, lisans servisi yok, veri API'den, ret ve silme gerçek tıklamayla; "kaydedilmedi" kart yanıtından).
- Eski kod (taban 4c94030, ayrı kopya `git worktree add --detach`, yalnız yeni test dosyası eklendi): **32/72 geçti, 40 kırmızı** — TZ=UTC ve TZ=Europe/Istanbul AYNI.
  Kırmızı nedenleri (iletiler okundu): bildirim 380 px / 22 satır; Değersiz × bildirimin altında (5 ekran boyu × 2–3 konum); 60 sn sonra ileti yok; üç retten sonra yığın boş;
  soru penceresinde örtülen 2 düğme; telefonda 481 / 535 px; "uzun" sınıfı yok; KDV Özeti'nde dışarıdaki kartlar (1366: Ödenecek, Sonraki Döneme Devreden; 1280: üç kart);
  mahsup tablosu 878 px > kutu (5 ekran boyu); formda "Olağandışı".
  Eski kodda yeşil kalan 32 denetim: kısa bildirimlerin eskisi gibi olduğu (B), öbür raporun tek satır kaldığı, telefonda KDV kartları (zaten sarılıyordu), rozetin varlığı, ret sonrası kart toplamları.
- Yeni kod (64b4db1): **72/72** — TZ=UTC ve TZ=Europe/Istanbul.
- Kayıtlar: `docs/kanit/2026-11-28/ui251-gorunum-{eski,yeni}-{utc,ist}.{json,log}`.

## 5. Kabul koşulları (sayılarla)
- A — dört iş ekranda ölçüldü: UI-1 genişlik 720 = min(720, ekran − 36) (telefon 354 / 324), 8 satır, örtülen düğme 0 (15 konum), 60 sn sonra yerinde, yığın 2 ve ekran içinde, soru penceresinde
  gizli / Vazgeç'ten sonra geri; UI-2 6/6 kart içeride, kesik 0 (4 masaüstü boyu + telefon); UI-3 tablo kaydırması 0, Geri Al kutu içinde (5 boy); D1 metin hesap planıyla aynı. Önce / sonra görüntüleri `ui251-ekran-once/`, `ui251-ekran-sonra/`.
- B — kısa bildirimler: pencere açıkken (530, 14) ve (530, 70), 380 px; 9 sn'de kapandı; pencere yokken sağ alt (right 1422, bottom 725); 250 harflik hata / 400 harflik uyarı / bilgi uzun DEĞİL;
  Satış Faturaları 1366×768'de tek satır. Komşu e2e'ler (16 senaryo × 2 TZ) GEÇTİ.
- C — ilgili e2e'ler ve yazım düzeni:
  | koşu | UTC | İstanbul |
  |---|---|---|
  | senaryo-degersiz-iptal-m2t2-251 | 41/41 | 41/41 |
  | senaryo-degersiz-siniri-m2-251 | 24/24 | 24/24 |
  | senaryo-supheli-230 | 67/67 | 67/67 |
  | senaryo-kdv-mahsup-sonrasi-251 | 57/57 | 57/57 |
  | senaryo-kdv-zincir-251 | 12/12 | 12/12 |
  | senaryo-kdv-donemi-250 | 23/23 | 23/23 |
  | senaryo-kdv-devreden-251 | 14/14 | 14/14 |
  | senaryo-form-izolasyon-243 | 188/188 | 188/188 |
  | gg243-kopyala | 28/28 | 28/28 |
  | uiux-a-243 | 51/51 | 51/51 |
  | uiux-b-243 | 58/58 | 58/58 |
  | uiux-244-ux9-ux10 | 74/74 | 74/74 |
  | uiux-ui11-244 | 153/153 | 153/153 |
  | senaryo-211 (yazım düzeni, ekranda) | 59/59 | 59/59 |
  | senaryo-c7b-kabul-250 | 39/39 | 39/39 |
  | senaryo-defter-243 | 33/33 | 33/33 |
  | birim: yazim-duzeni + 13 kaynak tarayan + platform-tasinabilirlik | 108/108 | 108/108 |
  Komşu koşuların istemci kodu son istemci commit'i 666c1610 ile aynı (sonraki commit'ler yalnız test / belge); kayıtlar `docs/kanit/2026-11-28/ui251-e2e-*`, `ui251-birim-komsu-*`.
- D — tabanda yeni senaryo 40 kırmızı, nedenleri yukarıda; yenide 72/72.

## 6. Mutant tablosu (kopya, TZ=UTC; `docs/kanit/2026-11-28/ui251-mutasyon.txt`)
| Mutant | Sonuç |
|---|---|
| M1 uzun bildirim hiç tanınmaz | ÖLDÜ (24 kırmızı) |
| M2 uzun bildirim süreyle kapanır | ÖLDÜ (3) |
| M3 en çok 2 → 3 uzun bildirim | ÖLDÜ (1) |
| M4 300 harf eşiği → 800 | ÖLDÜ (1 — "hangi bildirim uzun" adımı) |
| M5 pencere açıkken altta kuralı yok | ÖLDÜ (3) |
| M6 geniş kutu yok (380 px) | ÖLDÜ (6) |
| M7 metin yüksekliği sınırı yok | ilk iki partide YAŞADI → test güçlendi (360×640 telefon, iki uzun ret) → ÖLDÜ (3) |
| M8 KDV kartları sarılmaz | ÖLDÜ (2) |
| M9 KDV kuralı bütün raporlara | ÖLDÜ (1) |
| M10 rozet satıra kırılmaz | ilk iki partide YAŞADI → test güçlendi (768×1024) → ÖLDÜ (1) |
| M11 tutar başlıkları kırılmaz | ÖLDÜ (3) |
| M12 659 adı eski | ÖLDÜ (2) |
| M13 pencere açılınca eşitleme yok | ÖLDÜ (1) |
| M14 is-behind gizlemiyor | ÖLDÜ (1) |
| M15 pencere kapanınca eşitleme yok | ÖLDÜ (akış durdu — soru penceresinden sonra bildirim gizli kaldı) |
15/15 öldü. M1–M6, M8, M9, M11–M15 son testten önceki sürümle koşuldu; son test yalnız denetim EKLEDİ (hiçbirini çıkarmadı).

## 7. Hız
Ölçülmedi: değişiklik yalnız istemci görünümü (CSS + bildirim sayacı); hiçbir isteğin yanıtı / okuduğu hesap değişmedi (ders 53 kapsamı dışı).

## 8. KULLANICIYA SORULMALI
Yok (para / kapama / defter kuralına dokunulmadı).

## 9. BAŞ MİMAR KARARI GEREKİYOR (öneriyle; uygulanan öneri)
1. **Telefonda / çok alçak pencerede kayan metin dokunmayı alır.** Uzun bildirimin metni ekranın yarısını geçerse kendi içinde kayar; kaydırılabilsin diye YALNIZ o durumda metin
   alanı dokunmayı alır (altındaki satıra dokunulamaz; × ile kapanır ya da sayfa yukarıda kaydırılır). Masaüstü boylarında (≥ 1280×720) bu 760 harflik ileti sığar, dokunma geçer
   (2.4.3 ilkesi korunur). Seçenek B: metin hiç kaymaz, dokunma her zaman geçer, sığmayan kısım kesik kalır (tam metin Kopyala ile). ÖNERİ: A (uygulandı) — okunabilirlik.
2. **Uzun bildirim varken kısa bildirimler de onunla aynı sütunda (720 px, pencere açıkken altta)** durur; uzun bildirim kapanınca kısa bildirimler eski yerine döner.
   Seçenek B: iki ayrı kutu (bu durumda sağ altta / üst ortada çakışmalar çıkıyor). ÖNERİ: A (uygulandı).
3. **Kalıcı uzun bildirim kart kapansa da × basılana dek kalır** (görev metni: "yalnız × ile kapanır"). Sonradan açılan pencere sırasında gizlenir, kapanınca döner.

## 10. SONRAKİ SÜRÜME (20.11 kuralı)
- Telefonda cari kartı ret anında yatay kaymış görünüyor (kartın sol kısmı ekran dışında — `scrollIntoView` sonrası; ÖNCEDEN VAR, bu turun farkı değil; görüntü `ui251-ekran-sonra/ui251-a-ret-390x844.png`).
- Pencere boyu değişince (döndürme) `is-scroll` yeniden hesaplanmaz (yalnız gösterildiği an ölçülür); küçük ayrıntı.

## 11. DOĞRULANMADI
- `server/lib/integrity.mjs` kaynaklı "Ne yapmalı:" iletilerinin hangi ekranlarda çıktığı tek tek yürünmedi; hepsi aynı ortak bildirimden geçer (uzun biçim kuralı aynı).

## 12. DENENMEYEN
- ci.yml'nin bütün e2e listesi ve CI dışı senaryolar (ui-ux-217 dahil) — tam kapı ana oturumda; tam `npm test` (görev gereği yok).
- Windows'ta koşu (dosyaya dokunan test yok; CI'de görülecek).
- 57 bildirim kullanan e2e'nin 16'sı dışındakiler (tam kapıda).
- Gerçek dokunmatik cihaz (telefon yalnız Chromium görüntü alanıyla).

## 13. CI listesine eklenecek
- `package.json`: `"test:senaryo-ui251-gorunum": "node --disable-warning=ExperimentalWarning test/e2e/senaryo-ui251-gorunum.mjs"`
- `.github/workflows/ci.yml`: `node tools/kanit.mjs kos e2e-senaryo-ui251-gorunum npm run test:senaryo-ui251-gorunum` + Doğrulama Kapısı `--beklenen` listesine `e2e-senaryo-ui251-gorunum`.
  (package.json ve .github yasak olduğu için eklenmedi.)

## 14. Kılavuz metni önerisi (kısa, "nasıl yapılır")
- "Uzun hata iletileri (ne yapmanız gerektiğini anlatanlar) ekranın altında geniş bir kutuda kalır; okuyup × ile kapatın. Kopyala ile metni alabilirsiniz."
- KDV Mahsup Fişi: "Mahsup Edilen Aylar'da en yeni mahsubun yanındaki Geri Al ile mahsubu ters kayıtla geri alırsınız."

## 15. Commit listesi (taban 4c94030c'den)
- b9a8c462 kod + yeni senaryo (UI-1/2/3 + D1)
- 666c1610 kalıcı uzun bildirim sonradan açılan pencerede gizlenir; senaryoya soru penceresi ve "hangi bildirim uzun"
- 3c601aa2 rapor taslağı
- 70f6cb37 senaryo: telefonda iki uzun ret, 834×1112
- 64b4db1a senaryo: 360×640 ve 768×1024 (M7 / M10)
- c03bea15 Kanıt
- (bu rapor commit'i)

## 16. Ana oturumun yeniden koşacağı komutlar
```
cd <ağaç>
TZ=UTC PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos ui251-gorunum -- node test/e2e/senaryo-ui251-gorunum.mjs
TZ=Europe/Istanbul … (aynı)
# eski kod kırmızısı: git worktree add --detach <kopya> t251-aday-taban; yalnız test/e2e/senaryo-ui251-gorunum.mjs kopyalanır; aynı komut kopyada → 32/72, 40 kırmızı
# komşular: node test/e2e/{senaryo-degersiz-iptal-m2t2-251,senaryo-kdv-mahsup-sonrasi-251,senaryo-kdv-zincir-251,senaryo-kdv-donemi-250,senaryo-form-izolasyon-243,gg243-kopyala,uiux-b-243,senaryo-211}.mjs
# birim: node --test test/yazim-duzeni.test.mjs test/form-izolasyon.test.mjs test/static.test.mjs test/platform-tasinabilirlik.test.mjs
```
