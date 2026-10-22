# 244-mm-smm — mutasyon testi (para çekirdeği: stopaj yuvarlaması, MM4 alt kararı engeli, makbuz PDF'i)

Kopya: not defteri `mm-smm/mm-smm-mutasyon` (çalışma ağacının server/client/test/tools kopyası; çalışma ağacına mutasyon girmedi). Her mutasyon tek değişiklik,
koşu sonrası dosya yedekten geri kondu. Komut (her mutasyonda aynı):
`HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/mm-smm-244.test.mjs test/esmm-ubl.test.mjs test/esmm-gonderim-244.test.mjs test/netten-brute-244.test.mjs`

| Mutasyon | Yer | Sonuç (pass / fail) | Yakalayan |
|---|---|---|---|
| M0 temel (mutasyon yok) | — | 69 / 0 | — |
| M1 stopaj yine belge toplamından (`mulDiv(net, bp, 10000)`) | invoice-math.mjs computeInvoice | 67 / 2 | mm-smm T1, esmm-ubl B |
| M2 kalem stopajı aşağı yuvarlanır (`Math.floor`) | invoice-math.mjs computeInvoice | 56 / 13 | mm-smm T1, esmm-ubl A–E, netten-brute |
| M3 kâğıt makbuz engeli yok (`paperReceiptBlockOf → ""`) | routes/invoices.mjs | 65 / 4 | mm-smm T7, esmm-gonderim N5/N14/bırakma |
| M4 engel yalnız kartta (gönderim yollarındaki iki denetim silinir) | routes/invoices.mjs sendInvoiceOnce + numberForSend | 64 / 5 | mm-smm T7, esmm-gonderim N5/N14/bırakma |
| M5 engel Müşteri Fişi'ne de (tür koşulu silinir) | routes/invoices.mjs | 67 / 2 | mm-smm T8, esmm-gonderim bırakma (fiş yeniden gönderimi) |
| M6 PDF Net Ücret = brüt (stopaj düşülmez) | invoice-pdf.mjs receiptRows | 68 / 1 | mm-smm T3 |

Yakalanmayan mutasyon: 0. Ham çıktılar bu klasörde (mut-*.txt).
