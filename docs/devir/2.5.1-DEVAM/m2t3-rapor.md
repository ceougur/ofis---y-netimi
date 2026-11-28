# M2 TUR 3 — Değersiz Alacak sınırı: S-M2T2-1 = A + S-M2T2-2 = A (2.5.1; RAPOR)

Taban: `t251-m2t2` (bf7e7d21). Dal: `worktree-agent-ae39a10810940388a`, dal ucu: bu raporun commit'i (bir önceki 363a7c87). Görev metni: `docs/devir/2.5.1-DEVAM/m2t3-istem.txt`.
Ortam (son okuma): yük 5,25 / 4 çekirdek (başka ajanların koşuları; koşular boyunca 3,5–8), bellek kullanılabilir 9 GB (boş 2 GB), disk boş 6,1 GB.

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
1. **Fatura → İptal Et** (ve aynı yolu çağıran Sil, e-Belge iptali, Banka'dan Ters Kaydet): Değersiz Alacak satırı olan caride, cari Değersiz OLMADAN da eksi kalacaksa. Örnek (karar metnindeki AYNEN):
   taban T + Değersiz 3.000 @17.09 (423,55) + 05.10 avans 3.000 → bakiye −2.576,45; fatura 2.900 iptali.
   - Önce: 200, fatura iptal edildi, bakiye −5.476,45 (Değersiz 3.000 defterde kaldı).
   - Sonra: 409 `doubtful-writeoff-balance`, iptal penceresi açık kalır, fatura "Kaydedildi", bakiye **−2.576,45** kalır. İleti: "Fatura iptal edilemez: bu caride 17.09.2026 tarihli 3.000,00 TL
     Değersiz Alacak satırı var; iptalden sonra cari 5.476,45 TL alacaklı (eksi bakiye) olurdu. Değersiz Alacak satırı olan caride iptal cariyi alacaklıya (eksi bakiyeye) götüremez; Değersiz Alacak
     satırı olmasaydı da cari 2.476,45 TL alacaklı olurdu — bu fatura olmasaydı o kayda Değersiz Alacak yazılamazdı. Ne yapmalı: önce Değersiz Alacak satırını silin (cari kartı → Şüpheli Alacak →
     kaydın Değersiz satırındaki × düğmesi), sonra faturayı iptal edin; gerekirse Değersiz Alacak'ı yeniden yazın (form yazılabilecek tutarı gösterir). Hiçbir şey kaydedilmedi."
     (ekran: docs/kanit/2026-11-28/m2t3-ekran/*-m2t3-3-avansli-iptal-reddi.png)
   - "Ne yapmalı" işe yarıyor: Değersiz satırı silinince (bakiye 423,55) aynı iptal kabul, bakiye −2.476,45, Mutabakat tamam.
2. **Satıştan İade** (yeni ve Düzenle'si) aynı durumda: önce 200 (−5.476,45); sonra 409 "İade faturası kaydedilemez: … iadeden sonra cari 5.476,45 TL alacaklı … Değersiz Alacak satırı olmasaydı da cari
   2.476,45 TL alacaklı olurdu — bu iadeyle o kayda Değersiz Alacak yazılamazdı …"; bakiye −2.576,45.
3. **Fatura → Düzenle** ile TUTAR düşürme (satış faturası, SMM, alıştan iade — cariye borç yazan belgeler) Değersiz satırı olan caride cariyi eksiye götürüyorsa. Örnek (AYNEN): taban T + Değersiz 3.000
   (423,55), fatura 2.900 → 100.
   - Önce: 200, fatura 100, bakiye −2.376,45.
   - Sonra: "Değişiklikler Kaydedilsin mi?" onayından sonra 409, form açık kalır, fatura 2.900, bakiye **423,55**. İleti: "Fatura düzenlenemez: bu caride 17.09.2026 tarihli 3.000,00 TL Değersiz Alacak
     satırı var; düzenlemeden sonra cari 2.376,45 TL alacaklı (eksi bakiye) olurdu. Değersiz Alacak yazımı cariyi alacaklıya düşüremez — bu düzenlemeyle o kayda Değersiz Alacak yazılamazdı. Ne yapmalı:
     önce Değersiz Alacak satırını silin (…), sonra faturayı düzenleyin; …" (ekran: m2t3-ekran/*-m2t3-4-duzenle-reddi.png)
   - Düzenle'de cari değiştirilirse (borç eski cariden çıkar) eski cari aynı denetimden geçer: örnek T + Değersiz + avans 1.000 + bağsız ikinci fatura 800 → 223,55; ikinci fatura öbür cariye → 409
     ("düzenlemeden sonra cari 576,45 TL alacaklı"), eski cari 223,55 kalır.
4. DEĞİŞMEYEN (bilerek): tutar ARTIŞI (2.900 → 3.000: kabul, 523,55); eksiye götürmeyen azalış (ek borçlu caride 2.900 → 2.000: kabul, 1.523,55); tutarı aynı Düzenle'de peşin tahsilat eklenmesi —
   cari eksiye gitse de kabul (−576,45; tahsilattır, sıradan tahsilat da Değersiz'den sonra reddedilmiyor); bakiyeyi DÜŞÜRMEYEN işlem eksi caride de kabul (iadenin küçültülmesi −2.026,45 → −1.301,45);
   Değersiz satırı OLMAYAN avanslı caride iptal kabul (denetim hiçbir şey okumaz); kilitli dönemde dönem kilidi iletisi önce gelir (`period-locked` iptalde, `invoice-locked` Düzenle'de).
5. Tur 2'nin "Değersiz yüzünden" iletisi (eksiye Değersiz yüzünden düşen iptal / iade, ör. "en çok 123,55") AYNEN; "Değersiz olmadan da eksi" durumunda neden cümlesi yukarıdaki gibi değişir.

## DEĞİŞEN DOSYALAR
- `server/lib/bank/doubtful.mjs` — writeOffBalanceGuard: ret koşulundan "bakiye + Σ Değersiz ≥ 0" kalktı (S-M2T2-1 = A); "edit" eylemi (ileti sözcükleri); neden cümlesi iki duruma göre. Hız yolu
  (liste / form ucu / sınır hesabı) DOKUNULMADI.
- `server/routes/invoices.mjs` — editInvoice'ta YALNIZ denetimin çağrısı: iadenin Düzenle'si (tur 2, aynen) + borç yönlü belgenin tutarı düştüğünde ya da cari değiştiğinde (`decrease > 0,005`)
  `action: "edit"`; çağrı yazımlardan ÖNCEYE (azalış hesabının hemen arkasına) alındı, denetim yazımlardan sonra (tur 2'nin aynı yeri).
- `test/supheli-degersiz-m2t3-251.test.mjs` (YENİ, 11 test), `test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs` (tur 2'nin B'yi belgeleyen testi A'ya döndü), `test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs`
  (iki adım: 3 avanslı iptal reddi, 4 Düzenle ile tutar düşürme reddi).
- Kanıt `docs/kanit/2026-11-28/m2t3-*`; rapor bu dosya.
- Dokunulmadı: tek borç sırası ve girdisi, defter rotası, şüpheli defter türetmesi, göçler, client, kapı iletileri (integrity.mjs — gerek olmadı), package.json, tools, .github, kılavuz.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı — commit 56a06efb)
Eksenler: işlem (iptal / silme / e-Belge iptali / Ters Kaydet iptali — aynı iptal yolu; yeni satıştan iade; iadenin Düzenle'si; satış faturası / SMM / alıştan iade TUTARININ Düzenle ile düşürülmesi;
faturanın cari değiştirmesi) × sonuç (eksi değil / yalnız Değersiz yüzünden eksi / Değersiz olmadan da eksi / zaten eksiydi, daha da eksi).
1. S-M2T2-1: (a) bakiyeyi DÜŞÜRMEYEN işlem ret almamalı; (b) ileti "Değersiz yüzünden" diye yanlış anlatabilir; "en çok" 0 → "yazılamazdı"; (c) Değersiz satırı olmayan caride iptal yine kabul;
   (d) Değersiz satırı silindikten sonra aynı iptal kabul.
2. S-M2T2-2: (a) tutar artışı / tutarı değişmeyen Düzenle ret almamalı; (b) aynı Düzenle'de peşin tahsilat eklenmesi tutar düşürmesi değildir; (c) cari değiştirme — eski cari denetlenir; (d) taksitli
   fatura Düzenle'si aynı yol; (e) iadenin Düzenle'si zaten denetimli — çakışmamalı; (f) ileti "düzenleme" demeli.
3. Birden çok Değersiz satırı (son satır + toplam). 4. Kilitli dönem (kilit iletisi önce). 5. İki saat dilimi. 6. Hız yolu dokunulmaz. 7. Bağlı çekin karşılıksız çıkması bakiyeyi YÜKSELTİR — dokunulmaz.
Uygulanan: 1a–d, 2a/b/c/e/f, 3, 4, 5, 6 (test), 7 (yalnız rapor). 2d (taksitli fatura) DENENMEDİ.

## TARAMA (ders 10 — komşular; `git grep`)
| Tarama | Dosya | Sonuç (UTC / Europe/Istanbul) |
|---|---|---|
| tur 2'nin 80 dosyası (şüpheli / Değersiz / write-off; /cancel, sale_return seçilmişleri; kapı, şema kapısı, geri yükleme) | 80 | birleşik koşuda |
| fatura Düzenle yolu: `git grep -l 'invoices/\${…}/edit\|/edit`' + `'editInvoice\|"/edit"\|/edit"'` (test/*.test.mjs) | 56 (13'ü ortak) | birleşik koşuda |
| BİRLEŞİK (yeni / değişen iki dosya hariç) | **123** | **1572 / 1572** · **1572 / 1572** (m2t3-komsular-*) |
| ekran: senaryo-degersiz-iptal-m2t2-251 | 1 | 26 / 26 · 26 / 26 |
| ekran: senaryo-degersiz-siniri-m2-251 | 1 | 24 / 24 · 24 / 24 |
| `npm run test:kahin-cari` (kodu okunmadı) | — | 25.957 / 25.957 (0 fark) |
| `npm run test:kahin-defter` | — | 187 / 187 |
Liste: docs/kanit/2026-11-28/m2t3-arac/komsu-liste.txt (üretici komsu-liste.py, tarama komsu-duzenle.txt).

## YENİ / DEĞİŞEN TESTLER — taban (t251-m2t2, ayrı kopya; yalnız yeni / değişen test dosyaları) kırmızısı NEDENİYLE / yeni yeşili
| Test | Taban (UTC ve İstanbul aynı) | Yeni (UTC / İst.) |
|---|---|---|
| (değişen, tur 2 dosyası) avanslı iptal 409, −2.576,45 kalır | KIRMIZI: 200 ≠ 409 (fatura "cancelled") — tur 2 B davranışı | yeşil / yeşil |
| avanslı tam iade 409 "İade faturası kaydedilemez" | KIRMIZI: 200 ≠ 409 (iade "issued") | yeşil / yeşil |
| iki Değersiz satırı, avanslı iptal 409 + toplam metni | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| Düzenle 2.900 → 100 → 409 "Fatura düzenlenemez", 423,55 | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| avanslı Düzenle 2.900 → 2.800 → 409 | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| Düzenle'de cari değişir → eski cari 409 | KIRMIZI: 200 ≠ 409 | yeşil / yeşil |
| Değersiz silinince iptal kabul (−2.476,45) | yeşil (koruma testi — davranış değişmedi) | yeşil / yeşil |
| Değersiz'siz avanslı iptal kabul | yeşil (koruma) | yeşil / yeşil |
| bakiyeyi düşürmeyen iade küçültme kabul | yeşil (koruma; dişi M14) | yeşil / yeşil |
| kilitli dönem: kilit iletisi önce | yeşil (koruma) | yeşil / yeşil |
| tutar artışı + artıda kalan azalış kabul | yeşil (koruma) | yeşil / yeşil |
| tutarı aynı Düzenle + peşin tahsilat → −576,45 kabul | yeşil (koruma; dişi M12) | yeşil / yeşil |
| tur 2'nin öbür 7 testi | yeşil | yeşil / yeşil |
| e2e senaryo-degersiz-iptal-m2t2-251 | 16 / 26 — KIRMIZI 10: adım 3 ileti yok, fatura iptal edildi, bakiye −5.476,45; adım 4 ileti yok, form kapandı, fatura 100, bakiye −2.376,45 | 26 / 26 · 26 / 26 |
Sayılar: yeni + değişen + tur 2 hız dosyası 27 / 27 UTC ve 27 / 27 İstanbul (m2t3-son-yeni-testler-*); taban 13 / 19 iki TZ (6 kırmızı, hepsi "200 ≠ 409" — beklenen neden; m2t3-eski-yeni-testler-*).
Ekran senaryosu adım 4'te ürünün "Değişiklikler Kaydedilsin mi?" onayı BEKLENEN soru olarak denetlenip Evet denir (ders 34); başka soru çıkmadığı ayrıca denetlenir.

## KABUL
- A ✓ — 6 davranış testi + e2e iki adımı tabanda beklenen nedenle kırmızı, yenide yeşil, iki TZ (yukarıda).
- B ✓ — mutantlar (aşağıda): uygulanabilen 17'den 16'sı yakalandı; M8 tur 2'deki gibi yaşadı (bu turun koduna dokunmuyor); M9 UYGULANAMADI (kod artık o mutantın kendisi — tersi M10 yakalandı).
- C ✓ — komşular 1572 / 1572 iki TZ (123 dosya), iki ekran senaryosu iki TZ yeşil, kâhin cari 25.957 / 25.957, defter 187 / 187.
- D ✓ — hız yoluna dokunulmadı (diff: yalnız writeOffBalanceGuard + editInvoice çağrısı); tur 2'nin hız / eşdeğerlik dosyası (test/supheli-degersiz-hiz-m2t2-251.test.mjs) 8 / 8 iki TZ AYNEN.

## MUTANTLAR (docs/kanit/2026-11-28/m2t3-mutant/ozet.txt; kopya /dev/shm, test: hız + tur 2 iptal / iade + M2 sınırı + tur 3)
| Mutant | Sonuç |
|---|---|
| M1 aday günler geri · M2 iade denetimi yok · M2b iade Düzenle denetimi yok (artık satış Düzenle'sini de kırar) · M2c iptal denetimi yok · M3 değişmez (i) fatura iptali koşulu yok · M4 silme iletisi eski · M4b kapı iletisi genel · M5 sonra gelen Değersiz denemesi yok · M6 S155 üst sınırı kesin · M7 budama eşitlik koşulu yok | YAKALANDI (10) |
| M8 önceki gün kesiti aynı günü de alır | YAŞADI (tur 2'deki gibi; bu tur dokunmadı) |
| M9 denetim Değersiz olmadan da eksiyi reddeder (tur 2) | UYGULANAMADI (0 adet — artık kodun kendisi) |
| M10 eksi kontrolü yalnız Değersiz kaynaklıya döner (görev metni) | YAKALANDI (3 test) |
| M11 tutar düşürme denetimi kalkar (görev metni) | YAKALANDI (3 test) |
| M12 Düzenle denetimi tutar düşmese de çalışır | YAKALANDI (peşin tahsilat testi) |
| M13 neden cümlesi hep "Değersiz yüzünden" | YAKALANDI (3 test) |
| M14 "işlem bakiyeyi düşürdü" koşulu kalkar | YAKALANDI (iade küçültme testi) |
| M15 Düzenle iletisi "iade" diye anlatır | YAKALANDI (3 test) |

## HIZ
Hız yoluna dokunulmadı; ölçüm yapılmadı. Yeni denetim yalnız Değersiz satırı olan caride, yalnız iptal / iade / tutarı düşen Düzenle'de çalışır (tur 2'nin aynı işi: iki bakiye okuması + ret anında bir
sınır hesabı). Tutarı düşmeyen Düzenle'de hiçbir şey okunmaz.

## KULLANICIYA SORULMALI
YOK — iki kararın da uygulanmasında yeni para / kapama ayrışması çıkmadı. Bilgi (soru değil, baş mimar değerlendirsin): Düzenle denetimini YALNIZ tutar düştüğünde (ya da cari değiştiğinde) çalıştırdım;
aynı Düzenle'de peşin tahsilat EKLENİRSE ve cari eksiye giderse kabul ediliyor (cari kartından aynı tahsilatı yazmak da Değersiz'den sonra reddedilmiyor — tutarlılık). Tutar düşmesi + peşin tahsilat
AYNI Düzenle'deyse denetim toplam bakiyeye bakar (tahsilatın payı da sayılır) — uç durum, DOĞRULANMADI.

## BAŞ MİMAR KARARI GEREKİYOR
- YOK (kapsam içinde). Not: denetim borç yönlü bütün belgelerde (satış, SMM, alıştan iade) tutar düşürmede çalışır — karar "fatura TUTARI" diyor; alıştan iade ve SMM aynı kök (cariye yazılan borç
  azalır) diye dahil edildi. Daraltmak isterse tek koşul (`INVOICE_KINDS[...].party === "debt"` → yalnız sale).

## SONRAKİ SÜRÜME (20.11 kuralı)
- Ekran senaryosunda önceki adımın bildirimi (silme reddi) sonraki adımların görüntüsünde üstte kalıyor (bildirim kalıcı; görünüm, sayılar doğru).
- Bağlı çekin karşılıksız çıkması (tur 2 P9b): bakiyeyi YÜKSELTİR — aynı kök değil, dokunulmadı.
- Alış faturası yolu (tur 2 P9d, dar kontrol / B): alış faturasının eklenmesi ya da tutarının ARTIRILMASI da bakiyeyi düşürür; bu turda denetlenmiyor (karar kapsamı dışı).

## DOĞRULANMADI
- Düzenle 2.900 → 100 iletisindeki "yazılamazdı" (0): programın sınır işlevinden (tur 2 BAŞ MİMAR KARARI (1) çizgisi). Elle iki okuma: yalnız Düzenle azalışı sonradan gelen bağsız alacak sayılırsa
  3.000 − 2.800 = 200; faturayı aşan bağlı tahsilat payı (2.876,45 − 100) da bağsız sayılırsa 0 → program 0 diyor. Ret kararı iki okumada AYNI; yalnız iletideki sayı.
- Tutar düşmesi ile peşin tahsilat eklenmesi aynı Düzenle'de (yukarıda).
- M8'in eşdeğer olup olmadığı (tur 2'den).

## DENENMEYEN
- Taksitli faturanın tutarını Düzenle ile düşürme (kart yeniden kurulur; aynı çağrı yolu); SMM ve alıştan iade Düzenle'si (kod yolu aynı koşul); e-Belge gönderilmiş faturanın Düzenle'si.
- Windows (CI'de okunur); iki şirket; ekrandan Satıştan İade reddi (tur 2'nin API testi + bu turun API testi var; ekran adımı yalnız iptal ve Düzenle).
- Değersiz satırı olmayan caride Düzenle 2.900 → 100: yoklamada başka (var olan) kural reddediyor — `ledger-integrity` "Bu kayıt carinin borcunu açık şüpheli tutarın altına düşürür …" (değişmedi; bilgi).

## BİLİNEN SINIRLAR
- Tur 2'den: değişmez (i) gevşemesi; sonra gelen Değersiz satırlı caride soğuk ilk çağrı (zincir kararı).
- Düzenle denetimi tutarı düşmeyen Düzenle'de çalışmaz (bilerek; peşin tahsilat).

## CI LİSTESİNE EKLENECEK
`test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` (tur 2'den bekliyor; bu tur iki adım ekledi — CI e2e + yayın listesi). Node testleri `test/*.test.mjs` deseniyle zaten koşar.

## KILAVUZ ÖNERİSİ ("nasıl yapılır")
"Değersiz Alacak yazılmış bir carinin faturasını iptal etmek, iadesini almak ya da tutarını düşürmek cariyi alacaklıya (eksi bakiyeye) götürecekse program izin vermez — cari zaten alacaklı olsa da.
Önce cari kartında Şüpheli Alacak bölümünde kaydın Değersiz satırındaki × ile Değersiz Alacak satırını silin, sonra işlemi yapın; alacak hâlâ tahsil edilemiyorsa Değersiz Alacak'ı yeniden yazın — form
yazılabilecek en çok tutarı gösterir."

## COMMİTLER (t251-m2t2..dal ucu)
56a06efb nasıl bozulur · 8019632d S-M2T2-1 = A + S-M2T2-2 = A + testler · 90c9ed94 ekran senaryosuna iki adım · 010feab6 bakiyeyi düşürmeyen işlem testi · 363a7c87 Kanıt · (son) rapor.
Model adı commit'lerde / kodda 0.

## ANA OTURUMUN YENİDEN KOŞACAKLARI
- TZ=UTC ve TZ=Europe/Istanbul: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos m2t3-rk -- node --test test/supheli-degersiz-m2t3-251.test.mjs test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs test/supheli-degersiz-hiz-m2t2-251.test.mjs`
  (27 / 27). Taban: `git worktree add --detach <yol> t251-m2t2` + yalnız `test/supheli-degersiz-m2t3-251.test.mjs`, `test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs` (ilk iki dosya: 13 / 19, 6 × "200 ≠ 409").
- Ekran (PLAYWRIGHT_BROWSERS_PATH=…/pw-1194): `node test/e2e/senaryo-degersiz-iptal-m2t2-251.mjs` (26 / 26; tabanda 16 / 26) ve `node test/e2e/senaryo-degersiz-siniri-m2-251.mjs` (24 / 24).
- Mutasyon: `python3 -I docs/kanit/2026-11-28/m2t3-arac/mutant.py` (kopya yolu `/dev/shm/m2t3-ae39/mut` betikte — HEAD'in worktree kopyası + node_modules bağı).
- Komşular: `docs/kanit/2026-11-28/m2t3-arac/komsu.sh` (liste komsu-liste.txt, 123 dosya); `npm run test:kahin-cari`, `npm run test:kahin-defter`.
- Yoklama: `ROOT=<kod> node docs/kanit/2026-11-28/m2t3-arac/q1-yoklama.mjs` (Q1–Q9; yeni kod çıktısı m2t3-arac/q1-yeni.txt).
- Cari kâhini bakımı 34 için beklenen fark: Değersiz satırı olan caride bakiyeyi DÜŞÜRÜP eksiye götüren iptal / iade / iade Düzenle'si / borç yönlü belgenin tutarını düşüren ya da carisini değiştiren
  Düzenle → RET (`doubtful-writeoff-balance`), "Değersiz olmadan da eksi" dahil; bugünkü kâhin senaryolarında bu sınıf yok (0 fark ölçüldü).
