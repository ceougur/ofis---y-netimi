# 2.4.4 madde 23 — e-Arşiv / e-SMM iptal süresi (22.10.2026)

Kural: GİB İptal Kılavuzu V1.1 §3 (`kaynak/`, sha256 KAYNAK.md) + TBK 92 — süre ALICIYA İLETİM gününden, başlangıç günü sayılmaz, 8. gün dahil; süre dolunca
"yalnız programda iptal" de yok. Kod: `server/lib/einvoice/iptal-suresi.mjs` (tek yer), `server/routes/invoices.mjs` (iptal kapısı + kart alanları),
`client/assets/hof-invoices.js` ("Son İptal Günü").

Komutlar `node tools/kanit.mjs kos 244-iptal/<ad> -- …` ile (çıkış kodu + sayılar `<ad>.json`, ham çıktı `<ad>.log`).

- `yeni-yesil`, `yeni-yesil-tz-istanbul`: test/ebelge-244-iptal-suresi.test.mjs + test/goc-244-iptal-suresi.test.mjs (UTC ve TZ=Europe/Istanbul).
- `eski-163dd5d-kirmizi`: aynı testlerin API kısmı 163dd5d'nin AYRI kopyasında (git archive; ders 23) — hepsi kırmızı (yeni alanlar yok).
- `eski-163dd5d-davranis-kirmizi` / `yeni-davranis-yesil`: yeni alan denetimleri ÇIKARILMIŞ "davranış çeşidi" (`betikler/davranis-cesidi.test.mjs.txt`):
  eski kodda yalnız davranış farkı olan testler kırmızı (kesimden sayım, localOnly'nin süreyi atlaması, Hata/bulunamadı sonrası yeniden gönderim, e-SMM).
- `mutasyon-P1…P14` + `mutasyon-ozet.txt`: `node docs/kanit/2026-10-22/244-iptal/betikler/mutasyon.mjs docs/kanit/2026-10-22/244-iptal/betikler/mutasyon.json mutasyon`
  (TZ=Europe/Istanbul) — her mutasyon en az bir testi kırmızı yapmalı; dosyalar her mutasyondan sonra geri yazılır ve özeti denetlenir.
- test/goc-244-iptal-suresi.test.mjs (yeni-yesil içinde): v2.4.3 etiketinin GERÇEK koduyla gönderilen e-Arşiv veri dosyası güncel kodla açılır (ders 17);
  geri dönüşte v2.4.3 aynı belgeyi kesimden sayıp reddeder.
- `ebelge-ilgili`: e-Belge / fatura / iade / kaynak tarayan ilgili 54 test dosyası (479/479).
- `e2e-senaryo-ebelge-243`, `e2e-senaryo-ebelge-242`, `e2e-senaryo-entegrator-240`: komşu arayüz senaryoları (Chromium, flock).
- KÂHİN: bu işte kâhin YOK (ders 5: kodu yazan el kâhin yazmaz). Kâhin, `kaynak/KAYNAK.md`'deki kuraldan ayrı bir ajan tarafından yazılır.
- `ekran/`: `betikler/ekran.mjs` (Chromium, sahte EDM + sahte saat) — 5. gün "Son İptal Günü 28.06.2026 (alıcıya iletildiği 20.06.2026 gününden sonraki 8 gün)",
  12. gün "İptal Et kapalı: e-Arşiv faturanın iptal süresi doldu: …" + pasif düğme.

## Ek (kullanıcı kararı 22.10.2026, "önerin uygun"): sonucu belirsiz gönderimde "Yalnız Programda İptal"
Son gönderim girişiminden 8 gün geçtiyse önce EDM durum sorgusu: "bulunamadı" (11017; yalnız e-Arşiv) → iptal serbest; belge EDM'de var → durum belgeye
yazılır, iptal reddedilir (iletilmişse süre doldu, `einvoice-cancel-late`; değilse `einvoice-found`); EDM'ye ulaşılamaz → 502 `einvoice-cancel-unreachable`;
e-SMM'de her hata (11017 dahil) bilinmiyor → 409 `einvoice-cancel-unknown`. 8 gün dolmadıysa sorulmaz (bugünkü yol).
- `belirsiz-eski-6bde995-kirmizi`: 6bde995 ayrı kopyasında 25 testin 6'sı kırmızı (yeni 8 testin "8 gün dolmadıysa" ikisi eski kodda da yeşil — bilerek).
- `belirsiz-yeni-yesil`, `belirsiz-yeni-yesil-tz-istanbul`: 26/26. `mutasyon-belirsiz-Q1…Q7` + `mutasyon-belirsiz-ozet.txt` (`betikler/mutasyon-belirsiz.json`): 7/7.
- `belirsiz-ebelge-ilgili`, `belirsiz-e2e-senaryo-ebelge-243`, `-242`, `-entegrator-240`.
