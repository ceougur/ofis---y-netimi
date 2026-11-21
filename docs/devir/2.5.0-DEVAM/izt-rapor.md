# İzleyen küçük tur — rapor

## Özet
- Yedi işin hepsi kodlandı. Her birinin testi eski kodda kırmızı, yeni kodda iki saat diliminde yeşil.
- Kâhin ↔ program iki saat diliminde 0 fark. P-1'in 5 ve P-2'nin 14 farkı kapandı.
- Hız ölçümünde kötüleşen yol yok. Fatura kartı GET, Ç7b öncesinden de hızlı.
- Push yok, zamanlanmış görev yok.
- Bir kök neden kodlanmadı, baş mimar kararına bırakıldı: kapama defteri ile kuyruk, kartın hangi faturayı içine aldığını farklı seçiyor (aşağıda).

## Taban, dal, commit'ler
- Taban: 44a1762d (reset doğrulandı).
- Dal ucu: worktree-agent-a685ea99951e1d5f9 = **45da6ea8**.
- 14 commit, hepsinde `Co-Authored-By: Claude <noreply@anthropic.com>` var, model adı yok:
  - 8bd8b5c8 — tasarım §19 (koddan önce)
  - a30ae465 — İş 1 + 4
  - 128922e0 — İş 2
  - 24e40283 — İş 3 + 5
  - 62988915 — İş 6
  - 66057ddf — sınama
  - c11b1dc2 — ekran senaryosu
  - f853feb1 — komşu beklentileri
  - c3d9bcc0 — kâhin kanıtı
  - efeb1381 — c7b-tur3 ekran beklentisi
  - 36d8e118 — S234-c yalnız azaltmada + C2 testi
  - 8bf990d2 — taslak
  - d51f0ebe — hız kanıtı
  - 45da6ea8 — §19.10 + son kanıt

## Değişen yollar
Kod (+839 / −56; docs/kanit hariç):

| Dosya | + / − |
|---|---|
| `server/lib/obligation-queue.mjs` | +71 |
| `server/lib/obligation-input.mjs` | +7 / −? |
| `server/routes/invoices.mjs` | +133 civarı |
| `server/routes/plans.mjs` | +40 |
| `client/assets/hof-invoices.js` | +3 / −1 |
| `package.json` | +1 (`test:senaryo-izt-250`) |

Testler:
- Yeni: `test/izt-izleyen-tur-250.test.mjs` (16 test), `test/e2e/senaryo-izt-250.mjs`.
- Beklentisi bilerek değişen (karar numaralı yorumla): `c7b-tur3-hiz-250`, `c7b-tur3-kart-250`, `dkfix-s234-kapali-kart-250`, `iade-kesinti-tarama-249`, `t3hiz-esdegerlik-250`, `e2e/senaryo-c7b-tur3-250`.

Belgeler: `docs/erp/C7B-FATURA-TASARIM.md` §19 (§19.1–§19.10).

Dosya sınırı:
- Kuyruk ve kapama yardımcıları olarak `lib/obligation-queue.mjs` ve `lib/obligation-input.mjs` kullanıldı. `lib/invoice-settle.mjs` değişmedi.
- `stock.mjs`, `YAPIM-ASAMASI.json`, `test/bagimsiz/**`, ci.yml ve release.yml'ye dokunulmadı.
- Göç yok.

## İşler

**İş 1 + 4 — P-2 ve BULGU-1 (aynı kök neden)**
- **Kural:** karar (4), "fazlası carinin avansı".
- **Kök neden** (§19.2): kapama defteri kartın kapsamını açıldığı andaki tutarla kuruyor. Kuyruk ise iadeyle küçülmüş taksitlerle kuruyordu.
- **Kod:**
  - `returnCutsOf` / `coverCutsAfter` eklendi.
  - Ön geçişte kartın kapasitesine, o andan sonra doğan iadelerin kesintisi ekleniyor.
  - Asıl geçişte iadenin asıl faturaya mahsubu, kartın tuttuğu kısma dokunmuyor (`holds`).
  - Girdiye `coverCuts` sütunu eklendi.
- **Sonuç:**
  - d55 B2 (açık ve kapalı kart): kart 600 / Tahsil Edilen 600 / Kalan 0, iade açığı 300, bakiye −300. Tabanda Tahsil Edilen 300 / Kalan 300 idi.
  - T8 açık: gecikmiş 0 / 0 (tabanda 300).
  - T8 kapalı: 08.10 0, 09.10 600 (tabanda 300 / 900).

