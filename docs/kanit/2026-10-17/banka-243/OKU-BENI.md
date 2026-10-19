# 2.4.3 Banka / Rapor Merkezi düzeltmeleri — kanıt

Kapsam (docs/2.4.3-IS-LISTESI.md): 57k T1, 26 C3, 27 C4, 28 C5, 29 C6, 49 C7, 50 C9, 52 C11, 53 C12, 55 C14, 56 C15.
Eski kod: `git archive 4d546e9` ayrı kopyada (scratchpad `banka243-eski-4d546e9`; ders 23, 25). Lisans servisi ölü adres (ders 30).

## T1 — senaryo-banka-210-eski-satir adım 2 "Banka Hesabı seçicisi:" boş (ara sıra)
- Hüküm: TEST yarışı, ürün doğru. Seçici `/bank/choices` yanıtıyla kurulur; tutar alanı ondan önce görünür. Test seçeneği seçici gelmeden okuyordu.
- Zorla üretme (ders 20): `BANKA210_YARIS=1500` (seçici isteği 1,5 sn geciktirilir). Düzeltmesiz test: adım 2 kırmızı (`t1/zorla-1500ms-duzeltmesiz.txt`,
  ön koşul 1/1 oluştu). Düzeltmeli: 3/3 yeşil (`t1/zorla-1500ms-duzeltmeli-{1,2,3}.txt`; her koşuda "seçici henüz yokken okunan form 1").
- Ürün denetimi (adım 2b, her koşuda kendi gecikmesiyle): seçici gelmeden Kaydet → iki hesapta 400 "Banka Hesabı seçin", satır yazılmaz, banka toplamları
  değişmez (sunucudan okundu); seçici gelince seçilen hesaba (Garanti) yazılır. Eski kodda da yeşil (ürün değişmedi).

## C3–C15 — e2e `test/e2e/senaryo-banka-rapor-243.mjs` (yeni; CI e2e + kapı listesinde)
- Eski kod (DEPO=eski kopya): 10 geçti, 29 kaldı — `e2e-senaryo-banka-rapor-243-eski-4d546e9.txt` (her bulgu denetimi kırmızı; "geç gelen eski yanıt
  yeni sonucu ezmez" ve "boş dönem" eski kodda da yeşil — koruma denetimi).
- Yeni kod: 38/38 — `e2e-senaryo-banka-rapor-243-yeni.txt`.
- Birim `test/banka-rapor-243.test.mjs` (C14 grup/sıra/yetki, C15 presets): eski 0/3, yeni 3/3 (`birim-…`).

## Bilerek güncellenen beklentiler (ders 28 — hepsi koşuldu)
- C14: Banka grubu listeleri (banka-210-raporlar, raporlar-230-banka, banka-210-ertelenen, senaryo-banka-210 adım 42, senaryo-banka-210-temel adım 7);
  Finans Raporları rolü Banka grubunda yalnız Banka ve POS Hareketleri'ni görür; hız eşdeğerliği fikstürü `group` alanı.
- C9: senaryo-223 Bulgu 4 ("₺300,00"); senaryo-banka-210 ön izleme okuyucusu ekran metnini dosya biçimine çevirerek karşılaştırır.
- C5: senaryo-220 1366×768 — TOPLAM artık pencere kaydırılmadan görünür (kutu ≥ 160 px).
- C11: senaryo-banka-210 / 210-temel / 210b / 220 / pos-220 açılış yardımcıları adımları Genel Bakış'tan başlatır.
- C4: rapor ön izleme bekleyicileri (banka-210, pos-220, supheli-230, tahsile-ver-220) aria-busy'yi bekler.

Gerileme koşuları: `docs/kanit/2026-10-1{7,8}/banka-243-*.json/.log` (tools/kanit.mjs kos).
