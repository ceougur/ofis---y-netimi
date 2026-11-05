# P1 tur 2 kanıtı (03.11.2026)

Testler be87daab, düzeltme 393aeb57 (server/routes/accounts.mjs). Eski kod 20ca225a ve mutasyonlar AYRI KOPYADA (`git archive <commit> | tar -x`, node_modules ana ağaca
sembolik bağ; ders 23). Her kayıt `tools/kanit.mjs kos` ile; `.json` komut + commit + sayılar, `.log` ham çıktı.

## Eski kod (20ca225a) — beklenen nedenle kırmızı (ders 38)
- `eski-20ca225a-kart-iade-musteri-249`: 10/13; kırmızı 3 hücre, üçü de "beklenen 400, gelen 200" — DÜŞÜK-1 0 kart (POS satırı → Kredi Kartına İade), DÜŞÜK-1 tek kart
  pasif (aynı), DÜŞÜK-2 (kartla ödemesi yok müşteride POS satırı → iade). TEST-1 ve TEST-2 eski kodda YEŞİL (doğru davranış korunuyordu; dişleri mA / mB'de).
- `eski-20ca225a-senaryo-pos-kart-249`: 351/356; kırmızı 5'i de T16'da (0 kart): PUT 200, satır `finRef ""` (hesapsız), POS satışı geçersiz, POS Bekleyen −50. T15 eski kodda yeşil.

## Mutasyonlar (393aeb57 kopyasında, server/routes/accounts.mjs; her biri tek değişiklik)
| Ad | Değişiklik | Sonuç |
|---|---|---|
| M1 | PUT'ta `assertCardTarget(input, body, finRef);` silinir (DÜŞÜK-1 düzeltmesi geri) | 11/13 — DÜŞÜK-1 0 kart ve pasif kart hücreleri "gelen 200" |
| M2 | PUT'ta `if (!wasCardRefund(previous)) assertCardRefundRoom(...)` silinir (DÜŞÜK-2 geri) | 12/13 — DÜŞÜK-2 hücresi "gelen 200" |
| M3 | aynı satır koşulsuz `assertCardRefundRoom(...)` (var olan iade satırı da denetlenir) | 11/13 — P1-b "silinmemiş" ve DÜŞÜK-2 hücreleri: var olan iade düzeltmesi 400 card-refund-no-payment |
| mA | bayrak sorgusu `JOIN bank_accounts b ON b.id = e.fin_ref AND b.kind = 'card'` yerine `AND e.fin_ref <> ''` | API 12/13 — TEST-1 "hasCardPayment true"; e2e 347/356 — T15 üç kart sayısında (bayrak true, kutu görünür, API 200 / 0 kartta bank-account-invalid) |
| mB | PUT `corporateOf(input, body, previous)` → `corporateOf(input, {}, previous)` (POS ayrıntısı önceki satıra göre) | 12/13 — TEST-2: taksit 1 (beklenen 3), provizyon ve son 4 hane boş |

## Yeni kod (393aeb57)
API 13/13 (UTC + Europe/Istanbul); dar birim 86/86 iki TZ (kart-iade-musteri-249, supheli-230-yargic, banka-220-pos-moduller, banka-220-pos-valor,
banka-230-46-iade-iptal, banka-220-pos-kdv, banka-210-asama5-cari); genel 32/32 iki TZ (lisans-servisi-izolasyonu, platform-tasinabilirlik, yazim-duzeni,
ci-kapi-listesi, static, banka-210-post-statik); e2e senaryo-pos-kart-249 356/356, senaryo-pos-220 113/113, senaryo-cari-243 69/69, senaryo-iz32-230 41/41.
`esc-yeni-senaryo-pos-kart-249.jsonl`: 10 "Kaydedilmemiş Değişiklik" sorusu, hepsi kullanıcının değiştirdiği alandan (meşru; ders 34).
