# Ç7a kod ajanı — rapor (D-07 bitti; KG-19 / KG-6 / K-14 / K-15 dosya sınırında DURDU)

Dal: `worktree-agent-a2a0272debd031466`, taban `c7a-taban` (12b23fc6). Push yapılmadı. Ortam: yük 2,3 / 4 çekirdek, boş bellek 7 GB, boş disk 11 GB.

**Kısaca:** Dört kuraldan yalnız D-07 (kart faizi) kodlandı. KG-19, KG-6 ve K-14 / K-15 kodlanmadı, çünkü defterin veri kaynağı `server/routes/ledger.mjs` (`rows()`) bu kuralların ihtiyaç duyduğu alanları vermiyor ve bu dosya görev metninin YAZILMAZ listesinde. Kurala göre durdum; ayrıntı aşağıda B1'de.

## Bu turun değiştirdiği davranış (önce → sonra; dayanak D-07, sürücü bulgusu P3)
- **Sunucu:** Kredi kartı hesabına Faiz Gideri fişi önceden 400 `bank-account-invalid` ile reddediliyordu ("faiz gideri Vadesiz, Ticari ya da Diğer TL hesaptan girilir"). Artık kabul ediliyor.
  - Örnek madde: faiz 200 + BSMV / KKDF 10 → B 780 200 · B 780 10 / A 309.k 210.
  - Gecikme bedeli de aynı fişle girilir: B 780 / A 309.k.
  - Kart borcu artar; banka, Kasa ve cari değişmez.
- **Planlı İşlem:** Kart hesabına Faiz Gideri planlanamaz (400, neden yazılı: "kart faizi planlanmaz, ekstre gelince Faiz Gideri olarak girilir"). Vadesizde planlı faiz gideri eskisi gibi serbest.
- **Değişmeyenler:** Kart hesabına Masraf, Diğer Gider ve Faiz Geliri yine 400.
- **Ekran (Banka):**
  - Kart hesabının Hesap Detayı'nda yeni "+ Kart Faizi" düğmesi. Pasif kartta düğme pasif, nedeni görünür yazı.
  - Faiz formunda Faiz Gideri seçilince hesap listesine kartlar da gelir. Faiz Geliri seçilince ve Planlı İşlem'de kart listede yok.
  - Kart seçiliyken önizleme "Kart Borcuna Eklenen …" yazar.
- **Kılavuz:** Kısa "+ Kart Faizi" adımı eklendi; PDF yeniden üretildi ve `pdf-denetle` geçti.
- **Defter türetmesi DEĞİŞMEDİ.** Banka fişi satırları saklanır, defter aynen alır. Bu yüzden kural sürümü değişmedi ve kilitli dönemde kural farkı doğmaz.

## Commit'ler
- 58d9d434 — tasarım notu `docs/erp/C7A-BANKA-TASARIM.md` (koddan önce)
- cc02ec13 — sunucu (`server/lib/bank/vouchers.mjs`), `test/kart-faizi-250.test.mjs`, `test/c7a-banka-250-mutasyon.mjs`
- 87c7dd12 — ekran (`client/assets/hof-bank.js`), `test/e2e/senaryo-kart-faizi-250.mjs`, kılavuz HTML + `client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf`
- cdc4c89a — tasarım notu: yeniden üretim sayıları ve sonuç
- d98a39c6 — kanıt, `docs/kanit/2026-11-14/c7a-*`

## Her kuralın bugünkü kodda yeniden üretimi (taban, gerçek program, iki saat diliminde aynı)
| Kural | Senaryo | Bugünkü madde | Kitabın maddesi |
|---|---|---|---|
| KG-6 | s08 | 10.08 B 108.01 1.000 / A 120; komisyon valör günü gün fişinde: 12.08 B 102.01 975 · B 653 25 / A 108.01 1.000 | komisyon çekim günü |
| KG-19 | s12 | 27.02 valörlü transfer B 102.02 500 / A 102.01 işlem gününde; `value_date` (02.03) yalnız bilgi, 108.90 yok | çıkışta 108.90, valörde alıcı hesap |
| K-15 | s37 | 15.01 açılıştan önce kart ödemesi B 320 / A 108.00 200 | A 519 |
| K-14 | s11 | 20.12.2025 hesapsız havale B 102.00 70 / A 120 | B 519 |
| D-07 | s13 | kart_faiz → 400 (uygulanamadı) | B 780 / A 309 |

