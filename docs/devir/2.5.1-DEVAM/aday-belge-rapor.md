# 2.5.1 Son Aday — Belge ve Sürüm Ajanı Raporu (taslak; adım adım doldurulur)

Görev metni: `docs/devir/2.5.1-DEVAM/aday-belge-istem.txt`. Taban: `t251-aday-belge-taban` = 5afa15f4. Kod davranışı DEĞİŞMEZ (sunucu / istemci koduna dokunulmadı).

## 0. NASIL BOZULUR (işten ÖNCE yazıldı)
1. Sürüm package.json'da 2.5.1, package-lock.json'da (kök ya da `packages[""]`) 2.5.0 kalır → kurulum / güncelleme paketi karışık sürüm taşır.
2. Kılavuz kapağı güncellenir, dip notu unutulur (ya da tersi) → `test/kilavuz-surum.test.mjs` kırmızı.
3. Kılavuz HTML güncellenir, PDF yeniden üretilmez ya da `client/kilavuz/`'a kopyalanmaz (ders 42) → programdaki PDF eski sürüm / eski metin.
4. CHANGELOG başlığı `## 2.5.1 — …` biçiminde değilse güncelleme paketinin sürüm notu boş çıkar (`releaseNotes`).
5. Kılavuza yazılan kalın / eğik ad programda yoksa (yanlış not adı, eski ad) `npm run test:kilavuz-metin` kırmızı; madde başı vurgusu ekran adı sanılır.
6. Kılavuza sürüm notu / teknik bilgi (2.5.1'de…, dosya adı) girer → kılavuz kuralına aykırı.
7. Yazım düzeni: kılavuzdaki ekran adlarında küçük harfli sözcük; cümlelerde gereksiz büyük harf.
8. CHANGELOG ya da DEĞİŞİKLİKLER'de olmayan özellik (devir ekranı, kilit paketi, Gelir Tablosu) anlatılır → kullanıcı yanıltılır.
9. BİLİNEN SINIRLAR'da iş listesindeki bir sınır eksik kalır (ör. Değersiz'li caride stok satışı / verilen çek yolu, S-MS251-1, KDVK 29/4).
10. Eski kılavuz önerisi (KDV tur 6, Değersiz tur 5) yenisiyle birlikte girer → çelişen iki talimat.
11. PDF üretimi yarıda kalır / tek sayfa resimsiz çıkar (ders 20) → pdf-denetle resim sayısı denetimi.
12. Kılavuzdaki eski KDV Özeti cümlesi ("altta Net: … Net KDV") yeni rapor düzeniyle çelişir (Net KDV satırı kalktı).

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
Program davranışı DEĞİŞMEDİ (sunucu / istemci kodu yok). Kullanıcının gördüğü değişiklikler yalnız sürüm ve belgeler:
| Yer | Önce (taban 5afa15f4) | Sonra |
|---|---|---|
| Program sürümü (package.json, package-lock.json kök + `packages[""]`) | 2.5.0 | 2.5.1 (güncelleme denetimi, Hakkında, sürüm düşürme koruması bunu okur) |
| Kılavuz kapağı / dip notu (HTML + PDF) | "Sürüm 2.5.0" / "DestekOfis 2.5.0 · Kısa Kullanım Kılavuzu" | 2.5.1 |
| Programdaki kılavuz PDF'i (sol menü → Kullanım Kılavuzu) | 47 sayfa, 2.5.0 metni | 48 sayfa, 2.5.1 metni (yeni maddeler aşağıda) |
| Güncelleme paketinin sürüm notu (CHANGELOG `## 2.5.1`) | yok (boş) | "2.5.1 — KDV Özeti, Değersiz Alacak ve Müşteri İstekleri" + iki madde |
| Kılavuz 3. Ana Ekran → Bildirimler | uzun ileti okunacak kadar kalır | + uzun hata iletileri altta geniş kutuda, × ile kapanır |
| Kılavuz 9. Cari | — | Grupsuz / Alt Grupsuz; Grup Özeti; Tahsilat Dönemi + Bu Dönemde Ödeme Yapanlar + Tarih Aralığı bekleme + WhatsApp toplu; "45 gün gecikti (2. taksit)" |
| Kılavuz 9. Ticari Şüpheli Alacaklar | Değersiz Alacak Yaz tek cümle | aynı gün şüpheliye alma uyarısı (S-MS251-1); form önerisi / tarih / düğme; KDVK 29/4 notu (S-MS251-2); eksiye düşüren değişiklik listesi + "Ne yapmalı" yolu |
| Kılavuz 10. Taksitler | — | Taksit numarası (boşluksuz, her yerde aynı) |
| Kılavuz 13. Fatura → KDV Mahsup Fişi | "listedeki en son mahsubu Geri Al" | Mahsup Edilen Aylar'da en yeni mahsubun yanındaki Geri Al |
| Kılavuz 13. Fatura → KDV Özeti (yeni iki madde) | — | devreden / ödenecek / sonraki devreden + Mahsup Edilmemiş Ay; notlar: Mahsuptan Sonra Değişen Ay, Zincirle Uyuşmayan Mahsup Fişi (tur 7 metni AYNEN), Güncel Olmayan Önceki Fiş, Önceki Dönem İndirilecek KDV Azalışı (tur 8 metni AYNEN) |
| Kılavuz 15. Raporlar (TOPLAM paragrafı) | "KDV Özeti'nde Satış, Satıştan İade, Alış, Alıştan İade ve Net KDV" (Net KDV satırı programda 2.5.1'de KALKTI — eski metin yanlıştı) | "… TOPLAM'larının altında Önceki Dönemden Devreden KDV, Ödenecek KDV ve Sonraki Döneme Devreden KDV" |

## 2. DEĞİŞEN DOSYALAR
`package.json`, `package-lock.json` (yalnız iki kök sürüm alanı; `npm version` koşulmadı), `CHANGELOG.md`, `docs/2.5.1-DEGISIKLIKLER.md` (yeni), `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html`,
`client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf` (yeniden üretildi), `docs/kilavuz/metin-denetle.mjs` (yalnız NOT_LABEL'e dört madde başı vurgusu — 2.5.0 BS-5'in "Defter türünü seçmek" düzeni),
bu rapor, kanıt `docs/kanit/2026-11-28/aday-belge-*`. Sunucu / istemci / test / araç / göç / `.github` DOKUNULMADI.

NOT (görev metni çelişkisi — rapora): "Ortak kurallar"da `package.json` YASAK ve "Kılavuza DOKUNMA" yazıyor; "İşler" 1 ve 4 ikisini AÇIKÇA istiyor. Özel iş maddesi genel kuralın önüne alındı
(2.5.0'ın aday hazırlığı commit'i e7934c5e de aynısını yaptı); package.json'da YALNIZ `version` alanı değişti (script / bağımlılık yok).

## 3. TARAMA (ders 10 — `git grep`)
| Desen | Kapsam | Bulgu | Karar |
|---|---|---|---|
| `"version": "2.5.0"` | package.json, package-lock.json | 1 + 2 alan | 2.5.1 yapıldı |
| `Sürüm 2.5.0`, `DestekOfis 2.5.0 · Kısa` | kılavuz HTML | 1 + 1 | 2.5.1 |
| `['"\`]2\.5\.0['"\`]` | test/, tools/ (test/bagimsiz hariç) | yalnız DEFTER KURAL sürümleri (`LEDGER_RULE_VERSION`, kilit izi `version: "2.5.0"`, kural geçmişi) ve göç / fikstür adları | DOKUNULMADI (program sürümü değil — görev metni) |
| program sürümünü okuyan testler (`package.json` → version) | test/ | kilavuz-surum, kilavuz-pdf-surum, packaging, supervisor, updater (update-helpers) | hepsi package.json'dan okur, sabit yok → değişiklik gerekmedi; koşuldu (§4) |
| `Kullanim-Kilavuzu`, `CHANGELOG`, `DEGISIKLIKLER` | test/, tools/ | banka-220-kredi-karti-metin, gorunen-adres-247, mobil-karekod-248, kanit-araci, e2e/run.mjs (bağlantı), updater, kilavuz-surum, kilavuz-pdf-surum; tools/lib/update-package.mjs (releaseNotes), tools/package.mjs, tools/lib/app-files.mjs | e2e/run.mjs CI e2e'de (ana oturumun tam kapısı); öbürleri §4'te koşuldu; `releaseNotes(CHANGELOG, "2.5.1")` elle okundu: başlık + iki madde |
| şema kapısı (BS-7) | test/e2e/sema-kapisi-bs7.mjs, devir-d2 testleri | `PRAGMA user_version` (göç numarası) kullanır, program sürümü değil | etkilenmez |
| kılavuzdaki yeni <b>/<i> adlar | client/ + server/ | Grup Özeti, Liste, Tahsilat Dönemi, Bu Dönemde Ödeme Yapanlar, Grupsuz, Alt Grupsuz, Dün, Bu Hafta, Değersiz Yazıldı, Otomatik Dağıt, Mahsup Edilen Aylar, KDV notlarının adları (report-center.mjs) kaynakta birebir | `denetle({}, [3,9,10,13,15])`: kaynakta 379 (tabanda 356), eksik yalnız "+ Nakit", "+ Havale / EFT" — tabanda da aynı ikisi (ekranda bulunur; tam koşu §4) |

## 4. TESTLER (yeni test YOK — var olan denetimler; ham çıktı docs/kanit/2026-11-28/aday-belge-*)
Hepsi `flock -s olcum.lock` altında, `HUKUK_LICENSE_URL=http://127.0.0.1:9`, `tools/kanit.mjs kos` ile (betik aday-belge-kos.sh.txt; başlangıç yükü 3,82, bitiş 2,34; ilk denemede yük 5,4 → tek seferlik bekleme).
| Koşu | TZ | Sonuç |
|---|---|---|
| aday-belge-birim (kilavuz-surum, kilavuz-pdf-surum, yazim-duzeni, static, banka-220-kredi-karti-metin, gorunen-adres-247, mobil-karekod-248, updater, kanit-araci, packaging, supervisor) | UTC | GEÇTİ 119 / 119, 0 iptal / atlanan |
| aynı | Europe/Istanbul | GEÇTİ 119 / 119 |
| aday-belge-pdf-surum-eski (KILAVUZ_PDF = tabanın 2.5.0 PDF'i — dişi) | UTC | BEKLENEN KIRMIZI 1 / 2: "PDF sürümü 2.5.0 ≠ HTML 2.5.1 ya da program 2.5.1 (kapak: 2.5.0; dip not: 2.5.0)" — yeni PDF'le aynı test yeşil (birim koşusunda) |
| aday-belge-pdf-denetle (pdftotext + gerçek sunucu + tarayıcı) | Europe/Istanbul | GEÇTİ 39 / 39 — 48 sayfa, resim 38 ≥ 38, kapak + dip not 2.5.1, client/kilavuz kopyası aynı (sha256 52979ce7…), programın Yardım yolu bu dosyayı veriyor |
| aday-belge-kilavuz-metin (`npm run test:kilavuz-metin`; ekran gezintisi + bütün bölümlerin ad denetimi) | UTC | GEÇTİ 981 / 981 (ekran-banka 74 denetim; metin-denetle 907 / 907 ad: ekranda 630, kaynakta 277; EKRANDA BULUNMAYAN 0) |
| aynı | Europe/Istanbul | GEÇTİ 981 / 981 |
Ek (elle): pdftotext ile yeni PDF'te "Sürüm 2.5.1", "Grup Özeti", "Bu Dönemde Ödeme Yapanlar", "şüpheliye alma tarihini ertesi gün girin", "KDVK 29/4", "Zincirle Uyuşmayan Mahsup Fişi", "Önceki Dönem İndirilecek KDV Azalışı", "Mahsup Edilen Aylar", "geniş bir kutuda kalır", "Otomatik Dağıt ile kart toplamını" birer kez.
Eski kod kırmızısı (ders 7): yeni test eklenmediği için ayrı eski kopya kurulmadı; dişi eski PDF ile gösterildi (yukarıda).

## 5. KABUL
### A — sürüm her yerde 2.5.1
package.json `version`, package-lock.json kök + `packages[""]`, kılavuz kapağı + dip notu (HTML), PDF kapağı + dip notu (pdftotext: "Sürüm 2.5.1" 1, "DestekOfis 2.5.1 · Kısa" 1); 2.5.0 kalan program sürümü yazısı yok (tarama §3).

### B — CHANGELOG kısa ve doğru
`## 2.5.1 — KDV Özeti, Değersiz Alacak ve Müşteri İstekleri` + 'Yeni:' ve 'İyileştirmeler:' (2.5.0 biçimi; iki madde, ayrıntı DEĞİŞİKLİKLER'e). Devir ekranı / kilit paketi / Gelir Tablosu YAZILMADI.
`releaseNotes(CHANGELOG, "2.5.1")` başlık + iki maddeyi verir (güncelleme paketinin sürüm notu).

### C — DEĞİŞİKLİKLER + BİLİNEN SINIRLAR ↔ iş listesi kaynak satırları
| docs/2.5.1-DEGISIKLIKLER.md | Kaynak (docs/2.5.1-IS-LISTESI.md satırı / rapor) |
|---|---|
| §1 Taksit numarası | A Mİ (s.26), Mİ tur 2 (s.40); D s.224; mi-rapor §davranış 1–2, mi2-rapor 1–9 |
| §2 Grup Özeti, Tahsilat Dönemi, Bu Dönemde Ödeme Yapanlar, Tarih Aralığı bekleme, WhatsApp toplu, Excel "Gecikmiş Borç" | A Mİ (s.26); mi-rapor 3–7; mi2-rapor 10; mi3-rapor §1 |
| §3 KDV Özeti (devreden üç satır, ay satırları, Mahsup Edilmemiş Ay, Mahsuptan Sonra Değişen Ay, Zincirle Uyuşmayan, Güncel Olmayan Önceki Fiş, İndirilecek KDV Azalışı) | A M1 (s.27); D s.143 (tur 8), s.159 (tur 7), s.161 (tur 6), s.171 (tur 5); m1-rapor A, m1t2-rapor A |
| §4 Değersiz Alacak (form önerisi, kısmi sonrası, sınır, ret listesi, Mutabakat Testi satırı, 659 adı) | A M2 (s.38); D s.151 (tur 6), s.157 (tur 5), s.169 (tur 4); m2 / m2t2 / m2t3 raporları §1; D s.145 (659 adı) |
| §5 Görünüm (uzun hata iletileri, KDV kartları, Mahsup Edilen Aylar Geri Al) | D s.145 (UI turu) |
| §6 Altyapı (devir hesabı ekransız) | A D3 (s.33); CLAUDE.md DURUM 48 ("yalnız sunucu, ekransız; kullanıcı görmez") |
| BS: devir sihirbazı yok, 1 Şubat | C S-251Y-1/2/3 (s.87–89); CLAUDE.md YAYIN KARARI; A AKTARIM (s.13) |
| BS: Gelir Tablosu / Bilanço, Ödeme Hatırlatma, Rapor Merkezi grup raporu | A Ç6 (s.42), Ç5-C (s.41), Mİ-2 (d) (s.39); AKTARIM |
| BS: kilit paketi yok, POS iadesi 2.5.0 davranışı | C S-251Y-2 (s.88) |
| BS: Değersiz'li caride stok satışı / alışı, verilen çek-senet reddedilmez | B s.61, s.62; D s.157 karar (2) |
| BS: yeni Alacak Yaz / tahsilat / tahsilat artışı, Alacak taşıma, Silinenler geri yükleme kabul | D s.169 BM-M2T4-3, s.151 TARAMA; C S-M2T5-1 (s.85), S-M2T5-2 (s.86) |
| BS: başka şüpheli kaydın silinmesi reddi | B s.72 (S-DKM2-3 = C) |
| BS: aynı gün tahsilattan sonra şüpheliye alma | C S-MS251-1 (s.83) = C |
| BS: KDVK 29/4 | C S-MS251-2 (s.84) = A |
| BS: KDV PDF notları kısalır; Güncel Olmayan Önceki Fiş uç durumu; uyuşmazlık notu iki sonuç aynıyken; azalış ayı adı kayabilir | D s.161 (3); B s.60 (D-1); D s.143 karar (4) |
| BS: ciro edilmiş çek karşılıksız → "çek tahsilatı" | B s.73 (S-DKMI-1 = C) |
| BS: kilitli dönemde açık kalem türü | B s.76 (SK-60 = C) |
| BS: hız (Taksit Tahsilatları, Tüm Cari Hareketleri, devir ön izlemesi; Silinenler'li Değersiz denetimi) | B s.78 (kullanıcı 27.11 18:36 AYNEN); B s.62, D s.157 karar (3) |
| BS: 2.5.0'dan sürenler, iç işler | docs/2.5.0-DEGISIKLIKLER.md teslim notu; B '2.5.1'E (20.11 kuralı)' |

ALINMAYAN (bilerek): B'nin "BİLİNEN SINIR" geçmeyen satırları (görev metni yalnız 'BİLİNEN SINIR' geçenleri istedi); B s.60'ın DOĞRULANMADI cümlesi (fişsiz ve hareketsiz ayın tek ay raporu — doğrulanmamış kuşku, 20.11 kuralı).

### D — kılavuz ↔ öneri metinleri
| Kılavuz yeri | Kaynak öneri | Eşleşme |
|---|---|---|
| 3. Ana Ekran → Bildirimler | D s.145 / ui251-rapor §14 (1) | AYNEN ("Uzun hata iletileri … × ile kapatın."; Kopyala cümlesi madde içinde zaten vardı) |
| 9. Cari → Grup Özeti | mi-rapor "Gruba göre özet" | AYNEN, "Cari penceresinde" yerine "listenin üstünde Liste yerine" (düğmenin yeri) + "PDF, Yazdır ve Excel ekrandakiyle aynıdır" |
| 9. Cari → Tahsilat Dönemi | mi2-rapor "Tahsilat dönemi" + mi-rapor "Bugün kim ödedi" + mi3-rapor | üçü birleştirildi; mi3 metni AYNEN ("Tarih Aralığı'nı … hepsini seçer"; özne "Bu Dönemde Ödeme Yapanlar işaretliyken") |
| 9. Cari → Hangi taksit gecikti | mi-rapor | AYNEN |
| 9. Cari → Grupsuz / Alt Grupsuz | mi-rapor davranış 5 (öneri metni yok) | baş mimar değerlendir — bir cümle |
| 9. Şüpheliye alın | C S-MS251-1 | AYNEN ("Aynı gün tahsilattan sonra şüpheliye alacaksanız şüpheliye alma tarihini ertesi gün girin.") |
| 9. Değersiz Alacak Yaz | m2-rapor §14 + C S-MS251-2 | m2 metni kısaltılarak ("o günün faturaya bağlı tahsilatından önce" → "yazılabilecek tutar kaldıysa"); S-MS251-2 AYNEN |
| 9. Değersiz Alacak yazılmış caride değişiklik | D s.151 (tur 6, tur 5'in YERİNE) + m2t2 / m2t3 / m2t4 önerileri | tur 6 metni AYNEN; başına tur 2–4'ün kalemleri (fatura iptali / iade / tutar düşürme; Borç Yaz / taksit kartı silme / düşürme) ve sonuna tur 4'ün "silmek yetmez" yolu eklendi — BAŞ MİMAR DEĞERLENDİR (§BAŞ MİMAR) |
| 10. Taksitler → Taksit numarası | mi2-rapor | AYNEN |
| 13. KDV Mahsup Fişi (Geri Al yeri) | D s.145 / ui251-rapor §14 (2) | maddenin "listedeki en son mahsubu Geri Al" cümlesi bu metinle değiştirildi |
| 13. KDV Özeti | m1-rapor §13 + m1t2-rapor §13 | m1t2 metni (Mahsup Edilmemiş Ay, sırayla) + m1'in devreden üç satırı |
| 13. KDV Özeti'nde notlar | m1k5 (Mahsuptan Sonra Değişen Ay; k1–k4'ün yerine), D s.159 (tur 7 — tur 6'nın YERİNE), D s.143 (tur 8) | tur 7 ve tur 8 AYNEN; Mahsuptan Sonra Değişen Ay cümlesi m1k4'ün ilk cümlesi + m1k5'in onarım cümlesi; m1t2'nin "Zincirle … o ayın ve sonraki ayların" cümlesi ALINMADI (tur 6–7'de değişti — çelişmesin) |
| 15. Raporlar TOPLAM paragrafı | m1-rapor §13 (391. satır) | AYNEN |

## 6. MUTANT TABLOSU
Para / defter kodu değişmedi → para çekirdeği mutasyonu uygulanmaz. Belge denetimlerinin dişi (§4): kılavuz PDF sürüm testi eski (2.5.0) PDF verilince kırmızı; metin denetimi tabanda ve yenide aynı iki adı eksik sayar (yeni adlar kaynakta birebir).

## 7. HIZ
Yok (program kodu değişmedi).

## KULLANICIYA SORULMALI
Yok. (Para / kapama kuralı ayrışması çıkmadı; S-MS251-1 = C ve S-MS251-2 = A zaten kullanıcı kararıyla öneriyle verilmişti — metinleri AYNEN.)

## BAŞ MİMAR KARARI GEREKİYOR (öneri uygulandı; değerlendir)
1. Değersiz Alacak kılavuz maddesi: görev metni "Değersiz tur 6'nınki tur 5'inkinin YERİNE" diyor; tur 6 metni yalnız tur 5'in kalemlerini (Ödeme / POS İadesi / Alacak / alış faturası / kart hareketi / Otomatik Dağıt) sayıyor, tur 2–4'ün reddettiği yolları (fatura iptali / iade / tutar düşürme; Borç Yaz / taksit kartı silme / düşürme) ve tur 4'ün "Değersiz Alacak satırını silmek yetmez" yolunu söylemiyor. ÖNERİ (uygulandı): tur 6 metni AYNEN + başa tur 2–4 kalemleri + sona tur 4'ün yolu (tek madde; program bu yolların hepsini reddediyor — kullanıcı yalnız yarısını kılavuzda görürdü). Öbür okuma: yalnız tur 6 metni.
2. Görev metni çelişkisi (§2 NOT): "package.json YASAK / Kılavuza DOKUNMA" ↔ İşler 1 ve 4 — iş maddesi uygulandı.
3. `docs/kilavuz/metin-denetle.mjs` NOT_LABEL'e dört madde başı vurgusu eklendi (yalnız kılavuz denetim aracı; `tools/**` değil; 2.5.0 BS-5 düzeni). Yerine madde başlarını kalın yazmamak da olurdu; kılavuzun öbür maddeleriyle aynı görünüm için eklendi.
4. Mİ-2 (d) Rapor Merkezi grup raporu YAPILMADI → kılavuza girmedi; DEĞİŞİKLİKLER BİLİNEN SINIRLAR'da.

## SONRAKİ SÜRÜME (20.11 kuralı)
- Kılavuz metin denetimi (metin-denetle) madde başı vurgularını elle NOT_LABEL'e alıyor; madde başını (":" ile biten ilk <b>) kendiliğinden ayıran bir kural araç bakımıdır.
- KDV Özeti kılavuz maddeleri uzun (dört not bir maddede); ekran görüntüsü ve "nasıl yapılır" kutusuyla sadeleştirme UI/UX turu konusu.

## DOĞRULANMADI
- Kılavuzdaki yeni KDV notu adlarının EKRANDA göründüğü yalnız program kaynağında birebir arandı (metin-denetle "kaynakta" kuralı); gezinti KDV Özeti'nin notlu durumunu açmaz (KDV ekran senaryoları ana oturumun tam kapısında).
- Mevzuat dayanağı (KDVK 29/4) bu ajanca doğrulanmadı (C S-MS251-2'de de DOĞRULANMADI yazıyor) — metin kararın AYNEN cümlesi.

## DENENMEYEN
- Tam `npm test` ve ci.yml e2e listesi (görev gereği ana oturumda); Windows (CI'de).
- Site kılavuz PR'ı ve imzalı paket (yayın aşaması).
- Teslim notunun DENENEN / DENENMEYEN bölümleri (aday kapısından sonra ana oturum ekler).

## CI LİSTESİNE EKLENECEK
Yok (yeni test / senaryo yok).

## KILAVUZ METNİ ÖNERİSİ
Uygulandı (kılavuzun kendisinde; §5 D tablosu).

## COMMIT LİSTESİ (t251-aday-belge-taban = 5afa15f4 ..)
4725ae92 sürüm 2.5.1 + CHANGELOG + DEĞİŞİKLİKLER + rapor taslağı · 9b239466 kılavuz HTML + metin-denetle NOT_LABEL · e9c818df kılavuz PDF · a50cdb30 rapor · 3f69bac7 Kanıt · (bu rapor commit'i = dal ucu).
Model adı hiçbir commit'te / dosyada yok. PUSH YOK.

## ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <bu ağaç>; export HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
for tz in UTC Europe/Istanbul; do TZ=$tz node --test --test-concurrency=1 test/kilavuz-surum.test.mjs test/kilavuz-pdf-surum.test.mjs test/yazim-duzeni.test.mjs test/static.test.mjs test/banka-220-kredi-karti-metin.test.mjs test/gorunen-adres-247.test.mjs test/mobil-karekod-248.test.mjs test/updater.test.mjs test/kanit-araci.test.mjs test/packaging.test.mjs test/supervisor.test.mjs; done
git show t251-aday-belge-taban:client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf > /tmp/eski.pdf && KILAVUZ_PDF=/tmp/eski.pdf node --test test/kilavuz-pdf-surum.test.mjs   # beklenen kırmızı
node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu && cmp docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf; node docs/kilavuz/pdf-denetle.mjs
npm run test:kilavuz-metin
node -e "import('./tools/lib/update-package.mjs').then(m=>console.log(m.releaseNotes(require('fs').readFileSync('CHANGELOG.md','utf8'),'2.5.1')))"
```
(PDF yeniden üretilirse bayt bayt aynı çıkmaz — tarih damgası; cmp yalnız client kopyasının docs çıktısıyla aynılığına bakar. Kopyalanmış PDF'in aynılığını pdf-denetle sha256 ile denetler.)
