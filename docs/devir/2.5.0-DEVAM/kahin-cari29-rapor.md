# Cari kâhini bakımı 29: rapor (S266 = A, S265 = C)

## Özet
- **Sonuç:** Uzun Doğrulama'nın kâhin cari adımı kapandı. Tabanda 22 fark vardı, şimdi 0. Programla iki saat diliminde (UTC ve Europe/Istanbul) de 0 fark var. **P listesi boş.**
- **Çalışma yeri:** taban `ud3-sinama` = 35fbfe44 (doğrulandı). Kendi dalım `worktree-agent-a512c4c9a6a5549a7`, dal ucu **403ec16e**. PUSH yok.
- **Yazdığım yerler:** yalnız `test/bagimsiz/cari/**` ve `docs/kanit/2026-11-26/kahin-cari29-*`.
- **Kurallar:** KARARLAR.md §41'de. Yorum commit'i kod commit'inden önce atıldı (ders 40).
- **Kendi kural ihlalim:** hazırlıkta KARARLAR.md başlıklarını okuyan bir `python3 -I -c` satırını kilitsiz koştum. Bunun dışındaki bütün koşular `flock -s -w 3600 … timeout` altında koştu.

## Değişen ve kalkan susmalar (girdinin satırına göre)
- **S266 (girdi §1, KAPSAM: "tek taraflı kuyruğun artanını avans kalemi diye yazdığı yer"):**
  - **Alan:** yalın olmayan caride neden "şüpheli / değersiz" ya da "KS8" ise ve cari bağsız Ödeme ile alınan avans (tahsilat, alınan evrak, bağ fazlası) taşıyorsa.
  - **Kural:** Ödeme, kendi **anındaki** açık alınan avansı kapatır (Y29-2). İki tarafın zaman çizelgesi kararlı olana dek yeniden hesaplanır.
  - **Alacak yönlü kalem yoksa:** iade geri ödemesi (K-b, KS8.1, KS8.2) önce gelir, değişmez. Fazlası avansı kapatır, verilen avans kalemi kalmaz (Y29-3 (a)).
  - **Alacak yönlü kalem varsa:** avans ile Alacak tek vade sırasıyla kapanır (Y29-3 (b)).
  - **Y5-7 susması:** yalnız S266'dan sonra kalan verilen avansa bakar. Bu yüzden iade geri ödemesi tamamlanmış carideki yanlış susma kalktı.
- **SK-54 susması (yeni):** avans ile iade notu arasındaki sıra iade geri ödemesinin tutarını değiştiriyorsa kâhin susar. Girdi bu sırayı söylemiyor ("yalnız avans ↔ Alacak kapama sırası").
- **S265 (girdi §2):** dört koşulun hepsi birlikte aranır:
  - cari türü tedarikçi ve etkin Alış İadesi var;
  - bağsız tahsilat var;
  - geri tahsil edilmemiş, açık bir alış iadesi var;
  - aynı GÜN hem stok satışı hem Alış İadesi var.
  - Bu bileşimde alış faturasının `acik`, `gosterilen`, `liste:gosterilen`, `kartta` ve `taksitte` denetimleri SUS. Neden metni "BİLİNEN SINIR (kullanıcı kararı S265 = C) S265". Bakiye ve öbür alanlar yazılır.
  - Bileşim yoksa susma yok: d61 U8 (stok satışı ertesi gün) değerle denetleniyor, alış açığı 750.

## Öz test ve mutasyon
- Öz test **9.443/9.443**, iki saat diliminde.
- Mutantların hepsi d61'de yakalandı; program koşusunda da yakalandı:

| Mutant | Ne yapar | Nasıl yakalandı |
|---|---|---|
| 362 | S266 yok | değerle |
| 363 | S104 B (önce yükümlülük) | değerle |
| 365 | S265 susması bileşim dışına taşar | değerle (U8 `fatura:A8:acik`) |
| 364 | SK-54 susması yok | SUS kuralıyla |
| 366 | S265 susması yok | SUS kuralıyla |

## G3 (eski kâhin = taban ↔ yeni)
- 675/675, **BEKLENMEYEN 0**, yalnız etiketi değişen 0.
- Eşdeğerlik (2.4.9 / 2.4.6 / 2.4.5 / legacy) 540/540 bayt bayt aynı. Üretici 20/20 aynı dizi. Eski 114 elle senaryoda adım da beklenti de değişmedi.
- Değişen denetimler 732, hepsi sınıflı:
  - **S266:** 265 yeni + 19 değişen (d61, rastgele s1-4 ve s1-5; eski kâhinde Y5-7 susuyordu);
  - **SK54:** 12 kalkan (d61 U4);
  - **S265:** 432 kalkan (d61 U7, rastgele s1-3 ve s1-10);
  - **GENEL:** 4 yeni sayaç (s1-4).
