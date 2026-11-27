# M1 KÜÇÜK TUR 2 — KDV Özeti: karma ay (S-M1K-1 = A) — RAPOR (TASLAK)

Taban `t251-m1k` (52fb473f). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve defter DEĞİŞMEZ — yalnız Rapor Merkezi'nin KDV Özeti görünümü.

## 0. NASIL BOZULUR (koddan ÖNCE)
Kural (S-M1K-1 = A): mahsup fişinden sonra aynı ayda hem İndirilecek KDV azalmış hem satış KDV'si (391) değişmişse İndirilecek KDV FİŞTEN, 391 BUGÜNKÜ kayıtlardan;
her değişiklik bir kez sayılır. Önceki kararlar (S-DKM1-1 = A, S-M1-3 = C, S-M1-1 = B, S-M1-2 = B) DEĞİŞMEZ.
1. Aynı ayda alış iptali + satış eklenmesi (kararın örneği): Ocak fişi 500; Ocak alışı iptal + Ocak satış KDV 100; Şubat fişi 700 → Ocak 600, Ocak–Şubat 1.300 (= 391).
   Bozulma: Ocak 1.100 (bugünkü — taban), Ocak 500 (tümü fişten — 391 artışı kaybolur), Şubat'a azalma ikinci kez yazılır.
2. Satış silinmesi (391 AZALIR) + alış iptali aynı ayda: İ fişten, 391 bugünkü (azalmış) → ay sonucu fişten küçük; azalan 391 bir kez.
3. Yalnız 391 değişimi (İ aynı): S-M1-3 = C davranışı KALIR — sayılar bugünkü kayıtlardan, "mahsup fişi güncel değil" notu; zincirin taşıdığı devreden DEĞİŞMEZ.
4. Yalnız İ azalması: S-DKM1-1 = A davranışı KALIR (sonuç fişten, "bu ayın kayıtları fişten sonra değişti" notu).
5. Hiçbiri: fişin sayıları, not yok.
6. İ ARTMIŞ + 391 değişmiş: "Güncel Değil" (S-M1-3 = C) — bugünkü kayıtlar; karma kuralı UYGULANMAZ.
7. Devreden yönde (fiş "sonraki döneme devreden" yazmış) aynı karma: İ fişten, 391 bugünkü → devreden değişir; sonraki aya YENİ devreden taşınmalı (her değişiklik bir kez),
   sonraki ayın fişi eski devredenle kesildiyse "Zincirle Uyuşmayan Mahsup Fişi" notu; aralık toplamı = 391 − 191.
   Bozulma: sonraki aya fişin eski devredeni taşınırsa 391 değişimi aralık toplamında kaybolur; yön dönerse (devreden → ödenecek) yanlış satır.
8. Yıl dönümü: Aralık fişi + Aralık'ta karma; Ocak'ın S4 taşıması; Bu Yıl / 2026 yılı / Aralık–Ocak = 391 − 191.
9. İki şirket: 002'de karma 001'i etkilemez.
10. Aralık özetleri (tek ay, Ocak–Şubat, Ocak–Mart, Bu Yıl, Tüm Zamanlar) = 391 − 191 (karma ayı içeren her aralık); ay satırları = özet = tablo altı; ekran = PDF = Excel.
11. Not: karma ayda not ÇIKAR (güncel değil — ve sayıların nereden geldiği); karma ay ayrıca "azalan ay" notunda ikinci kez yazılmaz.
12. "Mahsup Edilmemiş Ay" 6 ay sınırı ve kopuk fiş (S4 emilim eşitliği, baş mimar kabulü) DEĞİŞMEZ.
13. A kipi (VAT_CARRY_MODE = "ledger") aynı settle kuralını kullanır — karma kuralı orada da (zincirsiz).
14. Ön izleme / fiş satırları: taban = yeni BİREBİR (iki TZ).
