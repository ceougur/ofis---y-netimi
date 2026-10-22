# 244-mm-smm — mutasyon testi (para çekirdeği: stopaj yuvarlama kuralı, MM4 alt kararı engeli, makbuz PDF'i)

Kopya: not defteri `mm-smm/mm-smm-mutasyon` (çalışma ağacının server/client/test/tools kopyası, d602695 sonrası; çalışma ağacına mutasyon girmedi). Her mutasyon tek
değişiklik, koşu sonrası dosya yedekten geri kondu. Komut (her mutasyonda aynı):
`HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/mm-smm-244.test.mjs test/esmm-ubl.test.mjs test/esmm-gonderim-244.test.mjs test/netten-brute-244.test.mjs test/fatura-model.test.mjs`

MM10 geri alındı (ana oturum kararı 22.10.2026; stopaj belge düzeyinde kalır). İlk turdaki M1/M2 (kalem başına kuralın mutasyonları, b1e9f55) geçersiz — silindi;
M1 artık kuralın tersini (kalem başına stopaj) enjekte eder.

| Mutasyon | Yer | Sonuç (pass / fail) | Yakalayan |
|---|---|---|---|
| M0 temel (mutasyon yok) | — | 70 / 0 | — |
| M1 stopaj kalem başına yuvarlanır (Σ kalem) | invoice-math.mjs computeInvoice | 67 / 3 | mm-smm T1, esmm-ubl B, fatura-model (bağımsız model) |
| M3 kâğıt makbuz engeli yok (`paperReceiptBlockOf → ""`) | routes/invoices.mjs | 66 / 4 | mm-smm T7, esmm-gonderim N5/N14/bırakma |
| M4 engel yalnız kartta (gönderim yollarındaki iki denetim silinir) | routes/invoices.mjs sendInvoiceOnce + numberForSend | 65 / 5 | mm-smm T7, esmm-gonderim N5/N14/bırakma |
| M5 engel Müşteri Fişi'ne de (tür koşulu silinir) | routes/invoices.mjs | 68 / 2 | mm-smm T8, esmm-gonderim bırakma (fiş yeniden gönderimi) |
| M6 PDF Net Ücret = brüt (stopaj düşülmez) | invoice-pdf.mjs receiptRows | 68 / 2 | mm-smm T1, T3 |

Yakalanmayan mutasyon: 0. Ham çıktılar bu klasörde (mut-*.txt).