## Kabul koşulları
- **A — defter kâhini:** 187/187 önce, 187/187 sonra. Not: ana oturum "iki saat diliminde 187/187" demişti; bu koşu tek çıktıda 187 denetim raporladı.
- **B — cari kâhini:** 17.136/17.136 önce ve sonra. Yapım aşaması listesi kendi kopyamda yeniden üretildi, `cmp` ile AYNI (boş).
- **C — muhasebe sürücüsü (226 koşu):**
  - 218 koşuda program çıktısı bayt bayt aynı.
  - Farklı 8 koşu (rastgele-1/2/3 ve s13, iki saat dilimi): kart_faiz olayları artık uygulanıyor.
  - Sınıflar önce = sonra: AYNI 6.528, U 1.022, SINIFLANMADI 376.
  - P 54 → 18: P3-KART-FAIZI-YOLU-YOK'un 36 farkı kalktı. Yeni fark yok.
  - Ç7a-KG6 (3 senaryo / 8 denetim), Ç7a-KG19 (1 / 4), Ç7a-K14-K15 (2 / 12) aynen bekliyor.
  - Sürücü tabanda da kırmızı (çıkış 1). SINIFLANMADI'lar Ç5 sonrası eskiyen BUGÜN görünümünden geliyor; bu turla ilgisiz.
  - Arşiv kopyasında git olmadığı için 23 senaryonun "önce"si koşulamadı. Bunlar ajan ağacının sürücüsüyle `--program <taban kopyası>` verilerek ayrıca koşuldu.