**İş 2 — P-1 / S238 = A**
- `cutPlan` kestiği taksitleri kaydediyor. İade belgesine `coverCutItems` / `ownCutItems` yazılıyor.
- İade iptalinde `growForInvoice` aynı taksitlere aynı kimlik ve vadeyle geri yazıyor. Kaydı olmayan eski iade bugünkü gibi son taksite gidiyor.
- d55 B1: taksitler iade öncesiyle aynı. 20.11 gecikmişi açık ve kendi kartta 300 (tabanda 0); kapalı kartta S205 gereği 600.

**İş 3 — S234-c**
- Ekrandaki yol: fatura kartı → Düzenle → Kaydet = **`POST /api/workspace/invoices/:id/edit`**.
  - Gövde: `scenario, accountId, issueDate, lines[], payment{cash[], cheques[], endorse[], rest, dueDate, installments}, force`.
  - Yalnız kaydedilmiş (issued) belgede çalışıyor; taslakta 409 `invoice-not-issued`.
  - Kâhinin yokladığı `PUT /invoices/:id` yalnız taslak içindir (kesilmişte 409 `invoice-not-draft`). Kâhinin 38 Düzenle kaydı bu yüzden listede kalıyor.
- Kod: `editInvoice` → `shrinkCoversByEdit` (önce ve sonra kapsam payı; karar (4) sırası; `trimCovers`).
  - Kod sürerken daraltıldı: yalnız tutar azalınca çalışıyor.
  - Gerekçe 1: Düzenle'de eklenen peşin ödemeydi, kartı küçültüyordu (C2 testi).
  - Gerekçe 2: hız ölçümü 1'de "Düzenle (aynı içerik)" +%20 çıkmıştı.
- D1 (açık ve kapalı kart): kart 900 → 300; 05.10 ve 05.11 kesildi, 05.12 kaldı.

**İş 5 — BULGU-2**
- İstemci: `payFrom` artık `mode === "installments"` ise "Taksitli" seçiyor.
- Sunucu: açık, tahsilatsız kart; aynı tutar, sayı, ilk vade, aralık, tarih ve cari ise kart AYNEN kalıyor (kimlik, kart no, taksitler).
- Bir şey değişirse yeni kart açılıyor (bugünkü davranış). Kapalı kart S235 gereği yeniden kuruluyor.

**İş 6 — fatura kartı GET**
- `ledgerFor` / `settledFor` önbelleği eklendi; anahtar `settleKey`, işlem içinde okunmuyor.
- `paymentStates` artık `obligationsOf` kullanıyor.
- Eşdeğerlik: H6 testi her yazım türünden sonra önbellekli değeri işlem içinde baştan kurulanla karşılaştırıyor.

**İş 7 — S239 / S240**
- Program bugün de öneri A ile aynı davranıyor; testlerde bekçi olarak tutuldu.
  - S239: kart 600 değişmiyor; 06.10'da gecikmiş 200.
  - S240: kart 900 / Tahsil Edilen 300 / Kalan 600, faturanın karttaki payı 600.

## Testler
- **Yeni test dosyası (16):** yeni kodda UTC 16/16, İstanbul 16/16.
  - Eski kodda (44a1762d) UTC 4/15, İstanbul 5/16. 11 kırmızı, hepsi beklenen nedenle:
    - P2: kart değerleri.
    - P1: taksit satırları farklı; P1e'de kesim kaydı yok.
    - B1: gecikmiş 300, beklenen 0.
    - C1: kart 900, beklenen 300.
    - E2: yeni kart açılıyor.
  - Eski kodda yeşil kalanlar bekçi testler: P2o, S239, S240, H6, C2.
- **Komşu tarama:** 170 dosya; `test/` taraması değişen işlev adlarıyla yapıldı ve dkfix'in G2 listesiyle birleştirildi (altın test ve K1 dahil).
  - İlk koşu iki saat diliminde 2034/2040.
  - 6 farkın nedeni okundu:
    - S216 → S238 beklentisi (2 dosya).
    - "Defter en çok bir kez": artık 0 kez okunuyor, önbellek.
    - Kesinti tarama sayacı yeni sütunu sayıyordu.
    - t3hiz hakemi yeni sütunu bilmiyordu (2 alt test).
  - Beklentiler karar numaralı yorumla düzeltildi. Bu 6 dosya ve yeni test iki saat diliminde 44/44.
- **Ekran:**
  - senaryo-izt-250: yeni 20/20, eski 10/18.
  - Düzenle formuna ya da kart penceresine dokunan 15 komşu senaryo yeşil: dkfix, banka-210b, eski-satir, pos-220, entegrator-240, fatura-243, kdv-donemi, c7b-kabul, gg244 ×2, uiux-b-243, 216, 217, kart-onbellek-yaris, c7b-tur3. c7b-tur3 ilk koşuda S216 beklentisinde düştü; düzeltmeden sonra 39/39.

