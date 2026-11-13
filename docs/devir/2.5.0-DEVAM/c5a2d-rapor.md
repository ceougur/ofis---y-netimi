# Ç5-A tur 2d (yalnız test) — kod ajanının raporu (13.11.2026; AYNEN; ajan raporu kanıt değil — ana oturum yeniden koşar; dar kontrole VERİLMEZ)

## Ç5-A tur 2d raporu (yalnız test; `server/` ve `client/` altına yazılmadı, push yapılmadı)

Üç iş de bitti, commit'li ve kanıtlı. YARIM iş yok. Kullanıcıya sorulacak para / defter durumu çıkmadı. Ürün hatası bulunmadı. Bir ajan raporunun bir cümlesi sondayla doğrulanamadı (aşağıda, "Gözlemler" 1. madde).
Ortam: yük 1,54 / 4 çekirdek, boş bellek 9 GB, boş disk 6,7 GB.

Hazırlık: dal `c5a2d-taban`'a (04926fb5) sıfırlandı, `node_modules` bağlandı. Görev metnindeki belgeler ve rapor bölümleri okundu.

### İş 1 — yaşayan sekiz mutant (dar kontrol 1f DÜŞÜK-2)
**Önce:** sekiz mutantın sekizi de yaşıyordu. Var olan 13 test dosyası (151 test; tur 2a–2c'nin yeni testleri dahil) her mutantta 151/151 yeşil kaldı. Tur 2a–2c'nin testleri hiçbirini öldürmüyordu.

**Eklenenler** (`test/kilit-izi-alanlar-250.test.mjs`; var olan beklentilerin hiçbiri değişmedi):
- **Şablona tek kayıt:** kilitten sonra (15.10) peşin bir tedarikçiye iade. Hiçbir cari satırı açmıyor.
- **Kapı dışı yazım listesine üç vaka.** Her biri hem satır içi taramada hem arka plan taramasında, ayrıca program kapalıyken yazılıp açılışta bulunma yolunda sınanıyor:
  - stok kaynaklı cari satırının kaynak kimliği kilit sonrası iadeye çevrilir (600 → 153),
  - evrağa bağlı taksit satırının açılış alanı 0 → 1 (101 → 519),
  - carisiz, kilitli karşılıksız evrağa cari yazılır ve kilit sonrası tarihli karşılıksız borç satırı eklenir.
- **[9]** Kapıdan geçen iki adım: 1. adım kabul (kilitli defter aynı); 2. adım 409 "Kapanmış dönem" (eşdeğerlik ihlali değil).
- **[10]** Kaynaklı kilitli satırda "Normal Cariye İşlendi" işareti 0 → 1: türetme değişmiyor ama tarama sapmayı buluyor.
- **[11]** v2.4.9'un gerçek kodunun kilit izi, güncel kodun 2.4.9 tanımıyla hesaplanan izle aynı veride birebir eşit (göçten önceki v2.4.9 deposu).

| Mutant | Önce | Öldüren test (sayı) | Kırmızının nedeni |
|---|---|---|---|
| Y2 | yaşıyor | stok kaynak kimliği vakası, iki tarama yolu (2) | tarama yalnız `stock:account` buluyor; iz değişmediği için sapma yok |
| Y3 | yaşıyor | [10] (1) | tarama bulgusu boş: `ledger:snapshot bulunmalı: []` |
| Y5 | yaşıyor | karşılıksız borç vakası (2) + [9] (1) | tarama bulgusu boş; [9]'da "2. adım kapı reddetmeli — KABUL EDİLDİ" |
| Y10 | yaşıyor | **EŞDEĞER** (47/47 yeşil) | aşağıya bakın |
| Y11 | yaşıyor | [9] (1) | "2. adım 409 beklenir: 500 Kapı eşdeğerlik ihlali … (period-lock)" |
| Y12 | yaşıyor | **EŞDEĞER** (47/47 yeşil) | aşağıya bakın |
| Y18 | yaşıyor | [11] (1) | iz farklı: güncel kodun 2.4.9 tanımı `541b4a57…`, v2.4.9'un gerçeği `3a7f82c8…` |
| Y23 | yaşıyor | taksit açılış alanı vakası (2) | tarama yalnız `gl:101`, `cheque:collections` buluyor; sapma yok |

- **Y11'in ürün tarafı:** sonda üretim kipinde (test denetimi kapalı) aynı yazımı denedi. Mutantta yazım kapıdan sessizce geçiyor, sapmayı yalnız sonraki tarama buluyor. Testteki 500, bu sessiz geçişin test kipindeki görünümü.
- **Y10 ve Y12 neden EŞDEĞER:** sonda 10 farklı yazımı taban ve mutant kodda, test denetimi açık ve kapalı iki kipte denedi.
  - Yanıt kodu, ileti ve tarama sonucu iki kodda aynı.
  - Değişen tek şey kapının iç karar etiketi: "kilit (…)" yerine "bulgu: gl:101, cheque:collections". Süzgecin kendi para denetimleri aynı yazımı zaten yakalıyor.
  - Bu etiket hiçbir API'den dışarı verilmiyor. Teste özel ürün kancası eklenmedi.
- **Baş mimar değerlendirmeli (Y3):** program kendi yollarıyla, bu işaretin türetmeyi değiştirdiği kaynaklı bir satır üretemiyor. [10] bu yüzden yalnız "izdeki alan değişince sapma bulunur" sözleşmesini sabitliyor. İsterseniz Y3 de EŞDEĞER sayılıp [10] çıkarılabilir.

### İş 2 — S160 = A'nın iki ek testi
**Yeni dosya:** `test/s160-iptal-yollari-250.test.mjs` (10 test).

**(a) Banka'dan Ters Kaydet** (KDV'li masrafın faturası):
- Kilitli tahsilat bağlıyken (05.10 ve tam kilit günü) 409 `period-locked-bond`; ileti tarihi söylüyor. Banka olayı, fatura ve bağ aynı kalıyor; kilitli defter satır satır aynı.
- Görev metninde olmayan ek: **Düzelt** de Ters Kaydet'i çağırdığı için aynı reddi alıyor (409, yeni işlem yazılmıyor). "Fatura iptalini çağıran her yol" kapsamında ekledim.
- Kilit dışındaki tahsilat bağlıyken serbest.
- Ret yalnız tahsilat yönünde: kilitli **ödeme** ve kilitli **verilen senet** bağlı faturada Ters Kaydet 200, kilitli defter aynı.
- Kilit kaldırılınca iptal geçiyor, yeniden kilit çalışıyor ve öbür kilitli bağ yine korunuyor.
- **Önemli sınır:** kilitli *tahsilat* bağı programın arayüz yolundan kurulamıyor. Ön koşulda okunan 409: tahsilat alış faturasını kapatmıyor. Bu yüzden bağ, kilit konmadan önce programın kendi bağlantısından (kapıdan geçerek) yazıldı. Yani bu yol bir savunma katmanı; programın kendi verisiyle bu duruma düşülmüyor.