- **D — eski sürüm kilitli verisi:** D-07 için gerekmedi (türetme değişmiyor). KG-6 / KG-19 / K-14 kodlanmadığından üretilmedi.
- **E — hız:** ÖLÇÜLEMEDİ. Ölçüm kilidi iki denemede de doluydu (başka oturum); bekleme döngüsü kurulmadı. Düzenek hazır: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7a-k4/olcum/hiz.sh` (`kilitsiz` / `kilitli`). Değişen tek yol, fiş yazımında hesap türünün sabit bir kümede aranması.
- **F — rastgele sıra:** `test/mutabakat` 400 işlem × 2 tohum, her 20 işlemde doğrulama: taban 2/2, yeni 2/2.
- **G — ekran:**
  - Yeni senaryo 23/23 (UTC ve Europe/Istanbul); tabanda 3 geçti / 5 kaldı ("+ Kart Faizi" yok).
  - Dokunulan senaryolar: senaryo-banka-210 428/428, -temel 80/80, 210b 90/90, gg243-banka-kart-aciklama 11/11, senaryo-211 59/59, banka-210-planli-yaris 19/19, banka-210-kart-onbellek-yaris 49/49.
  - Ekran görüntülerine bakıldı (form ve pasif kart).

## Testler
- **Yeni test** (`test/kart-faizi-250.test.mjs`): yeni kodda 3/3, iki saat diliminde. Tabanda 0/3; neden iletide okundu: "400 … faiz gideri Vadesiz, Ticari ya da Diğer TL hesaptan girilir" ve planlı kart faizinin nedeni yok.
- **Mutasyon:** 5/5 yakalandı.
  - Kartta kabulü geri al.
  - Kart faizinin para satırı 309 yerine 102 → kapı 409 `ledger-integrity` (102.00 sapması) ile reddediyor.
  - BSMV satırı düşer.
  - Planlı kart faizi kabul edilir.
  - Faiz hesabı 780 yerine 770.
- **Komşular** (25 dosya, taramayla): 305/305, iki saat diliminde.
- Değişen mevcut beklenti yok. Görev metnindeki örnek mutantların (komisyonu valöre geri al, 108.90'ı atla vb.) çoğu kodlanmayan kurallara ait.

## İş günü takvimi ↔ S21 / S27
- Varsayılanla ikisi de uyumlu: resmî tatilde sonraki iş gününe kayar (S21), arife yarım gün iş günü, dinî bayram tam gün tatil (S27).
- Risk: Banka Ayarları'nda "Yarım Gün (Arife): İş Günü Sayılmaz" seçilirse S27'den sapılır (B3).
- Dinî bayram tarihleri yalnız takvim dosyasındaki 2024–2031 tablosundan; hafızadan tarih eklenmedi.

## BAŞ MİMAR KARARI GEREKİYOR
- **B1 — dosya sınırı (KG-19, KG-6, K-14 / K-15'in ön koşulu).** Defter `journal(rows())` ile türetiliyor ve `rows()` şu alanları vermiyor:
  - banka satırlarında `e.value_date`, `e.type`, `e.bank_ref`, `l.ref`;
  - `refs()`'te hesap açılış tarihi ve Devir Kapanışı sınırı;
  - POS satış / komisyon kalemleri (`pos_items`).

  Öneri A: `rows()`'a yalnız okuma yapan bu üç ek, POS için satış başına toplu SQL (ders 47). Yazım anında farklı satır saklamak çözüm değil: eski ve kilitli veri yeniden türetilmez, kural farkı görünmez, eski satırları düzeltmek de göç ister.
- **B2 — kural sürümü etiketi.** Görev metni "yeni kural kimliği" diyor; general-ledger B15 notu "Ç7a aynı etiketi genişletir" diyor. Öneri: "2.5.0-defter" kalsın.
- **B3 — arife ayarı.** "Yarım Gün" ayarı S27'den sapmaya izin veriyor. Öneri: ayar kalsın, varsayılan S27.
- **B4 — kartta Masraf.** Kart yıllık ücreti (770) bu turda açılmadı; istenirse ayrı küçük iş.

## KULLANICIYA SORULMALI (tasarım notu §10; seçenekler ve öneriler orada)
- **S-a (KG-19):** Program bugün alıcı hesabın bakiyesini işlem gününde artırıyor; defter valörde yazarsa iki gün arasında banka ekranı ile defter farklı görünür. Banka modülü de valörle mi çalışsın?
- **S-b (KG-19):** Valörden önce Ters Kaydet girilirse 108.90 hangi gün kapanır?
- **S-c (KG-6):** Komisyon oranı / vergi kipi sonradan değişirse ya da valörde gerçek net farklı gelirse fark hangi güne yazılır?
- **S-d (KG-6):** Ödeme kuruluşu (KDV kipi) kesintisi de satış gününe alınsın mı?
- **S-e (K-14):** Hesapsız satırda "açılıştan önce" nasıl tanımlansın? Ayrıca Devir Kapanışı ve Bankaya Geçmiş Say ile ilişkisi.

İş listesinde KG-6 için yalnız 05.11 (5) kararı var; öbürleri için karar bulunamadı.

## Kapsam dışı bulgular
- Muhasebe sürücüsünün BUGÜN görünümü Ç5'ten beri eski kaldı; sürücü tabanda da kırmızı.
- Kart seçiliyken formdaki alan adı hâlâ "Banka Hesabı" (DÜŞÜK, görünüm).

## Doğrulanmadı / denenmeyen / koşulmadı
- Hız ölçülemedi.
- Yaygın programların valörlü transfer ve POS komisyonu düzeni: belgesi okunmadı.
- Yalnız D-07 için ayrı Windows koşusu gerekmiyor (dosya işlemi yok).

## Ana oturumun yapacakları
- **CI listesine eklenecek:** `test/e2e/senaryo-kart-faizi-250.mjs` (23 denetim).
- **Yeniden koşu komutları** (önünde `HUKUK_LICENSE_URL=http://127.0.0.1:9`):
  - `node --test test/kart-faizi-250.test.mjs` → 3/3, iki saat diliminde
  - `node test/c7a-banka-250-mutasyon.mjs --kopya <HEAD'in arşiv kopyası>` → 5/5
  - e2e (`PLAYWRIGHT_BROWSERS_PATH` ile) → TAMAM 23
  - `npm run test:kahin-defter` → 187; `npm run test:kahin-cari` → 17.136
- **Ekran yürüyüşü:** Banka → Hesaplar → kredi kartı → "+ Kart Faizi" → Faiz Tutarı 200, Tab, BSMV / KKDF 10 → önizleme "Kart Borcuna Eklenen ₺210,00" → Kaydet → kart borcu +210, banka değişmez → Mizan'da 780 / 309 → Mutabakat Testi temiz. POS / valör / transfer / açılıştan önceki hareket adımları B1 kararından sonra.

## Not defteri klasörleri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7a-k4` — betikler, sürücü çıktıları (`surucu-taban-tam`, `surucu-yeni`), ölçüm düzeneği `olcum/`. Kod kopyaları silindi.
