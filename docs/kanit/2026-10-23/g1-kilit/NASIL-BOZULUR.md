# G1 — Silinenler'den geri yükleme dönem kilidini aşıyor — "Nasıl bozulur?" (KODDAN ÖNCE, 23.10.2026)

Taban: is/g1-kilit = aday10 247d6a7. Tarama: server/routes/trash.mjs POST /api/admin/trash/restore bütün kolları + LOCK_SQL (integrity.mjs).

## Kollar (kilit denetimi var mı — koddan)
| Kol | Geri yüklemede yazılan | Kilit izi (LOCK_SQL) | Denetim |
|---|---|---|---|
| invoice (fatura/makbuz/iade) | invoices + invoice_lines (iptal edilmiş, etkisiz) | invoices (status <> draft, issue_date <= kilit) | YOK  ← G1 |
| payment | payments + banka olayı | payments, money_refs | restoreDate(payload.date) |
| cash (+ transfer ikizi, Vergi Ödemesi tax_json) | cash_entries | cash_entries, cash_tax_lock, money_refs | restoreDate(date) + ikiz |
| plan-entry | plan_entries | plan_entries, plans_party_lock, plans_close_lock | restoreDate + assertCloseOpen |
| account-entry | account_entries | account_entries, party_lock | restoreDate (accounts.restoreEntry) |
| stock-move | stock_moves | stock_moves, stock_opening_lock | restoreDate (stock.restoreMove) |
| plan (kart) | plans (+ silinmiş cari) | plans, party_lock, plans_close_lock | assertRestorable (Kayıt Tarihi, ilk tahsilat, kapanış, cari) |
| account (cari) | accounts.deleted_at | party_lock (live) | assertUnlocked (lockedSince) |
| cheque (çek/senet) | cheques + etkiler (cari/taksit) | cheques_lock, cheque_events_lock | restoreDate(issueDate) |
| doubtful / provision / writeoff | doubtful_* | doubtful_lock, doubtful_closed_lock, doubtful_provisions_lock | restoreDate (tarih, çıkarılma, karşılıklar) |
| stock (ürün kartı) | stock_items.deleted_at | yok (defter silinmiş ürünü süzmez) | gerekmez |
| row / column / tab / document / free-sheet / free-row / free-column / note / phone / lien | kayıt verisi | yok | gerekmez |
| Banka fişi, POS, KDV Mahsup Fişi | Silinenler'e GİRMEZ (ters kayıt/iptal kendi akışında; tax.mjs assertOpen) | — | — |

Faturanın bağları: silme = iptal (stok, cari, Kasa, çek, taksit etkileri geri alınır) + Silinenler. Geri yükleme hiçbir hareket yazmaz
(yalnız invoices + invoice_lines; durum "İptal Edildi"); defter/KDV yalnız status = 'issued' okur → mizan değişmez, ama kilit izi
iptal edilmiş belgeyi de sayar: kapanmış döneme belge eklenmiş olur (silmedeki kuralın — deleteBlock "Silmek için dönem kilidi açılmalı" — tersi).

## Nasıl bozulur (testler buradan)
1. Sil (açık dönem) → kilit → geri yükle: kaydedilmiş satış faturası, alış faturası, satıştan iade, önce İptal sonra Sil, kilit günüyle AYNI gün (sınır) → 409 period-locked; belge Silinenler'de kalır; invoices'ta satır yok.
2. Taslak (kilitli tarihli) sil → kilit → geri yükle → 200, taslak döner (taslak kilit izinde yok; silmede de serbest).
3. Kilit sonrası tarihli belge → 200 (iptal edilmiş, etkisiz).
4. Kilit açılır → aynı belge 200; kilit yeniden konur → sonraki işlemler geçer.
5. Reddedilen denemeden sonra Mutabakat Testi temiz (period-lock yok); test kipinde (gateVerify) Kasa girişi ve peşin satış 200 (eski kodda 500 gate-equivalence / 409).
6. Öbür kollar aynı sırayla (sil → kilit → geri yükle): tahsilat, Kasa, cari hareketi, stok hareketi, taksit hareketi, kart, cari, çek → 409 period-locked, aynı dil ("… kapatılmış (kilitli) dönemdir"); kilit sonrası tarihli eşleri 200.
7. İleti dili: "Bu <tür> GG.AA.YYYY tarihli; GG.AA.YYYY ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı."
8. Sıra: carisi silinmiş + kilitli → önce "Belgenin carisi silinmiş" (eski sıra); numarası başkasında (E6) + kilitli → E6 iletisi önce (kalıcı ret önce; kilit açtırıp sonra numara reddi verilmez).
9. Eşzamanlı iki geri yükleme: biri 200 (kilitsiz) öbürü "zaten geri yüklenmiş" (değişmez; mevcut test).
10. 002 şirketi: kilit şirket başına (period store ayarı) — ikinci şirkette kilit yokken aynı belge 200.
11. Eski sürüm verisi: 2.4.3'te kilitli döneme geri yüklenmiş (ihlal tabanı) belge → yeniden başlatmada taban; bu düzeltme onu değiştirmez (göç yok).
12. İkincil: kapıdan geçmeyen yol (invoices FINANCIAL'da değil) — başka bir kapısız yol kalırsa kullanıcı ne görür? (kanıt koşusuyla yazılır, düzeltme kapsam dışıysa öneri).
