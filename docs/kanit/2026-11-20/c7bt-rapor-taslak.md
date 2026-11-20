# Ç7b TAKSİT KÜÇÜK TURU (c7bt) — rapor taslağı

Taban: c7b3b-taban = b3a59f2a. İş: P7 (S219 = A) + S200 okuması. P6 → 2.5.1 (BAŞ MİMAR KARARI 20.11 11:25).

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
1. İki ayrı cari aynı ad + farklı telefon (cari önce); Excel'de ikisinin satırı — sıra C1→C2 ve C2→C1: her biri KENDİ carisine kart + borç (120) açmalı; çift kart yok.
2. Aynı Excel ikinci kez yüklenir: telefonlu satırlar aynı kişiyi bulur → yeni kart 0, yeni borç 0 (telefonsuz satırlar da).
3. Telefonsuz satır + aynı adlı TEK cari (telefonsuz, aynı grup) ve onun kartı → atlanır (aynı kişi); kartı yoksa ona bağlanır.
4. Telefonsuz satır + aynı adlı birden çok kişi / kart (biri telefonlu) → kişi kesin değil → atlanır, neden 'Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin'; kart / cari / borç AÇILMAZ (B'nin çift borç riski yok).
5. Telefonlu satır + aynı adlı TELEFONSUZ cari (kartlı): cari kuralı telefonsuz cariyi eşlemez (yeni cari açar) ama aynı kişi olabilir → kesin değil → atlanır (bugünkü gibi), çift borç yok — KULLANICIYA SORULACAK alt durum.
6. Carisiz eski kart (göçten kalma, account_id boş) aynı adla: kartın kendi telefonuyla karşılaştırılır (aynı → aynı kişi, atla; ikisi de 7+ hane ve farklı → başka kişi, aç; biri yok → kesin değil, atla).
7. Tablodaki kayda bağlı satır (linkRecords): kaydın carisi (case_key) kişiyi belirler; kaydın kartı varsa bugünkü 'Tablodaki kaydının taksit kartı zaten var'.
8. Aynı dosyada aynı kişi iki satır: ikinci satır atlanır (birinci satırın açtığı cari / kart aynı kişi).
9. Grup / alt grup: yinelenen kart denetimi bugünkü gibi aynı ad + aynı grup kartlarına bakar (başka gruptaki aynı adlı kart denetime girmez — bugünkü davranış); telefonsuz eşleşmede grup koşulu (cari kuralı) korunur.
10. Geri Al: yalnız bu yüklemenin açtığı cari / kartlar kalkar; önceden var olan aynı adlı carinin kartı / borcu kalır.
11. Kilitli dönem: kartın başlangıcı kapanmış dönemdeyse satır atlanır (neden kilit), yükleme durmaz; açılan cari geri alınır.
12. Büyük / küçük harf: 'AHMET YILMAZ' ↔ 'Ahmet Yılmaz' — SQLite NOCASE yalnız ASCII katlar (İ/ı katlanmaz); cari eşleştirmesiyle AYNI kural (tek yardımcı) — değişmez.
13. Kural iki yerde ayrı yazılırsa (plans ↔ accounts) ileride ayrışır → kişi çözümü accounts.mjs'teki TEK yardımcıdan (createFromPlan aynı yardımcıyı kullanır).

## 1. KOD (commit 3dbe2009)
- server/routes/accounts.mjs: kişi kuralı TEK yerde — samePerson (7+ hane telefon → aynı telefon; değilse telefonsuz + aynı grup), matchPerson onu kullanır; planPerson (yazmadan kişinin carisi: kayıt bağı → matchPerson, yabancı kayıt bağı) — createFromPlan aynı yardımcıyı kullanır (davranış aynı); planDuplicate(person, cards) → "same" / "unknown" / "".
- server/routes/plans.mjs (Excel import): aynı ad + aynı gruptaki açık kartlar (carili kartta carinin telefonu, carisiz kartta kartın telefonu) → planDuplicate; "same" → 'Aynı adla açık kart var'; "unknown" → 'Aynı adlı birden çok kişi var; telefonunu ekleyip yeniden yükleyin'.
- TARAMA: 'Aynı adla açık kart var' ve ad-yalnız kart sorgusu YALNIZ routes/plans.mjs import'ta (grep server/ client/). Ön izleme (plans/import/preview) yinelenen kart saymaz (yalnız başlık / şekil). Tablodan Aktar (routes/plan-transfer.mjs analyze) kendi kuralıyla telefonu karşılaştırır (bağsız kartı kayda bağlama; ad-yalnız değil) → değişmedi. Toplu Taksitlendir (açık kartı olan cari listeye gelmez) cari kimliğiyle çalışır → ad-yalnız değil.

## 2. TESTLER
- test/c7bt-ayni-adli-excel-karti-250.test.mjs (10 test). Yeni: UTC 10/10, Europe/Istanbul 10/10. Taban (c7b3b-taban): iki TZ 1/10 (9 kırmızı; nedenler okundu: (1)(5)(7)(9)(8) satır 'Aynı adla açık kart var' ile atlandı; (3)(4)(6) neden 'Aynı adla açık kart var' ≠ yeni neden; (10) kilit yerine 'Aynı adla açık kart var'). (2) tabanda YEŞİL — doğası gereği (eski kod her aynı adlı satırı atlar); dişi mutantlarla (M7).
- v2.4.9 gerçek kodu (git archive v2.4.9): aynı test iki TZ 1/10, aynı nedenler → bugünkü davranış 2.4.9'dan geliyor (gerileme değil).
- test/plans.test.mjs 'Excel'den ilk yükleme' beklentisi değişti: telefonsuz 'Ali Veli' (aynı grupta telefonlu Ali Veli'nin kartı var) → yeni neden (kişi kesin değil).
- G2 (27 Excel taksit / cari eşleştirme komşusu + plan-case-link, accounts-stock, cari-243, is-akisi): UTC 482/483 (tek kırmızı plans.test beklentisi — yukarıda).
- Mutantlar (7; her biri iki TZ, yeni test + plans.test): hepsi öldü (bkz. c7bt-mutant-sonuc.txt).
- G2 Europe/Istanbul (plans.test güncel): 483/483. plans.test UTC 12/12.

