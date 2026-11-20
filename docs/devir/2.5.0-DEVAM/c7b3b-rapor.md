## Ç7b tur 3b raporu: Kartı Kapat "Borçta Kalsın" (karar (6), KG-23, S205; B-11 = A)

Tur bitti. Bütün işler commit edildi, push yapılmadı.
- Dal: `worktree-agent-a7251f6b5e9ebfc97`, uç commit **15f023f1**, taban c7b3b-taban = b3a59f2a.
- Hız ölçümünde kötüleşen yol yok (kilitsiz ve kilitli). Ekran yürüyüşü sorunsuz.
- Açık noktalar:
  - Muhasebe sürücüsünde 22 yeni SINIFLANMADI satırı çıktı. Hepsi sürücünün kendi eşlemesinden geliyor; programdan gelen fark değil, ama sürücü bakımı gerekiyor (aşağıda C).
  - WhatsApp hatırlatması kapalı kartın kalanını hâlâ göndermiyor (dosya sınırı; BAŞ MİMAR KARARI GEREKİYOR bölümünde).

### Değişen davranışlar (önce → sonra)
Örnek: Yeni Borç kartı 900 TL (3 × 300; vadeler 05.10 / 05.11 / 05.12), 05.10'da 300 tahsilat, 08.10'da Kartı Kapat.

| Nerede | Önce | Sonra |
|---|---|---|
| Cari bakiyesi | 0 | **600** |
| Cari ekstresi | "Kart kapatıldı · kalan düşüldü" satırı (600) | satır yok |
| Mizan | 120: 0, 689: 600 | 120: 600, 689: madde yok (KG-23) |
| Gecikmiş Borç | 0 | 08.10'da 0, **09.10'dan itibaren 600** (S205) |
| Kart penceresi | kalan taksitler "Kapalı" | kalan taksitlerin vadesi 08.10; ertesi gün "Gecikti"; kartın durumu "Kapalı" kalır |
| Zil, şerit, Vade Takip, nakit akışı | kalan görünmüyordu | kalan görünüyor (zilde "1 gün gecikti" × 2) |
| Taksitler sekmesi rozeti | sıfırlanıyor | yine sıfırlanıyor (kapalı kart Geciken sayılmaz) |

Diğer değişiklikler:
- **Onay penceresi metni:** "Kalan ₺600,00 açıkken … kapatılsın mı? Ödeme planı biter; kalan borç carinin borcunda kalır, yarından itibaren gecikmiş sayılır. Vazgeçmek için cari kartında Alacak Yaz kullanın." Carisiz kartta: "kalan tutar kartta açık kalır". Düğme ipucu ve bildirim metni de buna göre değişti.
- **Önceden kapatılmış kartlar:** göç 53 bunları `'2.4.9'` diye işaretliyor; bakiye, ekstre ve 689 aynen kalıyor. Kilitli günde kapanmış eski kartta Yeniden Aç / tahsilat / silme eskisi gibi 409 alıyor.
- **Borçta Kalsın kartı kilitli günde kapanmışsa** Yeniden Aç, tahsilat ve silme serbest; kapanışı defter olayı değil.
- **Yeniden Aç → yeniden Kapat** her zaman yeni kuralla yapılıyor (işaret sıfırlanıyor).
- **Kapatılmış Mevcut Borç kartı** borcu taşımaya devam ediyor. Aynı borç ikinci bir kartla taksitlendirilemiyor; önce kart Yeniden Aç ile açılmalı.
- **Şüpheli alacaklı caride Kartı Kapat:** 128 artık 900 olarak kalıyor (önce 689 ile sıfırlanıyordu).

### Değişen dosyalar
**Tek yardımcı:** `server/lib/accounts.mjs` — `waivesRemaining`, `waivedOf`, `waivesSql`, `closeDaySql`, `keptDueOf`, `keptDueSql`.

**Okuyucular:**
- `server/lib/account-lines.mjs`, `server/lib/general-ledger.mjs`
- `server/routes/ledger.mjs` (`rows`, 127 beklenen, `partyTotals`)
- `server/routes/accounts.mjs` (`planCredit`, `lockedSince`)
- `server/lib/integrity.mjs` (`plans_close_lock` yalnız eski kural, yeni `plans_close_rule_lock`, carisiz kart kontrolü)
- `server/lib/integrity-scope.mjs`, `server/lib/bank/doubtful.mjs`
- `server/lib/obligation-input.mjs` (üç takvim sorgusu `keptDueSql` ile)
- `server/routes/plans.mjs`: işaretin yazımı, `closeDayOf`, `withQueue`, `shownTotalsOf`, `queueExtras`, `dueItems`, `openItems`, özetlere `closeRule`, `uncoveredDebt`
- `server/routes/plan-transfer.mjs`: tek satır, `uncoveredDebt` ile aynı kural