**(b) e-Arşiv iptal akışı** (sahte EDM servisiyle):
- Kilitli tahsilat bağlıyken 409; EDM'ye giden istek **0**. Belge iptal edilmiyor, gönderilmiş durumda kalıyor; bağ ve kilitli defter aynı.
- Kilit dışında: 200, EDM'de iptal isteği tam bir kez gidiyor.
- Kilit kaldır → iptal → yeniden kilit; ardından gelen ret yine EDM'ye gitmeden.

**Taban kırmızısı** (`c5a2-taban`, ayrı kopya): 7 test kırmızı, 3 yeşil. Yeşil kalanlar kural dışı vakalar, beklenen.
- Banka (iki vaka): yanıt 200, olay iptal edilmiş, fatura iptal edilmiş, bağ düşmüş. Kilitli defterde `-2026-10-05|120 … +2026-10-05|128` (A 120 → A 128).
- Düzelt: ek olarak 2 yeni işlem yazılmış.
- e-Arşiv (iki vaka): 200; EDM'ye `GetInvoiceStatus ×2` ve `CancelInvoice` gitmiş; kilitli defter 09.10 için 120 → 128.
- "Kilit kaldırılınca" testleri bu yüzden kırmızı (belge zaten iptal edilmişti).

**Yeni kodda:** UTC'de 17/17, Istanbul'da 17/17, çıkış 0 (yeni dosya + var olan S160 dosyası).

### İş 3 — S164 = C'nin ikinci örneği
`test/kural-farki-duzeltme-250.test.mjs` dosyasına [8] eklendi. Veri v2.4.9'un gerçek koduyla üretildi: açılışlı bir cari (gerçek kural farkı 800, 500 → 519), şüpheli alacak ve kilitli bir tahsilat. Sonra kilitli tahsilatın fatura bağı ayrı bağlantıyla yazıldı.

| Okuma | Bağ yazılmadan önce | Bağ yazıldıktan sonra |
|---|---|---|
| Fiş satırları | B 500 800 / A 519 800 | aynı |
| Fiş dışında kalan fark | yok | 120 −100, 128 +100 (alt defter hesabı) |
| Mutabakat Testi'nde kural farkı kaydı | 1 | 2; tahsilat kaydı adıyla listede |
| Kayıt | — | 200, fişte yalnız 500 / 519 |