## Kâhin ↔ program
| Kâhin | Saat dilimi | Sonuç |
|---|---|---|
| Cari | UTC ve İstanbul | 22794/22794, 0 fark. P-1 ve P-2'nin 19 farkı kapandı. |
| Defter | UTC ve İstanbul | 187/187, 0 fark, yakalanmayan mutasyon 0. |

Yapım aşaması listesi (kendi kopyada): 38 → 38 (yeni 0, kapanan 0, değişen 0; hepsi Düzenle). Kapanmamalarının nedeni yukarıdaki PUT ile POST farkı. Depodaki liste değiştirilmedi.

## Hız
Koşullar: özel kilit, 3 tur dönüşümlü, temiz 100 bin verinin taze kopyası. Her ölçüm başında yük 1,0–1,41 (geçersiz tur yok). Tablo `docs/kanit/2026-11-21/izt-hiz/tablo.md`.

En iyi / ortanca (ms):

| Yol | Taban | Yeni | Fark (ortanca) |
|---|---|---|---|
| Fatura kartı GET | 69,4 / 80,0 | 36,0 / 38,1 | −%52 |
| Fatura Düzenle (aynı içerik) | 127,7 / 138,0 | 110,9 / 117,5 | −%15 |
| Fatura Düzenle (azaltma) | 6527 / 7024 | 6249 / 6353 | −%10 |
| İade yazımı (kapalı kart) | 144,0 / 148,1 | 143,8 / 159,7 | +%7,8 |
| İade iptali (kapalı kart) | — | — | +%4,2 |
| İade iptali (açık kart) | — | — | −%5 |
| Kart penceresi GET | — | — | −%4 |
| Cari kartı GET | — | — | −%9,5 |
| Zil GET | — | — | +%1,9 |
| Taksitler listesi | — | — | −%11 |
| Faturalar listesi | — | — | −%7 |
| Kartı Kapat | — | — | −%7 |

- Fatura kartı GET, Ç7b öncesine (af655afd: 42,9 / 44,4) göre −%16.
- Kötüleşen yol 0.
- İlk ölçümün iade kolu betik hatası yüzünden 400 döndü; geçersiz sayıldı ve dosyası ayrı tutuldu (`sonuc-1-gecersiz-iade.txt`).

## Ekran (görüntüler `docs/kanit/2026-11-21/izt-ekran/`, baktım)
- **01:** Düzenle'den sonra kart aynı kaldı.
- **02:** kapalı kart + iade, Kalan ₺300,00.
- **03:** iade iptalinden sonra Kalan ₺600,00. Üç taksit satırı da ₺300,00; vadeler 08.10, çünkü S205 kapanış günü. İlk satır "Ödendi".
- **04:** Kartı Kapat sorusu "Kalan ₺600,00".
- **05:** ikinci kartın üç taksiti "Bekliyor", Kalan ₺300,00, Tahsil Edilen 0.
- **06:** Düzenle'den sonra Kalan ₺300,00.

## KULLANICIYA SORULMALI
**SK-42 (a) — Düzenle ile kartın açık kalanından FAZLA azaltma.** Örnek: kart 900, tahsilat 600, Düzenle 900 → 300.
- Bugün (yeni kod): kart 600; kartın kendi hesabı Tahsil Edilen 600 / Kalan 0. Ama kuyruk görünümü Tahsil Edilen 300 / Kalan 300 gösteriyor; bakiye −300.
- A (öneri): fazlası carinin avansı, iadeyle aynı. Kod gereği: Düzenle kesintisi iade gibi kayda geçer.
- B: kart küçülmesi kartın kalanıyla sınırlı kalır, görünüm bugünkü gibi.
- C: uç durum böyle kalsın (BİLİNEN SINIR).
- Yaygın programlarda: doğrulanmış kaynak okunmadı.

