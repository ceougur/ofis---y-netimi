# CI #861 — senaryo-personel-244 kırmızısı: kök neden, zorla üretme, düzeltme (iş listesi 7d, ders 39)

CI #861 (158d9c0 = aday 6 birleşimi): 4 platform test işi yeşil, "Uçtan uca (Chromium)" KIRMIZI — senaryo-personel-244 12/23, ilk hata
`page.$eval: Failed to find element matching selector ".hof-modal-backdrop.is-visible:last-of-type .hof-modal-title"`, ardından 10 adımda
`page.click: Timeout 30000ms exceeded` (açık kalan form tıklamaları yuttu). Aynı kod yerel aday 6 kapısında 64/64 geçmişti.

## Kök neden (testte; ürün doğru)
Form başlığı en üstteki pencereden `:last-of-type` ile ve pencere görünür olmadan okunuyordu. İki ayrı ön koşul aynı imzayı verir:
- **A — kare gecikmesi:** ürün pencereyi body'ye ekler, `is-visible`'ı bir kare sonra (requestAnimationFrame) verir (client/assets/hof-core.js `HOF.modal`).
  Test yalnız form alanını bekliyordu (`.hof-staff-form input`). Alan opaklık 0'da da Playwright için "görünür"dür, bekleme bu yüzden hemen biter.
  Hemen ardından gelen `$eval` görünür son pencereyi bulamaz.
- **B — sonradan eklenen div:** pencereden sonra body'ye eklenen her div `:last-of-type`'ı boşa düşürür. Ürün bu tür div'leri sonradan ekler:
  bildirim kabı `#hof-toasts`, Hızlı Arama paneli `#hof-search-panel`, açılır menüler.
CI'de hangisinin olduğu kısa günlükten ayırt edilemez, ikisi de aynı iletiyi verir. Düzeltme bu yüzden ikisini birlikte kapsar.

## Zorla üretme (ders 20) — eski test, ayrı kopyada (ders 23)
Ürün koduna dokunulmadı. Ön koşulu, sayfaya init betiği olarak yüklenen bir ön yükleme kurdu. İlk betikler `ilk-betikler/` altında,
genel araç `test/e2e/pencere-yaris-zorla.mjs` (HOF_ZORLA=gorunur|div, HOF_ZORLA_HEDEF).

| Koşu | Ön koşul | Sonuç | Neden (iletide) |
|---|---|---|---|
| zorla-panel-gec-eski-test | Hızlı Arama paneli 4 sn gecikmeli | 63/63 YEŞİL | panel pencereden önce eklendi; ilk varsayım kanıtlanmadı |
| zorla-A-eski-test | A, personel formu | 12 geçti 11 kaldı | CI'nin imzası aynen |
| zorla-B-eski-test | B, personel formu | 12 geçti 11 kaldı | CI'nin imzası aynen |
| eski-gorunur-pencere-onay | A, Personel Raporu penceresi + onay sorusu | 56/58 | 1. adım `$eval(".hof-modal-backdrop.is-visible .hof-modal-title")` boş; 7. adımda soru yanıtlanmadı, sonraki tıklama zaman aşımı |
| eski-div-onay | B, onay sorusu | 61/62 | 7. adımda soru bulunamadı, yanıtlanmadı, sonraki tıklama zaman aşımı |

## Düzeltme (b5fcdaa) ve yeşil
- En üstteki pencere `TOP = ${MODAL}:nth-last-child(1 of ${MODAL})`: görünür pencerelerin sonuncusu; arkadan eklenen div etkilemez.
- Pencere açılış beklemeleri `is-visible`'ı içerir: `${MODAL} ${WIN} [data-staff-kpis]`, `${MODAL} ${FORM} input[name="fullName"]`.
- 7. adımdaki "Kaydetmeden Kapat" sorusu BEKLENİR ve doğrulanır (ders 34). Eskiden `if (varsa)` ile sessizce atlanıyordu, form açık kalınca sonraki adımlar düşüyordu.

| Koşu | Ön koşul | Sonuç | Zorlama satırı | Soru yanıtlandı |
|---|---|---|---|---|
| yeni-gorunur-tum | A, BÜTÜN pencereler (1500 ms) | 64/64 YEŞİL | 25 | 1 |
| yeni-div-tum | B, BÜTÜN pencereler | 64/64 YEŞİL | 16 | 1 |
| yeni-duz | yok | 64/64 YEŞİL | 0 | 1 |

Yeşiller yalnız ön koşulun gerçekten oluştuğu koşularda sayıldı: "[pencere-zorla] "<pencere başlığı>": …" satırları ham günlükte.
Playwright seçici denemesi (`ilk-betikler/secici-dene.mjs`, boş sayfa): arkadan div eklenince `:last-of-type` boş döner.
`:nth-last-child(1 of S)` ve `:not(:has(~ S))` doğru pencereyi bulur; ikisi de yerelde, `$eval`'de ve locator'da çalışır.

## Komşular (ders 10) — 2.4.4 SONRASI
33 e2e dosyasında `top`/`dialog` sabiti `:last-of-type` ile tanımlı. Bu sabitlerle 134 beklemeyen okuma, ayrıca 5 doğrudan kullanım var.
Bugüne dek CI'de yalnız bu dosyada görüldü. Mekanik düzeltme (sabit → `:nth-last-child(1 of …)`), kaynak tarayan denetim ve açılış
beklemelerinin is-visible'ı içermesi iş listesi 7d'de "SONRASI" olarak yazılı.
