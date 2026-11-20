# Ç7b tur 3b — rapor taslağı (adım adım; ajan kesilirse buradan sürdürülür)

Taban: c7b3b-taban = b3a59f2a. Görev metni: docs/devir/2.5.0-DEVAM/c7b3b-istem.txt. Not defteri: scratchpad/c7b3b-ag (taban = git archive; eskiwt = git worktree --detach c7b3b-taban — etiketli testler için).

## Adımlar
- [x] 0 TASARIM EKİ — docs/erp/C7B-FATURA-TASARIM.md §17 (commit 672ce2d6; S205 vadesi kod sürerken düzeltildi: vade = KAPANIŞ GÜNÜ, gecikmiş ertesi günden).
- [x] 1 GÖÇ 53 + işaret (plans.close_rule; '2.4.9' = eski kural), kilit izi plans_close_rule_lock + plans_close_lock yalnız eski kurallı kart.
- [x] 2 TEK YARDIMCI lib/accounts.mjs (waivesRemaining / waivedOf / waivesSql / closeDaySql / keptDueOf / keptDueSql); okuyucular bağlandı.
- [x] 3 S205 (kuyruk girdisi keptDueSql; kart görünümü / zil / Vade Takip kuyruğun vadesinden), onay penceresi metni.
- [x] 4 KILAVUZ + PDF (pdf-denetle 39/39; kılavuz testleri 17/17).
- [ ] 5 BİTİŞ kabul A–G + G2 + mutantlar.

## Yeni testler (iki TZ yeşil; tabanda beklenen nedenle kırmızı)
- test/c7b-tur3b-borcta-kalsin-250.test.mjs: 5/5 UTC + İstanbul. Tabanda 0/5: T1 "bakiye 600 kalır" 0 ≠ 600; T2 900 ≠ 0; T3 "yeni kart Borçta Kalsın" 0 ≠ 500; T4 Yeniden Aç 409 "kalan alacaktan vazgeçildi"; T5 "göç koştu" (göç 53 yok).
- test/c7b-tur3b-eski-surum-250.test.mjs (v2.4.9 gerçek kodu; etiketli — eskiwt'de koşuldu): 3/3 UTC + İstanbul. Tabanda 1/3: (2) göç işareti yok (bakiye / 689 / donmuş madde kısmı tabanda da yeşil — değişmeyen davranış), (3) "yeni Kartı Kapat: kalan borçta" b2 0 ≠ 900.

## Kabul A / B önce (taban, iki TZ)
- A kâhin-defter: UTC 187/187, İstanbul 187/187.
- B kâhin-cari: UTC ve İstanbul 17.579/17.582 — 2 BULGU (d50-c5-s206-s25c-b1-iptal-havale k1:kart:KI2:toplam program 300 · kâhin 900; KI3:toplam program 0 · kâhin 900 — S210 / S211 kâhin bakımı bekliyor, tabanda var) + yapım listesi okunamadı (benim koşu hatam: KAHIN_YAPIM_ASAMASI olmayan dosyayı gösterdi; sonra koşusunda depodaki liste kopyasıyla).

## G2 komşu (111 dosya; tarama deseni komsu.txt)
- UTC ilk koşu: 1.443 / 1.472, 29 başarısız (14 dosya) — hepsi kuralın bilerek değiştirdiği beklenti ya da eski kuralı anlatan sınama (göç 53 işaretiyle eski kurala alındı) ya da göç sayısı 52 → 53. Düzeltmeden sonra o 14 dosya 228/228.
