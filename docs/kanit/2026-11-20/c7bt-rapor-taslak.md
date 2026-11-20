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
