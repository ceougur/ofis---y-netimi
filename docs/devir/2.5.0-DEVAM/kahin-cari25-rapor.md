# Cari kâhini bakımı 25: rapor

**Özet:** Bakımın bütün kalemleri bitti ve commit edildi. Push yapılmadı. Dal `worktree-agent-a24e3718cfe7459df`, ucu `6d0cd7a4` (taban `kc25-taban` = 288b91dc).
- Program ↔ kâhin karşılaştırması yeni listeyle **15 fark** veriyor; bunlar iki program şüphesidir (P-1, P-2).
- Yapım aşaması listesi **38 → 33** kayıt oldu.
- Program kodu değişmedi. Yalnız `test/bagimsiz/cari/**` ve `docs/kanit/2026-11-21/kahin-cari25-*` yazıldı.
- Ayrıntı `test/bagimsiz/cari/KARARLAR.md` §37'de. Kanıt `docs/kanit/2026-11-21/kahin-cari25-kanit/`, araçlar ve koşu betiği `docs/kanit/2026-11-21/kahin-cari25-arac/` içinde.

## Düzenle eşlemesi
- **Uç:** `fatura_duzenle` adımı artık `POST /api/workspace/invoices/:id/edit` ucuna gidiyor. Gövde faturanın ayrıntısından kuruluyor, yalnız miktar farklı.
- **Yoklamada bulunan ayrıntı:** ayrıntının `payment.rest` alanı bir TUTAR. Biçim `payment.mode` alanında. Gövdedeki `rest` bu yüzden `mode` değerinden doldurulur.
- **Yanıt kodları (yoklama):** taslakta 409 `invoice-not-issued`, eski PUT ucunda 409 `invoice-not-draft`, boş gövdede 400. Yanıtın kodu ve gövdesi okunuyor; 409 / 4xx "yapıldı" sayılmıyor.
- **Kendi kartı okuması:** taksitli faturanın kendi kartı Düzenle'den sonra ayrıntının yeni `planId`'sinden yeniden okunuyor, çünkü program yeni kart kimliği veriyor.
- **Bağdaştırıcı mutantı:** `KAHIN_DUZENLE_UC=put` ile eski uca gidilince d57 197/258 (61 fark). Eşlemenin dişi var.
- **Önceki 38 Düzenle kaydı (d53 P4 / A4):** 38'i de KAPANDI. Program Düzenle'yi yeni uçla yapıyor ve değerler kâhinle aynı.

## Yeni denetimler (girdinin hangi satırından)

