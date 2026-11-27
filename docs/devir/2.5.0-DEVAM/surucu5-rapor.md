# Muhasebe sürücüsü bakımı 5 — ajan raporu (AYNEN, SubagentHandback)

## Muhasebe sürücüsü bakımı 5 — rapor

Sürücüyü Ç7b'nin tamamına (tur 3b, taksit küçük turu) ve kâhinin bakım 14 hâline uyarladım. Son koşuda **SINIFLANMADI 0, sınıflanmamış adım 0, red farkı 0, uygulanamayan olay 0, Ç7b kimlikli U 0**. # fail 50'den 28'e indi. Kalan 28'in hepsi eski program hataları (P6, P4), eski R-B5 ve bir yeni kural belirsizliği (R-S200). Yeni kural için aşağıda kullanıcıya bir soru var. İki bilinçli hatanın ikisi de yakalandı. Ç7b öncesi kodla çıkan bütün farklar bir kurala ya da karara bağlandı; açıklanmayan fark kalmadı.

- **Dal:** `worktree-agent-a293dd7fb86915c0b`, uç **fce3d272**, taban c7b-aday = df7e93ca. 7 commit; hepsinde "Co-Authored-By: Claude" ve oturum satırı var, model adı yok. Push yapmadım.
- Değişen yollar yalnız `test/bagimsiz/muhasebe-surucu/` (4 dosya, +64 / −29) ve `docs/kanit/2026-11-20/surucu5-*`. Kâhin klasörlerine ve program koduna dokunmadım, zamanlanmış görev kurmadım.

### Yapılan eşlemeler (4959ab79)
**(a) Kartı Kapat**
- `karsilastir.py`: güncel-program görünümünden C7b6-KAPAT dönüşümü kalktı (ETIKET, KIMLIK, `degistir` ve `bugun_olay`).
- `program.mjs`: kâhinin `eski: true` kartı programda aynı Kartı Kapat yoluyla kapatılıyor, ardından göç 53'ün işareti yazılıyor (`close_rule = '2.4.9'`). Programın kendi testleri de aynı yolu kullanıyor (inceleme-226, kapali-kart-ekstre-tarihi-250).
  - Sütun yoksa (Ç7b öncesi kod) işaret yazılmıyor.
  - Olay eski sürüm aşamasında koşuyorsa kartı v2.4.9 kendisi kapatıyor.
  - Yeni Kartı Kapat kayıtta "Borçta Kalsın" olarak görünüyor.
- `BEKLEYEN_ONEK` listesinden "Ç7b" çıktı (karar (4), S15, S205 / S220 ve S210 / S211 artık kodda).

**(b) Kâhin bakımı 14, "SÜRÜCÜ İÇİN" maddeleri**
- 1 (S200), 2 (fatura iptalinde kartın kapanması) ve 4 (birden çok `kart_kalani`): eşleme gerekmedi, sonuç AYNI. Kapalı kartın kalemleri kart raporunda ayrı ayrı tutuyor.
- 3: `susmalar` "S213" artık S192 gibi yalnız listelenen raporda uygulanıyor. Önceki kod S192 dışındaki her kaydı S168 sayıyordu; S213 o günden sonraki bütün raporlarda 120 / 128'i susturacaktı.
- 6: Excel kartı artık yüklemenin açtığı tek karttan bulunuyor. Önceki `.at(-1)` ad araması aynı adlı iki kişide yanlış kartı bulabiliyordu. Kartın bağlandığı cari `esle_cari` olarak kaydediliyor ve kâhine bu cariyle veriliyor. Kartlar raporu da bu cariye göre süzülüyor.
  - Programın atladığı Excel satırı `atlandi` durumuna giriyor ve uygulanamayan listesine düşüyor; sessiz geçmiyor.
- 5: cari kâhinine ait, bu sürücüyü ilgilendirmiyor.

**(c) s91 mz0:** `R-B5-YEREL-GUN-UTC/RAPOR-MZ0` eklendi. mz1 için yazılı UTC günü kuralının aynısı: TE1'in yükleme anı 09.03 22:30Z, UTC'de 09.03, İstanbul'da 10.03. Kural değil, yalnız sınıflama.

**(d) P7:** üç kuralı kaldırdım; program artık kâhinle aynı.

**Ateşleme taramasında ateşlemeyen 7 kuralı da kaldırdım:**
- U-S58, U-S69, U-S15 ×2: Ç7b tur 3 kodda.
- R-S192-BAG-SONRA ×2: S212 = A tek aday düzeltmesiyle kodda (9db9b69d). Bakım 4'ün en küçük örneği ek-bag-sonra c7b-aday'da AYNI, c7b2-taban'da eski fark sürüyor.
- OLC-S87/RAPOR.
- Son koşuda kalan 15 kuralın hepsi ateşliyor. Uygulanamayan olay yok.

