# 2.4.8 SON ADAY T4 (İŞ AKIŞI) + T7 (TARİH) — 31.10.2026

Aday 1 = `aa76592c` (dal `is/t4-248`, worktree `/home/user/wt-t4-248`). Ürün kodu DEĞİŞMEDİ; yalnız iki yeni betik + bu kanıt.

| Koşu | Komut | Sonuç |
|---|---|---|
| T4 iş akışı | `node tools/kanit.mjs kos 248-t4/is-akisi -- node test/e2e/senaryo-is-akisi-248.mjs` | çıkış 0 · **184/184** (`is-akisi.json`, `is-akisi.log`, `ekran-t4/` 22 ekran + `soru-yanitlari.log`) |
| T7 tarih | `node tools/kanit.mjs kos 248-t4/tarih-t7 -- node test/e2e/senaryo-tarih-248.mjs` | çıkış 0 · **40/40** (`tarih-t7.json`, `tarih-t7.log`, `ekran-t7/` 2 ekran) |
| Dişi (mutasyon, ayrı kopya `git archive aa76592c`, ders 23/25) | `mutasyon-fark.diff`: (1) "Bu Ay" ayı UTC'den, (2) Pasif Cari elenmez | T7 **38/40** (01.12 ve 01.01 "Bu Ay" sayacı — beklenen neden), T4 **167/183** (gönderilecek 8, Pasif Kişi'ye ileti — beklenen neden) |

