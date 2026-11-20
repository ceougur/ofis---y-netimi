# TOPLU KÂHİN BAKIMI 14 — muhasebe kâhini bakımı 14 + cari kâhini bakımı 22: RAPOR

Dal: `worktree-agent-aa6366f4d4126b97f`. **Dalın ucu 4588176d.** Hiçbir şey gönderilmedi (push yok), zamanlanmış görev kurulmadı.
Taban `kahin-toplu14-taban` = 15f023f1. Muhasebe kâhininin son bakımı e779340f (bakım 13), cari kâhininki a52d2768 (bakım 21b) olarak doğrulandı.

Commit sırası:
- e75937dc — yalnız yorum (ders 40).
- cccba81f — senaryolar ve testler, model değiştirilmeden önce.
- 54ec97d3 — model.
- 39aa0612 — koşu betiği; mutasyon.py'ye `MUTASYON_ARALIK` eklendi. Bu ekleme koşuyu bölmek içindir, sonucu değiştirmez.
- 320a86dd, d05bcb6d, 135092a2, 4588176d — "Kanıt:" commit'leri.

## Bakımın en önemli bulgusu
A1 (S200), girdideki "kâhin bakım 13'te A ile kuruldu" sözüne karşın bakım 13'te **kurulmamıştı**. Kâhin bu alanda susuyordu: README bakım 13 Ü21 ve KULLANICIYA SORULMALI 1, kodda `raise AssertionError("… elle borçlar kart tutarından az; kâhin susar")`. Alan bu bakımda kuruldu.

## Madde madde yorum
**A1 — S200 = A (muhasebe İ1): kuruldu.**
- Mevcut Borç kartı açıldığında açık borç kart tutarından fazlaysa ve karta eşit tek elle borç yoksa (S110), elle borçların toplamı da kart tutarından azsa:
  - kart önce bütün elle borçları eskiden yeniye alır;
  - eksik kalan kısmı faturalardan alır.
- Faturaların kendi aralarındaki sırası kararda yazılı değil. M1e'nin S2 sırasını kullandım (vadesi önce gelen önce). Baş mimar bunu değerlendirmeli.
- Kart tutarı değişmez.
- Kararın örneği: F1 açık 20.000, 16.02'de gecikmiş 20.000.
- Açık Faturalar'da F1 20.000 görünür. Bu sayı kararın sayısından çıkıyor, o yüzden kâhin bu alanda susmuyor, değer yazıyor.
- Bakım 13 KS 2'nin susmaları aynen sürüyor: fatura / Borç Yaz dışında borç kalemi olması, karta eşit birden çok elle kalem olması.

**A2 — S210 = A ve S211 = A (muhasebe İ2 / İ3): kuruldu.**
- Eski kural (karar (4), R4): faturası iptal edilen kart küçülürdü.
- Yeni kural: iptal edilen faturanın herhangi bir kısmını içine almış her Mevcut Borç kartı **kapanır**. Kart taksitsiz kalır; `kartlar` raporunda S15 düzeniyle `{kapali: true, taksitler: []}` görünür.
- Kartın içine aldığı elle borç kendi vadesiyle carinin kuyruğuna döner. Kartın tahsilatı kendi tarihinde avans olur.
- Defter değişmez.
- Sil ile kalkan faturada karar (4) aynen geçerli (KS 1).
- Kâhinin sustuğu (senaryo hatası) üç durum (KS 2):
  - iptalden önce Kartı Kapat ile kapatılmış kart;
  - şüpheli kaydı olan cari;
  - iptalden sonra kapanmış karta tahsilat ya da Kartı Kapat.

**A3 — S213 = B (muhasebe İ4).**
- Açık Faturalar satırının kalanı artık iki parçanın toplamı: faturanın cari kuyruğundaki kalanı ve şüpheli kuyruğundaki kalanı.
- Eski kâhin şüpheliye alınmış kısmı göstermiyordu; bu, S213'ün A seçeneğiydi.
- Satırdaki "Şüpheli" işareti kâhinin dilinde yok; yalnız listeleme kuralı kuruldu.
- Değersiz yazılmış şüpheli faturası olan carinin Açık Faturalar raporunda kâhin susar. Bunun için yeni bir `susmalar` kaydı türü var: `{kural:"S213", rapor, cari, tarih, dosya}` (KS 3).

