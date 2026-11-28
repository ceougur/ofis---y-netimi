# 2.5.1 Değersiz Alacak sınırı — TUR 6 raporu

Görev metni: `docs/devir/2.5.1-DEVAM/m2t6-istem.txt`. Taban: `t251-m2t6-taban` (3980c57d). Dal ucu: `b093176c` (worktree-agent-a961aa7259bce4276). PUSH YOK.
Kapsam DAR: dar kontrol DK-M2T5 ORTA-1 — BAŞ MİMAR KARARI 28.11 11:55 UTC (1). B-1 (stok / çek-senet) KODLANMADI (karar (2): sonraki sürüm).

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Ekran: Faturalar → Alış Faturası (Hizmet ve Gider Alışı ya da Stoğa Mal Alışı) → Düzenle → Kaydet; yalnız carisinde Değersiz Alacak satırı olan caride.
Taban T: Fatura 2.900 + Borç 3.400, bağlı tahsilat 2.876,45, Şüpheliye Al 3.000, Değersiz 3.000 (17.09) → bakiye 423,55.

| Durum (dar kontrolün vakası AYNEN) | Önce (tur 5) | Sonra (tur 6) |
|---|---|---|
| T + Alış 500 + peşin ödeme 500 + avans 1.000 (bakiye −576,45); tutar aynı, peşin 500 → 100 | 200, bakiye −976,45, Mutabakat 'tamam' | 409 "Alış faturası düzenlenemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak satırı var; düzenlemeden sonra cari 976,45 TL alacaklı (eksi bakiye) olurdu. … Ne yapmalı: önce Değersiz Alacak satırını silin (cari kartı → Şüpheli Alacak → kaydın Değersiz satırındaki × düğmesi), sonra faturayı düzenleyin; … Hiçbir şey kaydedilmedi."; bakiye −576,45 kalır |
| Aynı tabanda peşin ödeme kaldırıldı | 200, −1.076,45 | 409 (… 1.076,45 TL alacaklı …), −576,45 kalır |
| Aynı tabanda tutar 500 → 100 ve peşin kaldırıldı | 200, −676,45 (tutar düştüğü için denetim kurulmuyordu) | 409, −576,45 kalır |
| Avanssız (423,55): peşin 500 → 76,44 | 200, −0,01 | 409 |
| Stoğa Mal Alışı'nda aynı (peşin kaldırıldı) | 200, −1.076,45 | 409 |
| İletinin neden cümlesi (Değersiz olmasaydı da eksi kalan durumda; ör. Alış 5.000 + peşin 5.000, peşin kaldırılır) | "… caride alış faturasının tutarının artırılması cariyi alacaklıya …" | "… caride alış faturasının düzenlenmesi cariyi alacaklıya (eksi bakiyeye) götüremez; Değersiz Alacak satırı olmasaydı da cari 1.576,45 TL alacaklı olurdu …" (tutar artışında da aynı söz) |

DEĞİŞMEYEN (kabul kalır, testte): net 0 (B4: 100 → 1.100 + peşin 1.000 → 323,55); tutar 100 + peşin 100 (net 0) → −576,45; peşin artışı (800 + peşin 300 → 700: −1.076,45 → −676,45, eksi kalsa da yükseldiği için); yalnız tarih değişikliği; eksiye düşmeyen azaltma (peşin → 100: 23,55); tam 0 (peşin → 76,45: 0); tutar artışı tam 0 (tur 5); Değersiz satırı HİÇ olmayan ve Değersiz satırı silinmiş caride peşin kaldırma (−4.076,45, kabul); cari değişimi (A −876,45 → −576,45, B −300); alış faturası iptali (peşinli: bakiye aynı, peşinsiz: +300); dönem kilidi iletisi Değersiz iletisinden önce. Ret atomik: fatura satırı ve kalemleri, carinin bütün hareketleri, bütün işlem başlıkları (fin_events), Değişiklik Geçmişi sayısı, Silinenler bayt bayt aynı.

