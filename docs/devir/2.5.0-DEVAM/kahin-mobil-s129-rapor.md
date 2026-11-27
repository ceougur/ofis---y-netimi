<!-- Ajan raporu AYNEN (13.11.2026; ajan sözü — kanıt değil; ana oturumun yeniden koşusu KAYIT'ta) -->
# Mobil yazma kâhini bakımı (S129): rapor

**Kısa sonuç:** S129 = A mobil yazma kâhinine işlendi ve öz test iki saat diliminde de 158/158 geçti. Kâhinin bu alanlardaki beklentisi ana oturumun tahmin ettiği gibi zaten kuyruk değeri değildi. Yani karar yalnız bir onay olmadı, beklentiler değişti. Kararla açıklanamayan değişiklik yok. Kullanıcıya sorulacak bir alt durum var (SM-1). Push yapmadım.

**Ortam (son okuma):** yük 2,44 / 4 çekirdek, boş bellek 11 GB, boş disk 9,4 GB.

**Dal:** `worktree-agent-a853e4598e7776030`. Taban `44c9025d`. `--ff-only` olmadı (dalda yalnız ana dalın `b7ac47a7` commit'i vardı, benim commit'im yoktu), bu yüzden `reset --hard` yaptım. Üç commit:
- `cea78f3d`: yalnız yorum (ders 40).
- `03a7b6b1`: kod ve `kabul.json`.
- `b93a75e7`: kanıt.

## 1. Yorum
**Eski okuma:** Kâhin kartın üç alanını (`kart:<k>:odenen`, `kalan`, `taksit<i>:odenen`) yalnız kartın KENDİ tahsilatlarından hesaplıyordu. Avans dahildi (K8-AVANS). Cari kâhini yalnız bakiye, fatura açığı ve açılış kalanı için, `2.4.6` kural setiyle kullanılıyordu. Karta bağlanmadan alınan tahsilat kartın göstergelerini düşürmüyordu. Bu, S129'un **B** okumasıdır. Akış modeli (`Akis`) de aynı okumadaydı.

**Yeni kural (S129 = A):**
- Üç gösterge cari kâhininin `2.5.0` tek kuyruğundan gelir. Aynı çevrilmiş adımlar o kâhine bir kez daha verilir ve değer `kart_odenen`'den okunur. Kendi kuyruk kuralımı yazmadım.
- Cari kâhini kartı tanımsız sayarsa ya da SK-18 nedeniyle susarsa bu üç alan yazılmaz.

**Değişmeyen (S118 = B):**
- `plan-overpay`, `plan-paid` ve Fazlasını Avans Yaz sınırı kartın kendi kalanından okunmaya devam eder.
- `fazla`, `tahsilatSayisi`, bakiye, fatura açığı, Kasa ve banka aynen kalır.
- Mobil için ayrı kural yok ("ekranda tek sayı").

## 2. Değişen beklentiler
Döküm: `docs/kanit/2026-11-13/kahinmobil-s129/kabul-fark-dokum.json` ve `kabul-fark-sinif.txt`.

| Senaryo | Alan | Eski → yeni | Karar | Adet |
|---|---|---|---|---|
| E05 çifti, k2 | `KT1:odenen` | 1.300 → [1.200, 1.300] | SM-1 | 2 |
| E41 çifti, k1 | `KT:odenen` | 1.500 → [1.000, 1.500] | SM-1 | 2 |
| R1 / R2 / R3 | `odenen` (arttı) | ör. 258 → 1.200 | S129 A (bağsız tahsilatın kuyruk payı) | 102 / 81 / 98 |
| R1 / R2 / R3 | `kalan` (azaldı) | ör. 109,04 → 0 | S129 A | 102 / 81 / 98 |
| R1 / R2 / R3 | `taksit<i>:odenen` (arttı) | ör. 18 → 240 | S129 A | 243 / 165 / 175 |
| R1 / R2 / R3 | avanslı kartta `odenen` | eski değer listenin (b) seçeneği oldu | SM-1 | 48 / 59 / 52 |

- Toplam 1.308 anahtar değişti; kararla açıklanamayan 0.
- Bakiye, fatura açığı, Kasa, adım yanıtları ve `fazla` hiçbir senaryoda değişmedi.
- Öbür 47 elle senaryonun elle tablosu değişmedi. Yeni cari kâhiniyle (bakım 14) 256 birleşimin hepsinde model = elle.
- **Ayrıca düzelttiğim, karar dışı bir kusur:** öz testteki H2 adımı bakımdan önce de kırmızıydı. Cari kâhininin 10 mutantını (129–143 arası) göremiyordu, çünkü `/3` dosyaları iki kiple taranıyordu. Cari kâhininin KARARLAR.md "Eşleme notları"ndaki dört kipli düzene (2.5.0 + 2.4.9 + 2.4.6 + 2.4.5) getirdim; şimdi 252/252.

## 3. Yeni elle senaryo: E42 (mobil ve masaüstü çifti)
Beklenenler kâhin koşulmadan, karar metninden yazıldı.
- **Kararın iki örneği:**
  - Kart 900 (3 × 300) + bağsız 500 → Tahsil Edilen 500 · Kalan 400, taksitler 300 / 200 / 0, bakiye 400.
  - Kart 600 (2 × 300) + bağsız 800 → Tahsil Edilen 600 · Kalan 0, taksitler 300 / 300, bakiye −200.
  - Kasa 1.300.
- **S118 = B sınaması:**
  - KT'ye 900 → kabul (tek kuyruğun kalanı 400 olsa da).
  - KT'ye 1 → 409 `plan-paid`.
  - LT'ye 700 → 409 `plan-overpay`.
  - LT'ye 600 → kabul.
  - Son durum: KT 900 · 0, LT 600 · 0, K −500, L −800, Kasa 2.800.
- Mobil ve masaüstü kanalı aynı sonucu veriyor.

## 4. Mutantlar
- **60** (S129 B okuması) ve **61** (sınır tek kuyruktan, S118 = B'nin tersi): yeni J1 adımında E42'nin iki kanalında değerle yakalanıyor (8 ve 9 değer farkı). 60 ayrıca R1'de akış beklentisince yakalanıyor (37 fark).
- **62** (SM-1'de B okumasını seçmek) yeni.
- **51**'in anlamı değişti: artık "SM-1'de A okumasını seçmek". İlk yorumumda "51 yakalanamaz" demiştim; ilk koşu 51'i E05'te yakaladı (tek değer ≠ liste). README'de düzelttim.
- Önceki 59 mutant hâlâ yakalanıyor. Toplam **62/62**.
- Eski kâhin kopyasında yeni ve değişen elle beklentiler 18 senaryo-birleşimde beklenen nedenle kırmızı (eski kâhin kartın kendi hesabını yazıyor).

## 5. Öz test (kod commit'i `03a7b6b`, temiz ağaç)
| Saat dilimi | Sonuç |
|---|---|
| UTC | 158/158, çıkış 0 |
| Europe/Istanbul | 158/158, çıkış 0 |

- "Cari kâhini değişti" denetimi (A2) ve kabul güncelliği (A1) yeşil.
- Bakımdan önceki taban 149/152'ydi; kırmızılar A1, A2 ve H2'ydi.

## 6. KULLANICIYA SORULMALI
**SM-1 (K8-AVANS × S129 — uç durum değil, Fazlasını Avans Yaz ile açılan her kartta çıkar).** Örnek: kart 1.200 / 3; kart tahsilatı 500, sonra 800 Fazlasını Avans Yaz → avans 100, bakiye −100. S129'un sözü bu durumu söylemiyor; K8-AVANS ise "Ödenen avansı da içerir" diyor.
- **A** (S129'un harfi, tek kuyruk): Tahsil Edilen 1.200 · Kalan 0.
- **B** (K8-AVANS sürer): Tahsil Edilen 1.300 · Kalan 0 ya da −100.
- **C**: uç durum böyle kalsın (BİLİNEN SINIR).

Bakiye, Kasa ve taksitler (400 / 400 / 400) üç seçenekte de aynı. Kâhin şimdilik ikisini de kabul ediyor (liste); seçim gelince tek değere iner.

## 7. DENENMEYEN
- Program koşulmadı.
- Kartın durum metni ("Tamamlandı" vb.) ve önerilen tutar: kâhinin dilinde anahtar yok.
- Kartlı cari ile fatura, elle borç, iade ya da şüpheli alacağın birleşimi.
- Cari kâhininin kartı reddettiği ya da sustuğu yol hiçbir senaryoda oluşmadı (yalnız kodda var).
- **Kör nokta:** bakiye, fatura açığı ve açılış kalanı hâlâ cari kâhininin `2.4.6` kipinden okunuyor. Bunun tamamen `2.5.0`'a taşınması bu bakımın kapsamı dışında, ayrı bakım ister.

## 8. Kural ihlalim ve beklemeler
- Kısa J1 koşusunu (birkaç saniye) yükü okuduğum AYNI adımda başlattım ve o an yük 4,38'di. Bu, "yük okuması ile başlatma aynı adımda gönderilmez" ve "yük > 4 ise yeni yük başlatılmaz" kurallarını ihlal ediyor. Sonraki koşuların hepsinde yükü ayrı adımda okudum.
- Ana oturumun iki ölçümü (`c5a1f-olcum/hepsi.sh`, `b7y-hiz.sh`) bitene kadar yük başlatmadım. Döngü kurmadan, ölçüm sürecinin bitmesini tek komutla bekledim.

## 9. Ana oturumun yeniden koşacağı komutlar
Hepsi worktree kökünden:
```sh
python3 -I -B test/bagimsiz/mobil-yazma/senaryolar.py --denetle
TZ=UTC KANIT_DIR=<klasör> node tools/kanit.mjs kos kahinmobil-s129-oz-utc -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py
TZ=Europe/Istanbul KANIT_DIR=<klasör> node tools/kanit.mjs kos kahinmobil-s129-oz-ist -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py
python3 -I -B docs/kanit/2026-11-13/kahinmobil-s129/arac/eski-kirmizi.py <worktree> <git archive 44c9025d kopyası>
python3 -I -B docs/kanit/2026-11-13/kahinmobil-s129/arac/kabul-fark.py <eski kabul.json> test/bagimsiz/mobil-yazma/kabul.json
```

**Programla karşılaştırma:**
- Programla karşılaştırmayı (`npm run test:kahin-mobil-yazma`) çalıştırmadım; o ana oturumun işi. Kartlı caride bağsız tahsilat olan R1–R3 kontrollerinde ve E42'de yeni fark görülebilir.
- `kabul.json`'daki cari kâhini özeti (`cari_model_sha256`) güncellendi.

## 10. Okunan dosyalar
- Görev metni ve girdi dosyası (tamamı): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-mobil-s129-istem.txt`, `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-mobil-s129-kararlar.md`.
- `CLAUDE.md` (oturumda yüklü olan tam metin) ve `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (1–82).
- `test/bagimsiz/mobil-yazma/README.md` (tamamı); `kahin.py` (1–1238); `senaryolar.py` (1–300, 680–780, 880–1040, 1200–1600, ayrıca kabul üretim bölümü); `kahin_test.py` (45–160, 436–560, 600–691).
- `program-surucu.mjs` AÇILMADI.
- `test/bagimsiz/cari/KARARLAR.md`: 658–662, 1020–1030, 2968–3231 ve başlık / anahtar sözcük taramaları. Bakım 13 bölümü cari kâhininde yok.
- `test/bagimsiz/cari/model.py`: 55–110, 1655–1700, 3472–3600, 4615–4740, 5010–5110 ve `def` / `sus_kart` taramaları.
- `test/bagimsiz/cari/oz-test.py`: yalnız anahtar sözcük taraması.
- Okunmayanlar: `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (`kanit.mjs` yalnız çalıştırıldı), `docs/devir/**`, iş listeleri, `YAPIM-ASAMASI.json`, `kos.mjs`, başka ajanların kanıtları, git farkı ve geçmiş içeriği.

## Dosyalar
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030/test/bagimsiz/mobil-yazma/README.md` (bölüm "2.5.0 bakımı — S129")
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030/test/bagimsiz/mobil-yazma/kahin.py`
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030/test/bagimsiz/mobil-yazma/senaryolar.py`
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030/test/bagimsiz/mobil-yazma/kahin_test.py`
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030/test/bagimsiz/mobil-yazma/kabul.json`
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a853e4598e7776030/docs/kanit/2026-11-13/kahinmobil-s129/` (kanıtlar ve `arac/` betikleri)
- Eski kâhin kopyası: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahinmobil-s129/eski/`