**A4 — S188 = C, S191 = C, S193 = C (muhasebe İ5–İ7).** Kâhin üçünde de zaten susuyordu; kodda (`_s179_sinif`, `_s181_sinir`) doğrulandı. Değişen yok.

**A5 — S205 = A ve S220 = A (muhasebe İ8).**
- Eski hâl: Kartı Kapat kalanı, kapanış günü vadeli tek kalemdi. Bu S220'nin B seçeneğiydi.
- Yeni hâl: kapanıştan önce vadesi geçmiş taksitin kalanı kendi vadesinde ayrı bir `kart_kalani` kalemi olur. Vadesi gelmemiş kalanlar kapanış tarihli tek kalemde toplanır.
- Sonuç: kapanış günü gecikmiş 0'a inmez; ertesi gün kalanın tamamı gecikmiş olur.

**A6 — S219 / S221 / S222 (muhasebe İ9).** Kâhinin `taksit_excel` olayı carisiyle gelir; kişi eşleştirmesi ve satır atlama dilde yok. Yalnız yorum, DENENMEYEN ve "sürücü için" notu yazıldı.

**B1 — S210 = A ve S211 = A (cari Y22-1 / Y22-2).**
- SK-41 (a) ve SK-41 (b) kartları da artık kapanır; kapanmış kartın göstergeleri SUS.
- Girdinin sorduğu KI2 / KI3 `toplam` anahtarlarının dayanağı (Y22 "BUGÜNKÜ okuma"): bakım 21b'deki 900, S210 / S211'in hiçbir seçeneğinin okuması değildi. Bakım 21b'nin geçici susma düzeni kartı değiştirmeden açık bırakıyordu; 900 bunun yan ürünüydü.
  - S210'un B seçeneği kartı 400'e küçültürdü.
  - KI3'teki 900, S211'in B seçeneğiyle yalnız rastlantıyla aynı.
  - A seçeneğinde ikisi de SUS'a döner.

**B2 (cari Y22-4 / Y22-5).** Yalnız yorum; dil eki yapılmadı. Kartı Kapat bu dilde yok. Excel / Tablodan Aktar yolu kişiyi kayıt no ile bağlar, ad + telefon eşleştirmesi yok.

## SUS'a dönen / SUS'tan çıkan anahtarlar
**SUS'a dönen:**
- Cari d50 — `k1:kart:KI2:var`, `toplam`, `mevcutBorc` ve `k1:kart:KI3:var`, `toplam`, `mevcutBorc` (B1).
- Cari d51 — KJ1–KJ3'ün aynı üç anahtarı (yeni senaryo; eski modelde yazılıyordu).
- Muhasebe — yalnız yeni susma kayıtları: S213 susması (A3) ve S210 sınır susmaları (A2). Eski bir anahtar SUS'a dönmedi.

**SUS'tan çıkan:**
- Muhasebe — bakım 13'ün "elle borçlar kart tutarından az" sınıfı (A1): `test_A7_S120`'nin susan örneği artık değer.
- Cari d50 (B1):
  - I2: `gecikmis` 10.000, `acikToplam` 10.000, `acikEsitBakiye`;
  - I3: `gecikmis` 0, `acikToplam` 0, `acikEsitBakiye`;
  - `hareket:i2b` (kalan / vade / beklenen), `takvim` / `vadeTakip` / `projeksiyon:hareket:i2b`, `takvim:fatura:FI2` / `FI3`;
  - GENEL: `projeksiyon:cari`, `takvim:cariKalemSayisi`.

## Yeni ve değişen elle senaryolar (değerler elle hesaplandı, hesaplar yorumlarda)
- **s118 (S200):** C1 kararın örneği — gecikmiş 16.02'de 20.000, 02.03'te 50.000; F1 açık 20.000; kart 2 × 30.000 değişmeden. C3'te eksik kısım vade sırasıyla alınıyor: F2 açık 30.000, 20.02'de gecikmiş 0.
- **s119 (S210 / S211):**
  - C1: BY açık 10.000, gecikmiş 10.000, kart kapalı.
  - C2: F2b açık 20.000.
  - C3 (kısmi tüketen kart): gecikmiş 20.000.
  - Hatırlatma {C1 10.000, C2 20.000, C3 20.000}.
