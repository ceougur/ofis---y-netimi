# Ç7b aday düzeltme turu (YB-1) — ajan raporu (AYNEN; ajan aa660861cba7cd284)

## Ç7b aday düzeltme turu (YB-1): Kartı Kapat artık tek soruyla kapanıyor

**Ne değişti (önce → sonra), en küçük örnekle:** Kart 3.000 TL, 3 taksit, ilk vade 08.09. Cari kartından (Taksit Tahsilatı değil) 500 TL tahsilat girildi. Kart penceresi "Kalan ₺2.500,00" gösteriyor.
- **Önce:** `PUT … {closeRemaining: 2500}` 409 dönüyordu: "güncel kalan 3.000,00 TL". Pencere "Kalan ₺3.000,00" diye ikinci kez soruyordu.
- **Sonra:** Tek istekte 200 dönüyor, kart kapanıyor. Carinin borcu 2.500 kalıyor, Mizan 120 değişmiyor (Borçta Kalsın).
- YB-1'in asıl amacı aynen duruyor: onaydan sonra tahsilat silinir, eklenir ya da tutar değişirse yine 409 geliyor. 409'un "güncel kalan"ı da artık pencerenin göstereceği sayı.
- Kartı Kapat'ın defter ve cari etkisi değişmedi; S118 = B ve Borçta Kalsın kuralları da aynen.
- İstemci (`hof-plans.js`) değişmedi.

**Değişen dosyalar:**
- `server/routes/plans.mjs`: yalnız YB-1 denetimi ve onun okuması.
- `test/c7bfix-kart-kapat-kuyruk-250.test.mjs` (yeni).
- `test/e2e/senaryo-c7b-tur3-250.mjs` (E adımı eklendi).
- `test/e2e/senaryo-c7b-kabul-250.mjs` (E adımı yeniden yazıldı).
- `test/tyk-birlesik8-ekranlar-250.test.mjs`: BEKLENTİ BİLEREK DEĞİŞTİ, aşağıda.

**Kök neden (ana oturumun okuması doğru, yeniden ürettim):**
- Denetim `detail()` → `shape()` okuyordu, bu da yalnız kartın kendi hesabı (allocate).
- `queueFor` işlem içinde null döndüğü için kuyruk hiç kurulmuyordu.
- `invoices.obligationsOf` işlem içinde önbelleğe dokunmadan kuyruğu kurabiliyor; bunu kodda doğruladım.

**Çözüm ve seçim gerekçesi:**
- `queueBuild` eklendi: `queueFor`'un işlem denetimi olmayan gövdesi. `queueFor` / `queueOf`'un işlem içindeki davranışı değişmedi.
- `shownRemaining(plan, user)` eklendi: `shape` + `withQueue` ile `detailView`'ın kuralının aynısı.
- Karşılaştırma işlemin içinde kalıyor (BEGIN IMMEDIATE). Böylece denetimle yazım arasına başka bir süreç dahil hiçbir yazım giremez.
- İşlem dışı seçenek (araya await girmeden) de mümkündü ama başka süreç yazımına karşı korumasız. Maliyeti aynı; hız D'de ölçüldü.

