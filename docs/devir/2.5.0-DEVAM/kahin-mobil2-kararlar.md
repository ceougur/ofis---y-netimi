# Mobil yazma kâhini bakımı 2 (S154 / S151 / S158 / S165) — GİRDİLER (ana oturumun yazdığı özet dosya; ders 5 koruması)

Bu dosya mobil yazma kâhinine (test/bagimsiz/mobil-yazma) şunları verir: (1) taksit kartının 'Tahsil Edilen' göstergesiyle ilgili üç kullanıcı kararı; (2) karttan tahsilat sınırıyla ilgili karar; (3) cari kâhininin bakım 15–18 ile değiştiği bilgisi. Kullanıcıya gösterilen soru metinleri AYNEN aktarılmıştır; içlerindeki 'program bugün' / 'bugün' sözleri ve örnek sayılar kural kaynağı DEĞİLDİR — KURAL KAYNAĞI yalnız KARAR satırlarıdır.

## 1. S154 — 'Fazlasını Avans Yaz' ile kapanan kartta 'Tahsil Edilen' (bakım 1 raporundaki SM-1 sorun)
Kullanıcıya gösterilen soru (AYNEN):
kart 1.200 TL / 3 taksit; karttan 500 TL tahsilat; sonra karttan 800 TL 'Fazlasını Avans Yaz' ile (kalan 700'dü → 100 TL avans; bakiye −100). Kartın 'Tahsil Edilen' göstergesi ne yazsın? PROGRAM BUGÜN (koşuldu): 'Tahsil Edilen 1.300 · Kalan 0', ayrıca 'fazla 100'; taksit satırları 400 / 400 / 400; cari bakiye −100 (2.3.0'daki 'Ödenen avansı da içerir' kuralı). S129 = A'nın sözü ('göstergeler carinin tek sırasından') bu durumu söylemiyor. A: Tahsil Edilen 1.200 (kartın tutarını aşmaz; 100 TL yalnız 'fazla / avans' olarak görünür). B (ÖNERİ): bugünkü gibi 1.300 (karttan gerçekten 1.300 TL alındı; 'fazla 100' ayrıca yazıyor) — kod değişmez, kâhin tek değere iner. C: böyle kalsın, kural yazılmasın (kâhin iki değeri de kabul eder).

KARAR (kullanıcı 13.11.2026 07:31 UTC, AYNEN: "b"): S154 = B — 'Fazlasını Avans Yaz' ile kapanan kartta 'Tahsil Edilen' karttan alınan paranın TAMAMIDIR (örnekte kart 1.200 / 3, karttan 500 + 800 avanslı → 'Tahsil Edilen 1.300 · Kalan 0', fazla 100 ayrıca; bakiye −100).
NOT (ana oturum): bakım 1'de bu alanda İKİ değeri de kabul ediyordun; karar tek değere (1.300) indirir.

## 2. S151 ve S158 — iade tahsilat değildir
S151 — kullanıcıya gösterilen soru (AYNEN):
taksit kartının 'Tahsil Edilen'i FATURASIZ stok iadesini sayar mı? ÖRNEK: Borç 500 + stoktan satış kartı 1.000 (2 × 500) + faturasız stok iadesi 300 → bugün kart 'Tahsil Edilen 300 · Kalan 700', 1. taksit 'Ödenen 300' (bağsız 300 tahsilatla birebir aynı görünüm); iade FATURASIYLA yapılınca kart küçülüyor, Tahsil Edilen 0. Bakiye (1.200) ve Kalan (700) iki okumada aynı. A: sayar (bugünkü). B (ÖNERİ): saymaz — iade tahsilat değildir; Tahsil Edilen 0, Kalan yine 700 (iade ayrı gösterilir). C: böyle kalsın (BİLİNEN SINIR).
KARAR (kullanıcı 13.11.2026 06:12 UTC, AYNEN: "önerilerini uygula"): S151 = B — taksit kartının 'Tahsil Edilen'i (ve taksit satırının 'Ödenen'i) FATURASIZ stok iadesini SAYMAZ: iade tahsilat değildir; örnekte 'Tahsil Edilen 0', 'Kalan' yine 700, bakiye 1.200; iade ayrı gösterilir (iade faturasıyla yapılan iadede kart küçülür, Tahsil Edilen 0 — aynen).