- **s120 (S213):** Açık Faturalar F1 100.000 ve F2 50.000; şüpheliden düşen nakitten sonra F1 70.000. 128|C1 90.000.
- **s121 (S220):**
  - 10.04 (kapanış günü) gecikmiş 30.000 (vade 01.04); 11.04'te 60.000.
  - Sonradan gelen 20.000 tahsilat önce 01.04 kalemine düşer; 21.04'te gecikmiş 40.000.
  - C2 (S205 kontrolü): 16.03'te 60.000.
- **s58 C2 (karar gereği):** `g2a` 0 → 2.000; `kt2` kapandı. Bakiye aynı.
- **Cari d51 (yeni, bugün 20.04):** J1 bakiye / gecikmiş / açık toplamı 100; J2 500 (FJ2b açık 500); J3 200; Kasa 300.
- **Cari d50:** I2 ve I3'ün yukarıdaki değerleri.
- Bütün yeni değerler modelin ilk koşusunda tuttu.

## SÜRÜCÜ İÇİN (alanı değişmeyen ama anlamı ya da sonucu değişenler)
1. `taksit_karti {kaynak: mevcut_borc}`: S200 sınıfında kâhin artık değer yazar.
2. `iptal {kaynak: <satış faturası>}`: kartı içine almış fatura iptal edilince kart kapanır, kalemler kuyruğa döner.
3. `acik_faturalar`: kalan = cari kuyruğu + şüpheli kuyruğu. Yeni `susmalar` kuralı "S213" (biçimi S192 ile aynı).
4. `taksit_kapat`: kalan artık birden çok `kart_kalani` kalemi; bu, `gecikmis.detay`, `acik_kalemler` ve `kartlar`'da görünür.
5. Cari: d50'de KI2 / KI3 gösterge anahtarları yazılmıyor; I2 / I3 kuyruk anahtarları yazılıyor.
6. Excel kartı: programın eşlediği cariyle `taksit_excel {cari}` olarak verilir.

Öbür bütün alanlar değişmedi.

## Mutantlar
**Muhasebe — 13 yeni (toplam 330):**
- B128: S200'de önce faturalar alınır.
- B128b: S200 B, kart küçülür.
- B128c: eksik kısım belge sırasıyla alınır.
- B129: karar (4) küçülmesi.
- B129b: S211 yok.
- B129c: kısmi tüketen kart kapanmaz.
- B129d, B129e, B129f: S210 susmaları yok.
- B130: S213 A.
- B130b: Değersiz susması yok.
- B131: S220 B.
- B131b: S205 B.

Metni yeni koda taşınan (anlamı aynı): B07, B41, B41c. Hepsi öldü; **sağ kalan yok**. Kalkan mutant yok.

**Cari:**
- 326: S210 B (bakım 21b davranışı).
- 327: S211 B.
- 328: kapanan kartın tahsilatı düşer.

Üçü değerle yakalandı. 324'ün anlamı daraldı; artık yalnız "kapanmış kartın göstergesi yazılır" mutantı, SUSMA olarak kalıyor. Önceki bakımların mutantlarının hepsi hâlâ yakalanıyor (cari 323–325, mutant ↔ senaryo 1.224/1.224).

## Test sayıları (iki saat dilimi, çıkış kodlarıyla)
UTC ölçümleri 39aa0612 / d05bcb6d, IST ölçümleri 320a86dd / 135092a2 commit'lerinde. Bu commit'ler arasındaki kâhin kodu aynı; aradakiler yalnız kanıt dosyası.

| Denetim | UTC | IST |
|---|---|---|
| muh-test | 223/223, çıkış 0 | aynı |
| muh-eski-kirmizi | 12/223 kırmızı, çıkış 1 | aynı |
| muh-g3 | 63.204/63.204, BEKLENMEYEN 0 | aynı |
| muh-yeni-mutantlar | 16/16 | aynı |
| muh-mutasyon (iki parça) | 165 + 165 = 330/330 | 330/330 |
| cari-oz | 6.936/6.936 | aynı |
| cari-mutasyon | 295/295 | aynı |
| cari-g3 | 625/625, BEKLENMEYEN 0 | aynı |
| cari-elle-yeni | 105/105 | aynı |
| cari-kirmizi-eski | 36 kırmızı | aynı |
| cari-elle-fark | 104/104 | aynı |
| cari-g1-tara | 105/105 | aynı |
| cari-mutant-senaryo | 1.224/1.224 | aynı |
| cari-genis-tarama | 2.201/2.201 | aynı |

G3 dökümleri ve özet taraması iki saat diliminde bayt bayt aynı.

