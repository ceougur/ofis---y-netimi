# 2.5.1 — Değersiz Alacak sınırı TUR 5 raporu (son Değersiz turu)

Taban `t251-m2t5-taban` (9a2b5113). Görev metni `docs/devir/2.5.1-DEVAM/m2t5-istem.txt`. Kararlar: SK-64 = A, ORTA-A, ORTA-B (S-251Y-1 = A). PUSH YOK.

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra; taban T = Fatura 2.900 + Borç 3.400, 17.09 bağlı tahsilat 2.876,45, Şüpheliye Al 3.000, Değersiz 3.000 @17.09 → 423,55)

| Ekran / işlem | Önce (taban) | Sonra (tur 5) |
|---|---|---|
| Cari kartı → Ödeme satırının × (SK-64 örneği: Ödeme 500 + avans 1.000 → bakiye −76,45) | "Hareket silindi.", bakiye −576,45 | 409 "Ödeme hareketi silinemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; silmeden sonra cari 576,45 TL alacaklı (eksi bakiye) olurdu. … Ne yapmalı: önce Değersiz Alacak satırını silin (…), sonra ödeme hareketini silin; …"; bakiye −76,45; izlenen yol (Değersiz sil → Ödeme sil) kabul → 2.423,55 |
| Ödeme düzeltme 500 → 100 / başka cariye taşıma | kabul (−476,45 / −576,45) | 409 "Ödeme hareketi düzeltilemez"; 500 → 600 (23,55) ve tarih değişikliği kabul |
| Alacak Yaz 400 → 500 (23,55 iken) | kabul (−76,45) | 409 "Alacak hareketi düzeltilemez"; 423,55 (tam 0) kabul; 423,56 (−0,01) ret; Borç'a çevirme kabul |
| Alış Faturası Düzenle 100 → 1.000 (323,55 iken) | kabul (−576,45) | 409 "Alış faturası düzenlenemez"; 100 → 423,55 (tam 0) kabul |
| POS İadesi silme (POS tahsilatı 1.000 + POS İadesi 500 → −76,45) | kabul (−576,45) | 409 "POS İadesi silinemez" |
| Taksit kartının ödeme / iade hareketi (kart tahsilatı 1.000 + kart iadesi 500 → −76,45) silme / 500 → 100 | kabul | 409 "Taksit kartının ödeme / iade hareketi silinemez / düzeltilemez" |
| Taksit kartı → Otomatik Dağıt 3.400 → 100 (1 / 2 / 12 taksit) — dar kontrolün vakası | 200, kart 100, bakiye −2.876,45 | 409 "Otomatik Dağıt kaydedilemez: … dağıtımdan sonra cari 2.876,45 TL alacaklı …"; kart, taksitleri, Değişiklik Geçmişi, cari satırları BAYT BAYT aynı; 3.400 / 3 taksit, 3.500, 3.000 (23,55) kabul; dönem kilidi iletisi önce |
| Mutabakat / tahsilat yazımı, 10 Değersiz satırlı cari, Silinenler'de Değersiz'den SONRA silinmiş 5.000 fatura | ~237 / ~347 ms (gösterge) | ~16 / ~39 ms (gösterge; büyümüyor — 20.000'de 18 / 39 ms) |
| Aynı, en kötü sınıf (her caride aynı gün Değersiz'den ÖNCE bağsız tahsilat) | ~205 / ~261 ms | ~56 / ~98 ms (5.000), ~171 / ~232 ms (20.000) — TEK geçiş, yine doğrusal → BAŞ MİMAR KARARI GEREKİYOR B-2 |
| DEĞİŞMEYEN: yeni Alacak Yaz, yeni tahsilat, tahsilat artışı (BM-M2T4-3), Değersiz'siz ya da Değersiz satırı silinmiş cari | kabul | kabul (testte) |

## 2. DEĞİŞEN DOSYALAR
- `server/lib/bank/doubtful.mjs` — writeOffBalanceGuard `kind` parametresi + 9 yeni ileti sözcüğü (Ödeme / POS İadesi / Alacak / Alış faturası / kart ödeme-iade / Otomatik Dağıt); değişmez (i)'nin Silinenler taraması: `writeOffUnbondSince` (yalnız sonucu okuyabilecek satırlar), `writeOffTrashMax` (tek cari: dizinli SQL; çok cari: TEK geçiş), `WRITE_OFF_TRASH_ROWS_SQL`; döngü hazırlık + tarama + değerlendirme olarak üçe ayrıldı (mantık AYNEN).
- `server/routes/accounts.mjs` — PUT / DELETE cari hareketi: denetim türleri `WRITE_OFF_GUARDED` (silme: Borç, Ödeme; düzeltme: Borç, Ödeme, Alacak), `guardKindOf` (POS İadesi).
- `server/routes/plans.mjs` — Otomatik Dağıt (yazımdan önce kur, kart + taksitlerden sonra denetle, store.tx içinde); kart hareketi PUT / DELETE (ödeme / iade).
- `server/routes/invoices.mjs` — Alış Faturası Düzenle'si tutar artırıyorsa (aynı cari) denetim.
- `test/supheli-degersiz-m2t5-251.test.mjs` (yeni: 13 belirli test + 3 rastgele tohum = 16), `test/supheli-degersiz-m2t4-251.test.mjs` (kurulum: (i) kolunu koşturan satır — beklenti aynı), `test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` (adım 7).
Göç, araç, `.github`, `package.json`, tek borç sırası, defter rotası, şüpheli defter türetmesi, KDV Özeti, kâhin klasörleri DOKUNULMADI.

## 3. TARAMA (git grep: `DELETE FROM account_entries`, `UPDATE account_entries SET …amount|kind|account_id`, `UPDATE plans SET …total|deleted_at|account_id`, cari cepheleri; ölçüm `docs/kanit/2026-11-28/m2t5-arac/yollar.mjs`, çıktı `m2t5-cikti/yollar.txt` — yeni ve taban kodda)

| Yol | Bakiyeyi düşürür mü | Tur 5 | Not |
|---|---|---|---|
| Cari hareketi DELETE — Borç | evet | denetim (tur 4) | |
| Cari hareketi DELETE — Ödeme / POS İadesi | evet | **denetim (yeni)** | SK-64 |
| Cari hareketi DELETE — Tahsilat / Alacak | hayır | yok | |
| Cari hareketi PUT — Borç | evet | denetim (tur 4) | |
| Cari hareketi PUT — Ödeme (düşür / taşı; tür değişmez — program yalnız Borç ↔ Alacak çevirir) | evet | **denetim (yeni)** | |
| Cari hareketi PUT — Alacak (artır) | evet | **denetim (yeni)** | Borç'a çevirme / taşıma eski cariyi yükseltir |
| Cari hareketi PUT — Tahsilat (artır) | evet | yok — BM-M2T4-3 kabul | ölçüldü −586,45 → −1.076,45 kabul |
| Yeni Alacak Yaz / yeni tahsilat | evet | yok — BM-M2T4-3 kabul | ölçüldü 423,55 → −576,45 kabul |
| Alacak satırını BAŞKA cariden Değersiz'li cariye taşıma | hedefte evet | yok | KULLANICIYA SORULMALI K-1 |
| Silinenler'den Alacak Yaz geri yükleme | evet | yok | KULLANICIYA SORULMALI K-2 |
| Banka → POS İşlemleri → İptal Et (void) | hayır (yalnız satış = tahsilat) | yok | iade bu yoldan silinmez |
| POS komisyon satırları (sağlayıcı carisi) | sağlayıcıda | yok | kapsam dışı |
| Taksit kartı PUT / DELETE | evet | denetim (tur 4) | |
| Taksit kartı Otomatik Dağıt | evet | **denetim (yeni, ORTA-A)** | |
| Kart hareketi PUT / DELETE — ödeme / iade | evet | **denetim (yeni)** | |
| Kart tahsilatı; taksit kalemi ekle / düzelt / sil | hayır / toplam değişmez | yok | |
| Kart kırpma / kapatma / büyütme (fatura iade / iptal içinden) | fatura işleminin parçası | fatura denetimi (tur 2–3) | |
| Kartı Kapat (Borçta Kalsın), Silinenler'den kart geri yükleme, Excel yüklemesi | hayır | yok | |
| Alış Faturası Düzenle (aynı cari, tutar artışı) | evet | **denetim (yeni)** | SK-64 ayna yolu |
| Stok satışı (açık hesap) silme / düşürme | evet | **YOK** | BAŞ MİMAR B-1 (ölçüldü −76,45 → −576,45 kabul) |
| Verilen çek / senet silme | evet | **YOK** | BAŞ MİMAR B-1 (ölçüldü −76,45 → −576,45 kabul) |

## 4–13
Ayrıntılı sonuçlar (testler, kabul, mutantlar, hız, sorular, baş mimar kararları, sonraki sürüm, denenmeyen, kılavuz önerisi, komutlar) ajanın son iletisindedir; kanıtlar `docs/kanit/2026-11-28/m2t5-*`, `m2t5-arac/`, `m2t5-cikti/`.

