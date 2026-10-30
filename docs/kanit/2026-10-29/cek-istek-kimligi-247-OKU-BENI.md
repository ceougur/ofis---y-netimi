# Kanıt — çek / senet girişinde istek kimliği (2.4.7, M5 kâhininin yan bulgusu; ORTA)

Düzeltme commit'i `a1f848f4`; eski kod `6f4e31c6` (ayrı kopya, `git archive` → not defteri `cek-idem-247-eski-6f4e31c6`; ders 23/25).
Eski kodun ve mutasyonların kayıtlarında `commit` alanı boştur (kopya git deposu değil); kod `6f4e31c6` + aşağıdaki değişiklik.

| Kayıt | Kod | Sonuç | Not |
|---|---|---|---|
| `cek-istek-kimligi-247-eski-6f4e31c6` | eski | BAŞARISIZ 2/12 (çıkış 1) | Beklenen nedenler: "aynı istek ikinci evrak açtı: 2 evrak", farklı gövde 200, yarışta 2 evrak, biçimsiz kimlik 200, "taksit bir kez ödenmeli (ödenen 2000)", seri no'lu yinelemede 409 cheque-duplicate, silinmiş evrakın kimliği yeni evrak, iki kullanıcıda 3 evrak, yeniden başlatmada başka evrak, 001'de 2 evrak. Eski kodda yeşil kalan 2 test geriye uyum (kimliksiz istek serbest) ve "reddedilen istek kimlik bırakmaz" korumasıdır |
| `e2e-senaryo-224-cek-kimlik-eski-6f4e31c6` | eski | BAŞARISIZ 65/69 | Yalnız yeni adım 2c kırmızı: "(kimlik yok) · (kimlik yok)", "tek senet (2 senet)", bildirim "Evrak portföye alındı.", cari "₺1.300,00 Alacaklı" (beklenen 650,00) |
| `cek-istek-kimligi-247-mutasyon1-tekillestirme-yok` | M1 | BAŞARISIZ 2/12 | `requestId/scope/body` bank.post'tan kaldırıldı — yakalandı |
| `cek-istek-kimligi-247-mutasyon2-sirketsiz-anahtar` | M2 | BAŞARISIZ 11/12 | app.mjs `createIdempotency({ store: hub ? hub.store : store })` (bütün şirketlerin kimliği 001'de) — şirket testi yakaladı (002'de 404) |
| `cek-istek-kimligi-247-mutasyon3-yeni-kayitla-yanit` | M3 | BAŞARISIZ 4/12 | yinelemede yeni evrak yazılıp "replayed" diye döndürüldü — yakalandı |
| `cek-istek-kimligi-247-yeni` | a1f848f4 | GEÇTİ 12/12 | |
| `cek-ilgili-birim-247` | a1f848f4 | GEÇTİ 849/849 | çek ucuna dokunan 57 birim/API test dosyası |
| `kahin-cari-cek-247` | a1f848f4 | GEÇTİ 7408/7408 | `npm run test:kahin-cari` (7 bilinen sınır dahil) |
| `kahin-defter-cek-247` | a1f848f4 | GEÇTİ 176/176 | `npm run test:kahin-defter` |
| `kahin-mobil-yazma-cek-247` / `kahin-mobil-yazma-eski-6f4e31c6` | yeni / eski | İKİSİ DE 45/52 | Aynı 7 senaryo kırmızı (E02 havale/POS, E05 taksit, R1–R3) — çek düzeltmesinden ÖNCE de var, bu işin dışında. Tam fark listesi `cek-istek-kimligi-247-m5-kahin-tam-fark.txt`: yeni kod 19 kâhin farkını kapattı (R2 d2182, R3 d197: aynı kimlik + farklı gövdeyle masaüstü çek/senet → artık 409 request-id-reused; evrak sayısı, portföy, cari ve fatura açığı kâhinle aynı), YENİ fark 0 |
| `e2e-senaryo-224-cek-247`, `e2e-senaryo-ux18-244-cek-247`, `e2e-senaryo-banka-220-cek-247`, `e2e-senaryo-form-izolasyon-243-cek-247` | a1f848f4 | GEÇTİ 69/69, 27/27, 76/76, 183/183 | çek formuna dokunan e2e'ler (ders 28) |
| `npm-test-cek-247` | a1f848f4 | GEÇTİ 3806/3806 (çıkış 0) | tam `npm test`, bir kez (0 başarısız, 0 iptal, 0 atlanan) |

Komutlar: `node tools/kanit.mjs kos <ad> -- node --disable-warning=ExperimentalWarning --test test/cek-istek-kimligi-247.test.mjs` (eski kod ve mutasyonlarda kopyanın
kökünden, `KANIT_DIR=<bu depo>/docs/kanit`); e2e `PLAYWRIGHT_BROWSERS_PATH=… HUKUK_LICENSE_URL=http://127.0.0.1:9 node tools/kanit.mjs kos <ad> -- npm run test:senaryo-224`;
M5 kâhininin eski kodla koşusu `KAHIN_PROGRAM_KOKU=<eski kopya> npm run test:kahin-mobil-yazma`.
