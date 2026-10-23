# 31e tur 9 Z1 — is/r31e-f, kod 9550df7 + a97cd52 (taban aday 19 = 3f62487)

## Bulgu ve karar
Tek vadeli taksit tablosunda (Ad Soyad, Taksit Tutarı, Kalan Borç, Sonraki Taksit Tarihi) Takvim / Vade / Nakit kalemi taksidi değil bütün Kalan'ı gösteriyordu. Bu, 975217f'nin K4 değişikliğinin gerilemesiydi.

| Kişi | Taksit | Kalan | v2.4.3 kalemi | aday 19 kalemi | Düzeltme sonrası |
|---|---|---|---|---|---|
| Kaan Uz | 1.000 | 9.000 | 1.000 | 9.000 ("gecikmiş") | 1.000 |

- Nakit Beklenen: v2.4.3 3.500, aday 19 13.500, düzeltme sonrası 3.500.

Karar (baş mimar, kâhinle aynı metin):
- Satırın TEK dönem / taksit kolonu varsa (Taksit Tutarı, Aidat, Kira, Aylık Ücret…) kalem = min(dönem tutarı, Kalan hücresi). Kalan boşsa dönem tutarı alınır; satır borcu belirlenemeyen satırda da (Y3 Murat Al: Aidat 800).
- Dönem kolonu yoksa ya da birden çoksa kalem satırın borcudur; borç belirlenemiyorsa kalem tutarsızdır ve not çıkar.
- Ödeme sözü kalemi söz tutarıdır, sınırlanmaz.
- Tablodaki Kişiler ve Açılış Bakiyesi satır borcunda (Kalan) kalır.

## Nasıl bozulur
- Taksit tutarı Kalan'dan küçük: kalem bütün Kalan olur.
- Taksit Kalan'dan büyük (Nur Ay 1.500 / 600): kalem Kalan'ı aşar.
- Kalan boş (Mert Can): kalem kaybolur.
- İki adaylı Y3 satırında (Aidat + Gecikme Faizi, Kalan boş) kalem kaybolur.
- İki dönem kolonu (Aidat + Kira): yanlış kolon seçilir.
- Söz kalemi Kalan'la sınırlanır.
- Kişiler / Açılış Bakiyesi kalemle değişir.

## Kanıt
- Yeniden üretim (`betik/tablo-kos.mjs` + `betik/taksit-kalan.json`): `ham/z1-v243.out`, `ham/z1-aday19-3f62487.out`, `ham/z1-a97cd52.out`.
- Kırmızı → yeşil: `ham/kirmizi-aday19-3f62487-yeni-testler.out`. Aday 19'un ayrı kopyasında 6 testin 4'ü kırmızı; nedenler iletide (Kaan 9.000 ≠ 1.000; Nakit 14.100 ≠ 4.100; Hale 530 ≠ 500).
  - İki dönem kolonu testi aday 19'da da yeşil. Koruma testidir; dişi M43 mutasyonunda.
- Testler:
  - `mutasyon-kimlik-bag` 43/43 (M34, M40, M42, M43, M44 Z1).
  - `komsu-testler` 1182/1182.
  - `goc-v243` 46/46.
- Bağımsız cari kâhini (is/kahin-244 0f23768 "çatal kaldırıldı"; dokunulmadı; `KAHIN_PROGRAM_KOKU`, program a97cd52): `kahin-cari-0f23768-tum` 27 senaryo, 3574/3574, 0 fark.
- e2e (flock altında): run (okul servisi pil → cari → Tablodan Aktar) 50/50, senaryo-kayit-tahsilat-244 (zil / Tahsilat Gir ön dolumu) 46/46, senaryo-216 54/54, senaryo-210 57/57, senaryo-226 25/25, senaryo-k8-230 17/17, senaryo-cari-243 48/48, senaryo-rapor 90/90, senaryo (Tablodan Aktar) 47/47, senaryo-219 42/42, uiux-a-243, uiux-ui11-244 153/153, senaryo-kayit-bag-31e 43/43.

## Beklenti değişiklikleri (karar)
`test/tablo-borc-r31e.test.mjs` tur 8 Y3 testlerinde iki değişiklik var:
- Takvim kalemleri:
  - Hale 530 → 500 (Aidat 500 < Kalan 530).
  - Gül ve İlker tutarsız → Aidat 500. Borçları yine yok, not yine var.
- Vade ve Nakit 3.780 → 4.750 (kalemler). Tablodaki Kişiler 3.780 aynı kaldı.