**İkinci bulgu (senaryo-c7b-kabul-250 E):**
- Neden bir yarış: kart penceresi "live:workspace.changed" olayıyla kendini yeniliyor (v2.0.22'den beri).
- `git diff 473e4a96 fce3d272 -- client/assets/hof-plans.js` içinde yenileme koduna dokunan satır yok. Yani ürün davranışı değişmedi; tur 2f'de tıklama canlı olaydan önce geldiği için ön koşul oluşmuştu.
- Düzeltme (ders 20):
  - **E0:** Pencere açıkken 100 TL tahsilat girilir; pencerenin kendini yenilediği (Kalan ₺800,00) doğrulanır.
  - **E:** 300 TL tahsilat soru ekrandayken girilir (veri tabanından okunur). 409 ağdan okunur, yanıt dizisi [409, 200].

**Tarama — AYNI AİLE: YOK.**
- Tahsilat sınırları (plans ≈1134–1146) kartın kendi kalanını okuyor; bunu S118 = B açıkça istiyor.
- Öbür `*-stale` kodları satır sürümü ya da parmak izi karşılaştırıyor, tutar değil.
- `accounts.mjs` 262 / 321 görünüm; işlem içinde bir karşılaştırma yok.
- Kartı Kapat'ın tek istemci yolu `closePlan`. Tablo taslak §2'de.

**Testler (yeni test K1–K9 + mevcut YB-1 testi, toplam 12):**
- Taban (fce3d272): UTC 4/12, İstanbul 4/12. Kırmızıların hepsi beklenen nedenle (ders 38):
  - K1 "güncel kalan 3.000,00", K2 "2.000,00", K5 "600,00", K6a "3.000,00", K7 "3.000,00", K8 "1.000,00".
  - K3: güncel kalan 3.000 ≠ pencere 2.500. K4: 3.600 ≠ 3.100.
- Yeni kod: UTC 12/12, İstanbul 12/12. `test/c7b-kart-kapat-onay-250.test.mjs` değişmedi, yeşil.
- **Ekran, senaryo-c7b-tur3-250:**
  - Yeni kod 39/0.
  - Taban kodda 36/3, beklenen nedenle: "ikinci soru … Kalan ₺3.000,00", istekler [409].
  - Görüntülere baktım: `docs/kanit/2026-11-20/c7bfix-ekran/tur3-{yeni,eski}/08–10`.
- **Ekran, diğer senaryolar:**
  - senaryo-c7b-kabul-250: yeni kodda 39/0, taban kodda 39/0 (bu adım YB-1'in kendisini sınıyor; cari tahsilatı yok, bu yüzden tabanda da yeşil).
  - senaryo-c7bt-ayni-ad-250: 21/0.
  - senaryo-kdv-donemi-250: 22/0.
  - Ana e2e (`run.mjs`): 50/50.

**Kabul A–F:**
- **A — kâhin:** `test:kahin-defter` 187/187 (0 fark, 0 yakalanmayan mutasyon). `test:kahin-cari` 17.648/17.648 (0 fark). Taban ve son, iki TZ'de aynı; yapım aşaması listesi 0.
- **B — muhasebe sürücüsü:** Taban ve son aynı: 7.756/7.926, 28 başarısız, 142 atlanan.
  - Sınıf dökümü iki tarafta birebir; surucu5'in kendi son koşusu da 28.
  - `gerileme.py` 248/248 birebir. Fark beklenmiyordu: sürücü `closeRemaining` göndermiyor.
- **C + F — komşular:** Kartı Kapat / plans uçları / c7b* / c7bt* / tyk* testleri, 153 dosya, iki TZ.
  - UTC: 900/900 + 1.130/1.131. İstanbul aynı.
  - Tek kırmızı `tyk-birlesik8-ekranlar-250:237`, beklenen nedenle: yeni bir `shape(` çağıranı (`shownRemaining`).
  - Ders 28 gereği beklenti değişti (commit 72fac9ac): `shownRemaining` listeye eklendi ve `withQueue` okuduğu denetleniyor. Yeniden koşu iki TZ'de 12/12.
- **D — hız:** Temiz 100 bin verinin kendi kopyamda, eski ↔ yeni dönüşümlü 3+3 blok × 5 tekrar, özel kilitle, 0 geçersiz.

  | Yol | Kilitsiz (ortanca / en iyi) | Kilitli 2026-06-30 (ortanca / en iyi) |
  |---|---|---|
  | Kartı Kapat `closeRemaining` | 1,04 / 1,06 | 1,01 / 1,03 |
  | İLK Kartı Kapat | 1,02 / 1,02 | 1,09 / 1,09 |
  | Kart GET, Yeniden Aç, eski istemci | 0,95–1,05 (kilitsizde kart GET ortancası 1,23 = 2 ↔ 3 ms; en iyi 0,95) | 0,95–1,05 |

  KÖTÜ (ortanca VE en iyi %10'dan kötü): 0.
- **E — değişmezler:** Aynı istek dizisi eski ve yeni kodda koşuldu, iki TZ'de hepsi aynı. Dizi: eski istemci, cari tahsilatı, kart tahsilatı, Yeniden Aç → Kapat, Mevcut Borç.
  - Karşılaştırılanlar: `plans` (status / closed_at / close_rule), `plan_entries`, `account_entries`, cari kartları, Mizan.
  - Mutabakat Testi temiz; Defter Mutabakatı "Tüm hesaplar tutarlı".
- **Mutantlar (UTC):** dördü de yakalandı.

  | Mutant | Kırmızı | Yakalayan |
  |---|---|---|
  | m1 denetimi kaldır | 6/12 | K3/K4/K5b/K8 + mevcut iki sınama |
  | m2 karşılaştırma kartın kendi hesabıyla | 8/12 | K1–K8 |
  | m3 409'da güncel kalanı kendi hesabından söyle | 4/12 | K3/K4/K5b/K8 |
  | m4 kalansız kartı denetim dışı bırak | 3/12 | K5b, K8, mevcut "kalansız kart" |

**KULLANICIYA SORULMALI (aday — siz karar verin; görünen tutar, ders 43 ailesi; bakiye her seçenekte aynı):**
- **Durum (K8 gözlemi):** Aynı caride iki kart var, karta bağlanmadan girilen 1.200 TL tahsilat kuyrukta vade sırasıyla dağılıyor.
  - Kart A 1.000 TL (3 taksit, 08.09–08.11), kart B 1.000 TL (ilk vade 08.01.2027).
  - Geç vadeli B "Borçta Kalsın" ile kapanınca kalanı kapanışın ertesi günü vadeli oluyor (S205 = A / S220 = A) ve A'nın 3. taksitinden öne geçiyor.
  - Sonuç: A'nın penceresi "Kalan 0 · Tamamlandı"dan "Kalan 333,34"e dönüyor. Bakiye 800, iki durumda da aynı.
  - YB-1 burada doğru çalışıyor: A'nın eski "kalan 0" onayı 409 alıyor.
- **Seçenekler:**
  - **A (öneri):** Bugünkü gibi kalsın (S50 / S129 / S205'in sonucu).
  - **B:** Borçta Kalsın kalanı kuyrukta kendi vadesini korusun.
  - **C:** Uç durum böyle kalsın (BİLİNEN SINIR).
- İş listesinde aradım; bu duruma karar yok. Yaygın programlarda nasıl olduğuna dair doğrulanmış kaynak okumadım.

**BAŞ MİMAR KARARI GEREKİYOR:** Yok.

**SONRAKİ SÜRÜME (2.5.1):**
- K6b gözlemi: taksitsiz Mevcut Borç kartında cari tahsilatı alttaki borç kalemine gidiyor. Pencere 3.000, carinin borcu 2.500. Bu, S129 kapanış notuyla tutarlı; Kartı Kapat tek soruyla kapanıyor.
- "Pencere açıkken başka oturum yazar" kurgusu olan öbür ekran senaryoları da aynı yarışa açık olabilir; taramadım.

**DOĞRULANMADI:** Yok.

**DENENMEYEN:**
- Ayrı sınama yazılmadı (`shownRemaining` `detailView`'ın `withQueue`'sunun aynısı; yer tablosu testi bunu denetliyor):
  - şüpheli kuyruğundaki kısmı (held) olan kart,
  - kilitli gün (kapatma reddi YB-1'den önce geliyor, sıra değişmedi),
  - carisiz eski kart,
  - eski kuralla kapanmış (frozen) kartın Yeniden Aç → Kapat'ı.
- İki kişinin aynı anda Kartı Kapat yapması zorlanmadı; denetim ve yazım tek işlemde.
- Mutantlar yalnız UTC'de, hız yalnız İstanbul TZ'de koşuldu. Windows CI'ye kalıyor.
- senaryo-226 ve uiux-a-243 koşulmadı.

**Commit listesi:**
- **Kod / test:**
  - db290c39: kod + yeni test
  - 317e507e: iki ekran senaryosu
  - 72fac9ac: yer tablosu testi
- **Kanıt:** 43679a95 (nasıl bozulur), 552d4777, 849a7c4c, 93943258, e8ebce77, 7b6d8640, 4e17704a, e2f5b170, 2a716d22, 88e53599, a9a01e0f.
- **Dal ucu:** `worktree-agent-aa660861cba7cd284` = a9a01e0f. Push yok.
- Worktree'de commit edilmemiş, bu turun kapsamı dışındaki ekran görüntüleri izlenmeyen dosya olarak kaldı (`docs/kanit/2026-11-20/c7bfix-ekran/*/01–07`, kabul-yeni 01–05 ve 07). Bir de `node_modules` bağı var. /dev/shm'deki kendi kopyalarımı zorlamadan kaldırdım.

**Ana oturumun yeniden koşacağı komutlar (worktree kökünde):**
- Yeni test, iki TZ:
  ```
  TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/c7bfix-kart-kapat-kuyruk-250.test.mjs test/c7b-kart-kapat-onay-250.test.mjs
  ```
  Aynısını `TZ=Europe/Istanbul` ile. Beklenen 12/12. Taban kopyada (`git worktree add --detach <ayrı yol> surucu5-uc`, yalnız yeni test dosyası kopyalanır) beklenen 4/12; nedenler yukarıda.
- Ekran, yeni kod: `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-1194 node test/e2e/senaryo-c7b-tur3-250.mjs` → 39/0.
- Ekran, taban kod: `DEPO=<taban kopya>` ile aynı komut → 36/3.
- Kabul senaryosu: `node test/e2e/senaryo-c7b-kabul-250.mjs` → 39/0.
- Yer tablosu: `node --test test/tyk-birlesik8-ekranlar-250.test.mjs` → 12/12.
- Hız ve değişmez betikleri: `docs/kanit/2026-11-20/c7bfix-hiz/hiz.sh` (kopyalar `/dev/shm/c7bfix-a66/{eski,yeni}` git worktree olarak yeniden kurulmalı), `docs/kanit/2026-11-20/c7bfix-degismez/degismez.mjs <kök> <own|shown> <çıktı>`.

Rapor taslağı: `/home/user/ofis---y-netimi/.claude/worktrees/agent-aa660861cba7cd284/docs/kanit/2026-11-20/c7bfix-rapor-taslak.md`

