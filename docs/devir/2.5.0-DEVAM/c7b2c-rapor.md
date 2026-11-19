# Ç7b TUR 2c — ajan raporu (AYNEN; ajan a7bce30c32d8be42f)

# Ç7b TUR 2c — RAPOR (iş bitti; PUSH YOK)

**Dal ve taban**
- Dal: `worktree-agent-a7bce30c32d8be42f`.
- Taban: `c7b2c-taban` = b66f1ae8. Worktree'yi `git reset --hard` ile sıfırladım, ucu `git log` ile doğruladım.
- Uç: f0f1b88e. Commit'siz iş yok, çalışan arka plan işim yok.

**Ortam:** yük 1,0 / 4 çekirdek, boş bellek 10 GB, boş disk 9,7 GB.

## Değişen gözlenebilir davranış (önce → sonra)

**Kilitli eski dosya (güncellemedeki kilit = geçiş günü)**
- Kayıt tahsilatı (KG-3), tarihi ≤ geçiş günü ise:
  - Önce: Yevmiye ve mizanda A 336.90.
  - Sonra: A 602 (eski yön).
  - Geçiş gününden sonraki tahsilat: A 336.90.
- Satıştan iade KDV'si (KG-8):
  - Önce: B 191.
  - Sonra: geçiş gününde / öncesinde ya da güncellemeden önce KDV mahsubu yazılmış ayda B 391; öbür aylarda B 191.
- Alıştan iade KDV'si (F-08): aynı kuralla A 191 (eski) ↔ A 391 (yeni).
- Mutabakat Testi / Kural Değişikliği Farkı, v2.0.26 verisinde:
  - Önce: kural farkı fişten sonra da "Fark Var"; dışarıda kalan alt defter farkı 840 TL.
  - Sonra: 336 / 191 / 391'de fark yok; Kural Farkı Düzeltme Fişi'nden sonra "— Düzeltildi".

**KDV Mahsup Fişi (eski mahsup ayı)**
- Eski mahsup ayı "Güncel Değil" görünmez.
- Mahsup Geri Al denince o ay yeni yöne geçer.
- Örnek (Ekim, yeniden ön izleme): eski H 200 / İ 100 yerine H 500 / İ 400; ödenecek aynı (100 TL).
- Saklı mahsup tutarları değişmez.

**Kilitsiz dosya:** geçiş yok, bütün tahsilatlar 336.90. Güncellemeden önce mahsup edilmiş ay yine eski yönde (B-6).

**Süzgeç (B-9):** iade faturası yazımında süzgeç artık bulgu vermez (gg-cari yeşil).

**Banka Alt Hesap Mizanı (B-10 = B):** ürün değişmedi, yalnız test süzüldü.

## Geçiş yardımcısı ve okuyucuları
Tek tanım `server/lib/ledger-rule-shift.mjs` (yeni). İçinde `ruleShiftOf(store)`, `oldCollection` / `oldReturnVat` ve SQL karşılıkları.

| Okuyucu | Yer |
|---|---|
| Türetme | `server/lib/general-ledger.mjs:463` (girdi), `:465` (tahsilat), `:667` (satıştan iade), `:683` (alıştan iade) |
| journal'ın girdisi | `server/routes/ledger.mjs:306` — rows() içinde tek satır `out.ruleShift` |
| Defter Mutabakatı beklenenleri | `server/routes/ledger.mjs:350–351` (336), `:393` (191 / 391) |
| Süzgeç | `server/lib/integrity-scope.mjs:668` |
| Göç 51 | `server/lib/migrations.mjs:1650` |

- **Göç 51 (yalnız işaret, tutar yok):**
  - `settings['ledger.ruleShiftThrough']` = güncellemedeki kilit; kilitsiz dosyada ''. INSERT OR IGNORE olduğu için yeniden koşuda değişmez.
  - `vat_offsets.rule_version` eklenir; sütun bu göçte eklendiyse var olan mahsuplar '2.4.9' işaretlenir.
- **`routes/tax.mjs` değişmedi.** Ön izleme, liste ve Güncel Değil `build()`'i okuyor, geçişi kendiliğinden alıyor; test bunu sayıyla gösteriyor.

## 336 ayrışmasının yeniden üretimi (ders 6)
Kanıt: `c7b2c-336-taban.txt`, `c7b2c-336-yeni.txt`. Veri v2.0.26 gerçek kodundan.

**Tabanda**
- Fişten önce ve sonra: 336 karma −750 · canlı −1.500 · beklenen −1.500.
- 191: karma 5.376 · canlı 5.466. 391'de de 90 TL fark.
- Fiş ön izlemesinde dışarıda kalan fark 840 TL.
- Kök neden: kilitli 750 TL tahsilat ve 90 TL iade KDV'si donmuş defterde 2.4.9 yönünde, canlı türetmede Ç7b yönünde. B14 (a) yüzünden fişle kapanamıyordu. Ayrı bir ürün hatası değil, B-8'in kendisi.

