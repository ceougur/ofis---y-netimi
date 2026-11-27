# 2.5.1 D4-ÖN — rapor (devir yedeği taşımasına Windows yeniden denemesi, belge temizliği arşivi görür, iki yorum)

Görev metni: `docs/devir/2.5.1-DEVAM/d4on-istem.txt` (ana oturumda). Taban: etiket `t251-taban` (64396478). Ortam (bitişte): yük 1,32 / 4 çekirdek, bellek boş ~9 GB (kullanılabilir), disk boş 13 GB.

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
1. **Devir yedeği oluşturma (yalnız programın içinden çağrılır; 2.5.0'da kullanıcıya açık oluşturma düğmesi YOK — ekranda değişen bir şey yok):**
   - Son adına taşıma geçici hatada (EPERM / EBUSY / EACCES / ENOTEMPTY): ÖNCE ilk hatada yedek düşer, yazılmış klasör silinir → SONRA 12 kez yeniden denenir (aralar 50…550 ms); örnek: 4 geçici hata + 5. denemede taşındı, yedek "Tamam", doğrulama geçer.
   - Taşıma hiç olmazsa: ÖNCE ham hata (ör. `EBUSY: …, rename`), klasör silinir (Windows'ta silme de düşüp asıl hatayı ezebilirdi) → SONRA 503 `devir-backup-move`, ileti: "Devir yedeği yazıldı ama son adına alınamadı (klasördeki bir dosya başka bir programca (ör. virüs tarayıcısı) kullanılıyor). Yedek Devir Yedekleri listesinde “Yarım Kaldı” görünür; birkaç dakika sonra yeniden deneyin."; yazılmış klasör SİLİNMEZ, Yönetim → Yedekler → Devir Yedekleri'nde "Yarım Kaldı" satırı olarak görünür (örnek: 12 deneme, ~3,3 sn).
   - Yeniden denenmeyen hata (ör. EXDEV): tek deneme, hemen 503 ("dosya sistemi hatası EXDEV"), klasör "Yarım Kaldı".
   - Yazma sırasındaki hata (kopya / özet): bugünkü gibi yarım klasör silinir; silme düşerse asıl hata döner (ders 21).
2. **Belge temizliği (her şirket açılışından 5 sn sonra):** ÖNCE yalnız çalışma yılının kayıtlarına bakıyordu → SONRA şirketin kayıtlı arşivlerinin belge kayıtlarına da bakar. Örnek (test 1): 002'de 5 dosya (2024 arşivinin, 2025 arşivinin, 2025 arşivinde silineli 5 gün olan kaydın, çalışma yılında duranın ve hiçbirinin göstermediği), hepsi çalışma yılında silineli 40 gün: ÖNCE 4 dosya silinir, 1 kalır → SONRA 1 silinir (kimsenin göstermediği), 4 kalır. Açılamayan arşiv (bozuk / eksik / kilitli): o şirkette o turda hiçbir belge dosyası silinmez (eski `.tmp` artığı ve silineli 30 günü geçen kayıt bugünkü gibi kalkar), günlüğe uyarı yazılır. Arşivsiz şirkette davranış AYNEN (001 örneği: 1 dosya silinir, önce de sonra da).
3. **Yorumlar (davranış yok):** `test/sema-kapisi-bs7.test.mjs` test 3, `server/routes/ledger.mjs` KDV mahsubu yorumu.

## DEĞİŞEN DOSYALAR
| Dosya | Değişiklik |
|---|---|
| `server/lib/devir/devir-backups.mjs` | Son ada taşıma `renameWithRetry` (lib/app-layout.mjs — mevcut yardımcı, DOKUNULMADI, zaten dışa açık); taşıma hatasında klasör korunur + Türkçe 503; yazma hatasında temizlik hatası yutulur |
| `server/lib/documents.mjs` | `createDocumentStore({ archives })`; `purge` arşivleri kısa süreli salt okunur bağlantıyla okur (`new DatabaseSync(file, { readOnly: true })`, bekleme süresi 0), bağlantı hemen kapanır; okunamayan arşiv → dosya silinmez |
| `server/routes/documents.mjs` | Yalnız bağlama: `archives: () => companies.archivesOf(companyId) → archiveFileOf(config.dataDir, yıl)` (+ import, + parametre) |
| `server/routes/ledger.mjs` | Yalnız yorum |
| `test/sema-kapisi-bs7.test.mjs` | Yalnız yorum |
| `test/devir-d4on-yedek-tasima-251.test.mjs` | YENİ (4 test) |
| `test/devir-d4on-belge-temizligi-251.test.mjs` | YENİ (3 test) |
| `test/devir-d4on-251-mutasyon.mjs` | YENİ mutasyon betiği (11 mutant; .test.mjs değil) |

Bekleme olay döngüsünü ne kadar tutar: `renameWithRetry` eşzamanlı (Atomics.wait) — yalnız geçici hatada; en kötü durumda 11 bekleme × (50…550 ms) = **~3,3 sn** (ilk denemede başarırsa 0). Yedek D4'te bakım kipinde alınacağı için kabul (görev metni). Not: programda olay döngüsünü tutmayan ikinci bir yardımcı da var (`archive-open.mjs moveIntoPlace`, async, 6 deneme / ~1,5 sn, ENOTEMPTY yok, dışa açık değil) — görevin hata listesi (ENOTEMPTY dahil) ve "dışa açma yalnız gerekirse" kuralı nedeniyle `renameWithRetry` seçildi.

## TARAMA TABLOSU (komşular, `git grep` ile; ders 10)
Tarama: `git grep -l -E "devir-backups|createDevirBackup|listDevirBackups|verifyDevirBackup|devir-yedekleri"`, `"createDocumentStore|/documents|belgeler/"`, `"makeArchive|archivesOf|hofArchive|placeLegacyArchive"`, `"sema-kapisi|backups/restore|restoreCompany"` (son tarama çok geniş — yedek / geri yükleme / şema kapısının çekirdek testleri seçildi) + kaynak tarayan denetimler.
| Alan | Dosyalar |
|---|---|
| Devir yedeği / arşiv | devir-arsiv-wal-250, devir-d2-bakim-250, devir-d2-yedek-250, devir-d2-arsiv-250, devir-d2-arsiv-goc-kesinti-250 |
| Belge | documents, trash, kayit-bag-31e |
| Şema kapısı / yedek / geri yükleme | sema-kapisi-bs7, yedek-220, yedek-220-inceleme, geri-yukleme-uyari-244, guvenilirlik-221-tatbikat, banka-210-gg-geri-yukle, createapp-acilis-geri-alma-249 |
| Yardımcı / kaynak denetimi | updater (renameWithRetry'nin öbür kullanıcısı), yazim-duzeni, platform-tasinabilirlik, lisans-servisi-izolasyonu |
| Yeni | devir-d4on-yedek-tasima-251, devir-d4on-belge-temizligi-251 |
SONUÇ (21 dosya, commit 276a4df1): TZ=UTC **203/203 geçti**, 0 başarısız / iptal / atlanan; TZ=Europe/Istanbul **203/203 geçti** (kanıt `d4on-komsu-utc`, `d4on-komsu-ist`).
Taranıp koşulmayanlar: `devir-d2-250-mutasyon.mjs` (D2 mutantlarının metinleri değişmedi — yalnız denetlendi: M22 ve M47'nin metni devir-backups'ta aynen duruyor), `devir-d2-hacim-250.mjs`, `devir-d2-eski-surum-250.mjs`, e2e `senaryo-220-yedek.mjs` (Devir Yedekleri bölümünün başlıkları; değişmedi), `test/e2e/run.mjs` (belgeler) — DENENMEYEN'de.

## YENİ TESTLER — kırmızı nedeni (taban, ayrı kopya `/dev/shm/d4on-tas/eski`) + yeşil (iki TZ)
| Test | Tabanda (UTC ve İstanbul: 0/4, 0/3) | Yenide |
|---|---|---|
| taşıma: 4 geçici hata → 5. denemede | `EPERM: test: enjekte, rename` (yeniden deneme yok) | yeşil |
| taşıma: kalıcı EBUSY | `undefined !== 503` (ham hata, klasör silinmiş) | yeşil |
| taşıma: EXDEV | `undefined !== 503` | yeşil |
| taşıma: açık tutamak | Linux: `EPERM: Linux eşdeğeri: klasörde açık tutamak` · Windows: **OKUNMADI** (ana oturum CI Windows'ta iki koşu okuyacak) | Linux yeşil; Windows OKUNMADI |
| belge: iki arşiv yılı + arşivsiz 001 | `{p2024: false, p2025: false, prec: false}` (arşivin gösterdiği üç dosya silindi) | yeşil |
| belge: bozuk arşiv | "arşiv okunamadı → belge dosyası silinmedi (beklenen true, gelen false)" | yeşil |
| belge: eksik / kilitli / arşivsiz | "eksik arşiv → dosya kalır (beklenen true, gelen false)" | yeşil |
Kanıt: `d4on-tasima-{taban,yeni}-{utc,ist}`, `d4on-belge-{taban,yeni}-{utc,ist}`. (Yeni koddaki ilk dört koşu commit'siz ağaçtaydı; aynı testler commit 276a4df1'de komşu koşusunda iki TZ yeşil.)
Windows'taki gerçek ön koşul (ders 18, 20, 48): 4. test Windows'ta tutamak açıkken GERÇEK `renameSync`'i dener ve iki denemenin İŞLETİM SİSTEMİNDEN geçici hatayla düştüğünü ister (ön koşul oluşmadıysa test kırmızı); tutamak bırakılınca sonraki denemeler yalnız geçici hatayla düşebilir (antivirüs), sonunda taşınmalı. Test sayısı iki platformda aynı (koşullu test yok; yalnız gövdede enjeksiyon farkı).

## KABUL KOŞULLARI
- A. Yeni 7 test: tabanda beklenen nedenle kırmızı (7/7), yenide yeşil (7/7), iki TZ. ✔
- B. Komşular: 21 dosya, 203/203 × 2 TZ. ✔
- C. Mutantlar (ayrı kopya `/dev/shm/d4on-tas/mut`, taban 7/7 yeşil): **11/11 yakalandı** (kanıt `d4on-mutasyon`; araç özet satırını tanımadığı için "BELİRSİZ" yazar — betik çıktısı ve çıkış 0 kanıttır).
- D. Açık tutamak: belge test 1, temizlikten sonra `/proc/self/fd`'de arşiv dosyalarına (ve `-journal/-wal/-shm`) giden tutamak **0**; her platformda iki arşiv dosyası taşınıp geri alındı; arşiv dosyaları bayt bayt aynı, yanlarında günlük dosyası yok. Mutant M7 (bağlantıyı kapatma) bu denetimde kırmızı. ✔
- E. Hız (aşağıda): arşivsiz şirkette fark yok. ✔

## MUTANT TABLOSU
| No | Mutant | Sonuç (ilk kırmızı) |
|---|---|---|
| M1 | yeniden denemeyi kaldır (tek deneme) | YAKALANDI — geçici hata testi (1 geçti / 3 kaldı) |
| M2 | kalıcı taşıma hatasını yut | YAKALANDI — kalıcı hata testi |
| M3 | taşıma düşünce klasörü sil | YAKALANDI — "yazılmış klasör listede yarım" |
| M4 | arşiv başvurusunu yok say | YAKALANDI — iki arşiv yılı |
| M5 | açılamayan arşivi "göstermiyor" say | YAKALANDI — bozuk arşiv (+ eksik / kilitli) |
| M6 | yalnız ilk arşive bak | YAKALANDI — `p2025: false` |
| M7 | arşiv bağlantısını kapatma | YAKALANDI — "arşive açık tutamak yok" |
| M8 | arşivin 30 günü geçmemiş silinmiş kaydını sayma | YAKALANDI — `prec: false` |
| M9 | arşivin 30 günü geçmiş silinmiş kaydını da say | YAKALANDI — PNONE silinmedi (bekleme) |
| M10 | bağlama: arşiv listesi verilmez | YAKALANDI |
| M11 | bağlama: arşiv yolu yanlış klasörden | YAKALANDI |

## HIZ (kabul E; `flock -x`, aynı veri, dosya silinmeyen tarama: 20.000 dosya, 10.000 kayıt, arşiv 0)
| Koşu | /proc/loadavg (1 dk) | Taban ortanca | Yeni ortanca |
|---|---|---|---|
| 1 | 2,95 (> çekirdek/2 — GEÇERSİZ sayıldı, ders 52) | 86,8 ms | 85,2 ms |
| 2 | 1,53 (geçerli) | 94,3 ms | 87,8 ms |
Yedi tur, sıra her turda değişir (`docs/kanit/2026-11-27/d4on-olcum-belge.mjs`, sonuç `d4on-hiz-belge-temizligi*.json`). Arşivli şirkette ek maliyet arşiv başına bir salt okunur açılış + `SELECT DISTINCT sha256` (ölçülmedi — DENENMEYEN).

## İŞ 3 — yorumlar (koddan doğrulandı)
- `test/sema-kapisi-bs7.test.mjs` test 3: eski yorum "denetim izi (audit_events) 001 dosyasında; bunlar yazılır" diyordu. Doğrusu: audit_events ortak katman değil (COMMON_TABLES = users, roles, sessions, mobile_*); kapılı 001'de `createAudit` `canWrite: !writeGate` → yazılmaz. DENENDİ: skip listesinden audit_events çıkarılmış geçici kopyayla test 3 GEÇTİ (kopya silindi). Skip listesi DEĞİŞMEDİ (yalnız yorum).
- `server/routes/ledger.mjs` (~301): eski yorum "mahsup tablosuna yazım tam kapıya düşer (integrity-scope 'kapsam dışı')". Doğrusu: `vat_offsets` `lib/db.mjs` FINANCIAL / SCOPE_TABLES'ta yok (db.mjs:95 notu: 2.0.15'ten beri BİLİNEN SINIR) → `touched` boş kalır (db.mjs:400), kapı `guard.check` hiç çağrılmaz (db.mjs:517); integrity-scope'un "kapsam dışı" dalına ulaşılmaz. Koddan okundu; çalıştırılarak denenmedi.

## KULLANICIYA SORULMALI
- YOK (para / kapama / defter kuralına dokunulmadı).

## BAŞ MİMAR KARARI GEREKİYOR (öneri UYGULANDI — "önerilerini uygula" kuralıyla; değiştirilebilir)
1. Arşivin KENDİ silinmiş belge kaydı: çalışma yılındaki kuralın aynısı uygulandı (silinmemiş ya da silineli 30 günü geçmemiş kayıt gösterir; 30 günü geçmiş silinmiş arşiv kaydı göstermez → dosya silinebilir). Seçenek B: arşivin her kaydı (silinmiş dahil) sonsuza kadar gösterir (daha temkinli; bedeli disk). Öneri A (uygulandı): arşiv salt okunur, kendi temizliği olmaz; aynı kural iki dosyada aynı sonucu verir; Devri Geri Al devir yedeğinden belgeler/'i de geri getirir.
2. Taşıma yardımcısı: eşzamanlı `renameWithRetry` (olay döngüsünü en çok ~3,3 sn tutar) seçildi; async `moveIntoPlace` (tutmaz, ~1,5 sn, ENOTEMPTY yok) alternatif. D4'te yedek bakım kipinde ve öbür şirket çalışırken alınırsa 3,3 sn tutma öbür şirketin isteklerini de bekletir — D4 tasarımında değerlendirilmeli.
3. Taşıması düşen "Yarım Kaldı" klasörü kendiliğinden silinmez (tam içerik; kullanıcı yeniden dener). Yer kaplar; D5'te listeden silme / yeniden adlandırma düğmesi düşünülmeli.

## SONRAKİ SÜRÜME (20.11 kuralı — program / kullanıcıyı etkilemeyen)
- `test/sema-kapisi-bs7.test.mjs` test 3'te audit_events skip'ten çıkarılabilir (test güçlenir; denendi, geçiyor).
- D2 mutasyon betiğine bu paketin mutantlarının eklenmesi gerekmez (ayrı betik); ana oturum isterse birleştirilebilir.

## DOĞRULANMADI
- Windows'ta açık tutamaklı klasör taşımasının GERÇEKTEN EPERM / EBUSY vermesi (4. testin ön koşulu) — yalnız CI Windows'ta görülür; tabanda Windows'taki kırmızı iletisi OKUNMADI.
- ledger.mjs yorumu koddan okundu, KDV mahsubu POST'unda kapının koşmadığı çalıştırılarak gösterilmedi.

## DENENMEYEN
- Tam `npm test` (görev gereği ana oturumda), e2e (bu pakette ekran değişmedi; `senaryo-220-yedek`, `run.mjs` belgeler bölümü koşulmadı), `devir-d2-hacim-250`, `devir-d2-eski-surum-250`, D2 mutasyon betiği.
- Arşivli şirkette büyük veride temizlik süresi (arşiv başına okuma maliyeti); eski şemalı (göç bekleyen) arşivin temizlikte okunması (case_documents ve deleted_at 2.0.1 / 2.0.2'den beri var; okunamazsa güvenli taraf: hiçbir dosya silinmez).
- Süreç taşıma sırasında öldürülmesi (rename atomik; ayrı SIGKILL testi yazılmadı), aynı anda iki devir yedeği.

## CI LİSTESİNE EKLENECEK
- Yok (yeni testler `.test.mjs`; `npm test` kalıbıyla kendiliğinden koşar). Yeni ekran senaryosu açılmadı.

## KILAVUZ METNİ ÖNERİSİ (son adayda toplu)
- "Devir Yedekleri listesinde “Yarım Kaldı” görünen yedek tamamlanmamıştır; geri yüklemede kullanılmaz. Virüs tarayıcısı dosyayı tutuyorsa birkaç dakika sonra işlemi yeniden başlatın."

## COMMIT LİSTESİ (t251-taban..dal ucu)
- 932d3a43 rapor taslağı — nasıl bozulur listesi (koddan önce)
- b52db13f İş 1: devir yedeği taşımasında Windows yeniden denemesi
- 8e9e065a İş 2: belge temizliği arşivi görür
- 05a353a2 İş 3: iki yorum düzeltmesi
- 276a4df1 mutasyon taraması
- c519f210 Kanıt
- (bu rapor commit'i)

## ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <bu ağaç>
HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC node tools/kanit.mjs kos d4on-yeni -- node --test test/devir-d4on-yedek-tasima-251.test.mjs test/devir-d4on-belge-temizligi-251.test.mjs
HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul node tools/kanit.mjs kos d4on-yeni-ist -- node --test test/devir-d4on-yedek-tasima-251.test.mjs test/devir-d4on-belge-temizligi-251.test.mjs
# taban kırmızısı: git worktree add --detach <kopya> t251-taban; iki yeni test dosyasını kopyaya al; aynı komut (7/7 kırmızı beklenir)
# mutasyon: git worktree add --detach <kopya2> <dal ucu>; HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/devir-d4on-251-mutasyon.mjs --kopya <kopya2>   (11/11)
# komşular: docs/kanit/2026-11-27/d4on-komsu-utc.json'daki 21 dosya, iki TZ
# CI: Windows Node 22/24'te devir-d4on-yedek-tasima-251 4. test İKİ koşuda yeşil (ders 18)
```