S158 — kullanıcıya gösterilen soru (AYNEN):
S151 = B ('iade tahsilat değildir') satış kartı OLMAYAN kartta da geçerli mi? Borç 900 → kart 900 (mevcut borç kartı) → faturasız stok iadesi 300; Kalan 600. A (ÖNERİ): evet — her kartta 'Tahsil Edilen 0' (iade ve Değersiz yazma tahsilat sayılmaz; tek kural). B: yalnız satış kartında; öbür kartta 'Tahsil Edilen 300'. C: Uç durum böyle kalsın — BİLİNEN SINIR.
KARAR (kullanıcı 13.11.2026 08:35 UTC, AYNEN: "önerilerini uygula"): S158 = A — 'iade tahsilat değildir' HER kartta geçerlidir: satış kartı olmayan kartta da faturasız stok iadesi ve Değersiz yazma kartın 'Tahsil Edilen'ine / taksit satırının 'Ödenen'ine SAYILMAZ (örnek: Borç 900 → kart 900 → iade 300: 'Tahsil Edilen 0', 'Kalan 600').

## 3. Karttan tahsilat sınırı (S118 = B'nin devamı) — kâhininde alanı varsa
S118 = B (kullanıcı 11.11.2026 06:14 UTC; bakım 1'de sana verildi): taksit tahsilatında 'Kalanı Aşan Tutar' / 'Kart Ödendi' sınırı, sorusu ve formda önerilen tutar kartın KENDİ kalanından gelir.
S165 = A (kullanıcı 13.11.2026 17:48 UTC, AYNEN: "önerilerin uygun"): karttan tahsilatta 'Kalanı Aşan Tutar' sınırı YALNIZ karttan alınan parayı sayar; faturasız iade (ve Değersiz yazma gibi para dışı pay) sınırı küçültmez (örnek: Borç 900 + Borç 500 → kart 900 → faturasız iade 300 → karta 700 sormadan KABUL, bakiye 400; ardından aynı karta 600 RET — kalan 200).
BAŞ MİMAR OKUMASI (kullanıcıya gösterildi; 'BAŞ MİMAR OKUMASI' diye yaz): S118 = B gereği carinin avansıyla ödenmiş kısım da sınırı küçültmez (S118'in kendi örneği: kart 1.000, karttan 300, başka yerden 100 avans → sınır 700).
'Fazlasını Avans Yaz': tutar sınırı aşıyorsa kayıt ancak kullanıcının 'Kalanı Aşan Tutar' sorusuna 'Fazlasını Avans Yaz' yanıtıyla yazılır; yanıt yoksa HİÇBİR kayıt yazılmaz (ret). Kâhininin adım dilinde bu yanıt için alan yoksa ve bir senaryon sınırı aşan tahsilat taşıyorsa: adıma alan ekle, raporda alanın adını / değerlerini ve etkilenen senaryoları tek tek yaz (sürücü eşlemesi ana oturumun işi — `program-surucu.mjs`'i DEĞİŞTİRME).

## 4. Cari kâhini değişti (bilgi)
Cari kâhini (test/bagimsiz/cari) bakım 15, 16, 17 ve 18 ile değişti (KARARLAR.md'sinde §26–§29): yukarıdaki kararların cari kâhinindeki karşılığı orada işlendi (kart göstergeleri, iade payı, 'Fazlasını Avans Yaz' seçeneği — cari kâhininde adım alanı `fazlasiniAvansYaz` —, sınır kuralı) ve bazı alt durumlarda cari kâhini bilerek SUSUYOR (S144 = C, S156 / S157 = C, S162 = B, S163 = C, S166 = B — bilinen sınırlar). Kendi başına yeni kuyruk / gösterge kuralı YAZMA: bu alanlarda cari kâhininin verdiği değeri kullan; cari kâhininin sustuğu yerde SEN DE SUS. Kabul dosyan cari kâhininin modeline bağlıysa yeniden üretilmesi gerekir.
