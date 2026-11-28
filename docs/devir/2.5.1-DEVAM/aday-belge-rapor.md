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