| Kural | Girdi | Kâhin |
|---|---|---|
| S238 | §1 | Kural vardı (Y24-5). Kararın kendi örneğinin kapanmış kartlı eşi eklendi (d56 G1): 20.11 gecikmişi 300, bakiye 600 |
| S239 | §1 | İade önce kartın dışındaki açığı kapatır (H1 kararın örneği). Artanın kartı küçültmesi bir OKUMA (H2). Düzenle ile azaltmada da dış açık önce (d57 K5) |
| S240 | §1 | S126 kartında kart küçülür, ödeme S126 sırasıyla dağılır (J1, SK-44'ün örneği). Eski kaleme iade gelince ödemenin sıradaki kaleme kayması bir OKUMA (J2) |
| S241 | §2 | Düzenle fazlası avans: açık kart K1 (kararın örneği), kapanmış kart K2, kendi kartı K3 |
| S242 | §2 | Artış kartı değiştirmez, faturanın günüyle ayrı açık durur: kendi kartı P1 (kararın örneği), Mevcut Borç kartı P2, kapanmış kart P3. "Faturanın vadesi = faturanın günü" bir OKUMA |
| §3 | §3 | Kartın içine almadığı faturanın iadesi / iptali kartı değiştirmez (L1 / L2 S110, M1 / M2 S120) |

Yeni SUS nedenleri:
- **SK-45:** §3'ün kendi örneği. Yalnız faturalar açıkken kartın hangi faturayı aldığı kararlarda açıkça yok (N1 / N2).
- **SK-46:** S120 / S200 alanında açılmış çok kalemli kartta iade (Q2).
- **SK-47:** aynı faturada art arda Düzenle ya da artırılmış faturaya iade (senaryo yok).

Elle denetim toplam **530**: d56 359, d57 171. Senaryo düzeltmeleri kural değil, açıkça yazıldı:
- d57'nin ilk durum kontrolündeki kendi kartı satırları kaldırıldı.
- d56'nın kurulum adımları tarih sırasına dizildi (numara sırası kuralı).

## Öz test ve mutasyon
- **Öz test:** UTC ve Europe/Istanbul'da **8.298/8.298**. 147 mutantın hepsi yakalandı.
- **Yeni mutantlar 341–347 (hepsi DEĞERLE yakalandı):**
  - 341 — S241 yok.
  - 342 — S242 B (artış kartı büyütür).
  - 343 — §3 seçilmeyen faturanın iptali kartı küçültür.
  - 345 — S239 B.
  - 346 — S240 B.
  - 347 — SK-45 SUS kuralı yok.
  - 344 boş bırakıldı; bağdaştırıcı mutantı (PUT) bunun yerini tutuyor.
- **G3:** **654/654**.
  - Değişiklik toplamı 405, BEKLENMEYEN 0.
  - Hepsi d56 / d57'de; eski senaryolarda ve rastgele senaryolarda fark yok.
  - Eski kural setleri 524/524 bayt bayt aynı.
  - G3 dökümü iki saat diliminde aynı.

## Program ↔ kâhin (taban programı, iki saat dilimi)
- **Eski listeyle (38 kayıt):** UTC ve Europe/Istanbul'da **23.976/24.062**. 86 fark, iki saat diliminde liste liste aynı:
  - 38'i "kapandı" kaydı,
  - 33'ü yeni yapım aşaması kaydı,
  - 15'i P.
- **Yeni listeyle (yalnız UTC):** **24.014/24.029**. 15 P + 33 yapım aşaması, liste hatası 0, yakalanmayan mutasyon 0.

## Yapım aşaması listesi
**38 → 33** kayıt. Ayrı commit `0eb09b9c`, döküm `kahin-cari25-yapim-ayrisma.json`.
- **Yeni 33 (paket Ç7b):**
  - S241 azaltma kolu, 5 kayıt. d57 K1 / K2'de program kartı 600 yapıyor ama Tahsil Edilen 300 / Kalan 300 gösteriyor; kâhin 600 / 0 (fazlası avans). K3'te kendi kartı programda 300, kâhinde 600.
  - §3, 28 kayıt. d56 L1 / L2'de program, kartın içine almadığı faturanın iadesinde / iptalinde kartı 900 → 600 / 300 küçültüyor. 20.11 gecikmişi programda 600, kâhinde 300.
- **Kapanan 38**, **değişen 0**.

## Eski kâhin kırmızısı
Eski kâhinde **124/530** elle denetim kırmızı.

| Kural | Senaryo | Kırmızı denetim |
|---|---|---|
| S239 | H1 / H2 / Q1 | 10 + 11 + 11 |
| Düzenle dış önce | K5 | 9 |
| S240 | J1 / J2 | 12 + 14 |
| S241 | K1 / K2 / K3 | 9 + 9 + 4 (+ kendi kartı 4) |
| S242 | P1 / P2 / P3 | 4 + 9 + 9 |
| SK-45 | N1 / N2 | 4 + 4 |
| SK-46 | Q2 | 1 |

- S238 (G1) ve §3 S110 / S120 (L1 / L2 / M1 / M2) kırmızı vermiyor. Kural zaten vardı ya da kâhin sonucu zaten veriyordu; bu kolların senaryosu önceden yoktu.
- Program ↔ eski kâhin (d56 / d57): **945/1.021**.

## P (program şüphesi)
Listeye alınmadı; kâhin programa uydurulmadı.
- **P-1 — S239 çok kalemli (S200) kartta uygulanmıyor (d56 Q1, 12 fark).**
  - Örnek: elle Borç 300 + fatura 900; 03.09'da kart 1.000 (faturanın 200'ü kartın dışında); 10.11'de iade 100.
  - Kâhin: dış açık 200 → 100, kart 1.000 değişmez.
  - Program: kart 900'e küçülüyor, dış açık 200'de kalıyor.
  - Bakiye ve gecikmiş iki tarafta 1.100. Tek kalemli kartta (H1) program doğru.
- **P-2 — S242'nin taksitli faturada artışı kendi kartını büyütüyor (d57 P1, 3 fark).**
  - Örnek: fatura 300, kendi kartı 3 × 100; Düzenle 300 → 900.
  - Kâhin: kendi kartı 300; 20.11 gecikmişi 800.
  - Program: kartı 900'le yeniden kuruyor; gecikmiş 600. Bakiye iki tarafta 900.
  - Not: Düzenle gövdesinde ödeme bölümü taksit bilgisiyle (ayrıntıdan) gidiyor.

## KULLANICIYA SORULMALI
Üç UÇ durumda kâhin SUS; bakiye her seçenekte aynı. Yaygın programlarda nasıl yapıldığına dair doğrulanmış kaynak okunmadı.