**Yeni kodda**
- Üç hesapta karma = canlı = beklenen.
- Dışarıda kalan fark yok; fişten sonra "Düzeltildi".
- Ayrışma kalktı. `kural-farki-duzeltme` testinin değişmezine 336 / 191 / 391 artık dahil.

## Yeni / değişen testler
Kanıt: `c7b2c-kirmizi-yesil.txt`.

**Yeni: `test/c7b-gecis-gunu-250.test.mjs`** (v2.4.9 gerçek kodunun verisi)
- Gün sınırı 29.09 / 30.09 / 01.10 (geçiş günü 30.09).
- Eski mahsup ayı ve ters kayıt → yeni yön.
- Kilit ileri, kilit kaldırma; Silinenler'den geri gelen tahsilat eski yönde.
- Göç 51'in yeniden koşusu, göç öncesi yedeğin geri yüklenmesi, kilitsiz dosya.
- Beklenen sayılar elle.
- Tabanda kırmızı; nedeni geçiş işaretinin olmaması.
- Yeni kodda yeşil: 2/2 UTC, 2/2 İstanbul.

**Değişen: `kural-farki-duzeltme`**
- Tabanda 6/8; kırmızı nedenleri "göç 51: geçiş günü" ve "ret durumunda fiş farkı kapattı (Düzeltildi)".
- Yeni kodda 8/8, iki TZ'de.

## Mutantlar
Her biri ayrı uygulandı; geçiş testi her mutantta 2 kez koşuldu (ders 20). Kanıt: `c7b2c-mutasyon.txt`.

