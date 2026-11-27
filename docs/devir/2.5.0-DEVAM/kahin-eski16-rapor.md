<!-- Ajan ARA raporu AYNEN (13.11.2026; ajan sözü — kanıt değil; kanıt koşuları YAPILMADAN verildi) -->
## Cari kâhini bakım 16: rapor (ara durum)

**Durum:** Yorum commit'i ve kod commit'i dalda. İki saat dilimindeki kanıt koşusu YAPILMADI. Ölçüm kilidini (`scratchpad/olcum.lock`) ana oturumun hız ölçümü dışlayıcı tutuyor. Tutan süreç pid 10125: `flock -x -n … timeout 7000 bash scratchpad/c5a1f-olcum/hepsi.sh`. 08:59'dan beri her yoklamada kilit doluydu. Bekleme döngüsü kurmadım (ders 50). Bu yüzden G3 dökümü, mutasyon taraması, geniş tarama ve iki TZ öz test sayıları yok. KARARLAR.md'nin C0t (G3) ve Kanıt bölümleri de yazılmadı. Kilit boşalınca bu ajan sürdürülürse bunları koşar, yazar ve "Kanıt:" commit'ini atar. İsterseniz ana oturum kendisi de koşabilir (komutlar aşağıda).

**Dal:** worktree-agent-a24a9b176b2cdfc4a. Bakım 15 dalına sıfırlandı; `git log` bakım 15'in üç commit'ini gösteriyor: 6453ad3b, ead8f4b3, 5448c215. Push yok, ağaç temiz.
- `7d2522e4`: yorum, KARARLAR.md §27 (ders 40, kural koddan önce).
- `72783564`: kod. İçinde `model.py`, `oz-test.py` açıklaması, d44 (yeni), d41, d42 ve `docs/kanit/2026-11-13/kahineski16-arac/` araçları var. Bu commit'i karsilastir.py'deki bir satır birleşmesi hatası yüzünden bir kez `--amend` ile düzelttim; push edilmemiş, yalnız bu dalda.

### Yorum
**S155 (toplam ölçü).** Bakım 15 tarih ölçüsüyle okumuştu:
- Yalnız tahsilat adımı ve yalnız şüpheli tarihinden önceye tarihliyse denetleniyordu. Kayıt günündeki borçla K1 yeniden kuruluyordu.
- Kararın KABUL örneğinde bu okuma RET verirdi (bakiye 1.500), yani S155'in B seçeneği.
- SK-33 (tahsilat dışı adımlar), SK-34 (a) / (b) ve "tarihli borç kurulamıyor" durumları iki dünya düzeniyle susuyordu.

Yeni kural (Y16-1): şüpheli kaydı olan caride her adımdan sonra A' = açık şüpheli, B' = bakiye. A' > 0, B' < A' ve adım normal bakiyeyi düşürdüyse (B' − A' < B − A) adım RET olur. Tür fark etmez, tarih ölçüsü yok, tam eşitlik KABUL.

"Açık şüpheli"nin kayıtla nasıl değiştiğini kâhinin kendi §8 ŞÜPHELİ KALAN kuralından okudum (PLAN §3.11b/2, K1 / K3 / K7):
- Kayıt gününden sonra (aynı gün dahil) gelen alacak satırları şüpheliden düşer: bağsız tahsilat, evrak, elle Alacak, iade faturası, stok iadesi, Taksit Tahsilatı.
- Faturaya bağlı tahsilat ve önceye tarihli satır düşmez. Değersiz kendi kaydından düşer.

Bu okumanın yeni bir sonucu var, BAŞ MİMAR yorumu olarak kullanıcıya gösterilmeli: şüpheli tarihinden SONRA gelen faturaya bağlı tahsilat normal bakiyeyi aşarsa artık RET (d44 X9). Bakım 15 bunu hiç denetlemiyordu. Bağlı evrakı kâhin, bakım 6'dan beri olduğu gibi şüpheliden düşen saydı.

SK-33 ve SK-34 ile susturulan adımların hepsi artık değer alıyor. Şüpheliye alma adımı (K1, bugünkü bakiyeyle) aynen.

**S158.** Her kartta para dışı kapatıcının payı 'Tahsil Edilen'den ve taksit 'Ödenen'den çıkar: stok iadesi, Değersiz ve iade faturasının artanı. 'Kalan', bakiye ve gecikmiş değişmez. SK-32 kalktı. İade faturası artanını da saydım; dayanağı S151'in kendi metni ("İade faturasıyla … Tahsil Edilen 0") ve S158'deki "her kartta".

**S154.** Kâhinin dilinde 'Fazlasını Avans Yaz' seçeneği yok: `kart_tahsilat` seçeneksiz, `kos.mjs` de seçenek göndermiyor. Sınır tek biçimde çıkmadığı için S144 (c) SUS aynen sürüyor, yalnız neden metni değişti. Değer istenirse adıma alan ve koşucu eşlemesi gerekir; ayrı bakım.