1. **SK-45 — iki faturalı caride elle kart hangi faturayı alır?** Örnek: A 600 (01.09), B 600 (02.09), elle kart 600.
   - A: en eski fatura (S2 sırası).
   - B: en yeni fatura.
   - C: Uç durum böyle kalsın (BİLİNEN SINIR).
   - Öneri **A**.
2. **SK-46 — S120 / S200 alanında açılmış çok kalemli kartta iade:** ödeme nasıl dağılır?
   - A: S200'ün içine alma sırasıyla.
   - B: küçülmeden sonra S126 sırasıyla.
   - C: Uç durum böyle kalsın (BİLİNEN SINIR).
   - Öneri **C**.
3. **SK-47 — aynı faturada art arda Düzenle ya da artırılmış faturaya iade:**
   - A: her Düzenle ayrı ayrı (S241 / S242).
   - B: net farkla tek kez.
   - C: Uç durum böyle kalsın (BİLİNEN SINIR).
   - Öneri **C**.

P-1 / P-2 için soru gerekirse ikisinde de öneri kararın sözüdür; ikinci seçenek programın bugünkü davranışı, üçüncüsü BİLİNEN SINIR. Bakiye ikisinde de aynı; P-2'de gecikmiş farklı (para kuralı, ders 43).

Baş mimarın görmesi gereken okumalar: Y25-3 (S239'un artanı kartı küçültür), Y25-4 (J2 dağılımı), Y25-6 (artışın vadesi faturanın günü, taksitli faturada da).

## SONRAKİ SÜRÜME (2.5.1)
- Rastgele üreticiye Düzenle ve kısmen kartta iade adımı.
- Öz testin saf simülasyonu Düzenle görmüş faturayı bilmiyor (bu bakımda alan dışı bırakıldı).
- Kendi kartının "Tahsil Edilen"i ve taksit satırları.

## DENENMEYEN
- Düzenle'nin bugünden başka bir tarihte yapılması (senaryolar tek günlük).
- SK-47 alanı ve Düzenle'den sonra açılan kart.
- Birden çok kartın içinde kısmen duran fatura.
- Nakit geri ödemeli iadenin kısmen kartta faturada.
- Defter kâhini ve mobil yazma kâhini açılmadı.
- Yeni listeyle program koşusu yalnız UTC'de yapıldı; eski listeyle iki saat dilimi de koşuldu.

## Değişen yollar
- `test/bagimsiz/cari/model.py`, `oz-test.py`, `kos.mjs`, `KARARLAR.md` (§37), `YAPIM-ASAMASI.json`
- `test/bagimsiz/cari/senaryolar/d56-c5-s238-s240-iade-ve-secilmeyen.json`, `d57-c5-s241-s242-duzenle.json`
- `docs/kanit/2026-11-21/kahin-cari25-arac/**`, `docs/kanit/2026-11-21/kahin-cari25-kanit/**`, `docs/kanit/2026-11-21/kahin-cari25-rapor-taslak.md`

## Commit listesi
| Commit | İçerik |
|---|---|
| `7edc4a43` | Yorum (önce kural) |
| `7e4fb24c` | Elle senaryolar (model değişmeden önce) |
| `37f1d1d8` | Kod |
| `21840a24` | Araçlar |
| `02b1b8dd` | Senaryo sırası, saf simülasyon alanı |
| `43a5c5d6` | İz, öz test, G3 sınıfı |
| `1178aea4` | Kendi kartı eşlemesi |
| `0eb09b9c` | Yapım aşaması listesi |
| `6d0cd7a4` | Kanıt + KARARLAR sonuç + rapor taslağı |

## Ana oturumun yeniden koşacağı komutlar
Çalışma dizini worktree; betik kendi içinde `flock -s`, süre sınırı kilidin içinde.
```
bash docs/kanit/2026-11-21/kahin-cari25-arac/kos.sh utc temel
bash docs/kanit/2026-11-21/kahin-cari25-arac/kos.sh ist temel
bash docs/kanit/2026-11-21/kahin-cari25-arac/kos.sh utc program
bash docs/kanit/2026-11-21/kahin-cari25-arac/kos.sh ist program
bash docs/kanit/2026-11-21/kahin-cari25-arac/kos.sh utc put
```
`kos.sh` içindeki eski kâhin kopyası (`scratchpad/kc25/eski`) silindi. `temel` ve `program-eski` adımlarından önce yeniden açılmalı:
```
git archive kc25-taban test/bagimsiz/cari | tar -x -C /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kc25/eski
```

## Ortam
- Ana oturumun özel ölçüm kilidi yüzünden koşular yaklaşık 50 dakika bekledi. İlk yoklama 30 dakikalık arka plan sınırında kesildi; yeniden koşuldu.
- Bitişte boş disk 6,7 GB. Kendi süreçlerimden çalışan kalmadı.