**Eski modelde kırmızıların nedeni (iletisi okundu):**
- Muhasebe 12 kırmızı: hepsi S120 susması, S210 / S213 / S220'nin yokluğu ya da Dosyalar testi. `test_S210_silme_karar4_aynen` eski modelde yeşil; kural değişmediği için beklenen bu.
- Cari 36 kırmızı: hepsi SK-41 alanında (ANAHTAR YOK, gösterge yazılıyor, `belirsiz` kaydı yok). Bakiye ve Kasa eski modelde de yeşil.

## G3 dökümü
**Muhasebe:** yalnız s58 değişti, 19 anahtar, sınıfı A2-S210-S211 (`g2a` 0 → 2000, `g2b` detay kalemi kart → BY, `kt2` kapandı). Yeni senaryolar s118–s121 (8 dosya). Rastgele tohum 1–3 aynı. Girdinin maddeleri dışında BEKLENMEYEN 0.

**Cari:** 59 fark, hepsi S210-S211 (d50: kalkan 6, yeni 14; d51: kalkan 9, yeni 26) ve GENEL yeni 4. Bakiye ve Kasa iki modelde aynı. 2.4.9 / 2.4.6 / 2.4.5 / legacy: 500/500 bayt bayt aynı. BEKLENMEYEN 0.

## KULLANICIYA SORULMALI (tek liste)
1. **S210 / S211 × fatura SİLME (UÇ; kâhin karar (4) ile değer yazıyor):** BY 400 + F 500 → kart 900 → kart tahsilatı 300 → F silinir. Bakiye her okumada 100.
   - (a) Karar (4) aynen: kart 400'e küçülür, kart kalanı 100 (07.01 taksitinde).
   - (b) S210 gibi: kart kapanır; BY açık 100, gecikmiş 100.
   - **Öneri (b).**
   - C: Uç durum böyle kalsın (BİLİNEN SINIR).
2. **S210'un sınırı (UÇ; kâhin susuyor):**
   - (a) Kart iptalden önce Kartı Kapat ile kapatılmışsa kart kalanı da kalkar mı?
   - (b) Şüpheli kaydı olan caride kart kapanınca M13 dağılımı kartsız dosyadaki gibi yeniden mi kurulur?
   - (c) İptalle kapanmış karta sonradan gelen tahsilat / Kartı Kapat ne olur?
   - **Öneri:** (a) kalkar, (b) yeniden kurulur, (c) reddedilir.
   - C: Uç durum böyle kalsın.
3. **S213 × Değersiz Alacak (UÇ; kâhin susuyor):** Değersiz yazılan şüpheli kısım Açık Faturalar'da:
   - (a) düşer;
   - (b) görünür.
   - Bakiye ikisinde aynı. **Öneri (a).**
   - C: Uç durum böyle kalsın.

Ayrıca baş mimarın değerlendirmesi için (kural uydurulmadı, yazılı kurala dayandım):
- İ1: eksik kısım faturalar arasında M1e'nin S2 sırasıyla.
- İ2: "içine alma" = iptalden önceki dosyada tüketim; kısmi tüketen kart da kapanır.
- İ4: kalan = cari kuyruğu + şüpheli kuyruğu.
- İ8: "önceden gecikmiş" = vade < kapanış günü.

## SONRAKİ SÜRÜME (2.5.1)
- Kalan iç düzen: cari `tyk250`'nin SK-41 nedeni artık yalnız mutant 326 / 327 için duruyor (kullanılmayan dal); mutant-senaryo aracının senaryo listesi elle bakılıyor.
- Programı etkileyen başka bir şey yok.

## DENENMEYEN
- Programla karşılaştırma (sürücü ve `test:kahin-cari` koşusu ana oturumun işi).
- S210: silme yolu (karar (4)), KS 2'nin üç kolu, alış tarafı.
- S213: satırdaki "Şüpheli" işareti; Değersiz yazılmış fatura.
- S220: Excel kartında ya da devirle gelen kartta Kartı Kapat (kural aynı, senaryo yok).
- S219 / S221 / S222: iki kâhinin dilinde de yok.
- Cari: Kartı Kapat, kapanmış karta sonradan tahsilat.
- Defter kâhini ve mobil yazma kâhini koşulmadı.
- Dinî bayram tarihleri.

