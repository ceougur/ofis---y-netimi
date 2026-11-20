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
