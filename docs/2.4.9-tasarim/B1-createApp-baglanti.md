# 2.4.9 B1 — createApp açılışı yarıda düşünce şirket dosyası açık kalmasın (TASARIM NOTU, kod yok)

> Sınıf [H] (iş listesi B1; dar kontrol ORTA-1, KULLANICI KARARI 02.11.2026 ~03:15 UTC "a": BİLİNEN SINIR + 2.4.9; 03.11 SORU 2 → B1 KAPSAMDA).
> Taban: dal `claude/compassionate-galileo-f9kghg`, commit e3f74093 (B1 öncesi = "eski kod"). Yazan: tasarım ajanı, 03.11.2026. Kod değişmedi.
> Okunanlar: CLAUDE.md (dersler 10, 18, 20, 21, 23, 25, 36, 38, 44, 48), docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md, docs/2.4.9-IS-LISTESI.md B1,
> docs/2.4.8-IS-LISTESI.md "CI #944 HÜKMÜ", "DAR KONTROL (openDatabase", docs/kanit/2026-11-02/db-bozuk-dk/NOT.md.

## 1. Sorun ve kanıt

2.4.8'de `openDatabase` (server/lib/db.mjs:7–29) PRAGMA düşerse bağlantıyı kapatıyor (e2380d7e). `createApp` (server/app.mjs:106) ise
`openDatabase` BAŞARILI olduktan sonra düşen bir adımda bağlantıyı kapatmıyor: app.mjs:120 `const db = openDatabase(config.dbPath)` ile
app.mjs:1080 `return app` arasında try/catch yok (v2.4.5 ve v2.4.7'de de aynı: `git show v2.4.7:server/app.mjs` satır 117, korumasız).
Bağlantı yalnız `app.close()` (app.mjs:1034–1075, `db.close()` 1074) ile kapanır; ama düşen açılışta `app` hiç dönmez, `children`'a da
girmez (app.mjs:594) → `closeCompany` (707–716) onu bulamaz (`false` döner), dosya çöp toplamaya (GC) kadar açık kalır.

**Yeniden üretim (bu not için, e3f74093, Linux, Node 22.22.0)** — betik `docs/kanit/2026-11-02/db-bozuk-dk/betik/sizinti-log.mjs`
(dar kontrolün betiği; gerçek program, `startTestServer`, `HUKUK_LICENSE_URL=http://127.0.0.1:9`), `/proc/self/fd` sayımı:

| Senaryo | Düşen adım (yığından) | 002 istekleri | Açık tutamak (dosyaya) | Not |
|---|---|---|---|---|
| tablo-bozuk (users kök sayfası bozuk) | `mirrorUsers` companies.mjs:470 ← app.mjs:233 | 503 ×3 | **3** (istek başına 1) | `--expose-gc` + gc → 0 (sızıntı GC'ye kadar) |
| tablo-bozuk-geri (aynı + Yedekten Geri Yükle) | aynı | 503 ×3 → geri yükleme 200 | 3 → geri yüklemeden sonra **4 "(deleted)"** | Linux açık dosyanın yerine yenisini koymaya izin verir; Windows'ta `swapInRestoredFile` renameSync (company-backups.mjs:235) EBUSY/EPERM → "Veri dosyası değiştirilemedi" 500 (company-backups.mjs:713) — koddan, Windows'ta DOĞRULANMADI |
| kilit (aynı süreçte BEGIN EXCLUSIVE) | `mirrorUsers` tx "database is locked" (10 sn busy_timeout) | 503 (10.037 ms) | **2**; sonraki başarılı açılış + closeCompany'den sonra da 2 | Fazla 1 tutamak SQLite unix VFS'nin aynı süreçte kilitli inode'da kapanan bağlantının fd'sini erteleme davranışı (kök neden DOĞRULANMADI) → testte kilit tutucusu AYRI SÜREÇ olmalı (§6) |

Etki büyür: her başarısız açılış bir bağlantı daha sızdırır ve açılışı tetikleyen yollar tekrar eder — kullanıcının her isteği (dispatchApp
app.mjs:690–697 → 503 `retry-after: 30`), Meta durum bildirimi (whatsapp/hook.mjs:165; Meta 200 dışı yanıtta 7 güne kadar yeniden dener),
açılışta süren WhatsApp işleri (app.mjs:791–803), günlük POS valör turu (app.mjs:750–772). Windows'ta bu sürede şirketin veri dosyası
silinemez, Yedekten Geri Yükle ile değiştirilemez, Şirket Sil klasörü arşive taşıyamaz — kurtarma tam gerektiği anda engellenir.

## 2. Şirket veri dosyasını (ve createApp yolundaki öbür SQLite dosyalarını) açan BÜTÜN yollar

Tarama: `rg -n "openDatabase\(|new DatabaseSync\(" server tools` (test/ hariç; 130 test çağrısı kapsam dışı).

| # | Yer | Ne açar | Açılıştan sonra düşebilen adım | Hatada close? | Hüküm |
|---|---|---|---|---|---|
| 1 | server/app.mjs:120 createApp (hub 001 ve çocuk 002) | şirket dosyası (yazma) | runMigrations 213, ensureInitialAdmin/mirrorUsers 232–233, profile.init 299, dataset.start 321, integrity.start 434, … 1080'e kadar | **YOK** | **B1 — düzeltilir** |
| 2 | server/lib/einvoice/kullanim-defteri.mjs:38 openUsageLedger (createApp:154, yalnız hub) | e-belge-kullanim.sqlite | `db.exec(SCHEMA)` 39, `db.prepare` 40 | **YOK** | aynı desen — §4 B1-b (öneri) |
| 3 | server/lib/whatsapp/defter.mjs:184 openWaLedger (createApp:215 createWhatsappHub, yalnız hub) | whatsapp-gonderim.sqlite | `db.exec(SCHEMA)` 185, meta okuma/yazma 186–190, prepare'ler | **YOK** | aynı desen — §4 B1-b (öneri) |
| 4 | app.mjs:145 withCompanyDb (salt okunur, kısa süreli) | açık olmayan şirket | fn | try/finally 146–150 | VAR |
| 5 | company-backups.mjs:173 prepareRestoreFile (geri yükleme hazırlık kopyası) | `<db>.geri-yukleme` | quick_check, runMigrations, transplant… | catch 201–208 `db?.close()` + clean | VAR |
| 6 | company-backups.mjs:226 swapInRestoredFile (canlı WAL checkpoint) | canlı dosya | checkpoint | try/finally 227–232 | VAR |
| 7 | company-backups.mjs:268 applyStagedRestore probe (salt okunur) | canlı 001 | user_version | try/finally 270–275 | VAR |
| 8 | company-backups.mjs:280 applyStagedRestore güvenlik yedeği | canlı 001 | createBackup, checkpoint | try/finally 281–287 | VAR |
| 9 | company-backups.mjs:82 readInstanceId / :99 inspectBackup (yedek doğrulama) | yedek dosyası | sorgular | finally `db?.close()` | VAR |
| 10 | backup.mjs:96 writeBackupIdentity / :111 readBackupIdentity / :185 copyUsageRows | yedek kopyası | exec/prepare | try/finally | VAR |
| 11 | company-separate.mjs:64 Ayır (yeni kimlik) | kopya dosya | setSetting | try/finally 65–69 | VAR |
| 12 | companies.mjs:117 instanceOf (kayıt defteri kurtarma, salt okunur) | şirket dosyaları | sorgular | iç try/finally | VAR |
| 13 | supervisor.mjs:247 withDatabase (güncelleme öncesi yedek, salt okunur) | 001 | fn | try/finally 248–252 | VAR |
| 14 | report-worker.mjs:22, integrity-scan-worker.mjs:21 (iş parçacığı, salt okunur) | şirket dosyası | rapor/tarama | finally `db?.close()` | VAR |
| 15 | tools/backup.mjs:48 (komut satırı yedek), tools/mutabakat.mjs:56 (kopya) | şirket / kopya | createBackup / VACUUM | açık close / try/finally | VAR (mutabakat.mjs:64 ayrıca createApp kullanır → #1 kapsar) |
| 16 | tools/olcek-210, kapi-olcum, banka-hareket-olcum, goc245-hiz, m30-goc-kesinti-adim | ölçüm kopyaları | — | ölçüm aracı; süreç biter | kapsam dışı |

`new DatabaseSync(...)` kurucusu kendisi düşerse (dosya açılamadı) bağlantı nesnesi dönmez; Node'un o durumda tutamağı bırakıp bırakmadığı
DOĞRULANMADI → §6 T0 ölçer (ucuz; bozuk/olmayan dizin yolunda `/proc/self/fd`).

Sonuç: hatada kapatmayan **yalnız #1 (createApp)** ve aynı desenle **#2, #3** (createApp'ın hub yolunda açılan iki makine defteri).

## 3. Düşen açılışta açık kalan ÖTEKİ kaynaklar (komşu — ders 10)

Yalnız `db.close()` eklemek yetmez: açılışın sonraki adımları zamanlayıcı ve kayıt bırakır; bağlantı kapanınca bunlar KAPALI bağlantıya
çarpar (bugün açık yetim bağlantıda çalışıyorlar — daha kötü: aynı şirkete ikinci, görünmez bir örnek yazabilir). Açılışta sırayla:

| Satır | Kaynak | Çocukta mı | Geri alma |
|---|---|---|---|
| 120 | db | ikisi | `db.close()` (SENKRON) |
| 154 | usageLedger (ayrı dosya) | yalnız hub | `usageLedger.close()` |
| 215 | whatsapp hub: defter (ayrı dosya) + zamanlayıcı | yalnız hub | `whatsapp.ledger.close()`; `whatsapp.scheduler.stop()` (async, beklenmez) |
| 257 | events (createEventHub; pinger setInterval events.mjs:162) | ikisi | `events.stop()` |
| 261 | unbridgeHubEvents (hub olaylarına dinleyici) | çocuk | `unbridgeHubEvents?.()` |
| 297 | analysisRunner | ikisi | `analysisRunner.close()` (async, `.catch`) |
| 319 | license.init | yalnız hub | `license.stop()` |
| 321 | dataset.start (zamanlayıcılar dataset.mjs:1484–1507) | ikisi | `dataset.stop()` |
| 438–443 | integrity.scanTimer | ikisi | `clearInterval` |
| 448–450 | posQueue (çocukta setImmediate → start) | ikisi | `posQueue.stop()` (stopped bayrağı start'ı etkisiz kılar — pos.mjs:1503–1537) |
| 462 | `whatsapp.scheduler.register(companyId, queue)` (hub'ın işçisine kayıt) | çocuk | `whatsapp.scheduler.unregister(companyId)` — YALNIZ bu örnek kaydettiyse (kayıttan hemen sonra yığına) |
| 470 / 475 | reportRunner / documents | ikisi | `reportRunner?.close()` / `documents.stop()` |
| 809–852 | yedek zamanlayıcısı, license.start, alertScheduler, sessionTimer, archive zamanlayıcıları | ikisi (bir kısmı hub) | ilgili stop/clear |
| 964 → 1080 | `app` kuruldu; sonrası (attachTunnel 1078) | — | `app.close()` (async, beklenmez; db zaten senkron kapatılır) |

Bugün ölçülen düşmeler (213/233) bu kaynakların hiçbiri kurulmadan önce; geç düşme (ör. integrity.start 434 bir para tablosunun bozuk
sayfasında) gerçek veriyle mümkündür → tasarım hepsini kapsar, test de genel ölçüyle (§6 T4) atlanan kaynağı yakalar.

## 4. Tek değişim deseni

**B1-a (zorunlu) — createApp'ı ince bir sarmalayıcıyla geri alma yığınına bağla.** 960 satırı yeniden girintilemeden:

```js
export function createApp(overrides = {}) {
  const undo = []; // açılışta kurulan her kaynağın geri alması, kuruluş sırasıyla
  try {
    return buildApp(overrides, undo);
  } catch (error) {
    rollbackOpen(undo, overrides.log, error); // tersten; her adım kendi try/catch'inde
    throw error; // ASIL hata aynen yeniden fırlatılır (ders 21: temizlik hatası asıl hatayı ezmez)
  }
}
function buildApp(overrides, undo) { /* bugünkü gövde aynen; kaynak kurulunca: undo.push(() => …) */ }
function rollbackOpen(undo, log, cause) {
  for (const step of undo.reverse()) {
    try { const r = step(); r?.catch?.(() => {}); } catch (e) { log?.warn?.(`Açılış geri alınırken: ${e.message} (asıl hata: ${cause?.message})`); }
  }
}
```

Kurallar:
1. `undo.push(() => db.close())` app.mjs:120'nin HEMEN ardından (121 createStore'dan önce). Öbür satırlar §3 tablosundaki noktalarda,
   kaynak kurulduktan hemen sonra; `app` kurulunca (964'ten sonra) tek `undo.push(() => app.close())` öncekilerin yerine geçebilir
   (yığın sıfırlanır: `undo.length = 0; undo.push(...)`), çünkü `app.close()` hepsini kapatır.
2. `db.close()` SENKRON ve catch'te hemen çalışır: createApp senkron döner; appFor'u çağıran (dispatchApp, restoreCompany'nin ardından
   gelen istek, kanca) hatayı aldığında dosya ZATEN serbest olmalı. Async kapanışlar (analysisRunner, reportRunner, scheduler.stop, app.close)
   beklenmez, `.catch(() => {})` ile bırakılır; şirket dosyasını tutmazlar (rapor iş parçacığı yalnız iş sırasında açar, finally'de kapatır).
3. Başarılı açılışta davranış AYNEN: yığın yalnız hatada okunur; `app.close()` değişmez.
4. Hata türü/iletisi değişmez (dispatchApp 503 iletisi `error.code || error.message` gösterir; HttpError ayrımı aynı).
5. `buildApp` dışa aktarılmaz; çocuk örnek de `createApp` (app.mjs:576) üzerinden açıldığı için aynı korumayı alır.
6. Test kancası (yalnız programdan, ortam/ayar dosyasından DEĞİL; `__testWriteLockProbe` emsali app.mjs:264): `overrides.__testOpenFault?.(stage, companyId)`
   — `stage` ∈ {"after-open", "after-migrations", "after-users", "after-dataset", "after-integrity", "after-register", "after-app"}; true dönerse o
   noktada `Error("test: açılış kesintisi <stage>")` fırlatılır. Çocuk `...overrides` ile aynı kancayı alır; `companyId` ile yalnız 002 düşürülür.
   Kanca olmadan sıfır maliyet.

**B1-b (öneri; ana oturum karar verir) — aynı desen iki makine defterinde.** `openUsageLedger` (kullanim-defteri.mjs:38) ve `openWaLedger`
(defter.mjs:184): `openDatabase`'den sonra kurulumu (SCHEMA, prepare, meta) `try { … } catch (e) { try { db.close() } catch {} throw e }`
içine al. Bu dosyalar createApp'ın hub yolunda açılır; bozuksa hub açılmaz ve süreç çıkar (server.mjs:17, sızıntı süreçle biter), ama
aynı süreçte createApp'ı tekrar çağıran testlerde/araçlarda (tools/mutabakat.mjs:64, test yardımcıları) Windows'ta geçici klasör
silinemez. 5'er satır, davranış aynı. Kapsam dondu (ders 45): "createApp yolunda açılan dosya" diye B1 içinde sayılması BAŞ MİMAR KARARI
olarak iş listesine yazılmalı; reddedilirse DÜŞÜK → 2.5.0.

Yapılmayacak: `openDatabase`'in kendisi değişmez (2.4.8 düzeltmesi yerinde); GC'ye güvenilmez; yeniden deneme/bekleme eklenmez.

## 5. Komşular (ders 10) ve nasıl bozulur

**Komşular:** `closeCompany` (app.mjs:707, async; çocuk listede yoksa `false`) — düzeltme bu sözleşmeyi değiştirmez; geri yükleme
`await closeCompany` → prepare → swap (company-backups.mjs:673–714) düşen açılıştan sonra dosyayı serbest bulmalı. supervisor.mjs:247
(etkilenmez; komşu testleri koşulur). test/whatsapp-t-durum-karar-tablosu-248.test.mjs T-Kbozuk / T-Kbozuk-yabancı (1607–1660; bozuk
dosyada kanca 503 → düzeltince 200; dosya rmSync) — PRAGMA'da düşen yol, `openDatabase` kapatıyor; B1'den sonra da yeşil kalmalı.
test/db-bozuk-dosya-tutamak-248.test.mjs (openDatabase düzeyi; değişmez). Kanca `appFor` çağrısı (hook.mjs:165 `permanent(error)` ayrımı) —
hata nesnesi aynı kaldığı için 503/kalıcı ayrımı değişmemeli (İş V1/X1 `dataMissing` işareti appFor'da, createApp'tan önce, etkilenmez).

**Nasıl bozulur (testler bu listeden):**
1. Göç ortasında düşme (runMigrations 213; göç işlemi tx'te geri alınır, göç öncesi yedek alınmış olur) → dosya serbest, user_version eski kalır, sonraki açılış göçü yeniden dener.
2. Kilitli dosya (başka süreç BEGIN EXCLUSIVE; mirrorUsers 10 sn sonra BUSY) → kilit kalkınca sıradaki istek 200, açık tutamak yalnız canlı örneğinki.
3. Derin bozulma (başlık/PRAGMA sağlam, tablo sayfası bozuk) — erken (users → 233) ve geç (para tablosu → integrity.start 434).
4. Geç düşme: zamanlayıcı/kayıt kurulduktan sonra (after-dataset … after-app) → yetim zamanlayıcı, hub işçisinde yetim kuyruk, hub olay dinleyicisi KALMAMALI; kapalı bağlantıya çarpan zamanlayıcı günlüğe hata yazmamalı.
5. Temizlik de düşerse (ör. `db.close()` fırlatır) → kullanıcıya giden ASIL hata (503 iletisi) değişmez.
6. Salt okunur lisans (süresi dolmuş/engelli) — açılış aynı; düşen açılışta da dosya serbest; sağlam açılışta salt okunur davranış değişmez.
7. İki şirket: 002 düşerken 001 çalışır (istekler 200, 001'in tutamakları değişmez); 002 düşen açılıştan sonra Yedekten Geri Yükle, Şirket Sil.
8. Tekrar: aynı bozuk şirkete 10 istek / 10 kanca bildirimi → tutamak 0 (bugün 10).
9. Yeni (hiç açılmamış, boş klasörlü) şirkette düşme → yeni boş dosya da serbest; `company.opened` işareti konmaz (595 çalışmaz).
10. Hub (001) açılışı düşer (doğrudan createApp) → 001 dosyası + (B1-b ile) iki defter dosyası serbest; aynı süreçte ikinci createApp açılır.

## 6. Test matrisi

Yeni dosya önerisi `test/createapp-acilis-geri-alma-249.test.mjs` (CI'nin `test/**/*.test.mjs` deseninde; her `it` Linux ve Windows'ta
AYNI sayıda koşar — `{ skip }` YOK, Linux'a özgü sayım `openHandlesTo()` null ise atlanan bir assert'tir, db-bozuk-dosya-tutamak-248'deki gibi;
Linux/Windows test sayısı eşitliği kapısı). Her senaryoda iki ölçü: (a) **Linux** `/proc/self/fd` → dosyaya (ve `-wal`/`-shm`'e) bağlı tutamak
= 0, gc ÇAĞRILMADAN, düşen istekten hemen sonra; (b) **her platform** `rmSync(file)` (+ `-wal`, `-shm`) başarılı ve `existsSync` false — Windows'ta
asıl kanıt (ders 48). Sunucu `startTestServer({ maxCompanies: 2 })`, sahte saat, `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30).

| # | Senaryo | Nasıl zorla düşürülür | Beklenen (yeni kod) | Eski kodda (e3f74093, ayrı kopya) |
|---|---|---|---|---|
| T0 | `new DatabaseSync` kurucusu düşer (olmayan dizin) | doğrudan | tutamak 0 (Node davranışı ölçülür; değilse bulgu) | aynı (ürün kodu değil) |
| T1 | 002 users kök sayfası bozuk (gerçek bozulma) | sizinti-log.mjs "tablo-bozuk" yöntemi: checkpoint → rootpage'e 0xA5 | 3 istek 503 ×3; tutamak 0; rmSync geçer | tutamak 3 → KIRMIZI "002 açılamadıktan sonra 3 açık tutamak kaldı"; Windows'ta rmSync EPERM/EBUSY |
| T2 | T1 + Yedekten Geri Yükle | `/api/admin/backups/restore` | 200; sonra GET 200; "(deleted)" tutamak 0 | Linux: geri yükleme 200 ama "(deleted)" 4 → KIRMIZI; Windows: 500 "Veri dosyası değiştirilemedi" |
| T3 | Göç ortasında düşme | gerçek eski sürüm verisi (test/fixtures/surum-2.0.x-zincir — programın ürettiği) + göçün dokunduğu tablonun sayfası bozulur; ya da `__testOpenFault("after-migrations")` | 503; tutamak 0; user_version değişmedi; göç öncesi yedek var; düzelince açılır | tutamak ≥1 → KIRMIZI |
| T4 | Geç düşme, her aşama | `__testOpenFault(stage)` × 7 aşama (yalnız 002) | her aşamada: tutamak 0; `process.getActiveResourcesInfo()` Timeout/Immediate sayısı açılış öncesiyle AYNI (yetim zamanlayıcı yok); hub `whatsapp.scheduler`'da 002 kaydı yok; hub olay dinleyici sayısı aynı; 2 sn içinde günlükte "database is not open" yok; sonraki açılış (kanca kapalı) 200 | after-dataset ve sonrası: zamanlayıcı/kayıt kalır → KIRMIZI (kanca eski kodda yok → eski kopyaya yalnız kancanın 7 satırı eklenerek koşulur, ürün davranışı eski; ya da T4 kırmızısı mutasyonla gösterilir — §7) |
| T5 | Kilitli dosya | **AYRI SÜREÇ** `spawn(process.execPath, ["-e", …BEGIN EXCLUSIVE…])` (tools/m30-goc-kesinti-adim.mjs:122 emsali); test/fixtures/sqlite-kilit-isci.mjs (iş parçacığı, AYNI süreç) KULLANILMAZ — POSIX fd ertelemesi sayımı şişirir (§1 "kilit": 2) | 503 (~10 sn); tutucu bırakınca: tutamak 0; sonraki GET 200; closeCompany → 0 | tutamak 1 → KIRMIZI |
| T6 | Temizlik de düşer | `__testOpenFault` + `db.close`'u fırlatan sarmalayıcı (yalnız testte; ya da undo'ya fırlatan adım) | istemciye giden 503 iletisi asıl hatanın iletisi; günlükte uyarı | — (yeni davranış; mutasyon: rethrow kaldırılınca kırmızı) |
| T7 | Salt okunur lisans | test lisansı süresi dolmuş + T1 | T1 ile aynı; sağlam şirkette salt okunur yanıtlar değişmez | T1 gibi kırmızı |
| T8 | İki şirket | 002 T1; 001'e paralel istekler; sonra Şirket Sil (002) | 001 200; 001 tutamak sayısı değişmez; Şirket Sil 200 + arşiv klasörü taşındı (Windows'ta asıl kanıt) | Windows'ta silme/arşiv EBUSY |
| T9 | Tekrar | 002 T1, 10 istek + 10 sahte kanca bildirimi (whatsapp hook yolu) | tutamak 0 | 20 → KIRMIZI |
| T10 | Yeni şirket ilk açılışta düşer | boş klasör + `__testOpenFault("after-open")` | yeni dosya silinebilir; `company.opened.<id>` yok | tutamak 1 |
| T11 | Hub 001 düşer | doğrudan `createApp` + `__testOpenFault("after-integrity", "sirket-001")` | fırlatır; 001 dosyası (+ B1-b: iki defter) tutamak 0; aynı dataDir ile ikinci createApp açılır, kapanır; geçici klasör rmSync geçer | tutamak ≥1 |
| T12 | Sağlam açılış gerilemesi | — | var olan bütün testler; `app.close()` sonrası tutamak 0 | — |

**Komşu dar liste (bitişte, yeni kodda):** test/db-bozuk-dosya-tutamak-248, whatsapp-t-durum-karar-tablosu-248 (94), yedek-220-inceleme,
yedek-220, banka-210-ariza, guvenilirlik-221-ariza, guvenilirlik-221-bulgular, backup, supervisor, sirketler-217, sirket-ayir-221,
sirket-siniri-225, banka-210-gg-geri-yukle, whatsapp-dk8-bekletti-geri-yukleme-248, whatsapp-dk13-arka-plan-kilit-248, update-flow,
upgrade-identity; e2e `npm run test:senaryo-220-yedek` (geri yükleme ekranı). Tam `npm test` adayda (ders 41: yapısal değişiklik → adayda bir kez tam).

## 7. Testin dişi (ders 7, 38) ve eski kod

- Eski kod AYRI KOPYADA (ders 23, 25): `git archive e3f74093 | tar -x -C <not defteri>/b1-eski-e3f74093` (benzersiz ad); yeni test dosyası
  oraya kopyalanıp `node tools/kanit.mjs kos b1-eski -- node --test test/createapp-acilis-geri-alma-249.test.mjs` ile koşulur. Kırmızı ANCAK
  iletide beklenen neden görülürse sayılır: "N açık tutamak kaldı" (T1, T2, T3, T5, T9) — "test: açılış kesintisi" ya da başka bir assert değil.
  T4/T6/T10/T11 kancaya bağlıdır; eski kopyada kanca yoktur → bu hücreler eski kodda "kanca yok" diye değil, kancanın yalnız 7 satırı eski
  kopyaya yamanarak (ürün davranışı eski) kırmızı görülür; yama ayrı kopyada, depoya girmez.
- Mutasyonlar (yeni kodda, ayrı kopyada): (m1) `undo.push(() => db.close())` kaldır → T1/T3/T5 kırmızı; (m2) rethrow'u kaldır / catch'te
  başka hata fırlat → T6 kırmızı; (m3) `scheduler.unregister` adımını kaldır → T4 after-register kırmızı; (m4) `dataset.stop` kaldır → T4
  after-dataset kırmızı (Timeout sayısı). Yakalanmayan mutasyon = eksik test.
- Ara sıra kırmızı uyarısı (ders 20): eski kodda sızan bağlantı GC'de kapanabilir → kırmızı nadiren yeşil görünebilir; sayım düşen istekten
  hemen sonra alınır, testte `gc` çağrılmaz. Yeni kodda yeşil GC'den bağımsızdır (senkron close).
- Her koşu `tools/kanit.mjs kos`; ham çıktı `docs/kanit/<gün>/b1/` + ayrı "Kanıt:" commit'i.

## 8. Windows CI'de erken görülme planı (ders 18, 21, 48)

1. Test + düzeltme yazıldığı GÜN çalışma dalına itilir (ayrı iş dallarında CI yok; ci.yml push `branches: ["**"]`, yalnız belge değilse koşar).
   İsteğe bağlı ama önerilen: önce YALNIZ TEST commit'i → CI Windows Node 22/24'te T1/T2/T8 rmSync EPERM/EBUSY ile KIRMIZI (Windows'ta
   gerçek kırmızı kanıt; neden iletiden okunur) → sonra düzeltme commit'i. Bedeli bir 6 işlik CI (ders 26 — kod commit'i, belge değil).
2. Düzeltme commit'inde `node tools/kanit.mjs ci <sha> --bekle 90`: Linux + Windows × Node 22/24 + e2e; yeni testler Windows'ta İKİ koşuda
   (Node 22 + Node 24) yeşil görülmeden "Windows'ta düzeldi" yazılmaz. Linux/Windows test sayısı eşit, atlanan yok.
3. Dar kontrol (xhigh, yeni ajan, yalnız bu fark) — §5 listesi + yığına girmeyen kaynak var mı + T4 genel ölçünün dişi.

## 9. DENENMEYEN / DOĞRULANMADI (bu not)
- Windows'ta EBUSY/EPERM ve "Veri dosyası değiştirilemedi" 500: koddan; CI'de görülecek (§8.1).
- "kilit" senaryosundaki fazla 1 tutamağın kök nedeni (SQLite unix VFS fd ertelemesi) — ölçüldü, kaynak koddan doğrulanmadı.
- Geç düşmenin (integrity.start) gerçek bozuk veriyle hangi tabloda tetiklendiği; `new DatabaseSync` kurucu düşmesinde Node'un tutamağı (T0).
- Kapsam dışı, önceden var olan (dar kontrol notu): kilitte istek olay döngüsünü 10 sn tutar; 001 bozuksa applyStagedRestore user_version'da düşer.

## 10. ANA OTURUM ONAYI (03.11.2026 18:18 UTC) — kodlama bu bölümle birlikte okunur

ONAYLANDI: B1-a deseni, §5 bozulma listesi, §6 T0–T12, §7 testin dişi, §8 Windows planı. Netleştirmeler:
1. **db HER aşamada SENKRON kapanır (after-app dahil).** §4 kural 1'deki "app kurulunca yığını app.close() ile değiştir" seçeneği KULLANILMAZ:
   app.close() async'tir, db.close()'a ancak await'lerden sonra varır → çağıran hatayı aldığında dosya açık kalır (kural 2 ile çelişir) ve
   çift kapama riski doğar. Yığın açılışın sonuna kadar tek tek kaynaklarla sürer; 964–1079 arasında kurulan her kaynak da yığına girer.
   T4 "after-app": hata createApp'tan çıktığı anda tutamak 0 + 2 sn içinde günlükte "database is not open" yok.
2. **B1-b KAPSAMDA — BAŞ MİMAR KARARI** (iş listesine yazıldı): openUsageLedger ve openWaLedger kurulum düşerse kendi bağlantısını kapatır,
   asıl hatayı aynen fırlatır. Gerekçe: B1'in değişmezi "düşen createApp hiçbir dosyada tutamak bırakmaz" bu iki dosya olmadan sağlanmaz;
   aynı süreçte createApp'ı yeniden çağıran yollar var (tools/mutabakat.mjs:64, testler); yeni kural değil, aynı kusurun aynı yoldaki iki
   kopyası. T11'e bozuk defter dosyalı hücre eklenir (her iki defter; eski kodda tutamak ≥1 → kırmızı).
3. **Kırmızı-önce commit düzeni:** commit 1 = yeni test dosyası + yalnız `__testOpenFault` kanca satırları (davranış aynen) → ana oturum
   iter → CI'de Linux + Windows KIRMIZI, her hücrenin iletisinde beklenen neden okunur (ders 38). commit 2 = düzeltme (B1-a + B1-b).
   commit 3 = Kanıt. Ajan İTMEZ; itme ve CI okuma ana oturumda.
4. Windows rmSync deseni var olan emsalden (test/db-bozuk-dosya-tutamak-248.test.mjs); bekleme/yeniden deneme ile kırmızı gizlenmez.
5. Eski kod ayrı kopyada (git archive e3f74093 → benzersiz klasör, ders 23/25); o kopyada npm ci / npm install YOK (ders 29).
6. Kapsam yalnız §2 #1–#3 ve §3 kaynakları. openDatabase, closeCompany sözleşmesi, hata iletileri, başarılı açılış davranışı DEĞİŞMEZ.
   Yeni bulgu çıkarsa düzeltilmez, rapora yazılır.
