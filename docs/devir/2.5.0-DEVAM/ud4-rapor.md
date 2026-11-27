# UD DÜZELTME TURU 4 RAPORU (S269 = A + S268 = A)

**Sonuç:** İki karar da uygulandı. P1, P2, P3 ve P5'in hepsi artık kabul ediliyor ve bakiyeler v2.4.9 ile aynı. Eski kodda (c767e765) yeni testler beklenen nedenle kırmızı. 8 mutantın 8'i öldü. Komşu testler, kâhinler, mutabakat ve e2e'lerin hepsi geçti. Push yapılmadı.

**Taban:** çalışma dalı `claude/epic-thompson-w0lc2l`, uç `04124181bef41303ca39be478865281b095365ca`. Bu uçta ürün kodu c767e765 ile aynı. Ajan dalı `ud4-s269`, worktree `/home/user/ofis---y-netimi/.claude/worktrees/agent-af5447eb2af85a0d6`.

## Commit'ler
- **`126aa068` (kod)**
  - `server/lib/bank/doubtful.mjs`
  - `client/assets/hof-accounts.js`
  - `test/supheli-degersiz-s269-250.test.mjs` (yeni, 8 test)
  - `test/supheli-s269-mutasyon-250.mjs` (yeni)
  - `test/e2e/senaryo-supheli-kuyruk-250.mjs` (adım 4 eklendi)
- **`652ecf62` (Kanıt):** `docs/kanit/2026-11-26/ud4-*` (17 kayıt, json + log).
- `ci.yml` değişmedi: ekran adımı CI'de zaten koşan senaryo-supheli-kuyruk-250'ye eklendi, yeni e2e açılmadı.
- Worktree'de izlenmeyen `node_modules` bağı var; commit'e girmedi.

## Değişiklik
**Sunucu (`doubtful.mjs`)**
- **Yeni `doubtfulStateBound`:** `doubtfulState` ile aynı girdi ve aynı `linked` ile tek ayırıcı koşusu. Ek olarak bağlı alacakların kayıt ve gün başına payını verir (`shares`).
  - Eski `boundSameDayShare` aynı hesabı ayrı bir koşuda yapıyordu; kaldırıldı.
  - Toplam aynı: s264 testleri ve probe P6 / P8 değişmedi.
- **`openRecord(..., { writeOffOn })`:** Değersiz Yaz ve Silinenler'den Değersiz geri yükleme bu seçeneği verir. Kalanı 0 olan kayıt, o günün bağlı payı geri sayılınca yazılabilir tutar taşıyorsa kapalı sayılmaz.
  - Sınır, tutar denetimiyle tutarlı kalsın diye Değersiz satırının günüyle hesaplanıyor.
  - Gün okunamazsa pay 0 sayılır; kapalı kayıtta yine 409 döner.
  - Çıkarılmış kayıt kapalı kalır.
  - Şüpheliden Çıkar, Karşılık ve karşılık geri yükleme bu seçeneği vermez; davranışları değişmedi.
  - Sınır aşımındaki güvenlik geri alması aynen duruyor (probe P8: 4 → 4 satır, 33 → 33 olay).
- **`listFor`** her kayda `writeOffRoomMinor` ve `writeOffRoomDate` ekler.
  - Sınır = kalan + bugünün bağlı payı. Kayıt gününden bugüne bağlı payın düştüğü dönemi açık bir gün daha çok yazdırıyorsa o gün seçilir.
  - `writeOffRoomDate` yalnız bugünden başka bir gün seçilince dolar. Çıkarılmış ya da iptal kayıtta tutar 0.

