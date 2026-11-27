# CARİ KÂHİNİ BAKIMI 28: RAPOR (S255 = A, S254 = C)

Taban `6a1d19d1` (doğrulandı). Dal `worktree-agent-a5cd991d0d986ba51`, uç **`a3d1a1b7`**. Push yok, zamanlanmış görev yok. Programın kodunu okumadım; program yalnız `kos.mjs` bağdaştırıcısıyla koşuldu.

## Özet
- **S255 = A kâhine işlendi.** Mevcut Borç kartının içine aldığı faturaya kart açıldıktan sonra yapılan bağlı tahsilat önce faturanın gösterilen açığını kapatıyor; fazlası kendi gününde tek kuyruğa gidiyor (kartın taksitleri dahil).
  - Kâhinde bağ, ödemeden önceki son kart tüketiminin hemen ardından uygulanıyor. Zamandan bağımsızlık (C13.4 (3) "bağlar önce") korunuyor.
  - "Kart faturayı içine almış mı" sorusu, ödeme yokmuş gibi kurulan hesapla ölçülüyor. Kart açılmadan önceki bağlı ödemede bugünkü kural sürüyor.
- **S254 = C işlendi.** İadeden önce açılmış en az iki kart varsa ve faturasız stok iadesi bir kart taksitini kapatıyorsa şunlar SUS: carinin kuyruk denetimleri ve kartların toplamı. Neden metni "BİLİNEN SINIR (kullanıcı kararı S254 = C) S254". Bakiye yazılıyor.
- **Eski senaryolarda fark 0.** Bütün farklar yeni d60'ta.

## Değişen / kalkan susmalar
| Alan | Önce (bakım 27) | Şimdi | Girdi |
|---|---|---|---|
| Kart sonrası bağlı ödeme gösterilen açıktan büyükse (600 / 900 / 1.200; tamamı kartta; iade sonrası) | Kart "açık borçtan büyük" (EK-2B 32) olunca cari SUS | Değerle (Y28-1) | §1 S255 = A ve KAPSAM |
| "Kalan tanımsız" istisnası (taksit kartlı caride) | Geçerliydi | Bu senaryolarda kalktı; kart ve fatura sayıları denetleniyor | §1 KAPSAM |
| İki kart + faturasız stok iadesi | S2 sırasıyla değer yazılıyordu | Yeni SUS (Y28-7) | §2 S254 = C |
| Kart sonrası bağlı çek / senet | — | Yeni SUS, SK-52 | §1 "AÇIKÇA geçmiyor → SUS" |
| Bağlı ödeme + Şüpheli Alacak payı (S168) | — | Yeni SUS, SK-53 | Kararın söylemediği alt durum |

Okuma (baş mimar görsün, soru değil): kararın "600 → fatura kapanır" sözünü gösterilen açığın kapanması diye okudum. Faturanın kendi açığı 300 kartın içinde, durumu 'Taksitte' (Y23-3 aynen). Program da aynı okumada.

## Öz test ve mutasyon (UTC = Europe/Istanbul)
- Öz test **9.357/9.357**.
- d60 ilk kâhin koşusunda **470/470**; elle hesapta düzeltme gerekmedi.
- Bütün elle tablolar 5.839/5.839.
- Mutantların hepsi öz testte d60'ta, `kos.mjs` taramasında programla da yakalandı:
  - 358 (S255 B, önce kartın aldığı kısım): değerle.
  - 359 (fazlası en son taksite): değerle.
  - 360 (S255 yok, bakım 27 davranışı): değerle.
  - 361 (S254 SUS yok): SUS kuralı olarak.

## G3 (eski kâhin `6a1d19d1` ↔ yeni, iki TZ'de döküm bayt bayt aynı)
- **670/670.** Üretici 20/20 aynı dizi. Eski senaryoların adımları ve elle tabloları değişmedi (elle fark 113/113).
- 2.4.9 / 2.4.6 / 2.4.5 / legacy eşdeğerliği **536/536**.
- 335 değişen denetim: **S255 yeni 223**, **S254 kalkan 112**. **BEKLENMEYEN 0.**
- Yalnız etiketi değişen 2: d60 `FV1:acik` KULLANICI'dan BAŞ MİMAR'a (S255).
- Fark yalnız d60'ta; rastgele senaryolarda S255 / S254 alanı çıkmadı.