### İki saat dilimi sınıf tablosu
125 senaryo (elle + rastgele), `--paralel 2`, `flock -s`. Taban ve son koşu c7b-aday'da; son koşu bakım sonrası sürücüyle.

| Koşu (çıkış) | AYNI | U | P | K | R | SINIFLANMADI | ÖLÇÜLEMEDİ | SUSMA | sınıfsız adım / red farkı / uygulanamayan | # fail |
|---|---|---|---|---|---|---|---|---|---|---|
| Taban, bakım öncesi sürücü (1) | 7.242 | 508 | 18 | 0 | 2 | 20 | 124 | 22 | 10 / 0 / 0 | 50 |
| Son, bakım sonrası sürücü (1) | 7.248 | 508 | 18 | 0 | 10 | **0** | 120 | 22 | **0 / 0 / 0** | **28** |

- Saat dilimine göre (son koşu): UTC'de AYNI 3.622, R 7; İstanbul'da AYNI 3.626, R 3. Tek fark R-B5'in yalnız UTC'de ateşlemesi.
- Kırmızı senaryolar:
  - P6: s81, s82, s94, s103 (eski, EKSİK YOL).
  - P4: s14 (eski).
  - R-S200: s118 (af1 / af3, 3 satır × iki TZ; yeni).
  - R-B5: s91 (mz0 / mz1, 4 satır, yalnız UTC).
- Bekleyen U'lar (senaryo / denetim): 2.5.1-Ç7b-B1 4/44 · D2–D4 28/30 · D4-(7) 1/1 · D4-GERI-AL 1/1 · GÖRÜNÜM-YOK 32/77 + 1/1 · Ç5-C 27/140.
- Tablonun tamamı `docs/kanit/2026-11-20/surucu5-tablo.txt` dosyasında.

### P / K / SINIFLANMADI / yeni R ayrıntısı
- **Yeni P yok, K yok, SINIFLANMADI yok.**