**İstemci (`hof-accounts.js`)**
- Durumu "open" olmayan ama `status = open` ve `writeOffRoomMinor > 0` olan kayıtta yalnız "Değersiz Alacak Yaz" düğmesi görünür.
- Form ipucu yazılabilir tutarı gösterir. Ekrandan okunan örnek: "En çok ₺2.000,00 (kalan şüpheli ₺0,00 + 21.11.2026 tarihli faturaya bağlı tahsilatın bu kayda düşen payı; Değersiz o günün tahsilatından önce sayılır, tarih o güne kuruldu)".
- Önerilen tutar = sınır. Tarih = `writeOffRoomDate`, yoksa bugün.

## Testler (son kod 126aa068)
| Koşu | Sonuç |
|---|---|
| Yeni s269 + s264 testleri, UTC | 14/14 |
| Yeni s269 + s264 testleri, Europe/Istanbul | 14/14 |
| Eski kopya (c767e765, `git archive`), s269, UTC | 1/8, 7 kırmızı, çıkış 1 |
| Eski kopya (c767e765), s269, Europe/Istanbul | 1/8, 7 kırmızı, çıkış 1 |
| Eski kopya e2e (supheli-kuyruk) | 20/28, 8 kırmızı, çıkış 1 |

Eski kopyadaki kırmızıların iletileri (ders 38):
- **P1:** 409 doubtful-closed, "değersiz yazılarak kapanmış; kalan tutar yok".
- **P2, P3, P5 ve Silinenler geri yükleme:** 409 doubtful-closed, "tamamı tahsil edilmiş".
- **İki S268 testi:** `writeOffRoomMinor` alanı yok (undefined).
- **Ekran:** ipucu "En çok ₺123,55 (kalan şüpheli)", tarih bugün, 1.000 reddedildi; bakiye 3.300.
- Yeşil kalan tek test P1′ koruma testidir (ertesi gün → 409, eskisi gibi).

**s264-probe yeni kodda (9/9):**
| Senaryo | Sonuç |
|---|---|
| P1 | 1.000 ve 2.000 kabul, bakiye 423,55 |
| P2 | 3.000 kabul, bakiye 400 |
| P3 | R1 1.500 kabul (1.923,55), sonra R2 1.500 kabul (423,55) |
| P5 | R1 1.500 kabul, bakiye 1.923,55 — v2.4.9 ile aynı |
| P6 | 400, sınır 123,55 — değişmedi |
| P8 | 400 + geri alma, sonra 500 kabul — değişmedi |

**Mutantlar (`ud4-mutasyon-s269`): 8/8 öldü.** Taban API 8/8, ekran 28/28.
- S1: Değersiz Yaz'ın kapalı denetiminde bağlı pay yok sayılır.
- S2: geri yüklemenin kapalı denetiminde bağlı pay yok sayılır.
- S3: ortak kapalı denetiminde bağlı pay yok sayılır.
- S4: liste yazılabilir tutar yerine yalnız kalanı verir.
- S5: bağlı payın günü bildirilmez.
- C1: ipucu ve önerilen tutar yalnız kalandan.
- C2: düğme gizli.
- C3: form tarihi bugün.