**S156 / S157.** Neden metinleri "BİLİNEN SINIR (kullanıcı kararı S156 = C) S156" ve "… S157" oldu. Susma alanları değişmedi.

**Yorum commit'inden sonra yapılan düzeltme (açıkça):** Yorumda "kayıtları önceden kapanmış caride bakiyeyi eksiye indiren adım" da SUS diye yazılmıştı. Rastgele s1'de bu, 10 tohumun 8'inde onlarca adımı iki dünyaya düşürdü; s1 tohum 4'te de adımsız dünya çöktü. Okumayı yeniden tarttım: açık şüpheli tutarı 0 olan cari, şüpheli kaydı hiç olmayan cariyle aynı. Harfi okuma uygulanırsa her carinin avansını yasaklardı → kural bağlamaz, KABUL. Ayrıca adımsız dünyada, SUS adımının kurduğu kayda başvuran sonraki adımlar da çıkarılıyor. Düzeltmeden sonra rastgele 20 senaryoda SUS yok, çökme yok. §27'de "DÜZELTME" diye yazdım; baş mimar kullanıcıya göstermeli.

### Hâlâ sustuğum sınırlar
- **SK-35 (yeni):** adım açık şüpheliyi sıfırlıyor ve bakiyeyi eksiye indiriyor. Örnek: borç 1.000, şüpheli 900, bugün tahsilat 1.100. KABUL okumasında bakiye −100; RET okumasında bakiye 1.000, açık şüpheli 900.
- **Y16-4 (kâhinin sınırı):** adımdan önce kural zaten bozuk. Hiçbir senaryoda oluşmadı.
- S144 (c), S143 (a), S137 / S138 / S141 / S149, S156 / S157 susmaları aynen.

### Elle senaryolar (kâhin koşulmadan yazıldı)
**d44-c5-s155-s158 (73 denetim):**

| Durum | Senaryo | Sonuç |
|---|---|---|
| Kararın KABUL örneği AYNEN (sonradan borç 500) | X1 | KABUL, bakiye 1.200 |
| Kararın RET örneği AYNEN (yeni borç yok) | X2 | RET, bakiye 1.000 |
| Önceye tarihli çek, Alacak Yaz, borç silme, stok iadesi, geri yükleme | X3, X4, X5, X11, X10 | RET, bakiye 1.000 |
| Tarih değişikliği | X14 | RET, bakiye 700 |
| Bağlı tahsilat (şüpheliden sonra) | X9 | RET |
| Borç yetiyor | X6 | KABUL |
| Tam eşitlik | X7 | KABUL, görünüm 0 |
| Şüpheliden sonraki tahsilat | X8 | KABUL, bakiye 700, görünüm 100 |
| SK-35 | X12 | SUS |
| Kayıtları kapanmış caride avans | X13 | KABUL, bakiye −100 |
| S158: Değersiz | Y2 | Tahsil Edilen 0, Kalan 600 |
| S158: tahsilat + iade | Y4 | Tahsil Edilen 300, Kalan 300 |
| S158: satış kartında Değersiz | Y5 | Tahsil Edilen 0, Kalan 600 |

