# 31e tur 10 Z2 / Z3 — is/r31e-f, kod 7465080 + 007eb2e (taban aday 20 = 7ffc838)

## Bulgular ve karar (ikisi v2.4.3'te de vardı; ORTA)
- **Z2:** Kalan hücresi sayı ve 0 ya da eksi (fazla ödeme) olan satırdan tahsilat beklenmez; Takvim / Vade / Nakit / zil / Tahsil Et kalemi çıkmaz. Dönem kolonu olsun olmasın geçerlidir.
  - Aday 20: Ali Veli (Aidat 1.000, Kalan −100) 1.000 "gecikmiş" görünüyordu; sekme süzgeçli Nakit 4.400 idi, doğrusu 3.400.
  - Aday 20, kâhin b3r: Dilek Su (yalnız Kalan, −250) Takvim'de tutarsız kalem olarak görünüyordu.
  - **Kişiler'de bugünkü davranış (değişmedi):** satır borcu olduğu gibi, Ali Veli borç −100 (alacak 0).
- **Z3:** ödeme sözü kalemi söz tutarıdır.
  - Söz tutarı kolonu önce gelir: Taksit 1.000 + Kalan 9.000 + Söz Tutarı 3.000 → kalem 3.000 (aday 20: 1.000).
  - Söz tutarı hücresi boşsa önceki kural geçer: tek vadeli tabloda min(dönem tutarı, Kalan). Örnek: Taksit 5.000, Kalan 3.000 → 3.000 (kâhin b3s: Gül Er 1.000).
- Neden: `rowState` paidOff yalnız Kalan = 0'da kalemi atlıyordu. Söz kalemi ise `own` kolonunu alıyordu; bu, sekmenin ilk dönem kolonuydu (Taksit Tutarı).

## Nasıl bozulur
- Kalan eksi ve dönem kolonu var: kalem dönem tutarıyla gecikmiş görünür.
- Kalan eksi ve dönem kolonu yok: tutarsız kalem kalır.
- Kalan 0: kalem görünür (zaten yoktu).
- Söz kalemi taksit tutarını alır.
- Söz tutarı boşken kalem kaybolur ya da Kalan'ı aşar.
- Kişiler'de eksi Kalan değişir.

## Kanıt
- Yeniden üretim (`betik/tablo-kos.mjs` + `betik/z1-komsu.json` = tur10 senaryosu): `ham/tur10-senaryo-v243.out`, `ham/tur10-senaryo-aday20-7ffc838.out`, `ham/tur10-senaryo-007eb2e.out`.
  - 007eb2e: FazlaOdeme'de Ali Veli kalemi yok, sekme süzgeçli Nakit 3.400, Kaan söz kalemi 3.000, Kişiler Ali −100.
- Kırmızı → yeşil: `ham/kirmizi-aday20-7ffc838-yeni-testler.out`. Aday 20'nin ayrı kopyasında 4 testin 4'ü kırmızı. Nedenler iletide: Ali Veli 1.000 kalemi; Nakit 3.000 ≠ 2.000; Kaan 1.000 ≠ 3.000; Dilek Su tutarsız kalem.
- Testler:
  - `mutasyon-kimlik-bag` 46/46. Tur 10 mutasyonları:
    - M45: eksi Kalan'da kalem çıkar.
    - M46: söz tutarı sonra okunur.
    - M47: boş sözde önceki kural yok.
    - M40: boş söz Kalan ile sınırlanmaz.
  - `komsu-testler` 1186/1186.
  - `goc-v243` 46/46.
- Bağımsız cari kâhini (is/kahin-244 27b2fb8, b3r/b3s dahil; dokunulmadı; `KAHIN_PROGRAM_KOKU`, program 007eb2e): `kahin-cari-27b2fb8-tum` 29 senaryo, 3632/3632, 0 fark.
- e2e (flock altında): run 50/50, senaryo-kayit-tahsilat-244 (zil / Tahsil Et) 46/46, senaryo-216 54/54, senaryo-210 57/57, senaryo-226 25/25, senaryo-k8-230 17/17, senaryo-cari-243 48/48, senaryo-rapor 90/90, senaryo (Tablodan Aktar) 47/47, senaryo-219 42/42, uiux-a-243 51/51, uiux-ui11-244 153/153, senaryo-kayit-bag-31e 43/43.