**Yeni R: `R-S200-ACIK-FATURALAR-KART-PAYI`** (bkz. KULLANICIYA SORULMALI 1)
- Durum: Mevcut Borç kartı faturanın bir kısmını içine almış; Açık Faturalar raporu.
- Kâhin net değeri yazıyor: kartın aldığı kısmı kapanmış sayıyor (README R5 / M1e, bakım 14 İ1).
- Program brüt değeri gösteriyor: `server/routes/invoices.mjs` `openItems` (`netInvoiceStates`'ten sonraki yorum: "v2.0.23 (Bulgu 2 D) … Açık Faturalar raporu ve fatura kartı faturanın kendi açığını gösterir (net istemez)"). Birleşik listeler (yaşlandırma, nakit akışı, Vade Takip) ise net istiyor.

En küçük örnek 1 (`surucu5-en-kucuk/ek-s200-acik-fatura`):
- Veri: F1 50.000 (vade 10.02), Borç Yaz 30.000; 01.02'de kart 60.000; durum 16.02.
- Gecikmiş 20.000: iki tarafta AYNI.
- Açık Faturalar F1: program 50.000, kâhin 20.000.
- Aynı sonuç c7b-aday'da iki saat diliminde, c7b2-taban'da ve v2.4.9'un gerçek kodunda. Yani gerileme değil.

En küçük örnek 2 (`ek-mevcut-borc-tum-fatura`, uç durum değil):
- Elle borç yok; "Carinin Mevcut Borcu" kartı 50.000 faturanın tamamını alıyor.
- Program Açık Faturalar'da F1'i 50.000 ve 6 gün gecikmiş gösteriyor, cari kartında Gecikmiş Borç 0. Kâhin F1'i listelemiyor. v2.4.9 da aynı.

Neden şimdi göründü: daha önce hiçbir senaryoda kartın içine aldığı fatura Açık Faturalar raporunda yoktu. Yeni s118 bunu ortaya çıkardı.

**Ek gözlem:** s118 af3'teki fark da aynı kökten. Senaryoda 20.02'den sonra yalnız rapor olayı olduğu için program değeri günden bağımsız; bu yüzden ÖLÇÜLEMEDİ yerine R olarak sınıfladım.

### Gerileme dökümü (aynı sürücü; c7b2-taban ↔ c7b-aday)
- 248 koşunun 176'sı birebir, **72'si farklı** (36 senaryo × iki TZ). **Açıklanmayan 0.**
- 62 koşuyu atıf aracı aileyle eşledi:
  - KG-2 600.90
  - KG-24 601
  - KG-3 336.90 / 602.90
  - KG-8 / F-08 + B-6 / KG-7
  - 649.90
  - Ç7b tur 3: karar (4), S15, S206 / S210 / S211
  - Ç7b tur 3b: Borçta Kalsın
  - Ç7b taksit küçük turu: P7, S219 = A
  - S212 = A / B1 (tek aday düzeltme turu; c7b3b-taban çalışma dalını içerdiği için bu aralıkta)
- 10 koşuyu elle bağladım (`surucu5-gerileme-atif-elle.txt`):
  - rastgele-1 olay 467 ve 638: C4'ün S212 ardılları. Eski koddaki ilk fark olay 461 (P308, 24.07).
  - s121 olay 13: kapalı karta tahsilat, eskiden 689'u çözüyordu → tur 3b.
  - s28 olay 7: Ocak KDV mahsubu red → kabul (S4 / KG-7).
  - s58 / s69 iptal: 409 → kabul (S15 = A).
- s112'nin tek farkı ret iletisinin metni: tek aday düzeltme S181 iletisi (29eb3a5c).
- Her farklı koşuda eski kodun kırmızısı yeninin kırmızısından fazla ya da eşit. Tek istisna s91 UTC (3 → 4): TE1 artık açıldığı için mz0'da R-B5 görünüyor.
- Eski kod koşusu: # fail 874.

### Testin dişi (`surucu5-mutantlar.txt`)
Programın ayrı kopyasında tek satırlık iki bilinçli hata denedim (`server/routes/plans.mjs`):
- **mutant1:** Kartı Kapat yine eski kuralla kapatıyor (`close_rule '' → '2.4.9'`, kalan 689'a gidiyor). s40 / s60 / s121'de # fail 58; her saat diliminde SINIFLANMADI 24 ve sınıflanmamış adım 5. **Yakalandı.**
- **mutant2:** Excel'de aynı adlı açık kart varsa kişiye bakmadan satır atlanıyor (`duplicate === "same" || cards.length`). s91 / s19 / s86'da # fail 4; iki saat diliminde s91 OLAY 1 `atlandi` → SINIFLANMADI, neden "Aynı adla açık kart var". **Yakalandı.** Bu yolu "atlandi" eşlemesi yakaladı; o eşleme olmasaydı bu hata sessiz geçerdi.
- Mutant koşusu başlarken yük 6,5'ti (başka oturumun kâhin mutasyon koşusu). Bu bir ölçüm değil; sayılar yükten bağımsız.

### KULLANICIYA SORULMALI
1. **Mevcut Borç kartının içine aldığı faturanın Açık Faturalar ve Yaşlandırma raporundaki kalanı.** Bu bir rapor ve kapama kuralı (ders 43). Bakiye ve cari kartındaki Gecikmiş Borç iki okumada da aynı. **Uç durum değil:** "Carinin Mevcut Borcu" kartı faturaların üstüne açıldığında her zaman ortaya çıkıyor.
   - **A (kâhinin okuması):** kartın aldığı kısım faturadan düşer.
     - Örnek 1'de F1 20.000; cari kartının gecikmişiyle ve Vade Takip'le aynı.
     - Örnek 2'de F1 listede görünmez.
   - **B (bugün ve v2.0.23'ten beri program):** fatura kendi açığıyla görünür.
     - Örnek 1'de F1 50.000, 6 gün gecikmiş. Aynı 30.000 01.03 / 01.04 vadeli taksitlerde de görünür.
     - Örnek 2'de F1 50.000 gecikmiş görünür, cari kartında gecikmiş 0.
   - **Önerim A.** Yaşlandırma raporu cari kartı ve Vade Takip ile çelişmemeli. Ayrıca kartın kendi faturası zaten rapora girmiyor (alt başlık: "taksitli faturalar taksit kartında izlenir").
   - A seçilirse bir program turu gerekir (openItems'ın Açık Faturalar çağrısı net istemeli).
   - Yaygın programlarda nasıl yapıldığına dair doğrulanmış bir kaynak okumadım.
2. R-B5 (s91, yalnız UTC'de "yerel gün"): eski soru, yenisini eklemedim. mz0 yalnız aynı kuralın bir örneği daha.

### SONRAKİ SÜRÜME (2.5.1)
- Gerileme atıf aracı sezgisel; 10 koşuyu elle tamamlamak gerekti. Aileleri ve "durum" ile "ret iletisi" farklarını araca almak iyi olur.
- Ateşleme taramasını (`atesleme.py`) ve döküm aracını sürücünün kendisine almak; ateşlemeyen kural için kendiliğinden uyarı.
- `eski` kartı şu an göç işaretinin veri tabanına yazılmasıyla kuruluyor; senaryo izin verdiğinde v2.4.9 yolu da denenebilir. Bugünkü yöntem programın kendi testleriyle aynı, bu yüzden yalnız iç düzen.
- Geçmiş günlü raporların ÖLÇÜLEMEDİ sınırı (120 satır) aynen sürüyor.

### DENENMEYEN
- S213 susması (Değersiz yazılmış şüpheli fatura): hiçbir senaryonun beklenen dosyasında `susmalar` S213 kaydı yok. Kod yolu yazıldı ama gerçek veriyle çalışmadı.
- `esle_cari` ile cari değiştirme dalı: bütün senaryolarda program kâhinin carisini eşledi, dal hiç çalışmadı. "atlandi" yolu yalnız eski kodda ve mutant2'de çalıştı.
- Eski sürüm aşamasında (v2.4.9) koşan `eski: true` Kartı Kapat ve aynı Excel'in ikinci kez yüklenmesi: kâhinin dilinde yok.
- Kâhinin sustuğu alanlar (S225–S227, S188 / S191 / S193): karşılaştırılmadı.
- P6 ve P4: değişmedi, bu bakımın kapsamında değil.
- Hız ölçümü yapmadım (görev gereği); tam `npm test` koşmadım.

### Ana oturumun yeniden koşacağı komutlar (worktree kökünde)
- **Tam koşu**, yaklaşık 33 dk, iki TZ: `bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/surucu5-a293/kos-tam.sh <ad>`. Betikteki W yolu kendi kopyanıza göre değiştirilmeli; içerik: `KANIT_DIR=… flock -s -w 3600 …olcum.lock node tools/kanit.mjs kos surucu5-<ad> -- node test/bagimsiz/muhasebe-surucu/kos.mjs --cikti /dev/shm/… --veri /dev/shm/…`.
  - Beklenen: AYNI 7.248 · U 508 · P 18 · K 0 · R 10 · SINIFLANMADI 0 · ÖLÇÜLEMEDİ 120 · SUSMA 22 · # fail 28 · 7.756/7.926.
- **Ç7b öncesi kod:** aynı komuta `--program /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/surucu5-a293/eski` (git archive c7b2-taban, docs/kanit hariç). Beklenen # fail 874.
- **Gerileme:**
  - `python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py <eski> <yeni>` → 72 / 248 farklı.
  - `python3 -I docs/kanit/2026-11-20/surucu5-arac/gerileme-atif.py <eski> <yeni> test/bagimsiz/muhasebe-surucu/gerileme.py` → aracın açıklayamadığı 10 koşu (elle atıf dosyası).
- **Mutantlar:** `python3 -I docs/kanit/2026-11-20/surucu5-arac/mutant.py <kopya> mutant1|mutant2`. Kopya şöyle hazırlanır: `git archive HEAD server client package.json` + `test/helpers.mjs`. Ardından `kos-tam.sh <ad> --senaryo s40,s60,s121|s91,s19,s86 --paralel 1 --program <kopya>`.
- **En küçük örnekler:** `bash docs/kanit/2026-11-20/surucu5-arac/kucuk-kos.sh <senaryo.json> <beklenen.json> <ad> [TZ] [program kökü]`. Örnekler `docs/kanit/2026-11-20/surucu5-en-kucuk/` içinde.

### Dosyalar ve ortam
- Sürücü: `test/bagimsiz/muhasebe-surucu/{karsilastir.py, program.mjs, kos.mjs, siniflama.json}`. siniflama.json'da 15 kural kaldı.
- Kanıt: `/home/user/ofis---y-netimi/.claude/worktrees/agent-a293dd7fb86915c0b/docs/kanit/2026-11-20/surucu5-*`
  - Koşu kayıtları (json + log.gz): onceki, son, eski, mutant1, mutant2.
  - Tablolar ve dökümler: `surucu5-tablo.txt`, `surucu5-eski-tablo.txt`, `-dokum.txt`, `-ozet.json.gz`, `surucu5-son-atesleme.txt`.
  - Gerileme: `surucu5-gerileme.txt`, `-gerileme-atif.txt`, `-gerileme-atif-elle.txt`.
  - Diş denemesi: `surucu5-mutantlar.txt`.
  - Klasörler: `surucu5-en-kucuk/`, `surucu5-arac/`.
  - Rapor taslağı: `surucu5-rapor-taslak.md`.
- Kendi /dev/shm klasörümü ve not defterindeki mutant / v2.4.9 kopyalarını tam yollarıyla sildim. Ç7b öncesi kod kopyası (`scratchpad/surucu5-a293/eski`, 88 MB) yeniden koşu için duruyor. node_modules bağı ağaçta.
- Ortam (son ölçüm): yük 7,9 / 4 çekirdek (başka oturumların koşuları), bellek boş 6 GB, disk boş 7,2 GB.