**Değişen eski beklentiler (karar gereği):**
- d41 S7 (çek): SUS → RET, bakiye 1.000.
- d41 S8: → KABUL, bakiye 950. S9: → KABUL, bakiye 1.100.
- d42 T7 (S158'in kendi örneği): Ödenen'ler 0 / 0 / 0 / 0.
- Bakım 15'in tarih ölçüsüne dayanan S1, S2–S6 ve d39 N11 beklentileri değişmedi.

**İlk koşuda bir elle hata:** X14'te `hareket:x14a:kalan` için 700 yazmıştım. Yanlıştı: elle Alacak KS2 gereği borcu kapatmaz. Kâhin bu anahtarı hiç yazmadı; değeri kâhine uydurmadım, anahtarı çıkardım. Öbür 72 elle değer ilk koşuda kâhinle aynıydı.

### Mutantlar
- **Yeni:** 299 (S155 B, tarih ölçüsü) ve 300 (yarım: yalnız tahsilatta toplam ölçü) S155 için; 301 (S158 B) ve 302 (yarım: yalnız stok iadesi sayılmaz) S158 için.
- **Anlamı değişenler:** 293 tahsilat hiç reddedilmez; 294 eşitlikte de ret; 295 aynı günün alacak satırı düşmemiş sayılır. 296 artık tarih ölçüsünün en katı biçimi; kararın KABUL örneği X1 de onu yakalıyor.
- Hepsi değerle yakalandı (mutant-senaryo; 293–302 için hangi senaryoların yakaladığı KARARLAR C10t'de).
- Mutant 121 (bağlı tahsilat da düşer) X9'u da yakalıyor.

### Test sayıları (yalnız UTC kabuğu, kanit.mjs dışında, ön koşular)
| Koşu | Sonuç | Not |
|---|---|---|
| Öz test | 6.374/6.374 | Y16-5 düzeltmesinden ÖNCE |
| Bütün elle tablolar | 3.392/3.392 | düzeltmeden sonra |
| d44 + d41 + d42 | 272/272 | |
| Eski kâhinde aynı 272 denetim | 50 kırmızı (d44 34, d41 9, d42 7) | beklenen nedenlerle: X1 eski RET bakiye 1.500, SK-33 / SK-32 alanında ANAHTAR YOK, X9 ve X12 eski KABUL |
| elle-fark | 97/97 izinli | |
| G1 tarama | 98/98 | |

İki saat dilimi ve mutasyon / G3 / geniş tarama koşulmadı.

**Ders 52 notu:** kilit doluyken birkaç kısa, yarım saniyeyi aşmayan tek süreçli koşu yaptım (elle-fark, eski kâhin kırmızısı, mutant 121 denetimi, sözdizimi denetimi). Bunlar ana oturumun ölçüm penceresine düşmüş olabilir.

### G3
Koşulmadı (kilit dolu). Sınıflar yazıldı (karsilastir.py): S155 ve S158; beklenen BEKLENMEYEN 0.

### KULLANICIYA SORULMALI
- **SK-35 (uç durum; bakiye okumalar arasında farklı).** Örnek: borç 1.000 (01.05) → 16.05 Şüpheli 900 → bugün tahsilat 1.100.
  - A (öneri: "açık şüpheli kalmadı, kural bağlamaz"): KABUL, bakiye −100 (100 avans).
  - B (kararın harfi: borç −100 < açık şüpheli 0): RET, bakiye 1.000, açık şüpheli 900.
  - C: Uç durum böyle kalsın (BİLİNEN SINIR).

### DENENMEYEN
- Program koşulmadı; ret iletisi / kodu bilinmiyor.
- Elle senaryoda yok: birden çok açık şüpheli kaydı, fatura iptali / silme, kart silme, iade faturasının önceye tarihli olması, havale.
- S158'de iade faturası artanının satış kartı olmayan kartı kapattığı elle senaryo yok.
- Y16-4'ün hangi yoldan oluşacağı bilinmiyor.
- İki şirket ve yedek geri yükleme.

### Ana oturumun koşacağı komutlar
Worktree'de, kilit boşken, önce `cat /proc/loadavg`:
- `bash docs/kanit/2026-11-13/kahineski16-arac/kos.sh utc` ve ardından `… kos.sh ist`. Eski kopya hazır: `scratchpad/kahineski16-eski` (6453ad3b, değişiklikten önce çıkarıldı). Çıktılar `scratchpad/kahineski16-kanit`'e gider.
- Ek: `python3 -I -B docs/kanit/2026-11-13/kahineski16-arac/s155-say.py --model test/bagimsiz/cari` (ret / SUS sayıları + değişmez; yük kilidiyle).
- `model.py` değişti → mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli. Yapım aşaması listesini açmadım.
- Koşucu `hareket_sil`, `hareket_geri_yukle`, `hareket_duzenle`, `evrak`, `alacak`, `stok_iade` adımlarında da "ret" okuyabilmeli.

### Okunan dosyaların tam listesi
- `scratchpad/kahin-eski16-istem.txt` 1–38 ve `scratchpad/kahin-eski16-kararlar.md` 1–31 (ikisi de tamamı).
- `CLAUDE.md` (oturuma yüklü hâli) ve `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` 1–82 (tamamı).
- `test/bagimsiz/cari/KARARLAR.md`: başlık taraması; satır 505–534, 920–968, 3233–3553 (§26 tamamı); ŞÜPHELİ KALAN / K1 / S144 / Avans Yaz geçen satırların grep'i.
- `test/bagimsiz/cari/model.py`: 60–68, 81 ve 350–375 (MUTASYONLAR), 1455–1466, 1482–1486, 3348–3373, 3380–3659, 3668–3674, 3741–3766, 3863–3903, 5060–5139, 5370–5469; ayrıca grep satırları.
- `test/bagimsiz/cari/oz-test.py`: 1–80 ve 280–339.
- `test/bagimsiz/cari/kos.mjs`: yalnız 595–624 (kart_ac / kart_tahsilat / fatura eşlemesi) ve grep satırları 479, 481, 601.
- Senaryolar: d41 S kısmı, d42 T2 / T7, d30 / d41 / d42 / d43 elleBelirsiz alanları; `*.json` üzerinde adım biçimi grep'i.
- `docs/kanit/2026-11-13/kahineski15-arac/`: kos.sh, bicim.py, elle-karsilastir.py, mutant-senaryo.py, karsilastir.py, elle-fark.py, mutasyon-tara.py (tamamı); yeni-senaryolar15.py 1–60; genis-tarama.py 1–40; g1-tara.py 1–12.
- `kahineski15-kos-utc.txt`: grep ile 12 satır.
- OKUNMADI: YAPIM-ASAMASI.json (eski kopyada da açılmadı), server/client/tools ve öbür yasaklı yollar, git geçmişi içeriği, defter klasörü.