| Mutant | Yakalayan test ve ileti |
|---|---|
| Geçişi yok say | geçiş testi 2/2 koşuda ("KG-3: geçiş gününde ve öncesinde 602…"); kfd |
| '≤' → '<' | geçiş testi 2/2 koşuda (aynı ileti); kfd |
| Mahsup işaretini yok say | geçiş testi 2/2 koşuda ("B-6: … Ekim eski yönde") |
| Süzgeçte eski formül | gg-cari ("süzgeç tam kapıyla aynı karar vermeli", bulgu 1) |
| Göçte işaret yazma | geçiş testi (TypeError; değerle kırılsın diye `?.value`'ya çevirdim, 29bc45d1), kfd ("göç 51: geçiş günü") |
| Ek: beklenende eski formül | geçiş testi ("Defter Mutabakatı'nın beklenenleri"), kfd, gg-cari |

Mutantsız koşu: hepsi yeşil.

## Komşu taraması ve defter kâhini
**G2 komşu taraması (ders 10):** adıyla ya da API yoluyla anan 222 test dosyası; ölçüm kilidi doluydu, tek tek sırayla koştum. Kanıt: `c7b2c-komsu.txt`.
- İstanbul: 222/222 rc=0.
- UTC: 221/222 rc=0. `banka-210-goc` kırmızıydı: göç 51'in yeni ayar satırını "mevcut satır değişti" saydı. Test aracını düzelttim, yeniden koşu 25/25.

**Defter kâhini (`npm run test:kahin-defter`):** 183/187, UTC ve İstanbul aynı. Kanıt: `c7b2c-kahin-defter.txt`.
- 4 fark: K_EYLUL ve K_SON 191 / 391.
- Tabanda da aynı 4 fark ve 0 yakalanmayan mutasyon. Bu tur getirmedi.
- Nedeni KG-8 / F-08: kâhin hâlâ eski yönü modelliyor. Kâhin bakımı TUR 2e'nin kapsamında; ders 40 gereği programa uydurmadım.

## Değişen beklentiler (her biri "BEKLENTİ / BİLEREK DEĞİŞTİ" ve karar numarasıyla)
- **`kural-farki-duzeltme` (B-8 = A):** Düzeltildi; dışarıda kalan fark yok; değişmeze 336 / 191 / 391 dahil. `c7b-kural` fixture'ına `through` (geçiş günü) eklendi.
- **Ç3 testleri `donmus-defter-tur1` / `tur3` / `tur4` / `yasam`:** tohum Ç5-A G3'ün ilkesiyle iki kuralda aynı türetilen veriye çevrildi.
  - Borç Yaz → satış faturası; carisiz Kasa girişi → carinin nakit tahsilatı.
  - Kural benzetimi fatura 600 → 642.
- **`donmus-defter-bellek`:** Ç5-A dışı fark yalnız Ç7b kural kimliklerinde (c7b-kural çevirisiyle).
- **`banka-210-gg2-hiz` (B-10 = B):** eşdeğerlik 101 / 102 / 108 / 121 / 300 / 309 alt hesap kümesine süzülür.
- **`donmus-defter-250`, `yasam`, `kural-farki-kapi-disi`:** şema sürümü 50 → 51.
- **`defter-kaynak-iz`:** `vat_offsets.rule_version` gerekçeli açık istisnada (SINIF 3).
- **`guvenilirlik/goc-v20`:** göç 51'in yeni ayar satırı karşılaştırma dışında; var olan ayarlar yine değişmemeli.

## Senin yeniden koşacakların
`HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test --test-concurrency=1 <dosya>`, `TZ=UTC` ve `TZ=Europe/Istanbul`:

| Dosya | Beklenen |
|---|---|
| `test/c7b-gecis-gunu-250.test.mjs` | 2/2 |
| `test/kural-farki-duzeltme-250.test.mjs` | 8/8 |
| `test/banka-210-gg-cari.test.mjs` | 3/3 |
| `test/banka-210-gg2-hiz.test.mjs` | 5/5 |
| `test/donmus-defter-tur1-250.test.mjs` | 12/12 |
| `test/donmus-defter-tur3-250.test.mjs` | 11/11 |
| `test/donmus-defter-tur4-250.test.mjs` | 13/13 |
| `test/donmus-defter-yasam-250.test.mjs` | 7/7 |
| `test/donmus-defter-bellek-250.test.mjs` | 5/5 |
| `test/donmus-defter-250.test.mjs` | 13/13 |
| `test/defter-kaynak-iz-250.test.mjs` | 2/2 |
| `test/banka-210-goc.test.mjs` | 25/25 |

- `npm run test:kahin-defter`: 183/187 (4 fark tabanla aynı).
- Kırmızı kanıtı için: `git worktree add --detach <kopya> c7b2c-taban`, yeni testi kopyala, koş.

## Commit'ler
a10464cb (tasarım §13), 4a0facb0 (kod), 9f9ed101 (testler), 47ffe0cc (§13.6), 1b8b7d2a (komşular), 17128410 (goc-v20), 29bc45d1, f0f1b88e (kanıt).

## BAŞ MİMAR KARARI GEREKİYOR
1. **Dosya sınırı aşımı:** `routes/ledger.mjs` rows()'a tek satır (`out.ruleShift = ruleShiftOf(store)`) yazdım; görev metni bu dosyada yalnız expected()'e izin veriyordu. journal saf olduğundan geçiş girdisinin rows()'tan gelmesi gerekiyordu. Kabul ya da başka bir yer kararı senin.
2. **Kilit izi:** `vat_offsets.rule_version` ve `settings['ledger.ruleShiftThrough']` kilit izinde değil; `integrity.mjs` dosya sınırı dışında. Kapı dışı bir değişiklik bugün yalnız Kural Değişikliği Farkı uyarısıyla görünür. Önerim: bir sonraki `integrity.mjs` izninde kilit izine almak.
3. **Şirket Verisini Sıfırla:** "Tümünü" geçiş gününü siler, "Hareketleri" silmez (`app.mjs` dosya sınırı dışında). Sıfırlamadan sonra geçiş gününden önce tarihli girilen iade eski yönde kalır. Önerim: iki kipte de silinsin.

## KULLANICIYA SORULMALI
Yok.

## DOĞRULANMADI / DENENMEYEN / KOŞULMADI
- **Hız:** ölçülmedi (TUR 2e). Türetmeye her çağrıda iki küçük sorgu ekleniyor (ayar ve mahsup tablosu).
- **Denenmedi:**
  - Aynı kurulumda iki şirket (kilitli + kilitsiz) — yalnız ayrı veri dosyalarıyla denendi.
  - Aynı gün sıra (ders 31) testi — yüklem yalnız tarihe bakıyor.
  - Geçiş günü çevresinde ayrı yıl dönümü örneği.
  - `b7-dondurma-yaris-zorla.mjs` kipleri.
  - Ekran senaryoları ve sürücü / kâhin "sonra" karşılaştırması (TUR 2e kapsamı).
- **Yük kuralı:** defter kâhininin taban koşusunu 1 dakikalık yük 3,79 iken başlattım; eşik 3,5'ti.
- **Tam npm test:** koşulmadı (görev gereği).

## Not defteri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2c-ag`:
  - Betikler: `tek.sh`, `mutasyon.sh`, `mutant.py`, `kahin.sh`, `kanit-yaz.sh`, `uret/b8-336.mjs`.
  - Ham çıktılar: `tek-*.out`, `mut-*.out`, `kahin-*.out`.
- Kopyalar (`taban-wt`, `mut-wt`) ve arşiv kopyası tam yoluyla silindi.