**Komşu ve diğer koşular**
- Komşu 47 dosya, Europe/Istanbul: 455/455. Liste test/ taramasıyla çıkarıldı: doubtful.mjs ve şüpheli uçlarını kullanan 39 dosya + `sema-kapisi-bs7`, `trash`, `silinenler-donem-kilidi-244`, `banka-210-gg-geri-yukle`, `yazim-duzeni`, `kalan-metin-246`, `tyk-birlesik8-ekranlar-250`, `uiux-244-ux9`.
- e2e: senaryo-supheli-kuyruk-250 28/28, senaryo-supheli-230 67/67, senaryo-banka-210 429/429. Ekran görüntülerine baktım: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud4-k7p3/ekran/supheli-kuyruk-4-dugme.png` ve `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud4-k7p3/ekran/supheli-kuyruk-4b-form.png`.
- Kâhin cari: UTC 25.298/25.298, Europe/Istanbul 25.298/25.298.
- Kâhin defter: UTC 187/187, Europe/Istanbul 187/187.
- Hepsinde çıkış 0, iptal 0, atlanan 0.
- Mutabakat 5.000 işlem: tohum 7 GEÇTİ, tohum 8 GEÇTİ (çıkış 0; ikisi paralel, her biri timeout 5400). İkisinde de şüpheli ve Değersiz işlemleri koştu.
- YAPIM AŞAMASI listesi: 0 kayıt (dosya değişmedi).

## Hız (ders 53 (a)) — ölçüm ana oturumda
- **Kayıt listesi** (GET `/api/workspace/accounts/:id/doubtful`, cari kartının Şüpheli Alacak bölümü): eskisi gibi tek ayırıcı koşusu. Ek iş yalnız bağlı alacaklarda bir döngü ve kayıt başına gün karşılaştırması.
- **Değersiz Yaz ve Silinenler'den Değersiz geri yükleme:** iki ayırıcı koşusu yerine bir tane — beklenti hızlanma.
- **Şüpheliden Çıkar, Karşılık ve karşılık geri yükleme:** aynı tek koşu, küçük ek iş.
- Okunan hesap her yolda aynı: doubtful_receivables, doubtful_provisions, accounts, cheques, fin_events; linkedShares (bağlı satırı olan carinin kuyruğu); doubtfulCredits SQL (account_entries, plans, plan_entries, invoices); allocateDoubtful.

## KULLANICIYA SORULMALI
Yok. Dikkate alınacak bir baş mimar notu var:
- Kayıt gününden SONRAKİ bir günde düşen bağlı tahsilat için (ör. kayıt 15.09, bağlı tahsilat 17.09) sunucu o güne geriye tarihli tam Değersiz'i zaten kabul ediyordu.
  - c767e765'te de kabul ediliyor: 17.09 tarihli 3.000 → 200, bakiye 423,55. Bugünün tarihiyle → 400.
  - Bu tur sunucu kuralına dokunmadı.
- Yeni form bu durumda "En çok ₺3.000,00 … 17.09.2026 tarihli …" yazıyor ve tarihi 17.09'a kuruyor. Görev metni "kaydın Şüpheliye Al günü" diyordu; ben sunucunun sınırıyla tutarlı kalsın diye bütün günleri aday aldım.
- Yalnız kayıt gününe daraltılması istenirse küçük bir kod değişikliğiyle yapılır. Bakiye ve para değişmez; değişen yalnız ipucu ve önerilen tarih.

## DOĞRULANMADI
- Windows (CI'de görülecek).
- Hız ölçümü (ana oturum).
- Tam `npm test` (görev gereği koşulmadı).
- Uzun Doğrulama.
- Kâhin bu turun P senaryolarıyla doğrudan koşulmadı; beklenen sayılar karar metninden ve dar kontrolün v2.4.9 koşusundan alındı.

## SONRAKİ SÜRÜME (2.5.1)
- **P5'te aynı gün çıkarılmış R2 kaydı:** R1'e Değersiz yazılınca R2'nin hesaplanan çıkarılan tutarı 123,55 → 0 oluyor. Başlık 123,55'te kalıyor; mevcut close-amount toleransı içinde, bakiye ve kapı tamam. Önceden var olan sınıf.
- **Kapanmış görünen kayıtta düğme:** "Değersiz Yazıldı / Kalan ₺0,00" görünen satırda düğme ve "şüphelide kalan ₺0,00" bildirimi yan yana duruyor. Karar gereği; görünüm ayrıntısı.
- DÜŞÜK-1, DÜŞÜK-2, Y-d ve S206 kapsam dışı bırakıldı; bu turda dokunulmadı.

Geçici kopyalar silindi. Eski kopya kaldırıldı; mutasyon kopyasını betik kendisi sildi.

Ortam: Yük 1,22 / 4 çekirdek, bellek boş 14 GB (kullanılabilir), disk boş 5,3 GB.