## Ana oturumun yeniden koşacağı komutlar
```
bash docs/kanit/2026-11-20/kahintoplu14-arac/kos.sh utc temel   # ve ist temel
bash docs/kanit/2026-11-20/kahintoplu14-arac/kos.sh utc mut1    # mut2; ist mut1 / mut2 (her biri ~25 dk, flock -s)
```
Betikteki `W` (ağaç yolu) ve `E` değişkenleri ana oturumun kendi kopyasına göre değiştirilmeli. `E` = `git archive kahin-toplu14-taban test/bagimsiz/muhasebe test/bagimsiz/cari` ile çıkarılmış kopya.

Ayrıca `npm run test:kahin-cari` gerekiyor; program değerleri bende yok. d50'nin KI2 / KI3 anahtarları artık yazılmadığı için o iki ayrışmanın kapanması bekleniyor.

## OKUNAN DOSYALAR (yaklaşık satır aralıklarıyla)
- **Temel belgeler:** CLAUDE.md (oturum bağlamında); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (1–82); girdi `scratchpad/kahin-toplu14-kararlar.md` (tamamı) ve görev metni.
- **Muhasebe README:** 1–247, 255–300, 1443–1800; arama satırları 54, 72, 81, 108, 139, 228, 262–267, 329, 460–571.
- **Muhasebe model.py:** 189, 298–304, 376–392, 431–439, 644–700, 805–830, 963–1010, 1195–1320, 1440–1840, 1870–1900, 2380–2640, 2679–2690, 2700–2809, 3035–3060, 3100–3115, 3120–3180, 3330–3420, 3527, 3633, 3744–3746, 3960–3985.
- **Muhasebe diğer dosyalar:**
  - `senaryolar_elle.py`: 1–80, 375–395, 1440–1575, 3836–3990 (sonu).
  - `test_model.py`: 1–68, 1120–1140, 1248–1310, 1553–1569, arama satırları.
  - `mutasyon.py`: 1–40, 184–205, 270–280, 600–745.
- **Cari KARARLAR.md:** başlıklar, 4585–4625, 4756–4937, Excel arama satırları.
- **Cari model.py:** 405–420, 677–702, 1670–1705, 3271–3283, 4183–4270, 4480–4560, 5440–5490, s206 / sk41 arama satırları.
- **Cari diğer dosyalar:** `oz-test.py` 280–380 ve arama; `senaryolar/d50` (tamamı). `kos.mjs` açılmadı.
- **Kendi önceki bakım araçlarım:** `docs/kanit/2026-11-19/kahincari21b-arac/` (`kos.sh`, `bicim.py`, `elle-fark.py`, `mutant-senaryo.py` tamamı; `karsilastir.py` 1–240) ve `kahinmuh13-arac/` (`kos.sh`, `g3-muh.py` tamamı). Ayrıca `kahinmuh13-*` / `kahincari21b-*` kanıt JSON'larının yalnız `sure_sn` alanı.
- **Kural ihlali (açıkça bildiriyorum):** `tools/kanit.mjs`'de bir kez arama yaptım ve 46. satırı (`KANIT_DIR` okuması) gördüm. `tools/` yalnız çalıştırılabilirdi. Kural ya da beklenti kaynağı olarak kullanılmadı.

## Dosyalar
- /home/user/ofis---y-netimi/.claude/worktrees/agent-aa6366f4d4126b97f/test/bagimsiz/muhasebe/README.md ("Kâhin bakımı 14")
- /home/user/ofis---y-netimi/.claude/worktrees/agent-aa6366f4d4126b97f/test/bagimsiz/cari/KARARLAR.md (§34)
- /home/user/ofis---y-netimi/.claude/worktrees/agent-aa6366f4d4126b97f/docs/kanit/2026-11-20/kahintoplu14-rapor-taslak.md
- Kanıt dosyaları: /home/user/ofis---y-netimi/.claude/worktrees/agent-aa6366f4d4126b97f/docs/kanit/2026-11-20/ (`kahintoplu14-*`)
- Araçlar: /home/user/ofis---y-netimi/.claude/worktrees/agent-aa6366f4d4126b97f/docs/kanit/2026-11-20/kahintoplu14-arac/

Eski kopya: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahintoplu14-eski (iş bitince ana oturum tam yoluyla silebilir).

Ortam (son okuma): yük ~2,9 / 4 çekirdek, kullanılabilir bellek ~13 GB, boş disk ~7,4 GB.