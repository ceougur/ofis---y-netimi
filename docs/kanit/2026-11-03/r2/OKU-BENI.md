# 2.4.9 R2 — kanıt (taksit kartının iade kesintisi her forAccount çağrısında bütün iadeleri tarıyordu; ders 47)

Kod: eski = `git archive e6ee52a8` (not defterinde ayrı kopya `r2-249-aa56/eski-e6ee52a8`, ders 23/25; node_modules sembolik bağ, npm komutu yok), yeni = 7839d2a7
(yalnız `server/routes/plans.mjs` returnCuts: tarama kuralı aynen `scanReturnCuts`; sonuç `total_changes()|data_version` damgasıyla saklanır, işlem içinde eski yol).
Test: 44ebb5b4 `test/iade-kesinti-tarama-249.test.mjs`. Bütün koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9`; düzenek test/isz-248/ortak.mjs + test/whatsapp-248-ortak.mjs
(sahte Meta / lisans / kapıcı yerel). Ağır koşular `flock /tmp/destekofis-olcum.lock` altında tek tek; makine paylaşımlı — yük her ölçüm dosyasının `.uptime`'ında.

| dosya | ne |
|---|---|
| eski-e6ee52a8-iade-kesinti-tarama-249.* | yeni test ESKİ kodda: 3/4, YAPI hücresi beklenen nedenle KIRMIZI — "iade faturaları cari başına yeniden taranıyor: {elleTumune 16, elleSecili 16, onizleme 16, kartDongusu 32} (cari 16; beklenen her istekte ≤ 1)"; eşdeğerlik ve bayatlık hücreleri eski kodda yeşil (kural aynı) |
| yeni-iade-kesinti-tarama-249.*, …-Istanbul.* | yeni kodda 4/4 (UTC ve Europe/Istanbul); tarama {0, 1, 1, 0} |
| mutasyon-M1-M7.* | test/r2-249/mutasyon.mjs — yeni kodun ayrı kopyasında (git archive 7839d2a7) 7/7 mutasyon KIRMIZI, beklenen hücre ve iletiyle (önbellek okunmaz; işlem içinde saklanır; damgada data_version / total_changes yok; kesinti yanlış karta; iptal/taslak iade sayılır; damga hiç değişmez) |
| esitlik/ | büyük veri eski ↔ yeni eşdeğerliği (aşağıda) |
| olcum/ | önce/sonra ölçüm (aşağıda); `sql-suzme-deneme.txt` = tasarımda elenen SQL süzme seçeneğinin ölçümü |
| hazirlik/ | verinin hazırlığı (programın API'siyle), özetler ve yük |
| komsu-dar-UTC.* | 57 komşu test dosyası (rg returnCuts / coverCuts / sale_return / coversBalance / ledgerPlansByAccount / forAccount / waFacts + WhatsApp alıcı / önizleme + plan / cari / mizan + kaynak tarayan: lisans-servisi-izolasyonu, platform-tasinabilirlik, yazim-duzeni, banka-210-post-statik) 759/759 |
| kaynak-tarayan-son.* | kaynak tarayan 4 dosya son ağaçta (test/r2-249 betikleri dahil) 23/23 |
| kahin-cari.* | bağımsız cari kâhini (`test/bagimsiz/cari/kos.mjs` = `npm run test:kahin-cari`) 7408/7408 |

## Veri (programın kendi API'siyle; SQL yazımı yok)
- `hazir-iade` = B2'nin R2 kopyası yeniden üretildi (B2'ninki silinmişti): `test/b2-249/ek-hazirla.mjs <hazir-taban> … iade` eski kodla → 4.021 cari, 1.030 iade (1.001 coverCuts'lı), 1.310 kartlı cari.
- `hazir-cesit` = hazir-iade + `test/r2-249/cesit-hazirla.mjs` (saat akar): iade iptali 50, silme 50, düzenleme 2→1 50, kart taşıma 30, kart silme 20, yeni 200 cari iki kapsayan kart
  (tam iade → tek belgede iki kart / kısmi / iki kısmi / taslak), 20 cari iade → iptal → yeniden iade. Sonuç 4.271 cari, 1.270 iade (1.147 kesin, 73 iptal, 50 taslak), 1.021 coverCuts'lı,
  101 iki kartlı belge, 1.935 etkin + 37 silinmiş kart, 1.510 kartlı cari. Reddedilen istek 0.
- Eski / bozuk biçimli payment_json (bozuk JSON, metin tutar, \u kaçışlı anahtar, null / dizi / metin coverCuts, büyük harfli alan, yinelenen anahtar), başka bağlantının yazması ve geri alınan
  işlem büyük veride değil kalıcı testte (BAYATLIK hücresi) denenir.

## Eşdeğerlik (esitlik/; test/r2-249/esitlik-kos.mjs + esitlik-karsilastir.mjs; JSON'lar not defterinde `r2-249-aa56/esitlik/`, sha256 aşağıda)
Bütün cariler (silinmişler dahil): forAccount, kart kesintileri, mizan girdisi (ledgerPlansByAccount), accounts.detail, accounts.waFacts, HTTP cari kartı (GET /accounts/:id),
elle alıcı listesi (ilk 2.000, son 2.000, Tümüne ekstre, Tümüne mesaj), otomatik önizleme (son 2.000 ekstre, tümü hatırlatma).
- karsilastir-iade-UTC: 14/14, fark 0 — 4.036 cari, 1.535 kart, 1.002 kesintili.
- karsilastir-cesit-UTC: 14/14, fark 0 — 4.286 cari, 1.935 kart, 1.102 kesintili. karsilastir-cesit-Istanbul (TZ=Europe/Istanbul): 14/14, fark 0.
- karsilastir-dis: karşılaştırıcının dişi — yeni çıktıda bir kartın kesintisi +0,01 bozuldu → forAccount ve kesintilerde tam 1 fark bulundu, öbür bölümler aynı.
- gecersiz-ilk/: ilk zincir — eski koşuda HTTP bölümü, eşzamanlı döngülerin (~140 sn) ardından keep-alive bağlantısında ECONNRESET aldı (test düzeneği); bölüm sırası değişti, zincir baştan koşuldu.
sha256: eski-iade-UTC fcbac6f0…, yeni-iade-UTC 8f6e9d4c…, eski-cesit-UTC 997dd2b8…, yeni-cesit-UTC a01fe7f3…, eski-cesit-Europe_Istanbul 75aac3cd…, yeni-cesit-Europe_Istanbul 4027de9f…,
yeni-cesit-UTC-dis c7d46906….

## Ölçüm (olcum/; test/b2-249/olcum.mjs iade kümesi + test/r2-249/olcum-ek.mjs; tablo test/r2-249/olcum-tablo.mjs → olcum-tablo.*)
Aynı hazir-iade'nin taze kopyası, saat 03.11.2026 15:00 sabit, 2 tekrar; hücre = süre / olay döngüsü en çok / başka kullanıcı en çok (ms). Yük (load average 1 dk) ~4,6–5,1 (paylaşımlı makine).

| ölçüm | kişi | eski e6ee52a8 | yeni 7839d2a7 | bütçe |
|---|---|---|---|---|
| elle alıcı listesi, ilk 2.000 (B2 olcum.mjs) | 2.000 | 10.876/10.593/10.656 ; 12.304/11.843/12.075 | 1.386/945/1.141 ; 1.295/1.016/1.075 | ≤ 2.000 |
| elle alıcı listesi, Tümüne ekstre | 4.021 | 21.296/21.002/21.047 ; 21.305/21.023/21.076 | 1.850/1.550/1.609 ; 2.021/1.633/1.784 | ≤ 3.000 |
| elle alıcı listesi, son 2.000 (iade carileri) | 2.000 | 10.349/9.980/10.133 ; 10.352/10.021/10.139 | 804/555/589 ; 787/519/619 | ≤ 2.000 |
| otomatik önizleme, son 2.000 | 2.000 | 9.960/9.710/9.757 ; 10.288/10.056/10.085 | 765/524/563 ; 641/426/438 | ≤ 2.000 |
| otomatik önizleme, tümü | 4.014 | 18.106/17.825/17.887 ; 19.303/18.997/19.097 | 1.288/1.033/1.080 ; 1.461/1.211/1.257 | ≤ 3.000 |
| cari kartı, 200 tek istek (bilgi) | 200 | istek p50 36,6 / 35,8 ms, en çok 381 ms | istek p50 30,2 / 28,5 ms, en çok 396 / 393 ms | — |

SQL'de kart kimliğiyle süzme (elenen seçenek; sql-suzme-deneme.txt, yük ~5): çağrı başına 1,79 ms (tam tarama + ayrıştırma 3,64 ms); ilk denemede (yük ~3,6) 1,56 / 2,64 ms.
1.310 kartlı caride ~2,0–2,3 sn → bütçeye sığmaz.

Yeniden koşmak: test/r2-249/esitlik-zincir.sh (+ esitlik-dis.sh), olcum-zincir.sh, komsu-zincir.sh — yol değişkenleri baştadır.