- Döküm UTC ile Europe/Istanbul arasında bayt bayt aynı.

## Program ↔ kâhin (iki saat dilimi)

| Düzen | Önce (taban kâhin) | Sonra |
|---|---|---|
| CI (`npm run test:kahin-cari`) | 25.164/25.164 | **25.298/25.298** (d61 134/134) |
| Uzun Doğrulama (`--tohum 1-30 --islem 120`) | 175.649/175.671, **22 fark** | **175.143/175.143**, 0 fark |

Her iki düzende: 7 bilinen sınır, 0 okuma hatası, 0 yakalanmayan mutasyon.

Tabandaki 22 farkın nereye gittiği:
- **s1-30, müşteri E, 7 fark (S266):** kâhin kural metninden programın sayısını verdi. Örnek: Ödeme s015'in avans kalemi "yok", Borç s018'in Kalan'ı 88.134.
- **s1-12, tedarikçi S, 15 fark (S265):** artık SUS (BİLİNEN SINIR). Gözlem: program A4'ü 1.415, A5'i 132.071 açık gösteriyor; eski kâhin 0 ve 74.189 diyordu.

## Yapım aşaması listesi
- Kendi kopyamda `--yapim-asamasi-yaz` (UTC): 0 kayıt → 0 kayıt. Yeni 0, kapanan 0, değeri değişen 0.
- Üretilen dosya depodakiyle bayt bayt aynı, depodaki listede değişiklik yok.
- `kanit.mjs` bu koşuyu "BELİRSİZ (özet satırı tanınmadı)" diye yazdı; `kos.mjs`'in kendi çıkışı 0.

## Eski kâhin kırmızısı (d61)
- **50/74 kırmızı**, nedenleri beklenen:
  - U1: eski kâhinde Y5-7 susuyordu, anahtarlar yok;
  - U2 / U3 / U5: eski kâhin Ödeme'ye 100 / 200 / 100'lük "Tahsil Edilecek Borç" kalemi yazıyor, sonraki Borç'un Kalan'ını 0 veriyor;
  - U4 ve U7: elle tabloda yok olması gereken anahtarlar eski kâhinde değerle yazılıyor, SK-54 ve S265 belirsiz kayıtları yok.
- Yeni kâhinde d61'in ilk koşusunda 74/74 tuttu; elle hesapta düzeltme yapılmadı.
- Program ↔ eski kâhin (d61): 106/130.