**SK-42 (b) — Düzenle ile ARTIRMA.** Örnek: fatura 300, kart 300, Düzenle 300 → 900.
- Bugün: kart değişmiyor; artan 600 faturanın vadesiyle kuyrukta (10.09'da gecikmiş 600).
- A (öneri): bugünkü gibi kalsın.
- B: kart büyüsün.
- C: uç durum (BİLİNEN SINIR).
- Yaygın programlarda: doğrulanmış kaynak okunmadı.

## BAŞ MİMAR KARARI GEREKEN
**1. Kapama defteri ile kuyruğun kapsam seçimi ayrışıyor.** Önceden var; taban ve yeni kod aynı. Kanıt `izt-kos/ayr.mjs`, `ayrisma-yeni-eski.txt`.
- Durum: carinin açık borcu kart tutarından fazlayken (S120) kuyruk kartı en eski faturaya bağlıyor; kapama defteri en yeni faturaya.
- Örnek: A 600 (01.09), B 600 (02.09), kart 600.
  - Ekranda A "Taksitte", B "Gecikti" görünüyor.
  - A'nın İptal Et'i kartı değiştirmiyor.
  - B'nin İptal Et'i kartı KAPATIYOR: 0 / K0, bakiye 600; A kartsız kalıyor.
  - İade de yanlış kartı küçültür.
- Görevdeki "tek yardımcı" bu turda yalnız kapsam TUTARI için yapıldı. Seçim için tek yardımcı yazılırsa iade, iptal ve Düzenle davranışı değişir. Yeni tur ya da karar gerekiyor (para kuralı olabilir — ders 43).

**2. Düzenle azaltma 6,3–7 sn sürüyor.** Ç7b öncesinde de aynı; olay döngüsü 7 sn. Kullanıcıyı etkiliyor. Bu turun kapsamı dışında, nedeni ölçülmedi.

**3. `hof-invoices.js` dosya sınırı.** Yalnız `payFrom` değişti.

## SONRAKİ SÜRÜME (2.5.1)
- İade Düzenle'sinde kendi kart, kayıtlı taksitlere değil son taksite büyüyor (P-1 kapsamı iade iptali; kapsayan kart Düzenle'de de kayda göre büyüyor).
- Ölçüm nüansı: yeni kodda "Düzenle azaltma" olay döngüsü en çok değeri 0,0 okundu (izleyici yakalamadı).

## DENENMEYEN
- Son değişiklik (36d8e118, S234-c yalnız azaltmada) yalnız yeni test dosyası (iki saat dilimi 16/16) ve hız ölçümü 2 ile sınandı. G2 komşu taraması ve komşu ekran senaryoları bu değişiklikten ÖNCE koşuldu → ana oturumun tam `npm test`'i.
- Tam `npm test`; mutasyon testi. Mutantlar yalnız gerekçeyle yazıldı, koşulmadı.
- Kilitli dönem; iki şirket; yedek → geri yükleme; v2.4.9 gerçek verisi.
  - Kesim kaydı (`payment_json` yeni anahtarları) göç gerektirmiyor. Kaydı olmayan eski iade P1e testinde var.
- Faturasız stok iadesinin kesinti kaydı (`trimCovers` öğeleri yalnız iade faturasında kaydediliyor).
- İadeyle küçülen taksitin sonradan elle düzenlenmesi ya da silinmesi ardından iade iptali (kayıtlı kimlikle yeniden açılır).
- Ekran senaryoları tek saat diliminde koşuldu (İstanbul).

## BİLİNEN SINIRLAR
- SK-42 (a) çözülene kadar: Düzenle ile fazla azaltmada kart görünümü Kalan 300 gösteriyor.
- Kâhinin 38 Düzenle kaydı açık (PUT ile POST farkı).

## Ana oturumun yeniden koşacağı komutlar
Kilit kalıbı: `flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 2400 …`

- **Yeni test:** worktree'de
  `HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC|Europe/Istanbul … node --test test/izt-izleyen-tur-250.test.mjs`
- **Eski kopya:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt-a68/eski` (git archive 44a1762d; yeni test içinde).
- **Komşu tarama:** `bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt-a68/g2-kos.sh` (liste `g2-tum.txt`).
- **Ekran:** `bash …/izt-a68/e2e-kos.sh <kod> <ek> senaryo-izt-250 …`
- **Kâhin:** `bash …/izt-a68/kahin.sh`
- **Hız:**
  `flock -x -w 3600 …/olcum.lock timeout -k 5 6000 bash …/izt-a68/hiz/kos.sh`
  sonra `python3 -I …/izt-a68/hiz/tablo.py …/izt-a68/hiz/sonuc.txt`
  Ç7b öncesi kopya: `…/izt-a68/oncesi` (af655afd).

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt-a68`
- `probe/`: iz.mjs, b2.mjs, ayr.mjs, pk3.mjs, pk4.mjs
- `hiz/`
- `eski/`, `oncesi/` (kod kopyaları, git archive)
- Koşu çıktıları ve `ekran-*`

Ortam: yük 1,49 / 4 çekirdek, bellek boş 2 GB (kullanılabilir 7 GB), disk boş 11 GB. Arka planda işim kalmadı.
