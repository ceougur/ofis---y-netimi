# Ç7b DK + S229 ALTIN birleşik küçük tur — rapor taslağı (adım adım)

Taban dkfix-taban = 94a7b475. Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dkfix-ab23 (eski kod kopyası `eski/` = git archive dkfix-taban, docs/kanit hariç).

## Adımlar
1. 3eaa73b8 — Tasarım §18 (koddan önce).
2. 03f30733 — S234 = A (plans.mjs shrinkPlan / trimCovers / growForInvoice + `shrinkable`; iptal yolu `closed: false`) + test/dkfix-s234-kapali-kart-250 (9 sınama).
   - Yeni kodda 9/9 (TZ İstanbul); tabanda 6 kırmızı (T1–T4, T7, T8: "kart tutarı 900 !== 600 / 300"), T5 / T6 / T9 iki kodda yeşil (değişmeyen davranışın bekçisi).
   - Önce / sonra sayılar (yoklama pk.mjs — pk-taban.txt / pk-yeni.txt): bakiye ve Mizan 120 her senaryoda aynı; gecikmiş T1 / T3 / T3b / T4 / T6 / T7 / T7b aynı;
     T2 kapanış günü 300 → 0 (09.10 aynı 600) — KULLANICIYA SORULMALI; T8 08.10 0 → 300, 09.10 600 → 900 — BULGU (kuyruk ↔ kapama defteri; tabanda açık iki kartta da aynı).
3. 91b08696 — S229 ALTIN: ownPayState (yalnız okuma), K1 yardımcısı, altın testte ANLIK DURUM S230 katlaması (1.840,97 TL), mutabakat motoru S234 = A.
   - altın test: taban kırmızı (3 fark: overview openSale / overdueSale −1.840,97; K1 iki sorun) → yeni yeşil 6/6.
   - motor testleri (mutabakat-cekirdek, fatura-model, mutabakat-yil-donumu) 8/8.
4. 7b091d40 — S235 = B istemci metni + ekran senaryosu senaryo-dkfix-250 (21/21 yeni; tabanda 4 kırmızı) + ekran görüntüleri dkfix-ekran/.
   - GÖZLEM / BULGU: kaydedilmiş taksitli faturanın Düzenle formu kalan ödemeyi 'Açık Hesap (Vadeli)' seçili açıyor; değiştirmeden Kaydet → taksit kartı kalkıyor (önceden var).
5. G2 komşu (54 dosya; liste not defteri g2-liste.txt) — TZ İstanbul: g2-ist-1 268/268, g2-ist-2 432/432 (0 atlanan). TZ UTC: sürüyor.
6. Mutasyon (mut.sh, mut/ kopyasında): M1 kapalıyı atla → 6 kırmızı; M2 ters (yalnız eski kurallı) → 7 kırmızı; M3 iptal yolunda kapalıyı da kırp → T6 kırmızı; M4 büyüme kapalıya yok → T4 / T7 kırmızı. Geri alındı (cmp).
