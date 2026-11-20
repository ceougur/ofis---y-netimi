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

## Kabul A / B / C sonra
- A kâhin-defter yeni: UTC 187/187, İstanbul 187/187 (fark yok; kâhin-defter senaryolarında Kartı Kapat yok gibi — değişmedi).
- B kâhin-cari yeni: UTC ve İstanbul 17.580/17.582 — yalnız tabandaki 2 BULGU (d50-c5-s206-s25c-b1-iptal-havale KI2 / KI3 toplam; Ç7b tur 3 S210 / S211 — kâhin bakımı bekliyor). Yeni fark YOK. Yapım listesi kendi yolunda (--yapim-asamasi-yaz): 2 kayıt — aynı iki BULGU (paket 'AYRIŞTIRILMADI'; elle etiketlenmedi). Depodaki liste DEĞİŞMEDİ.
- C sürücü: taban 7.580 geçti / 36 fail / 140 skip; yeni 7.568 / 58 / 140. 'Ç7b-(6)' bekleyeni KALKTI (taban 2 senaryo / 12 denetim → yok); KALKAN fark 0; YENİ 22 SINIFLANMADI — hepsi s40 / s60: (a) ADIM farkları (s40 adım 18, s60 adım 5 / 6: program 689 yazmıyor, sürücünün BUGÜN modeli C7b6-KAPAT hâlâ 2.4.9 kuralında — sürücü bakımı), (b) s60 raporları (mz / son / gt / g2): kâhinin `eski: true` TK2'si (2.5.0'dan önce kapatılmış kart) sürücüde güncel Kartı Kapat'a eşleniyor (program.mjs taksit_kapat 'programda AYNI yol') → program Borçta Kalsın, kâhin 689. Program davranışı D testinde (v2.4.9 gerçek kodu) eski kuralda. Sürücü bakımı: `eski` için göçün işaretini ('2.4.9') koymak + C7b6-KAPAT değişimini kaldırmak.

## Ekran senaryoları (ders 28; TZ İstanbul)
- senaryo-c7b-tur3-250 0, uiux-a-243 0, senaryo-c7b-kabul-250 0, senaryo-225-uyari 0 (ilk koşuda geçti).
- senaryo-226: ilk koşu 20/22 (G1 kilitli kapanışta Yeniden Aç — Borçta Kalsın kartı serbest) → eski kurallı kartla (göç işareti) BEKLENTİ BİLEREK DEĞİŞTİ → 22/22.
- run.mjs (test:e2e): ilk koşu 'taksitler (v2.0.4)' adımı (kapatınca şerit pili kalkmalı) → BEKLENTİ BİLEREK DEĞİŞTİ (kalan şeritte kalır, rozet sıfırlanır) → 50/50.

## Mutantlar (iki TZ; 7 dosya: c7b-tur3b-borcta-kalsin, c7b-tur3b-eski-surum, inceleme-226, accounts-stock, plans, banka-210-gg-cari, supheli-kuyruk-defter)
- YAKALANDI 13 / 14: M1 yeni kartı eski kuralla düş, M2 eski kartı yeni kuralla say, M3a genel defter, M3b cari defteri, M3c partyTotals, M3d şüpheli ayırıcısı (T6 ile), M3e Cari Listesi, M3f kapanış günü kilidi, M4 gecikme kalem vadesinden, M5 vade kapanış ertesi, M7 Yeniden Aç'ta işaret sıfırlanmaz, M8 göç işaretlemez, M9 zil kapalı kartı almaz.
- YAŞIYOR 1: M6 plans_close_rule_lock'u kaldır — EŞDEĞER: işaret plans_close_lock'un üyelik koşulunda (waivesSql) da var; '' ↔ '2.4.9' değişimi kilitli kartı o girdiye sokar / çıkarır → iz yine değişir (T4). Ek girdi fazlalık (2.5.1 sadeleştirme).
