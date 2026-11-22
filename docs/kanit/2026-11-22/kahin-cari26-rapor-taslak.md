# Cari kâhini bakımı 26 — rapor (ajan agent-aba92b2d7bf349903; taban izt2-sinama = 3b420085; dal worktree-agent-aba92b2d7bf349903)

Ayrıntı: `test/bagimsiz/cari/KARARLAR.md` §38. Ham çıktılar: `docs/kanit/2026-11-22/kahin-cari26-kanit/`. Araçlar: `docs/kanit/2026-11-22/kahin-cari26-arac/`.

## Özet
- S246 = B / S235 = B: taksitli faturanın kendi kartı Düzenle ile artırılınca Düzenle'nin planıyla yeni tutarla yeniden kurulur; kapanmış (tahsilatsız) kart AÇIK kurulur. S242 = A yalnız Mevcut Borç kartında.
- §2 (kendi kartında azaltma): ödemeli ve kapanmış kollar SUS (SK-48); açık tahsilatsız kol §36 KAPSAM (b) + (e) ile değer (program farklı okuyor → P-1).
- S243 = A: SK-45 SUS kalktı — kart en eski faturayı taşır.
- S244 / S245 = C: SUS aynen (neden metninde karar numarası); S245 genişletildi (art arda Düzenle, yeniden kurulan karta iade — kart göstergeleri de SUS). S247 / S248: dilde yok.
- Yeni SUS: SK-49 (UÇ — kapanmış + ödemeli / iadeli faturada artırma), SK-50 (UÇ — iadesi olan faturanın Düzenle'si; program koşusundan sonra eklendi).

## Sayılar
- oz-test 8.642/8.642 (UTC, İstanbul) · G3 660/660 BEKLENMEYEN 0 · elle fark 111/111 · yeni elle 770/770 · eski kâhinde 102/770 kırmızı.
- Program ↔ kâhin: eski listeyle 24.349/24.354 (4 KAPANDI + P-1), yeni listeyle (0 kayıt) 24.353/24.354 (P-1) — iki TZ aynı; 0 yakalanmayan mutasyon. Program ↔ eski kâhin 1.436/1.459.
- Yapım aşaması listesi 4 → 0.
