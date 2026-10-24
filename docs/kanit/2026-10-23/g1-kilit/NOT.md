# G1 — Silinenler'den geri yükleme dönem kilidini aşıyor (is/g1-kilit, taban aday10 247d6a7)

Kayıtlar (tools/kanit.mjs kos; ../g1-kilit-*.json/.log):
- g1-kilit-kirmizi-eski-247d6a7: yeni test ESKİ kodda (git worktree 247d6a7, ayrı kopya) 2/8 — nedenler iletide: geri yükleme 200 (beklenen 409),
  Mutabakat Testi period-lock "kapının görmediği bir yolla değişti", sonraki açık dönem geri yüklemesi 500 gate-equivalence (test kipi), üretim kipinde 200.
- g1-kilit-yesil: yeni kodda 8/8.
- g1-kilit-mutasyon: 5/5 mutasyon yakalandı (mutasyon.py; ayrı kopya 247d6a7 + yeni invoices.mjs).
- g1-kilit-komsular: 34 dosya 538/538. g1-kilit-e2e-senaryo-217: 65/65 (flock).

İkincil bulgu nitelemesi (ikincil.mjs; komut: `node ikincil.mjs <depo kökü>`, sahte saat 2026-10-08 12:00):
v2.4.3 (163dd5d) ve aday10 (247d6a7) AYNI sonucu verir (ikincil-v2.4.3-163dd5d.json = ikincil-aday10-247d6a7.json; süre alanları dışında alan alan aynı):
- üretim kipi (gateVerify kapalı): kilitli tarihli belge geri yüklenir (200) → Mutabakat Testi period-lock; süzgeç (scoped) yolundaki Kasa girişi, peşin satış,
  cari tahsilatı 200; tam kapıya giden işlem 409 ledger-integrity "İşlem geri alındı: … (Kapanmış dönem … değişemez) … yöneticinize bildirin."; dönem kilidi
  değişince (ya da yeniden başlatınca) kilit izi yeniden alınır, sapma sessizce kaybolur (sonraMutabakat []).
- test kipi (gateVerify açık; yalnız testler / bootVersion CURRENT): süzgeç yolundaki aynı işlemler 500 gate-equivalence.
- yeni kod (ikincil-yeni.json): geri yükleme 409 period-locked, bütün sonraki işlemler 200, Mutabakat Testi temiz, iki kipte de.
m30-yeniden-uret g1'in "2.4.3 → 200, 2.4.4 → 500" farkı sürüm değil KİP farkıdır (bootVersion yalnız CURRENT'e gateVerify verir).
