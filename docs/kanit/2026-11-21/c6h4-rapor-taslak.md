# Ç6-HESAP tur 4 — rapor taslağı (ajan; SON hâli — rapor SubagentHandback ile verildi)

Taban 5ee4d99e. Dal: worktree-agent-adeefec4f86e1240e. Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag
Ham çıktılar: docs/kanit/2026-11-21/c6h4-ham/ · betikler: docs/kanit/2026-11-21/c6h4-betik/

## Commit'ler
24c1563e tasarım (C6 §11, §7 düzeltmesi; C3 §21) · b0a73c5b ORTA-1 · 9fbf911b ORTA-2 · a1226bc6 S236 = A (göç 54) · 3a17196b üç testin göç numarası 53 → 54 (BAŞ MİMAR KARARI
GEREKİYOR) · 3293c1b1 testlerin kırmızı düzeni · 78fc025c tablo adı ledger_valuation_cards · (Kanıt commit'i)

## Sonuçlar
- Yeni testler (c6h-alt-hesap-farki 3, c6h-kural-farki-fis 10, c6h-degerleme-dondurma 2): yeni kodda 15/15 iki TZ (komşu yığınının içinde); eski kodda 15/15 KIRMIZI iki TZ, nedenler
  beklenen (neden yok / neden düşmedi / kilitli 2025 −80000 / KALAN yerine ham satırlar / ters kayıt arası neden var; dört eşdeğerlik sınaması "işlev yok" — dişi m2 / m3 / m5).
- Komşu yığını (140 dosya; komsu.txt): UTC 1414/1414, İstanbul 1414/1414.
- Mutantlar 8/8 yakalandı, iki TZ (m1 7 · m2 10 · m3 6 · m4 1 · m5 6 · m6 2 · m7 2 · m8 1 kırmızı).
- Kâhinler önce = sonra: defter 187/187 (iki TZ), cari 17648/17648 (iki TZ; 7 bilinen sınır), maliyet 41306/41306, tutar 3559/3559, muhasebe modeli 0 başarısız.
- Hız (temiz 100 bin, özel kilit, dönüşümlü 8 koşu): kilitsiz yanıt özetleri eski = yeni (her istek), süre denk; kilitli yanıt sayıları aynı, özet farkı yalnız neden satırları
  (fark-100k.out: neden dışı 12/12 AYNI); kilitli süreler gürültü içinde; dondurma koşusu eski 8.935 / 10.175 ↔ yeni 9.617 / 9.337 ms.
- KÖTÜ: fişten SONRA Gelir Tablosu yıl 2026 (fiş dönemin içinde) eski en iyi 3.204 / 3.202 · ortanca 3.361 / 3.264 ↔ yeni 4.690 / 4.573 · 4.818 / 4.781 ms (+%43–47). Parça
  (parca.out): kapsamın tamamının frozenSums'ü 1.191–1.305 ms + tam periodRuleDiff 156–209 + expected 72 ms. KOD DEĞİŞTİRİLMEDİ → BAŞ MİMAR KARARI GEREKİYOR.