## 3. A — kâhin-defter
- Yeni 187/187, taban 187/187 (değişmedi).

## 4. G — EKRAN
- test/e2e/senaryo-c7bt-ayni-ad-250.mjs (yeni; CI listesine eklenecek): yeni 21/21; taban 15/21 (6 kırmızı, nedenleri: '1 kart oluşturuldu. 1 satır atlandı (Aynı adla açık kart var)', C2 kartsız / bakiye 0, 120 +3.000, telefonsuz satırın nedeni eski metin, listede 1 Ahmet Yılmaz kartı). Ekran görüntülerine bakıldı (Taksitler listesinde iki Ahmet Yılmaz kartı, telefonlarıyla; bildirimler).
- senaryo-219 (Excel yüklemeleri komşusu): 74/74.

## 5. B — kâhin-cari
- Yeni 17.580 / 17.582, taban 17.580 / 17.582 — AYNI iki fark (d50-c5-s206-s25c-b1-iptal-havale k1:kart:KI2 / KI3:toplam; program 30.000 / 0, kâhin 90.000) iki tarafta da → bu turun farkı DEĞİL (d50 bekleyen toplu kâhin bakımında, S210 / S211).
- Yapım aşaması kendi kopyada (KAHIN_YAPIM_ASAMASI): 2 kayıt, ikisi de yukarıdaki d50 farkı ('AYRIŞTIRILMADI' — üretici etiketi; paket Ç7b tur 3b / d50 bakımı, bu tur değil); depodaki liste BOŞ, değiştirilmedi. Bu turun yeni kaydı 0.
- E2E: senaryo-c7bt-ayni-ad-250 kanıtla 21/21; tabanda 15/21 (c7bt-e2e-ayni-ad-taban.log). Ekran görüntüleri c7bt-ekran/.

## 6. C — muhasebe sürücüsü (iki TZ; sürücü DEĞİŞTİRİLMEDİ)
- Taban: 7.580 / 7.756 geçti, 36 başarısız, 140 atlanan. Yeni: 7.594 / 7.760 geçti, 22 başarısız, 144 atlanan.
- KALKAN (16; hepsi s91, iki TZ): P7-AYNI-ADLI-EXCEL-KARTI (g1b gecikmiş C1, kt1 TE1 kartı, mz2 120 / 519 / cari C1, son 120 / 519 / cari C1) → program = kâhin.
- KALAN P6 (S44 / S79 bağ düzeltme yolu; s81, s82, s94, s103) AYNEN; başka sınıf değişmedi (sıralı fark listelerinin comm'u: yalnız tabanda 16 satır, yalnız yenide 2 satır).
- YENİ (2; yalnız TZ=UTC): s91 mz0 (01.01–09.03 mizanı) ana:120 program 3.200 · kâhin 1.200; ana:519 −3.200 · −1.200 → SINIFLANMADI. KÖK NEDEN (ders 6, okundu): TE1'in yükleme anı 2026-03-09T22:30:00Z — UTC sürecinde 09.03, İstanbul'da 10.03; program KG-5 maddesini sürecin yerel gününe (09.03), kâhin İstanbul gününe (10.03) yazar → aynı R-B5-YEREL-GUN-UTC farkı (sınıflamada yalnız mz1 için yazılı). Bugüne dek TE1'in kartı P7 yüzünden açılmadığı için mz0'da görünmüyordu. TZ=Europe/Istanbul koşusunda AYNI. Program hatası DEĞİL; sınıflamaya mz0 satırı eklenmesi ana oturumun (sürücü bakımı) işi.
- s51 (S120): taban ve yeni iki TZ AYNI 9 / 9 (U 0, P 0, K 0, R 0) — değişmedi.

## 7. F — değişmezler
- Rastgele sıra (test/mutabakat/kos.mjs --islem 400 --tohum 11 --tohumlar 2 --her 20): yeni 2/2, taban 2/2 — her doğrulamada Kasa / cari / stok / taksit / fatura / çek / ana defter tutarlı.
- Mutabakat Testi: yeni test (1)(5)(9) ve ekran senaryosu sonunda tutarlı; kâhin-defter 187/187.