Ortam: `PLAYWRIGHT_BROWSERS_PATH=<not defteri>/w1-248-q7m3/pw`, `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30), geçici veri not defteri `t4-k9m2/` (ders 25),
`df -h /` 11 GB boş (ders 24). Meta = BAĞIMSIZ K0 sahte Meta (`test/bagimsiz/whatsapp-248/sahte-meta`; programın kendi test sahte Graph'ı kullanılmadı, ders 5).
Sunucu saati sahte (T4 03.11.2026 09:00; T7 03.11.2026 → 01.01.2027 → +30 gün); T7 TZ Europe/Istanbul (gerçek kurulum, ders 14). Her iki betik koşu başı/sonu
gerçek günü karşılaştırır, değiştiyse GEÇERSİZ (çıkış 2) — ders 22.

## T4 — beklenen (ELLE, girilen veriden) ↔ program (ekran = veri tabanı = sahte Meta)

Cariler EKRANDAN (+ Yeni Cari, insan hızında yazım, Kayıt Tarihi 01.09.2026); hareketler + C3 taksit kartı programın API'sinden.

| Cari | Telefon | Açılış | Beklenen Geçen Ay (31.10) | Beklenen Bu Ay (03.11) | Program |
|---|---|---|---|---|---|
| C1 Aynı Ad Kişi | 0532 100 00 01 | 1.000 (+200 −350 Ekim, +40 Kasım) | 850,00 TL | 890,00 TL | aynı; PDF Ekim'de Kasım hareketi yok, devir 1.000 |
| C2 Aynı Ad Kişi | 0532 100 00 02 | 500 (vade 20.10) | 500,00 | 500,00 | aynı |
| C3 Ortak Telefon A | 0533 200 00 00 | 250 (taksit 15.09/15.10/15.12) | 250,00 | 250,00 | aynı |
| C4 Ortak Telefon B | 0533 200 00 00 | 750 | 750,00 | 750,00 | aynı (aynı telefona 2 ayrı ileti + 2 ayrı PDF, K2) |
| C5 Sabit Hat Kişi | 0212 555 01 01 | 100 | 100,00 → kanca 131026 Başarısız | | aynı (K1: elenmez) |
| C6 Yurt Dışı Kişi | +49 151 2345 6789 | 300 | 300,00 (+4915123456789) | | aynı |
| C7 Telefonsuz | — | 100 | elenir "Telefon yok" | | aynı |
| C8 İstemiyor (Tab+Boşluk) | 0534 … | 100 | elenir "WhatsApp Mesajı İstemiyor" | | aynı |
| C9 Pasif (kartta Pasife Al) | 0535 … | 100 | elenir "Pasif Cari" | | aynı |
| C10 Alacaklı Kişi | 0536 600 00 00 | 0 (+100 −400 Ekim) | 300,00 TL (Alacaklı) | | aynı |

| Adım | Beklenen | Program |
|---|---|---|
| Geçen Ay önizleme | 10 / 7 gönderilecek / 3 elenen; 7 × 0,0009 = 0,0063 USD | aynı |
| Geçen Ay gönderim | Meta 7 POST, 7 kabul, 7 PDF; `destekofis_ekstre` tr; {{3}} 01.10.2026 – 31.10.2026 | aynı |
| Kanca | teslim 4, okundu 1 (C3), başarısız 1 (C5), yanıtsız 1 (C10) | ekran çipleri = veri tabanı aynı; satırda 131026 nedeni |
| Bu Ay sayacı | 5 (teslim + okundu) | API 5, gönderim penceresi "5 teslim edildi", Yönetim kartı 5 |
| Bu Ay ekstresi | R3 uyarısı 0 (dönem farklı), 7 ileti, 01.11.2026 – 03.11.2026; +3 teslim → 8 | aynı |
| Ödeme Hatırlatma | C3: [ad, firma, 15.09.2026, 200,00 TL, 250,00 TL]; C4 (aynı telefon) gecikmiş borcu yok → yok | aynı; **C2 elenir (aşağıda B1)** |
| WhatsApp Web | wa.me/4915123456789, metinde ad + 300,00 TL; Meta'ya istek yok; message_sends +1 | aynı; sabit hat bu yolda seçilemez |
| Personel | Otomatik Gönder pasif + "yetkiniz yok"; API 403; Meta 0 | aynı |
| 002 (ekrandan açıldı) | cari yok, Gönderimler boş, Bağlı Değil, Bu Ay yok; kendi WABA'sıyla 1 ileti → 001 değişmez | aynı (001: 8 → 8; 002: 1) |
| Salt okunur | Gönder pasif + "salt okunur"; API 403; yeni toplu iş/ileti 0 | aynı |
| Mobil Cihazlar | 8 gün kala uyarı yok; 7 gün kala "Lisansınız 7 gün sonra bitiyor." | aynı |
| Sahte Meta toplam | ileti 16 (7+7+1+1), PDF 15, kesin sonuçlu PDF silme 9 (4+1+1+3) | aynı; belirteç sızıntısı 0 |

## T7 — sahte saatle

| Adım | Beklenen (plan) | Program |
|---|---|---|
| Sınır 2, 03.11 23:30 üç kişi | 2 gider, 1 Sınır Nedeniyle Bekliyor | aynı |
| 04.11 00:30 / 23:29 / 23:31 | 2 / 2 / 3 (kayan 24 saat) | aynı |
| 30.11 23:50 Bu Ay | 01.11.2026 – 30.11.2026 | aynı |
| Teslim 30.11 23:59:30, kanca 01.12 00:01 | Kasım'a sayılır | Kasım 1 → 2, Aralık 0 |
| 01.12 Bu Ay / Geçen Ay | 01.12.2026 – 01.12.2026 / 01.11.2026 – 30.11.2026; Geçen Ay PDF'i Aralık hareketsiz, 1.200,00 | aynı |
| 01.01.2027 Bu Ay / Geçen Ay | 01.01.2027 – 01.01.2027 / 01.12.2026 – 31.12.2026; Z2 800,00, Ocak hareketi yok; 2027-01 sayacı 0, 2026-12 korunur | aynı (ekranda iki yol da) |
| TTL Meta'da 259200 | 73 sa − 1 dk Meta Kabul Etti; 73 sa + 1 dk Süresi Doldu + PDF silindi | aynı |
| TTL bildirilmedi / reddedildi | 73 sa'te dolmaz; 30 gün + 1 sa'te Süresi Doldu; reddedilende kartta uyarı | aynı |
| Kanca yolu hiç çalışmadı | dolmaz (§7a 16) | aynı |

## Bulgular ve gözlemler

- **B1 (ORTA, kullanıcı kararı — "kime gönderilir", ders 43 düzeni):** Açılış Bakiyesi'ne Vade Tarihi (20.10.2026) girilmiş, vadesi geçmiş, taksit kartı olmayan cari
  Ödeme Hatırlatma'da "Gecikmiş Borç Yok" ile elenir; cari kartında da Geciken 0. Program "vadesi geçmiş borç"u yalnız taksit kartlarından sayar (cari kartı
  `server/routes/accounts.mjs` overdue = plan toplamları; `server/lib/whatsapp/queue.mjs` overdueOf). Plan §7a 20 "vadesi geçmiş borç"; T1 kâhin sürücüsü vadeleri taksit
  kartıyla kurduğu için görmedi. Yeniden üretim: T4 S6 + S10 (`is-akisi.log` ⚑ satırı, `ekran-t4/t4-14-hatirlatma-onizleme.png`).
- **D1 (DÜŞÜK):** Elle Bağla → Kaydet ve Sına başarılı olunca aynı sayfada "Gönderim Onayı" ve "Bu Ay" kartı görünmez; sayfa yenilenince görünür
  (`client/assets/hof-whatsapp-ayar.js` testNow başarıda yalnız `render()`; WhatsApp'ı Bağla yolu `load()` çağırır). Onay gönderim penceresinden de verilebildiği için iş durmaz.
- **D2 (DÜŞÜK):** Hiç cari yokken Cari listesi "Bu süzgeçte cari yok." der ("Henüz cari yok." yalnız Tümü süzgecinde).
- **D3 (DÜŞÜK, bilgi):** WhatsApp Web ile Gönder sabit hattı "Numarası Yok / Hatalı" sayar (wa.me cep ister); Otomatik Gönder K1 gereği gönderir — iki yolun sayıları farklı.
- Beklenen soru: ikinci "Aynı Ad Kişi" açılırken "Aynı Adlı Cari Var" (Vazgeç / Yine de Aç) — meşru, "Yine de Aç" (`ekran-t4/soru-yanitlari.log`).
- T2-1 gözlemi (karar bekliyor, denetlenmedi): 30.11'de "Bu Ay" (01.11–30.11) gönderilen cariye 01.12'de "Geçen Ay" önizlemesi "Daha Önce Gönderildi" diyor (aynı aralık).
- Ortam notu (ders 14): T7 ilk koşusu UTC saat diliminde 01.12 00:10'da 01.12 tarihli hareketi "İleri tarihli" reddetti (program yerel günü kullanır, WhatsApp ayı +3 sabit);
  gerçek kurulum Türkiye saatinde olduğu için bulgu sayılmadı, koşu TZ Europe/Istanbul ile yinelendi.
- 30 gün + 1 sa'te PDF silme isteğine Meta 100 (medya ömrü 30 gün, zaten düşmüş) — beklenen.
- Toplu iş başlığında saat 06:00 (sunucu 09:00 TR) — bilinen W4 sınırı (tarayıcı saat dilimi).

## DENENMEYEN
Hareket girişi ve taksit kartı ekrandan (API'den girildi; o ekranlar başka senaryolarda); Fatura Ayarları satıcı bilgisi ekrandan (API); 002'nin bağlantısı ekrandan (API; ekran yolu 001'de);
WhatsApp'ı Bağla (Yol 2); gerçek Meta (D0, yayından sonra kullanıcıda); gerçek Windows/Edge; dar pencere ve kapıcı üzerinden kanca (T3/W9 senaryolarında); T4'te gece
yarısında süren gönderim (T7a API düzeyinde); "Son 3 Ay" / "Tüm Hareketler" dönemlerinin ay/yıl geçişi.
