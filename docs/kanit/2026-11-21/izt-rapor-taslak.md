# İzleyen küçük tur — rapor taslağı (adım adım)

Taban izt-taban = 44a1762d. Not defteri /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt-a68.

1. 8bd8b5c8 — tasarım §19 (koddan önce) + taban yoklaması (izt-kos/taban.txt, iz.mjs).
2. a30ae465 — İş 1 + 4: kuyruk (lib/obligation-queue.mjs, lib/obligation-input.mjs). Yoklama: B2 kart 600/T600/K0, iade açığı 300; T8acik gecikmiş 0/0; T8sonra 0/600.
   Kuyruk komşuları 10 dosya 200/200 (UTC).
3. 128922e0 — İş 2: P-1 / S238 = A (plans.mjs cutPlan log + growForInvoice items; invoices.mjs retarget / restoreCuts / ownCard / cancel). B1 20.11 gecikmiş 300, taksitler aynı.
4. 24e40283 — İş 3 + 5: S234-c (editInvoice → shrinkCoversByEdit), BULGU-2 (payFrom mode; sunucu kartı korur).
5. 62988915 — İş 6: ledgerFor / settledFor önbelleği + paymentStates → obligationsOf. Ön bakış (akış): af655afd 43,4 / 53,5; taban 69,4 / 78,3; yeni 12,6 / 17,7 ms.
6. 66057ddf — sınama 15 test: yeni UTC 15/15, İstanbul 15/15; eski (44a1762d) UTC 4/15 (11 kırmızı beklenen nedenle).
7. (sürüyor) G2 komşu 170 dosya iki TZ; ekran senaryosu; kâhin; hız.