## DEĞİŞEN DOSYALAR
- `server/routes/invoices.mjs` (editInvoice — tek koşul): `existing.kind === "purchase" && decrease < -0.005` → `existing.kind === "purchase" && !(doc.account?.id && doc.account.id !== existing.accountId)` (cari değişmiyorsa tutar koşulsuz; cari değişiyorsa tur 5 gibi denetimsiz) + açıklama.
- `server/lib/bank/doubtful.mjs` (yalnız ileti sözü): `edit:purchase` op "alış faturasının tutarının artırılması" → "alış faturasının düzenlenmesi" + açıklama.
- Yeni test `test/supheli-degersiz-m2t6-251.test.mjs` (10 test). Kanıt `docs/kanit/2026-11-28/m2t6-*`, araçlar `m2t6-arac/`, çıktılar `m2t6-cikti/`. Bu rapor.
- DOKUNULMADI: stok, çek / senet, tek borç sırası, defter rotası, şüpheli defter türetmesi, göçler, KDV Özeti, kâhin klasörleri, `.github`, `package.json`, `tools`, kılavuz, ci.yml.

## TARAMA (aynı Düzenle yolundan geçen türler — ölçüldü: `m2t6-cikti/olcum-turler.txt`, iki TZ aynı)
| Tür | Bakiyeyi düşüren Düzenle | Durum | Karar |
|---|---|---|---|
| Hizmet ve Gider Alışı (expense_purchase, tür purchase) | peşin ödeme düşürme / kaldırma; tutar artışı | tur 6'da denetimli | bu tur |
| Stoğa Mal Alışı (goods_purchase, tür purchase) | aynı | tur 6'da denetimli (test 6) | bu tur |
| Satıştan İade (alacak yönlü) | iade büyümesi / peşin iade ödemesi | tur 2'den beri KOŞULSUZ ('return') | değişmez |
| Satış / SMM / Alıştan İade (borç yönlü) | tutar düşüşü | tur 3'ten beri denetimli | değişmez |
| Satış / Alıştan İade | peşin TAHSİLAT artışı (ölçüldü: Satış −576,45 → −1.076,45 200; Alıştan İade −1.076,45 → −1.576,45 200) | kabul | BM-M2T4-3 ("tahsilat artışı … KABUL") — kapsam dışı, kodlanmadı |
| 'Gider / SMM alış' ayrı türü | yok — SMM satış yönlü (borç), giderler tür purchase | — | — |
| Alış peşin > tutar | 400 payment-exceeds (ölçüldü) | — | cari değişiminde eski cari düşemez (net +tutar − peşin ≥ 0) → M30 eşdeğer |

## YENİ TESTLER — kırmızı nedeni + yeşil (iki TZ)
`test/supheli-degersiz-m2t6-251.test.mjs`:
- YENİ KOD (3e4a56f4+, tur 5 testiyle birlikte): UTC 26 / 26, Europe/Istanbul 26 / 26 (`m2t6-yeni-*.json`, GEÇTİ).
- TABAN (t251-m2t6-taban, ayrı `git worktree --detach` kopyası, yalnız yeni test dosyası eklendi): UTC 5 / 10, Europe/Istanbul 5 / 10 (`m2t6-eski-*.json`, BAŞARISIZ). Kırmızı 5'in NEDENİ (iletiler okundu): beşi de "200 !== 409" — tabanda Düzenle kabul ediliyor (peşin 500 → 100 / kaldırma, tutar düşüp peşin kalkması, −0,01, ileti testi, Stoğa Mal Alışı). Tabanda yeşil 5: B4 net 0 ve 'yanlış yere düşmüyor' dörtlüsü (Değersiz'siz / silinmiş, cari değişimi, iptal, dönem kilidi) — taban da kabul ettiği için beklenen; dişleri mutantlarda (M28, M31, M27p).