- Ön izleme farkı kaynağıyla gösteriyor: kayıt kimliği, 09.10, hesap farkı 128 +10000 / 120 −10000, "fişle düzeltilmez". Fişe sessizce girmiyor; davranış beklenen biçimde olduğu için test yazıldı.
- **Dişi:** mutasyon betiğinin M3'ü ("alt defter hesabı farkı fişe girer") açılınca [8] kırmızı. Neden: fiş satırlarına "A 120 100 / B 128 100" giriyor.
- Taramanın bu değişikliği görüp görmediği sınanmadı (bilinen sınır).
- Dosya iki TZ'de baştan sona 8/8, çıkış 0.

### Gözlemler (bulgu değil)
1. **Tur 2a raporunun bir cümlesi doğrulanamadı.** Tur 2a, "POS komisyon faturasının bağlı iadesi Ters Kaydet'te artık 409 alır" diyordu. Sondada POS komisyon faturasının hiç banka olayı yok, yani Ters Kaydet yolu yok. Doğrudan iptali ise 409 alıyor.
2. İş 3'te fiş yazıldıktan sonra Mutabakat'taki kural farkı kaydı hâlâ 2 adet, fark 900 gösteriyor. Fiş dışında kalan 120 / 128 farkı varken "Düzeltildi" verilmiyor (kuralın gereği). Test bunu sabitlemiyor.
3. Benim koşu betiğim (`betik/kos.sh`) git depo değişkenini ana depoya yönlendiriyor. Bu ayarla `test/kanit-araci.test.mjs` 2 testte düşüyor. Ayar olmadan 50/50 yeşil. Kanıt koşuları bu ayar olmadan yapıldı.

### DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- **Denenen:** dokunulan üç dosyanın tamamı iki TZ'de baştan sona (47/47, 8/8, 17/17); dosya adı ve lisans servisi denetimleri 11/11; kanıt aracı testi 50/50.
- **Koşulmadı:** tam `npm test` (görev gereği), e2e, hız ölçümü (ürün kodu değişmedi), kâhinler.
- **Denenmedi:** e-SMM ve e-Fatura'nın iptal yolları ile e-Belge'de silme yolu (yalnız e-Arşiv iptali sınandı).
- **Sınırlar:** Y10 / Y12'nin eşdeğerliği 10 yazımlık sondaya dayanıyor, kanıtlanmış değil. Y3 sorusu yukarıda.
- **Windows'ta izlenecek:** `kilit-izi-alanlar-250` (yeni çok adımlı ayrı bağlantı yazımı), `kural-farki-duzeltme-250` [8] (ayrı bağlantı + geçici klasör). İkisi de kendi geçici klasörünü kendi tam yoluyla siler.

### Ana oturumun yeniden koşacağı komutlar
Çalışma klasörü `/home/user/ofis---y-netimi/.claude/worktrees/agent-ac4b7ba8396fbd29d`. Komutlar `TZ=UTC` ve `TZ=Europe/Istanbul` ile, `HUKUK_LICENSE_URL=http://127.0.0.1:9` verilerek koşulur.
1. `node --test --test-concurrency=3 test/kilit-izi-alanlar-250.test.mjs` → 47/47.
2. `node --test --test-concurrency=1 test/s160-iptal-yollari-250.test.mjs test/s160-kilitli-tahsilat-bagi-250.test.mjs` → 17/17.
3. `node --test test/kural-farki-duzeltme-250.test.mjs` → 8/8.
4. **S160 taban kırmızısı:** `c5a2-taban`'ın `git archive` kopyasına yeni dosya kopyalanır → 10 testte 3 geçer, 7 düşer, nedenler yukarıdaki gibi.
5. **Mutantlar:** `c5a2d-taban` kopyası + yeni `kilit-izi-alanlar-250` dosyası; kopyada depo değişkeni ana depoya verilir; betik `docs/kanit/2026-11-13/c5a2d-betik/mutant.py`. Beklenen: Y2 2, Y3 1, Y5 3, Y11 1, Y18 1, Y23 2 test düşer; Y10 ve Y12 47/47 yeşil.

### Commit'ler (dal `worktree-agent-ac4b7ba8396fbd29d`)
- 7601bc13 — İş 1 testleri
- 3139aa4d — İş 2 testleri
- 19602bc7 — İş 3 testi
- 8f4dceb2 — tasarım notu §17.12 (4 satır)
- 23f73856 — Kanıt: `docs/kanit/2026-11-13/c5a2d-*`; kanıt aracının çıktıları ve `c5a2d-mutant/`, `c5a2d-sonda/`, `c5a2d-betik/` klasörleri

### Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2d-q` — betikler ve ham çıktılar. Kod kopyaları silindi.

### Süreç notu
Bir ara yanlışlıkla içi boş bir "görev önerisi" çağrısı gönderdim. Çağrı zaman aşımına düştü; önerinin oluşup oluşmadığı bilinmiyor. Masaüstünde boş bir öneri kartı görürseniz geçersizdir, kapatılabilir.