## d61 elle senaryosu
- Beklenenler karar metninden elle yazıldı, kâhin koşulmadan (üreteç `uret-d61.py`, commit 60abbade — kod commit'inden önce).
- Taşıyıcılar:
  - **U1 — KS8 carisi + kararın örneği:** Alacak 200 açık, verilen avans yok, bakiye −400.
  - **U2 — KS8, alacak yönlü kalemsiz:** sonraki Borç'un Kalan'ı 50, Σ açık = bakiye.
  - **U3 — şüpheli / değersiz kayıtlı cari:** sonraki Borç'un Kalan'ı 150.
  - **U4 — SK-54:** SUS.
  - **U5 — Alacak'ın vadesi avanstan önce:** Alacak kapanır.
  - **U7 — S265 bileşimi:** alış faturası SUS.
  - **U8 — bileşimsiz:** alış açığı 750, değerle.

## KULLANICIYA SORULMALI
**SK-54 (UÇ DURUM; para kuralı, ders 43).** KS8 carisinde Alacak da varken, avans ile açık iade notu hangi sırayla kapanır?
- Örnek: 01.03 tahsilat 500 · 05.03 Alacak 200 (vade 30.04) · 08.03 faturasız stok iadesi 100 (borcu yok) · 10.03 Ödeme 300.
- **A:** önce iade geri ödemesi. Not 100 kapanır, kalan 200 avanstan düşer: avans 300, Alacak 200 açık.
- **B:** tek vade sırası. Avans 01.03 önce: avans 200, not 100 açık, Alacak 200 açık.
- **C (ÖNERİ):** Uç durum böyle kalsın (BİLİNEN SINIR — kâhin susar).
- Bakiye her seçenekte −500. Alacak her seçenekte 200 açık; program da 200 gösteriyor (gözlem).
- Yaygın programlarda: doğrulanmış kaynak okunmadı.

Baş mimarın görmesi gereken okumalar (soru değil):
- Y29-3 (a): alacak yönlü kalem yoksa "iade önce, fazlası avansa" okuması seçildi. Dayanak KAPSAM'daki "iade kuralları DEĞİŞMEZ" ve "artanı" sözleri.
- Y29-1: S266'nın alanı yalnız girdinin saydığı iki tür (KS8, şüpheli / değersiz). Öbür yalın olmayan türlerde bugünkü kural sürüyor.

## SONRAKİ SÜRÜME (2.5.1)
- Rastgele üreticiye müşteri carisinde elle Alacak + alınan avans + bağsız Ödeme (S266 (b) kolu) ve açık şüpheli kayıtlı caride Ödeme.
- S265 belirsiz kaydı fatura başına yineleniyor; cari başına tek satır yeter (görünüm ayrıntısı).
- Bakım 28'in 2.5.1 listesi aynen.

## DENENMEYEN
- S266 alanında müşteriye ciro ile bağ / geri ödeme fazlası: kural kodda var, elle senaryo yok.
- Açık (Değersiz yazılmamış) şüpheli kayıtlı caride S266: elle senaryo yok.
- Alacak ile açık iade notunun birlikte olduğu ve iade geri ödemesinin değişmediği kol: yalnız U1 var.
- S266 alanı dışındaki yalın olmayan türler: girdinin konusu değil.
- Rastgele üretici müşteriye elle Alacak üretmiyor; S266 (b) kolu yalnız elle senaryoda.

## Değişen yollar
- `test/bagimsiz/cari/model.py`: `_tyk` (yeni `s266` parametresi, "e" olayı, tavan), `_alacak_govde250`, `_borc_tarafi_250`, yeni `_s266_*` ve `_s265`, `kuyruk` / `kuyruk_borc` / `_geri_odemeler` başına `_s266_kur` çağrısı, `_s98_iki` tedarikçi dalı, `kontrol_v3` alış kolu, mutantlar 362–366.
- `test/bagimsiz/cari/oz-test.py`: SUS kuralı kümesine 364 ve 366 eklendi.
- `test/bagimsiz/cari/KARARLAR.md`: §41.
- `test/bagimsiz/cari/senaryolar/d61-c5-s266-s265-yalin-olmayan.json` (yeni).
- `docs/kanit/2026-11-26/kahin-cari29-arac/`, `kahin-cari29-kanit/`, `kahin-cari29-rapor-taslak.md`.
- `kos.mjs`, `YAPIM-ASAMASI.json` ve `BILINEN.json` değişmedi.

## Commit listesi (eskiden yeniye)
e5fcb96e (yorumlar) · 60abbade (d61) · ad4d9ae7 (model + öz test) · 587cc09e (araçlar) · 8a657756 (KARARLAR kuralları) · 503a77cb Kanıt UTC · 4f436a62 Kanıt Europe/Istanbul · 581745b0 Kanıt (yapım listesi, eski kâhin, son hâl) · 403ec16e (rapor taslağı). **Dal ucu: 403ec16e.**

## Ana oturumun yeniden koşacağı komutlar
Kendi ağacında, `HUKUK_LICENSE_URL=http://127.0.0.1:9` ile, TZ=UTC ve TZ=Europe/Istanbul için ayrı ayrı:
- `python3 -I -B test/bagimsiz/cari/oz-test.py` → 9.443/9.443
- `npm run test:kahin-cari` → 25.298/25.298
- `npm run test:kahin-cari -- --tohum 1-30 --islem 120` → 175.143/175.143
- G3 ve eski kâhin kırmızısı: `docs/kanit/2026-11-26/kahin-cari29-arac/kos.sh <utc|ist> <oz|g3|elle|program|uzun|program-eski|yapim>`
  - Betikteki ağaç yolu (`W`) ve eski kopya yolu kendi ağacına göre değiştirilmeli.
  - Eski kopya: `git archive 35fbfe44 test/bagimsiz/cari | tar -x` ile ayrı klasöre.
  - Ham çıktılar not defterinde: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kc29-a51/`.

Disk boş alan 5,6 GB. Not defterindeki büyük ham klasörleri (uzun-*, program-taban-*) tam yolla sildim.