## KABUL
- A: yeni testler tabanda beklenen nedenle ('200 !== 409') kırmızı, yenide yeşil, iki TZ — SAĞLANDI.
- B: dar kontrolün vakaları AYNEN (−576,45; 500 → 100 409; kaldırıldı 409) ve ret atomik (bayt bayt) — SAĞLANDI; ileti yolu (Değersiz satırını sil → aynı Düzenle 200, 2.423,55 → 1.923,55; Mutabakat tamam).
- C: yanlış yere düşmüyor (net 0, artış eksiye götürmüyor, eksiye götürmeyen peşin azaltma, tam 0, Değersiz'siz, Değersiz silinmiş, iptal, cari değişimi, kilit) — SAĞLANDI.
- D: mutantlar (aşağıda) — tur 6'nın dört dişli mutantı iki TZ'de yakalandı.
- E: komşular 294 dosya UTC 3.169 / 3.169, Europe/Istanbul 3.169 / 3.169; ekran senaryoları senaryo-degersiz-iptal-m2t2-251 41 / 41 ve senaryo-degersiz-siniri-m2-251 24 / 24 iki TZ; `test:kahin-cari` 25.957 / 25.957 ve `test:kahin-defter` 187 / 187 iki TZ (kâhin kodu okunmadı; fark 0) — SAĞLANDI.
- F: hız — aşağıda (GÖSTERGE).

## MUTANT TABLOSU (`m2t6-arac/mutant.py`; tur 5'in aracından üretildi; 7 test dosyası, M2T2_TOHUM=1,2,3,4)
UTC: 47 mutant → 43 YAKALANDI, 2 YAŞADI, 2 UYGULANAMADI. (İlk koşu 30 dk arka plan sınırına takıldı — M18'de kesildi, o mutant BELİRSİZ sayıldı ve ikinci koşuda baştan koşuldu; çıktılar `mutant-UTC-1-kesildi.txt` + `mutant-UTC-2.txt`; kesilen kopyada mutasyonlu dosya elle geri alındı.)
| Mutant | UTC | Europe/Istanbul | Not |
|---|---|---|---|
| tur 2–5 (M1 … M26; 41 tane) | 39 yakalandı | — | M9 UYGULANAMADI (tur 4 / 5'te de aynı — metin tur 3'te değişti); M17b YAŞADI (tur 4'ten bilinen, B); M23c tur 5'in B koşusunda yaşamıştı, burada YAKALANDI |
| M27 (tur 5'in alış mutantı, eski metin) | UYGULANAMADI | — | metin tur 6'da değişti → M27p |
| M27p — alış denetimi yok | YAKALANDI (6) | YAKALANDI (6) | |
| M28 — tutar koşulu geri geldi (`decrease < -0.005`) | YAKALANDI (5) | YAKALANDI (5) | görev metnindeki 1. mutant |
| M29 — ileti sözü 'tutarının artırılması'na döndü | YAKALANDI (1) | YAKALANDI (1) | görev metnindeki 2. mutant |
| M30 — cari değişiminde de denetim | YAŞADI | YAŞADI | EŞDEĞER: peşin > tutar 400 (ölçüldü) → cari değişiminde eski cari net +tutar − peşin ≥ 0, denetim reddedemez |
| M31 — yalnız tutar düşerken denetim | YAKALANDI (5) | YAKALANDI (5) | |

## HIZ (ders 47 — GÖSTERGE; ana oturumun özel kilitli kabul ölçümü yerine geçmez)
- Değersiz'siz caride tur 6'nın eklediği iş: Alış Faturası Düzenle'de (önce yalnız tutar artışında) writeOffBalanceGuard'ın TEK 'Değersiz satırı var mı' sorgusu. Defter bakiyesi (iki kez) YALNIZ Değersiz satırlı caride okunur (değişmedi).
- temiz-100k kopyasında (102.295 cari hareketi, 9.540 alış faturası; salt okunur kopya, ölçümden sonra silindi): plan `SEARCH account_entries USING INDEX idx_account_entries_source (source=?)`; en çok hareketli 3 caride ortanca 0,002 ms, en kötü 0,041 ms (200 ölçüm). Yük 3,85 iken ölçüldü (paylaşımlı kilit, özel kilit YOK) → gösterge. `m2t6-cikti/hiz-sorgu.txt`. Not: plan source dizinini seçiyor — süre veri tabanındaki TOPLAM Değersiz satırı sayısıyla büyür (temiz-100k'da 0); yaygın veride küçük. Uçtan uca Düzenle süresi ÖLÇÜLMEDİ.

## KULLANICIYA SORULMALI
YOK (kararın metni bu yolu kapsıyor; peşin tahsilat artışı BM-M2T4-3 ile kapsam dışı).

## BAŞ MİMAR KARARI GEREKİYOR
YOK.

## SONRAKİ SÜRÜME (20.11 kuralı — programı değiştirmeyenler)
- M30 eşdeğer mutantı (kod sadeleştirmesi: cari koşulu davranışı değiştirmiyor; okunurluk için bırakıldı).
- Hız ölçüm aracı (`hiz-sorgu.mjs`) gösterge; uçtan uca ölçüm ana oturumun kabul düzeneğinde.

## DOĞRULANMADI
- Peşin ödemenin banka / kredi kartı / verilen çek ile olduğu Alış Faturası Düzenle'si (aynı kod yolu — denetim yöntemden bağımsız defter bakiyesini ölçer; test yalnız nakit peşinle).
- İki şirket / yedek geri yükleme (karar (5) — teslim notunun DENENMEYEN'ine).

## DENENMEYEN
- Tam `npm test` (görev gereği ana oturumda). Windows (CI'de okunur; yeni test dosyaya dokunmaz).
- Bu yolun ekrandan yürüyüşü (yeni ekran adımı eklenmedi; iki mevcut senaryo yeşil; Alış Faturası Düzenle reddi aynı bildirim bileşeninden çıkar — ana oturumun ekran yürüyüşüne).
- Uçtan uca hız kabulü (özel kilit — ana oturum).
- B-1 yolları (stok satışı / alışı, çek / senet silme) — karar (2) gereği kodlanmadı.

## CI LİSTESİNE EKLENECEK
Yeni ekran senaryosu yok. Yeni birim testi `test/supheli-degersiz-m2t6-251.test.mjs` `npm test`'in deseniyle zaten koşar (ci.yml değişmedi).

## KILAVUZ METNİ ÖNERİSİ (aday kapısında; karar (3) ile birlikte)
"Değersiz Alacak yazılmış bir caride şu değişiklikler kaydedilmez: Ödeme ya da POS İadesi silme ve tutarını düşürme, Alacak tutarını artırma, alış faturasını cariyi alacaklıya düşürecek biçimde düzenleme (tutarını artırma ya da peşin ödemesini düşürme / kaldırma), taksit kartının ödeme / iade hareketini silme, Otomatik Dağıt ile kart toplamını düşürme. Program nedenini ve yapılacakları yazar. Önce cari kartı → Şüpheli Alacak'ta Değersiz satırını × ile silin, işlemi yapın, gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir)."

## SÜREÇ NOTU
İlk iki arka plan işi Bash'in 30 dk varsayılan arka plan sınırıyla başlatıldı (2 saat verilmeliydi — token tasarrufu (5) / ders 55) ve kesildi: kesilen adımlar (mutant M18'den sonrası, komşu İstanbul ve sonrası) BELİRSİZ sayılıp yalnız onlar 2 saat sınırla yeniden koşuldu; komşu UTC tamamlanmıştı (GEÇTİ). Komşu İstanbul sırasında yük 5,10'a çıktı (mutantlarla eşzamanlı; ikisi de paylaşımlı kilit altında).

## COMMIT LİSTESİ (t251-m2t6-taban..)
- 9c60f858 nasıl bozulur listesi (koddan önce)
- 3e4a56f4 kod + kalıcı test
- 44e0ca97 Kanıt: yeni / taban iki TZ, komşular UTC, araçlar
- 8f357c41 Kanıt: mutantlar, öbür türlerin ölçümü
- b093176c Kanıt: komşular İstanbul, kâhinler, ekran senaryoları
- (bu rapor commit'i)

## ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
- Yeni test, yeni kod, iki TZ: `TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/supheli-degersiz-m2t6-251.test.mjs test/supheli-degersiz-m2t5-251.test.mjs` (ve `TZ=Europe/Istanbul`) → 26 / 26.
- Taban kırmızısı: `git worktree add --detach <kopya> t251-m2t6-taban`; kopyaya yalnız `test/supheli-degersiz-m2t6-251.test.mjs`; aynı komut → 5 / 10, beşi '200 !== 409'.
- Mutantlar: `/dev/shm/m2t6-mut/mut` = `git worktree add --detach … <dal ucu>` + node_modules bağı; `MUT_TZ=UTC python3 -I docs/kanit/2026-11-28/m2t6-arac/mutant.py [ad …]` (tur 6'nınkiler: M27p, M28, M29, M30, M31).
- Komşular: `docs/kanit/2026-11-28/m2t6-arac/komsu.txt` (294 dosya) `node --test --test-concurrency=2 $(cat …)` iki TZ; `npm run test:kahin-cari`, `npm run test:kahin-defter` iki TZ; `node test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs`, `node test/e2e/senaryo-degersiz-siniri-m2-251.mjs` iki TZ.
- Öbür türlerin ölçümü: `node docs/kanit/2026-11-28/m2t6-arac/olcum-turler.mjs <kök>` iki TZ.