## Program ↔ kâhin (iki TZ)
| Koşu | Sonuç |
|---|---|
| İlk (UTC, liste boş) | 25.101/25.164; 63 fark, **hepsi d60**; öbür 105 senaryo tam |
| Son (UTC) | **25.101/25.101**, 0 fark, 63 yapım aşaması |
| Son (Europe/Istanbul) | **25.101/25.101**, 0 fark, 63 yapım aşaması |
| Eski kâhin ↔ program (d60) | 428/440; 12 fark, hepsi Q1 (S254 alanı) |

Her iki son koşuda 0 okuma hatası, 0 yakalanmayan mutasyon, 7 bilinen sınır.

## Yapım aşaması listesi
- **0 → 63 kayıt**, hepsi d60, paket **'S255 izleyen tur 4'**. Yeni 63, kapanan 0, değeri değişen 0. UTC ve İstanbul üretimi bayt bayt aynı.
- Üretici kendiliğinden Ç5-B tur 2: 7, Ç7b: 8, AYRIŞTIRILMADI: 48 etiketi verdi. Görev metni gereği hepsini 'S255 izleyen tur 4' yaptım.
- Liste ayrı commit'te (`3377…` değil: liste commit'i `7d1364df`'den önceki commit). `kos.mjs` paket listesine bu ad eklendi (`e00d9729`).
- S255 kodu girince bu 63 kayıt "KAPANDI" diye kırmızıya döner; liste o birleşimde yeniden üretilmeli.

## Eski kâhin kırmızısı
- **205/470** elle denetim kırmızı, beklenen nedenle:
  - S255 caride anahtar yok (eski kâhinde EK-2B 32 SUS).
  - S254 `elleYok` anahtarları eski kâhinde değerle yazılıyor.
  - Y23-6 (i) ve "S254 = C" belirsiz kayıtları yok.
- Kırmızısı olmayanlar: V1 / V5 / V6 / V12 ve V11'in k0'ı. Bunlar bugünkü kuralla aynı sayılar.

## P listesi (program şüphesi)
- **P-1:** Bağlı ödemenin gösterilen açığı aşan kısmı programda kartın taksitlerine düşmüyor.
  - En küçük örnek d60 V2: F 900 (01.09), kart 600 = 3 × 200 (05.10 / 05.11 / 05.12), 20.10'da F'ye bağlı 600, bugün 20.10.
  - Kâhin: kart Tahsil **300** / Kalan **300**, gecikmiş **0**.
  - Program: Tahsil **0** / Kalan **600**, gecikmiş **200**.
  - Bakiye 300, faturanın kendi açığı 300 / gösterilen 0 / kartta 300 / 'Taksitte' ikisinde aynı. Yani programda kartın Kalan'ı (600) bakiyeyi (300) aşıyor.
  - Aynı aileden: V3, V4, V7 (tamamı kartta: Kalan 900 ↔ 600, gecikmiş 300 ↔ 0), V8, V10 ve V11'in k1'i.
  - V9 programda kâhinle aynı.
- **Gözlem (SUS alanı, P değil):** Q1'de program iadede son açılan kartı (K2) küçültüyor; K2'nin toplamı 300'e iniyor, 3. taksiti okunamıyor. Q2'de program eski kâhinle aynı.

## KULLANICIYA SORULMALI (ikisi de UÇ; programla karşılaştırılmadı; yaygın programlarda doğrulanmış kaynak okunmadı)
- **SK-52, bağlı çek / senet (kart açıldıktan sonra):**
  - A: bağlı tahsilatla aynı (gösterilen 300, fazla 300 karta; Kalan 300).
  - B: çek faturanın kendi açığını kapatır, kart değişmez (Kalan 600).
  - **C (öneri): Uç durum böyle kalsın (BİLİNEN SINIR).**
  - Bakiye her seçenekte 300; gecikmiş 0 ↔ 200.
