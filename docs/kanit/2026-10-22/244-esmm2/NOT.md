# 2.4.4 iş listesi 22 — e-SMM gönderim kapıları (esmm2)

Kod: `server/routes/invoices.mjs` (sendKind / eProfileOf / sendsDoc; MISSING_CODES; referenceMismatch; draftFirst ve /e-draft koruması; /integrator/test
e-SMM; TURN_STOP integrator-reference), `client/assets/hof-invoices.js` (draftUploadFor, iptal penceresi ve tür notu), `server/lib/einvoice/edm.mjs`
(PACKAGE-FAIL iletisi). Test altyapısı: `test/esmm-mock.mjs` (sahte ESmmEDM.svc, gerçek e-SMM WSDL'i) `test/einvoice-mock.mjs`'e yol olarak bağlı.

| Kayıt | Ne | Sonuç |
|---|---|---|
| eski-7c36f87-esmm-gonderim | yeni rota testleri, taban (7c36f87, ayrı worktree; ders 23) | 4/19 geçti, 15 kırmızı — geçen 4'ü "bugünkü davranış" korumaları (N1 bayrak kapalı ×2, e-SMM kullanıcısı olmayan firma, N3 e-Arşiv); dişleri mutasyonla (M01, M16, M18, M19) |
| eski-7c36f87-goc-esmm | v2.4.0 ESMM + v2.4.3 kâğıt makbuz (gerçek eski kod) → güncel kod | taban kırmızı (2.4.0 makbuzu bayrak açıkken Gönderilecekler'de değil) |
| eski-7c36f87-e2e-gg244-esmm-gonder | ekran senaryosu, taban | kırmızı (beklenen) |
| yeni-esmm-gonderim | rota + göç + esmm-edm + esmm-gizli-241 | 41/41 |
| komsu-ebelge, komsu-fatura | bütün ebelge/einvoice/edm/edoc/esmm/gg243/goc-244 + fatura birim testleri | 386/386, 69/69 |
| kahin-ebelge-t1-3x150 | bağımsız e-Belge kâhini (e-Arşiv/e-Fatura; e-SMM yok) 3 tohum × 150 | fark 0, ihlal 0 (senaryolar klasörü 9/9) |
| mutasyon-M01…M21 (+M04a/b, M08a/b) | 23 mutasyon | 22 yakalandı; M02 (sendKind'da profil koşulu düşer) eşdeğer: serbest meslek makbuzunun profili yalnız KAGIT ya da ESMM olabilir (allowedProfiles/profileFor) ve her kapı ayrıca profil ≠ KAGIT ister |
| e2e-* | gg244-esmm-gonder (yeni) + senaryo-ebelge-242/243, gg243-tumunu-gonder, gg244-secilenleri-gonder, senaryo-entegrator-240 | ayrı kayıtlar |