**Göç:** `server/lib/migrations.mjs` (göç 53; sütun `plans.close_rule TEXT NOT NULL DEFAULT ''`).

**Arayüz ve belgeler:** `client/assets/hof-plans.js`, kılavuz HTML ve PDF, tasarım notu §17.

`obligation-queue.mjs` değişmedi.

### Testler
**Yeni testler (iki saat diliminde yeşil, eski kodda beklenen nedenle kırmızı):**
- `test/c7b-tur3b-borcta-kalsin-250.test.mjs`: 6/6.
  - Eski kodda 0/6: T1 "bakiye 600 kalır" 0 ≠ 600; T2 900 ≠ 0; T3 0 ≠ 500.
  - T4 eski kodda 409 "kalan alacaktan vazgeçildi"; T5 "göç koştu" (göç 53 yok); T6 128/689 ters.
- `test/c7b-tur3b-eski-surum-250.test.mjs` (v2.4.9'un gerçek koduyla, etiketli kopyada koşuldu): 3/3.
  - Eski kodda (2) göç işareti yok; (3) b2 0 ≠ 900.
  - Bakiye / 689 / donmuş madde kısmı eski kodda da yeşil; değişmeyen davranış bu.

**Beklentisi bilerek değiştirilen testler** (her birinde "BEKLENTİ BİLEREK DEĞİŞTİ (karar (6))" notu var):
- `accounts-stock` (yeni bir sınama da eklendi), `bulgu-223` (bakiye 12.720 → 18.720), `plans.test` (zil kalır), `mutabakat/motor.mjs`.
- `donmus-defter-250`, `donmus-defter-yasam-250` ve `kural-farki-kapi-disi-250`: göç sayısı 52 → 53.
- `obligation-input-250`: yeni boş `closeRule` alanı özetten çıkarıldı.
- Eski kuralın kilitlerini anlatan sınamalar göç işaretiyle eski kurala alındı: `inceleme-226`, `inceleme-226-2`, `banka-210-kapi-kapsam`, `birlesik-tur2-yaris`, `kapali-kart-ekstre-tarihi`, `defter-kaynak-iz`.
- E2E: `e2e/run.mjs` (kalan şeritte kalır), `e2e/senaryo-226` (G1 eski kurallı kartla).

### Kabul koşulları
- **A (kâhin-defter):** önce 187/187 ve 187/187 (iki saat dilimi); sonra aynı. Fark yok.
- **B (kâhin-cari):** önce 17.579/17.582, sonra 17.580/17.582 (iki saat dilimi).
  - Kalan iki BULGU tabanda da vardı (d50-c5-s206 KI2 / KI3 toplam; Ç7b tur 3'ün S210 / S211'i, kâhin bakımı bekliyor). Yeni fark yok.
  - Yapım listesi kendi yolumda yeniden üretildi: aynı 2 kayıt, paket "AYRIŞTIRILMADI", elle etiketlemedim. Depodaki liste değişmedi.
  - Not: cari kâhininde Kartı Kapat olayı yok gibi görünüyor.
- **C (muhasebe sürücüsü):** önce 7.580 geçti / 36 başarısız; sonra 7.568 / 58 (140 atlanan ikisinde de).
  - Sınıflamada "Ç7b-(6)" kimlikli kural zaten yoktu.
  - Özetteki "Ç7b-(6)" bekleyeni kalktı (2 senaryo / 12 denetim → 0). Kalkan fark 0.
  - 22 yeni SINIFLANMADI satırının hepsi s40 ve s60'ta:
    - (a) Adım farkları (s40 adım 18, s60 adım 5 ve 6): sürücünün güncel-program modelinde C7b6-KAPAT hâlâ 2.4.9 kuralında; program artık 689 yazmıyor.
    - (b) s60'ın rapor farkları: kâhinin `eski: true` olarak işaretlediği TK2'yi `program.mjs` güncel Kartı Kapat'a eşliyor. Program Borçta Kalsın uyguluyor, kâhin 689 bekliyor. Programın eski kart davranışını D testi v2.4.9'un gerçek koduyla doğruluyor.
  - Sürücüye dokunmadım. Bakım: `eski` için göç işaretini (`'2.4.9'`) koymak ve C7b6-KAPAT değişimini kaldırmak.
- **D (eski sürüm verisi):** yukarıdaki yeni D testi geçiyor. Donmuş defterdeki plan-close maddesi güncel türetmeyle aynı; kural farkına girmiyor. Mevcut `c7b-tur3-eski-surum-250` testi de yeşil.
- **E (hız):** temiz 100 bin satırlık veri, özel kilit, yük 2'nin altında, her kipte 4 blok. Kilitsiz ve kilitli kiplerde 18'er yol ölçüldü; kötüleşen 0, geçersiz blok 0.
  - Örnekler (ortanca ms, taban → yeni):

    | Yol | Kilitsiz | Kilitli |
    |---|---|---|
    | Kartı Kapat (yazım) | 1081 → 1128 | 1042 → 1060 |
    | cari kartı | 162 → 158 | — |
    | Defter Mutabakatı | 11461 → 11518 | 18215 → 18231 |
    | Mutabakat Testi | 8563 → 8185 | 14665 → 15334 |
    | zil | 2129 → 2078 | — |
    | Vade Takip | 1736 → 1702 | 1704 → 1858 (oran 1,09) |

  - Ayrıntı `c7b3b-hiz-tablo-*.txt` dosyalarında.
- **F (değişmezler):** rastgele sıra testi (600 işlem × 2 tohum, iki tohumda toplam 18 kart kapatma): eski kod 2/2, yeni kod 2/2. Yeni testlerde ve yürüyüşte her adımdan sonra Mutabakat Testi temiz.
- **G (ekran):** yürüyüş SORUNSUZ (ekran görüntüleri `c7b3b-ekran-*.png`).
  - Gerçek tıklama; onay penceresinde ilk odak Vazgeç'te, Tab ile Kartı Kapat'a gidilip Enter.
  - Ertesi gün sayfa ve sunucu saati ilerletildi: Gecikmiş Borç 600 · 2 kalem, zil, Vade Takip.
  - Alacak Yaz insan hızında yazıldı.
  - E2E senaryoları (İstanbul): `senaryo-c7b-tur3-250`, `uiux-a-243`, `senaryo-c7b-kabul-250`, `senaryo-225-uyari` yeşil; `senaryo-226` 22/22 ve `run.mjs` 50/50 (beklenti düzeltmesinden sonra).
- **G2 (komşu testler):** 111 dosya, desenle tarandı. UTC'de ilk koşu 29 başarısız verdi; düzeltmeden sonra o 14 dosya 228/228. İstanbul'da 1473/1473. Şema kapısı (sema-kapisi-bs7) ve geri yükleme testleri listede, yeşil.

### Mutantlar (iki saat dilimi, 7 test dosyası)
- 14 mutanttan 13'ü yakalandı:
  - M1 yeni kartı eski kuralla düşmek, M2 eski kartı yeni kuralla saymak.
  - Bir okuyucuyu yardımcıdan koparmak: M3a genel defter, M3b cari defteri, M3c `partyTotals`, M3d şüpheli ayırıcısı (T6 sayesinde), M3e Cari Listesi, M3f kapanış kilidi.
  - M4 gecikmeyi kalem vadesinden başlatmak, M5 vadeyi kapanışın ertesi gününe koymak, M7 Yeniden Aç'ta işareti sıfırlamamak, M8 göçte işaretlememek, M9 zilin kapalı kartı almaması.
- Yaşayan 1: M6 (`plans_close_rule_lock` kaldırılıyor). Bu eşdeğer bir mutant: işaret `plans_close_lock`'un üyelik koşulunda da var, değişince iz yine değişiyor (T4). Ek girdi aslında fazla.

### Kılavuz
"Kartı Kapat" maddesi yeniden yazıldı: "kalan borç carinin borcunda kalır ve ertesi günden gecikmiş sayılır (zilde ve Vade Takip'te görünür); alacaktan vazgeçecekseniz cari kartında Alacak Yaz ile ayrıca kaydedin". PDF yeniden üretildi; pdf-denetle 39/39, kılavuz testleri 17/17.

### KULLANICIYA SORULMALI
Kapanıştan önce vadesi geçmiş bir taksitin vadesi ne olsun? Gecikmiş tutar kapanışın ertesi gününden itibaren iki okumada da aynı; değişen yalnız kapanış günündeki gecikmiş ve gecikme yaşı.
- **A (uygulandı, önerim):** vade = kalemin kendi vadesi ile kapanış gününün erken olanı. Önceden gecikmiş kalem kendi vadesinde kalır; kapanış günü gecikmiş 0'a inmez, yaş küçülmez.
- **B:** görev metnindeki "kalemin kendi vadesine bakılmaz" ifadesinin harfi. Bütün kalemler kapanış gününe çekilir; kapanış günü gecikmiş 0 olur, ertesi günden yine tamamı.
- **C:** Uç durum böyle kalsın (BİLİNEN SINIR).
- Gerekçe: S205 sorusu (SK-39) yalnız vadesi gelmemiş kalemi soruyordu. B'yi seçmek yalnız tek satırlık bir değişiklik ister (`keptDueSql` / `keptDueOf`).
- Yaygın programlarda nasıl yapıldığına dair doğrulanmış bir kaynak okumadım.

### BAŞ MİMAR KARARI GEREKİYOR
- **WhatsApp Ödeme Hatırlatması:** `lib/whatsapp/queue.mjs` (`overdueOf`) eski anlamlı `totals.overdue` alanını ve yalnız açık kartları okuyor; yazmam yasaktı. Bu yüzden Borçta Kalsın kartının gecikmişi WhatsApp hatırlatmasına girmiyor. Zil, şerit ve Vade Takip'e giriyor. Öneri: Ç5-C'de (WhatsApp'ın kuyruğun gecikmişine geçişi) kapanır.
- **Sürücü bakımı:** C'deki (a) ve (b) maddeleri.

### SONRAKİ SÜRÜME (2.5.1)
- `plans_close_rule_lock` fazlalık (M6); sadeleştirilebilir.
- `lib/accounts.mjs`'teki `closeDayOfPlan` ve `keepsRemaining` dışa açılmış ama kullanılmıyor.
- Görünüm ayrıntıları (sayılar doğru):
  - Kapalı Borçta Kalsın kartında cari kartının "Taksitten Kalan" göstergesi 0 (kalan Bakiye ve Gecikmiş Borç'ta görünüyor).
  - Kart başlığındaki "Taksit planı … – 08.10.2026" aralığı kaydırılmış vadeyi gösteriyor.
  - Kapalı karttaki taksit satırlarında ✎ / × düğmeleri görünüyor; bu eskiden de öyleydi.
- Cari kâhininde Kartı Kapat olayı yok; kapsam boşluğu.

### DOĞRULANMADI
Doubtful durumundan şüpheli kaydının kalan tutarını T6'da okuyamadım (assertion koşullu kaldı). Dişi 128 defter kontrolü ve Mutabakat Testi üzerinden; M3d yakalandı.

### DENENMEYEN
- Tam `npm test` koşulmadı (görev metni gereği).
- CI ve Windows koşulmadı.
- İki şirket (bu tur için ayrıca denenmedi; eski komşu testlerde var) ve eski sürüme geri dönüş denenmedi. v2.4.9 programı işareti bilmediği için Borçta Kalsın kartının kalanını düşer; bilinen sınır.
- Taksitli faturanın kendi kartı ve Mevcut Borç kartı Borçta Kalsın ile kapatıldıktan sonra fatura Düzenle'nin karta etkisi denenmedi.
- Kapalı Mevcut Borç kartının alttaki faturası iade edildiğinde kuyruğun kapasite davranışı denenmedi.

### CI listesine eklenecek
Yok; yeni ekran senaryosu yazılmadı. Yeni testler `test/*.test.mjs` altında.

### Commit listesi (taban → uç)
1. 672ce2d6 Tasarım
2. 7b38384e Kod + yeni test
3. f6e365d8 Kılavuz
4. 9d656d50 D testi
5. f2eea210 Komşu testler
6. d3174e4c Kanıt
7. a5b4f6ad T6 testi
8. ae4da429 Kanıt
9. 6dfb72f0 E2E testler
10. 9be1b620 Kanıt
11. 1c5074b8 Kanıt
12. 15f023f1 Kanıt

Kanıtlar `docs/kanit/2026-11-20/c7b3b-*` altında; rapor taslağı `docs/kanit/2026-11-20/c7b3b-rapor-taslak.md`. Geçici kopyalar silindi; disk boşluğu 7,5 GB.

### Ana oturumun yeniden koşacağı komutlar
Hepsi `HUKUK_LICENSE_URL=http://127.0.0.1:9`, TZ önce UTC sonra Europe/Istanbul.
- `node --test test/c7b-tur3b-borcta-kalsin-250.test.mjs test/c7b-tur3b-eski-surum-250.test.mjs` (eski kod kırmızısı için: `git worktree add --detach <yol> c7b3b-taban` ve yalnız bu iki test dosyası kopyalanır).
- Komşu liste: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3b-ag/komsu2.txt`, koşucu `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3b-ag/komsu.sh`.
- `npm run test:kahin-defter`, `npm run test:kahin-cari`, `node test/bagimsiz/muhasebe-surucu/kos.mjs --program <kök>`.
- `node test/e2e/run.mjs` ve `node test/e2e/senaryo-226.mjs`.
- Hız: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3b-ag/hiz/hiz.sh kilitsiz|kilitli 5` (eski kodun kopyası `c7b3b-ag/taban` silindi; önce `git archive c7b3b-taban` ile yeniden çıkarılmalı).
- Mutantlar: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3b-ag/mut/kos.sh` (`MUTWT=<git worktree kopyası>`).
- Ekran yürüyüşü: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3b-ag/yuruyus/yuruyus-c7b3b.mjs` (`ROOT=<kod kökü> OUT=<klasör>`).