- **SK-53, S255 + Şüpheli Alacak payı (S168 / S181):**
  - A: önce şüpheli payı, sonra S255.
  - B: önce S255, şüpheli payı yalnız gösterilen kısımdan.
  - **C (öneri): Uç durum böyle kalsın (BİLİNEN SINIR).**

## SONRAKİ SÜRÜME (2.5.1)
- Rastgele üreticiye kart sonrası bağlı ödeme ve iki kart + stok iadesi eklenmeli.
- Bakım 27'nin 2.5.1 listesi aynen.

## DENENMEYEN
- Faturanın Tahsilat Ekle'si ayrı yol olarak: bağdaştırıcıda aynı uç; formun önerdiği / sınırladığı tutar API'den okunmuyor.
- Bağlı çek / senet, Mahsup Et ve şüpheli paylı bağlı ödeme: elle senaryo yok (SUS).
- Faturayı iki kartın içine aldığı durum: elle senaryo yok.
- Bağlı ödemeden sonra yazılan iade / Düzenle: bugünkü kural sürüyor, senaryo yok.

## Ana oturum için uyarılar
- **Kural ihlali, açıkça:** kilitsiz koşulanlar oldu. Hazırlıkta üç kısa JSON okuma satırı (`python3 -I -c`) ve `model.py` için bir düzenleme betiği (python heredoc) `flock` olmadan çalıştı. Başka koşuların hepsi `flock -s` altında, süre sınırı kilidin içinde.
- Başka ajanın özel kilitli ölçümü (~11:2x–12:49 UTC) koşularımı bekletti. Bir okuma betiği 30 dakikalık arka plan sınırında kesildi; yerine düzeltilmiş betikle yeniden koşuldu.
- **Doğrulanmadı:** program testlerinden biri `kos.mjs`'teki paket listesiyle JSON'daki listenin aynı olmasını denetliyor mu bilmiyorum (program testlerini okumadım).

## Değişen yollar
- `test/bagimsiz/cari/`: `KARARLAR.md` (§40), `model.py`, `oz-test.py`, `kos.mjs` (yalnız paket listesi), `YAPIM-ASAMASI.json`, yeni `senaryolar/d60-c5-s255-s254-bagli-odeme-kartli-fatura.json`.
- `docs/kanit/2026-11-22/`: `kahin-cari28-arac/`, `kahin-cari28-kanit/`, `kahin-cari28-rapor-taslak.md`.

## Commit listesi
- `d26cae35` yorum (kodsuz)
- `f4bde41e` d60 elle tablosu
- `91acc91d` kural kodu, mutantlar, öz test
- `e00d9729` `kos.mjs` paket adı
- `e7b0e9f3` koşu betikleri ve araçlar
- `8d82df44` Kanıt (öz test, G3, elle)
- rapor taslağı / P dökümü araçları commit'i
- yapım aşaması listesi commit'i (ayrı)
- `7d1364df` Kanıt (program) + §40 kanıt bölümü
- `a3d1a1b7` rapor taslağı son hâli

## Yeniden koşu komutları
Her adım `flock -s` + `timeout 2400` ile, `kanit.mjs kos` üzerinden çalışır. Eski kopya `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kc28-a5c/eski` (`git archive 6a1d19d1`).
```
/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51/docs/kanit/2026-11-22/kahin-cari28-arac/zincir.sh "utc oz" "ist oz" "utc g3" "ist g3" "utc elle" "ist elle"
/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51/docs/kanit/2026-11-22/kahin-cari28-arac/zincir.sh "utc program" "ist program" "utc program-eski" "utc yapim" "ist yapim"
python3 -I -B docs/kanit/2026-11-22/kahin-cari28-arac/yapim-ayir.py <üretilen> test/bagimsiz/cari/YAPIM-ASAMASI.json <hedef> <döküm>
```
Kendi ağacınızda koşarken `kos.sh` içindeki `W` / `N` yollarını değiştirin.

## Dosyalar
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51/test/bagimsiz/cari/KARARLAR.md` (§40)
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51/docs/kanit/2026-11-22/kahin-cari28-kanit/`
- `/home/user/ofis---y-netimi/.claude/worktrees/agent-a5cd991d0d986ba51/docs/kanit/2026-11-22/kahin-cari28-rapor-taslak.md`
