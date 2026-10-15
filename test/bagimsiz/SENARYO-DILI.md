# Bağımsız Senaryo Dili ve Çıktı Biçimi

Dil sürümü: **`destekofis-senaryo/4`** · Yazıldığı gün: 10.10.2026 (sürüm 2: aynı gün; sürüm 3: 12.10.2026; sürüm 4: 15.10.2026) ·
Kapsam: 2.1.0 (Banka İlk Teslim) içinden, **döviz, POS ve ekstre/mutabakat HARİÇ** işlemler; sürüm 3 ile çek/senet portföyü ve Bankaya
Tahsile Ver (plan §3.11a, §3.14), sürüm 4 ile **Şüpheli Ticari Alacaklar (plan §3.11b) ve K8 taksit kuralları (plan §3.10/3)** kapsama girdi.

### Sürüm 4 değişiklikleri (15.10.2026)

Sürüm 3'teki kurallar aşağıdakiler dışında aynen geçerlidir. Sürüm 2 ve 3 senaryoları (`"dil": "destekofis-senaryo/2"` / `/3`)
değiştirilmeden sürüm 4 kurallarıyla koşulur; sürüm 4 yalnız ekler (K8 taksit kuralı sürüm 3'te "senaryo kurmaz" olan durumları
tanımlar; sürüm 3 senaryosu o durumları zaten kurmaz). Şüpheli alacak işlemleri (§4.39–4.42) ve `fazlaAvans` yalnız `"dil":
"destekofis-senaryo/4"` senaryosunda yazılır.

Kaynaklar (temiz oda; §0): `docs/BANKA-MODULU-PLAN.md` **§3.11b (Şüpheli Ticari Alacaklar)** ve **§3.10/3 (K8 taksit)**; ayrıca
`docs/2.3.0-SUPHELI-KABUL.md` §1 K1–K12 (planın susan yerlerini yaygın uygulamayla dolduran, programın kodu yazılmadan plandan türetilmiş
kurallar) ve §2 (kabul sayıları). **Yeni dayanak etiketi:** **[KABUL Kn]** — kural planda açıkça yazılı değil, kabul belgesinin K-n kuralından
alındı; kabul belgesi program ekibinin elinden çıktığı için program kâhinden farklı çıkarsa fark **İNCELE**'dir (ÇIKARIM gibi), BULGU değil.
Yalnız planın açık sözüne dayanan kurallar [PLAN §3.11b] etiketini taşır ve fark BULGU'dur.

| # | Yer | Değişiklik | Dayanak |
|---|---|---|---|
| F1 | §4.39–4.42 (yeni) | Şüpheli alacak işlemleri: Şüpheli Alacağa Al, Karşılık Ayır, Şüpheliden Çıkar, Değersiz Alacak Yaz. Yeni takma ad türü: **supheli** (kayıt) | [PLAN §3.11b/2–3] |
| F2 | §4 gösterim, §7, §8.3 | Carinin bakiyesi 120 **ve 128**'deki satırlarının toplamıdır ("Cari bakiyesi DEĞİŞMEZ"); carinin alacak satırı önce şüpheli tutardan düşer (A 120 yerine A 128); 644 kuralı; Değersiz Alacak cari bakiyesini kapatır | [PLAN §3.11b/2–3 (644 kuralı 15.10.2026 kararıyla planın açık sözü); KABUL K3, K7] |
| F3 | §4.17 | K8: kalan 0 → 409 `plan-paid`; kalanı aşan tutar → 409 `plan-overpay`; `fazlaAvans: true` (programda `overpay:true`) yalnız yetkiliye (403 `plan-overpay-permission`); fazlası kartta extra, caride alacak | [PLAN §3.10/3] |
| F4 | §4.28 | `sil` hedefleri: şüpheli kaydı ve karşılık (ters kayıtla defterden düşer) | [PLAN §3.11b/4 "Silinenler (geri alma ters kayıtla)"] |
| F5 | §5.5, §5.6, §5.7 | Şüpheli işlemlerinin yetkisi, ret önceliği ve ret kodları (`doubtful-*`, `date-before-record`, `plan-*`) | [PLAN §3.11b/4; §3.10/3; KABUL K8, F, G, U, W] |
| F6 | §8.1, §8.3 | Yeni çıktı alanı **`supheliAlacaklar`** (kayıt başına tutar, karşılık, tahsil edilen, değersiz, çıkarılan, kalan, durum) | [PLAN §3.11b/5 rapor sütunları] |
| F7 | §11 | Hesap planına 128, 129, 644, 654 (659 zaten vardı) | [PLAN §3.11b/2–3] |
| F8 | §12, §13 | BELİRSİZ-33 … 38; §13/10 geçerlilik kuralları | Plan susuyor |

**Sürüm 4 eki (15.10.2026, ürün sahibi kararı; plan §3.11b/2 "Tahsilatta seçim" ve §3.11b/3 644 kuralı planın açık sözü oldu):**

| # | Yer | Değişiklik | Dayanak |
|---|---|---|---|
| F9 | §4.15 | `cari_tahsilat`'a seçimli **`normalCari: true`**: satır şüpheliden düşmez, `A 120` kalır ("Normal Cari Hesaba İşle"). Yalnız dil sürüm 4; şüpheli kaydı olmayan caride de yazılabilir (etkisiz) | [PLAN §3.11b/2 (a)] |
| F10 | §4.42a | Alacak satırı kapsamı planın sözüyle: `kapatilacakFatura` bağlı `cari_tahsilat`, satış faturasının **peşin satırı** ve `normalCari` tahsilatı DÜŞMEZ (A 120); `taksit_tahsilat` yalnız kartın tarihi ≤ kayıt tarihi olan kayıtlardan düşer | [PLAN §3.11b/2 (a)–(c)] |
| F11 | §4.42a, F2 | 644 kuralı artık planın açık sözü: K6 etiketi **[PLAN §3.11b/3]** oldu; programla fark **BULGU** (önceden [KABUL K6] → İNCELE) | [PLAN §3.11b/3 (15.10 kararı)] |
| F12 | §12 BELİRSİZ-38 | Peşin satırı ve bağlı tahsilat tanımlandı → listeden çıktı; alıştan iade geri ödemesi ve müşteri carisine alış faturası belirsiz kalır | [PLAN §3.11b/2 (b)] |
| F13 | §4.15, §5.6, §5.7 | Açık şüpheli kaydı olan caride `normalCari` ya da `kapatilacakFatura` bağlı tahsilat carinin 120 bakiyesini (= cari bakiyesi − açık kayıtların kalanı) aşarsa **409 `doubtful-normal-exceeds`** (grup 4; hiçbir şey yazılmaz). Açık kayıt yoksa sınır yok | [PLAN §3.11b/2 (a) "Sınır"] |

### Sürüm 3 değişiklikleri (12.10.2026)

Sürüm 2'deki kurallar aşağıdakiler dışında aynen geçerlidir. Sürüm 2 senaryoları (`"dil": "destekofis-senaryo/2"`) değiştirilmeden
sürüm 3 kurallarıyla koşulur (sürüm 3 yalnız ekler; sürüm 2 senaryosunun sonucu değişmez). Evrak işlemleri (§4.30–4.38) yalnız
`"dil": "destekofis-senaryo/3"` senaryosunda yazılır. Kaynak yine yalnız plan (temiz oda; §0): `docs/BANKA-MODULU-PLAN.md` §2.3, §3.5/6,
§3.7 #9 ve #21, §3.11 madde 5, **§3.11a (senetler 121/321)**, §3.11b/1 ve **§3.14 (Bankaya Tahsile Ver)**.

| # | Yer | Değişiklik | Dayanak |
|---|---|---|---|
| E1 | §4.30–4.38 (yeni) | Evrak işlemleri: alınan/verilen çek ve senet, ciro, tahsil, ödeme, karşılıksız, Bankaya Tahsile Ver, Bankadan Geri Al, evrak silme. Yeni takma ad türü: **evrak** | [PLAN §2.3 "kind … receive, issue, collect, endorse, pay, bounce"; §3.14] |
| E2 | §8.2, §11 | Hesap planına 101.01 · 101.02 · 103 · 121.01 · 121.02 · 321. 101 ve 121 alt hesaplıdır (yalnız alt hesaplarıyla yazılır); 103 ve 321 üç haneyle | [PLAN §3.11 "101.01 Portföydeki Çekler, 101.02 Tahsile Verilen Çekler"; §3.11a tablo] |
| E3 | §7, §12 | Evrak satırı olan carinin fatura açıkları karşılaştırılmaz (BELİRSİZ-27); cari değişmezine evrak terimi eklendi | Plan susuyor (evrakın fatura kapamaya etkisi yazılı değil) |
| E4 | §5.5, §5.6, §5.7 | Evrak işlemlerinin yetkisi, ret önceliği ve ret kodları (`cheque-deposited` dahil) | [PLAN §3.14 "409 `cheque-deposited`"; §9.1'de çek yetkisi yok → BELİRSİZ-18] |
| E5 | §12 | Yeni BELİRSİZ-27 … 32 | Plan susuyor |

### Sürüm 2 değişiklikleri (10.10.2026)

Sürüm 1'deki kurallar aşağıdakiler dışında aynen geçerlidir. Her madde dayanağını taşır; **[KARAR]** = baş mimarın 10.10.2026
kararı (plan susuyordu ya da plan sözcüğü yoruma açıktı; karar programın kodundan değil, yaygın uygulamadan ve plandan verildi).

| # | Yer | Sürüm 1 | Sürüm 2 | Dayanak |
|---|---|---|---|---|
| D1 | §7 kural 5–7, §12 BELİRSİZ-7/9 | Geri ödenmemiş iadenin asıl faturayı aşan kısmı iade belgesinin açığı; iade + bağsız satır → BELİRSİZ-9 | Aşan kısım ("artan") aynı carinin aynı yöndeki (asıl faturayla aynı türdeki) en eski açık belgesini kapatır (otomatik en eskiden kapama, yeni kural 6); kapatamadığı kalan iade belgesinin açığıdır. Bağsız satırların dağıtımı kural 7 oldu. BELİRSİZ-9 kalktı (sıra artık tanımlı; durum BELİRSİZ-11 ile zaten kapsanıyor); BELİRSİZ-7 iade artanını da kapsar | [KARAR] |
| D2 | §3.2, §5.3, §10 | `yineDeKaydet` → `cashForce` | Aynı; ayrıca açıkça: koşucu yalnız `cashForce:true` gönderir; `cashForce` banka ve kart hesabının "Uyar"ını da geçer. Ret kodu banka/kart hesabında da `cash-negative` / `cash-blocked` (+ `accountId`) | [KARAR] + [ÇIKARIM §7] |
| D3 | §5.2, §4.16, §4.13 | (değişmedi) kartla ödeme kart hesabına (309.NN) | Aynı; karar olarak teyit: cari ödeme, alış peşini (stok alımı dahil) kart hesabına bağlanır; kart limiti kadar eksiye serbest | [KARAR] + [PLAN §3.5, §3.11] |
| D4 | §5.4, §8.3 | "ad'ı önceki adımın hareketini anar" (iki okumaya açıktı) | Yinelenen adımın her takma adı (`ad`, `odeme.taksit.ad`, `banka_masraf.fatura`) önceki adımın varlığını anar **ve çıktı haritalarında ikinci ad olarak aynı değerle yer alır**. İç içe ad tanımları gövdeye girmez | [ÇIKARIM §5.4 + §8.3] |
| D5 | §4.4, §4.7 | `kmhLimiti` vadesiz/ticari/diğer; eksi açılış bu türlerde | `kmhLimiti` ve eksi açılış **yalnız vadesiz** hesapta; öbür türde 4xx | [ÇIKARIM §3.5 tablo "Vadesiz … KMH Limiti alanı var" (yalnız bu satırda); §3.7 #1 "KMH'de eksi açılış ters"] |
| D6 | §4.20, §4.23, §4.22, §4.24–4.26 | "102 türü hesap" (vadeli dahil) | Vadeli hesapta banka masrafı ve diğer gelir/gider → 400 `bank-account-invalid`; vadeli hesapta faiz gideri, kart borcu kaynağı, kredi hedefi/kaynağı → [BELİRSİZ-24] | [ÇIKARIM §3.5 "Vadeli … Hayır; yalnız transfer ve faiz"] |
| D7 | §4.26, §4.27 | kredi anaparası sınırsız | Anaparanın kredinin o anki borcunu aşması ve kredi hesabını borç bakiyesine çeviren ters kayıt → [BELİRSİZ-25] | Plan susuyor |

---

## 0. Bu belge ne, nasıl yazıldı

**Amaç.** Programdan bağımsız bir muhasebe kâhini (model) ile programı süren koşucunun (API ya da ekran) **aynı senaryoyu** okuyup
**aynı biçimde** sonuç üretmesi. İki sonuç alan alan karşılaştırılır. Kâhin programın kodunu görmeden, yalnız bu belgedeki
kurallarla yazılır; böylece program ile kâhin aynı yanlış varsayımı paylaşamaz.

**Temiz oda.** Bu belge YALNIZ şu iki kaynak okunarak yazıldı:
- `docs/BANKA-MODULU-PLAN.md` (Sürüm 3)
- `docs/BANKA-MODULU-TALIMAT.md`

Programın kodu (`server/`, `client/`, `tools/`, `test/`), git geçmişi, `docs/*KANIT*.md` ve `docs/*ESLEME*.md` okunmadı. Kâhini
yazacak kişi ya da ajan da aynı kurala uyar: kaynağı bu belge + plan + talimattır. Bu belgede bir kural eksik ya da yanlışsa
programın koduna bakılarak değil, plana bakılarak düzeltilir; düzeltme dil sürümünü artırır (sürüm 1 → 2: yukarıdaki tablo; sonraki `destekofis-senaryo/3`).

**Üç el, üç karşılaştırma.**
1. **Plan sayıları** (`kontrol` adımlarındaki `planBeklenen`): planda yazılı sayılar.
2. **Kâhin**: bu belgenin kurallarıyla ayrı dilde (öneri: Python, yalnız standart kütüphane) yazılmış model.
3. **Program**: koşucunun programdan okuduğu sonuç.

Önce kâhin plan sayılarıyla karşılaştırılır; tutmazsa hata kâhindedir (ya da plan kendi içinde çelişiyordur) ve program
karşılaştırmasına geçilmez. Sonra program kâhinle karşılaştırılır.

**Neden "ajanların birbirini onaylaması" değil.** İki ajan aynı yanlış varsayımı taşıyabilir; bu düzen bunu üç yoldan keser:
(1) kâhinin kuralları programın kodundan değil plandan gelir ve her kural dayanağını (plan satırı ya da "yaygın uygulama") taşır;
(2) kâhin, programa bakılmadan önce planın kendi sayılarına (`planBeklenen`) karşı sınanır; (3) girdi (senaryo JSON) ve çıktı (kâhin
JSON) dosyadır, deterministiktir ve depoda durur — aynı komutla herkes yeniden üretebilir; sonuç bir ajanın "geçti" sözüne değil,
dosyaların alan alan karşılaştırmasına dayanır.

**Kâhin için uygulama sözleşmesi.** Ayrı dil (öneri Python 3, yalnız standart kütüphane, `python3 -I`); yalnız tamsayı kuruş
(kayan nokta yok); ağ ve saat kullanmaz (bugün = senaryodaki `bugun`); aynı senaryoya her koşuda bayt bayt aynı çıktıyı verir;
programın hiçbir dosyasını içe aktarmaz ve okumaz.

---

## 1. Dayanak etiketleri ve fark sınıfları

Belgedeki her kural şu etiketlerden birini taşır:

| Etiket | Anlamı | Program kâhinden farklı çıkarsa |
|---|---|---|
| **[PLAN §x]** | Planın açık kuralı ya da sayısı; satır alıntılanır | **BULGU** (program hatası ya da bildirilmemiş plan değişikliği) |
| **[ÇIKARIM §x]** | Planın örneğinden ya da tablosundan çıkarılmış; dayandığı satır alıntılanır | **İNCELE** (önce planın niyeti netleşir) |
| **[YAYGIN]** | Plan susuyor; yaygın muhasebe/ERP uygulaması seçildi | **İNCELE** |
| **[BELİRSİZ-n]** | Kâhin karar vermez (§12'deki liste) | Senaryo bu durumu kurmaz ya da ilgili alan karşılaştırılmaz |

Karşılaştırıcı her farkı, farka yol açan adımların işlem türüyle birlikte yazar; sınıfı (BULGU / İNCELE) o işlemin bu belgedeki
etiketinden okunur.

---

## 2. Dosyalar

| Dosya | Yazan | İçerik |
|---|---|---|
| `test/bagimsiz/SENARYO-DILI.md` | bu belge | dil ve çıktı biçimi |
| `test/bagimsiz/senaryolar/<ad>.json` | senaryo yazarı | senaryo |
| `test/bagimsiz/senaryolar/<ad>.beklenen.json` | elle, plandan (varsa) | tam beklenen çıktı |
| `<ad>.kahin.json` (öneri) | kâhin | kâhin çıktısı |
| `<ad>.program.json` (öneri) | koşucu | programdan okunan çıktı |

Bütün dosyalar UTF-8, JSON. Kâhin ve koşucu çıktısı anahtarları sıralı (`sort_keys`) ve iki boşluk girintiyle yazılır ki fark
dosyası okunabilsin.

---

## 3. Senaryo dosyası

### 3.1 Üst düzey

```json
{
  "dil": "destekofis-senaryo/3",
  "ad": "kabul-1-16",
  "aciklama": "…",
  "dayanak": "PLAN §12.5 adım 1–16",
  "baslangic": {
    "bugun": "08.10.2026",
    "sirket": "bos",
    "ayarlar": { "kasaEksiBakiye": "uyar", "benzerIslemUyarisi": "acik" },
    "kullanicilar": { "Y": "yonetici", "M1": "muhasebe", "P1": "personel" }
  },
  "adimlar": [ ]
}
```

| Alan | Zorunlu | Anlamı |
|---|---|---|
| `dil` | evet | `"destekofis-senaryo/4"`, `"destekofis-senaryo/3"` ya da `"destekofis-senaryo/2"`. Başka değerde kâhin ve koşucu çalışmaz (sürüm 1 senaryoları yalnız `dil` değiştirilerek sürüm 2 kurallarıyla koşulur; sürüm 2 ve 3 senaryoları sürüm 4 kurallarıyla aynen koşulur; evrak işlemleri sürüm 3'ten, şüpheli alacak işlemleri ve `fazlaAvans` sürüm 4'ten itibaren yazılır). |
| `ad` | evet | Dosya adıyla aynı (`kabul-1-16`). |
| `baslangic.bugun` | evet | Sahte saatin başlangıç günü (`gg.aa.yyyy`). [PLAN §12.5 "sahte saat 08.10.2026 Perşembe (sunucu `config.now` + Playwright `page.clock`)"] |
| `baslangic.sirket` | evet | Yalnız `"bos"`: yeni, boş şirket (hesap, cari, ürün, hareket yok; dönem kilidi yok). |
| `baslangic.ayarlar.kasaEksiBakiye` | Kasa'dan çıkış içeren senaryoda **zorunlu** | `uyar` · `engelle` · `kontrol_yok`. Koşucu programın Nakit Kasa eksi bakiye ayarını buna getirir. [BELİRSİZ-1] |
| `baslangic.ayarlar.benzerIslemUyarisi` | hayır | `acik` (varsayılan) · `kapali`. [PLAN §8.11 "Benzer İşlem Uyarısı · **Açık** …"] |
| `baslangic.kullanicilar` | hayır | takma kullanıcı → rol. `Y` her zaman vardır ve rolü `yonetici`dir. §3.4 |
| `adimlar` | evet | Sırayla uygulanan işlemler (§4). |

### 3.2 Adım ortak alanları

| Alan | Zorunlu | Anlamı |
|---|---|---|
| `id` | evet | Senaryoda tekil; `^[a-z0-9][a-z0-9-]{0,31}$` (ör. `"9-12"`, `"k6"`). Çıktılar adımı bununla anar. |
| `islem` | evet | §4'teki işlem adlarından biri. |
| `tarih` | hayır | İşlemin tarihi (`gg.aa.yyyy`). Yoksa o anki `bugun`. Deftere yazmayan işlemlerde (`hesap_ac`, `cari_ac`, `urun_ac`, `stok_giris`, ayarlar) kullanılmaz; `hesap_ac`'ın defter tarihi `acilisTarihi`dir. |
| `kullanici` | hayır | `baslangic.kullanicilar` anahtarı; yoksa `Y`. |
| `ad` | işleme göre | Bu adımın oluşturduğu varlığın ya da hareketin takma adı (§3.3). Sonraki adımlar bu adla anar. |
| `istekKimligi` | hayır | İstek kimliği (§5.4). Koşucu programa istek kimliği olarak gönderir ([PLAN §7 "Yazan her uç `x-hof-request` alır"]). |
| `benzerOnay` | hayır | `true` ise Benzer İşlem uyarısı geçilir (programda `similarOk:true`). [PLAN §3.10/2] |
| `yineDeKaydet` | hayır | `true` ise eksi bakiye "Uyar" sorusu geçilir (programda "Yine de Kaydet", `cashForce`). Koşucu yalnız `cashForce:true` gönderir; bu Kasa'nın, banka hesabının ve kurumsal kartın "Uyar"ını birlikte geçer (`negativeOk` gönderilmez; programda `negativeOk:false` açıkça gönderilirse banka/kart Uyar'ı geçilmez) [PLAN §3.9; KARAR D2] |
| `ayniAnda` | hayır | Eşzamanlı grup adı (§5.8). |
| `not` | hayır | Serbest açıklama; kâhin ve koşucu yok sayar. |

### 3.3 Değer biçimleri

- **Takma ad:** `^[A-Z][A-Z0-9_]{0,15}$` (ör. `ZIR`, `ABC`, `F1`, `TH1`). Hesap, cari, ürün, fatura (iade dahil), taksit kartı,
  hareket, evrak (çek/senet, sürüm 3) ve şüpheli alacak kaydı (sürüm 4) için **tek ad alanı** vardır; aynı ad iki kez tanımlanamaz. Koşucu takma ad ↔ program kimliği tablosunu kendisi tutar;
  çıktıya hep takma adla yazar.
- **Tutar:** metin, `^[0-9]{1,13}(,[0-9]{1,2})?$`. Ondalık ayırıcı virgül, binlik ayırıcı yok, işaret yok. `"20000"`,
  `"20000,00"`, `"10,5"` (= 10,50 TL) geçerli; `"1.234,56"`, `"1234.56"`, `"-5"` senaryo hatasıdır. Kuruşa çevirme: tam kısım × 100
  + ondalık (tek hane ise ×10). Geçerli aralık 0 < tutar ≤ 1.000.000.000.000,00 TL. [PLAN §9.2/9 "Tutar `parseMinor`: 0 < tutar ≤
  1e12 TL, en çok 2 ondalık"; §2.1 "Bir uçtan girilebilecek en büyük tutar 1e12 TL"]
  - İstisna: `hesap_ac` ve `acilis_duzelt`'te vadesiz/ticari/diğer hesabın `acilisBakiyesi` başında `-` taşıyabilir (KMH ile eksi
    açılış). [PLAN §3.7 #1 "KMH'de eksi açılış ters"]
- **Ham tutar (bozma testi):** Herhangi bir tutar alanı yerine `<alan>Ham` (metin) yazılabilir (`tutarHam`, `birimFiyatHam`,
  `acilisBakiyesiHam`, `brutHam` …); değeri biçim denetiminden geçmez ve koşucu onu olduğu gibi gönderir. Kâhinin davranışı §6.2'de.
- **Yüzde oranı:** KDV oranı tamsayı `1`, `10` ya da `20`. Diğer oranlar (stopaj, iskonto) metin `^[0-9]{1,3}(,[0-9]{1,2})?$`
  ve baz puana çevrilir: `"15"` → 1500, `"2,5"` → 250, `"10"` → 1000.
- **Tarih:** `gg.aa.yyyy`, geçerli takvim günü.
- **Miktar:** tamsayı ≥ 1 (Adet). Ondalık miktar bu dil sürümünde yoktur.

### 3.4 Kullanıcılar ve roller

Roller: `yonetici` (programdaki admin), `muhasebe`, `personel`. [PLAN §9.1 varsayılan roller "admin, avukat, muhasebe"; kabul adım
36 "Personel"]. Koşucu her takma kullanıcı için o rolde ayrı bir kullanıcı açar ve adımı o kullanıcının oturumuyla yapar. Yetki
sonuçları §5.5'te.

---

## 4. İşlem kataloğu

**Gösterim.**
- `B x T` = x hesabına T tutarında borç satırı; `A x T` = alacak satırı. Her satır işlemin tarihini taşır (aksi yazılmadıkça).
- `c(X)` = X carisinin hesabı: müşteri → **120**, tedarikçi → **320**. [ÇIKARIM §3.7 #2 "B 102.01 20.000 / A 120" (ABC müşteri),
  #3 "B 320 / A 102.01"; §11.1 A3 "Tür değişikliği … 120/320/336 sınıfını kaydırıyor" → hesap carinin türünden gelir]
  - (sürüm 4) Müşteri carisinin **bakiyesi** 120'deki ve **128 Şüpheli Ticari Alacaklar**'daki (o cariye bağlı) satırlarının işaretli
    toplamıdır; "Şüpheli Alacağa Al" (B 128 / A 120) bakiyeyi değiştirmez [PLAN §3.11b/2 "Cari bakiyesi DEĞİŞMEZ"]. Carinin **alacak
    satırı** (`A c(X)` yazan her satır: tahsilat, taksit tahsilatı, satıştan iade, alınan evrak …) şüpheli kaydı varken §4.42a kuralıyla
    önce 128'e yazılır. Bu belgedeki `A c(X)` gösterimi bu kuralı kapsar; işlem tablolarında ayrıca yazılmaz.
- `b(H)` = H banka hesabının alt hesabı (`102.NN`, `309.NN`, `300.NN`; §4.4).
- `p(yol, H)` = para hesabı (§5.2): nakit → **100**; havale → `b(H)` ya da hesap atanmamışsa **102.00**; kart → `b(H)` ya da kart
  hesabı yoksa **108.00**. [PLAN §3.11 `moneyAccount` tablosu "cash → 100 · bank hesap → 102 (alt hesap) · bank '' → 102.00 ·
  card kurumsal kart → 309.NN · card '' → 108.00"]
- Her işlemde ortak ret kuralları da uygulanır: tarih (§5.1), hesap seçimi (§5.2), eksi bakiye (§5.3), istek kimliği ve Benzer
  İşlem (§5.4), yetki (§5.5). İşlem tablolarında yalnız o işleme özgü retler yazılıdır.

### 4.1 `saat` — sahte saati ilerlet

| Parametre | Anlamı |
|---|---|
| `bugun` | Yeni gün; eski günden önce olamaz (senaryo hatası). |

Deftere etkisi yok. Koşucu programın sahte saatini bu güne getirir. [PLAN §12.5 ön koşul; Aşama 2 "`config.now` +
`startTestServer({ now })`"]

### 4.2 `ayar` — şirket ayarı

| Parametre | Anlamı |
|---|---|
| `kasaEksiBakiye` | `uyar` · `engelle` · `kontrol_yok` (Nakit Kasa) [PLAN §8.9 "Yönetim → Eksi Bakiye Denetimi: Nakit Kasa ayarı orada kalır"] |
| `benzerIslemUyarisi` | `acik` · `kapali` [PLAN §8.11] |

Yalnız `Y` (yönetici). Deftere etkisi yok.

### 4.3 `donem_kilidi` — dönem kilidi koy

| Parametre | Anlamı |
|---|---|
| `kilitTarihi` | Bu gün dahil öncesi kilitlenir; `bugun`den sonra olamaz [YAYGIN]. Sonradan geri alınmaz (bu dil sürümünde kilit kaldırma yok). |

Etkisi: tarihi ≤ kilit olan her yeni yazım ve kilitli tarihli satırın silinmesi → **409 `period-locked`**. [PLAN §2.5 "Kilitli
döneme yazılmaz, kilitli dönemdeki kayıt değiştirilmez"; Aşama 0 "Kilitli döneme kayıt tahsilatı API'den → 409 `period-locked`"
(kodun öbür işlemlerde de aynı olması ÇIKARIM)]. Ters kaydın tarihi için §4.27.

### 4.4 `hesap_ac` — banka hesabı aç (açılışla)

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | evet | Takma ad |
| `banka`, `hesapAdi` | evet | Ör. "Ziraat Bankası", "Ana TL Hesabı" |
| `tur` | evet | `vadesiz` · `ticari` · `vadeli` · `diger` · `kurumsal_kart` · `kredi` [PLAN §3.5 tablo] |
| `paraBirimi` | evet | Yalnız `"TRY"` (döviz kapsam dışı) |
| `kod` | hayır | Hesap Kodu (ör. "ZRT-TL"); verilmezse koşucu tekil bir kod üretir |
| `iban` | hayır | `kurumsal_kart` ve `kredi` dışındaki türlerde |
| `acilisTarihi` | evet | Açılış günü D |
| `acilisBakiyesi` | evet | S (`"0"` olabilir). 102 türlerinde bankadaki bakiye (yalnız vadesiz hesapta, KMH ile `-` olabilir; D5); kart ve kredide **borç tutarı** (artı yazılır) |
| `bakiyeDogrulandi` | hayır | `true`/`false` (varsayılan `false`); "Bu tutar bankadaki gerçek bakiyedir" kutusu [PLAN §3.9] |
| `kmhLimiti` | hayır | **yalnız vadesiz** (sürüm 2, D5); varsayılan `"0"` |
| `kartLimiti` | hayır | kurumsal_kart; varsayılan `"0"` |

**Alt hesap kodu** [ÇIKARIM §3.5 "`gl_sub` alt hesap kodunu sistem verir; değişmez"; §3.7 #1 "B 102.01 … Kart: B 500 / A 309.01.
Kredi: B 500 / A 300.01"; §12.5 "Ziraat (102.01), Garanti (102.02)"]:
- ana kod: vadesiz/ticari/vadeli/diger → 102; kurumsal_kart → 309; kredi → 300
- NN = aynı ana kodda açılış sırası, `01`'den başlar, iki hane. Reddedilen hesap açılışı numara tüketmez [YAYGIN].
- Kâhin hesaplar; koşucu programın verdiği kodu okur; ikisi `hesapKodlari` çıktısında karşılaştırılır (§8.4).

**Yevmiye** (tarih = D) [PLAN §3.7 #1]:
- 102, S > 0: `B b(H) S / A 500 S`
- 102, S < 0: `B 500 |S| / A b(H) |S|`
- 309: `B 500 S / A b(H) S`
- 300: `B 500 S / A b(H) S`
- S = 0: satır yok (açılış yine "var" sayılır). [PLAN §3.11 bank:opening "En çok bir etkin açılış (sıfır olabilir)"]

**Retler:**

| Durum | Sonuç | Dayanak |
|---|---|---|
| D > bugün | 400 | [PLAN Aşama 3 "Açılış ileri tarih → 400"] |
| D ≤ kilit | 409 `period-locked` | [PLAN Aşama 3 "kilitli → 409"] |
| geçersiz IBAN (TR, 26 karakter, mod 97 = 1 değil) | 400 | [PLAN Aşama 3 "Geçersiz IBAN → 400"] |
| aynı IBAN silinmemiş başka hesapta | 409 | [PLAN Aşama 3 "Aynı IBAN → 409"] |
| aynı `kod` silinmemiş başka hesapta | 4xx | [ÇIKARIM §3.5 "Hesap Kodu … silinmemiş hesaplar arasında tekildir"] |
| `acilisBakiyesiHam` 2'den çok ondalık | 400 | [PLAN §5.1 "Banka uçlarında … 2'den çok ondalık 400"] |
| `kmhLimiti` > 0 ve tür vadesiz değil | 4xx | [ÇIKARIM §3.5 tablo: "KMH Limiti alanı var" yalnız Vadesiz satırında] (sürüm 2, D5) |
| S < 0 ve tür vadesiz değil | 4xx | [ÇIKARIM §3.5; §3.7 #1 "KMH'de eksi açılış ters"] (sürüm 2, D5) |
| vadesiz, S < 0 ve \|S\| > `kmhLimiti` | senaryo kurmaz | [BELİRSİZ-23] |

Aynı bankada aynı adlı iki hesap **izinlidir**. [PLAN Aşama 3 "Aynı bankada aynı adlı iki hesap → izinli, kod tekil"]

### 4.5 `hesap_durum` — pasife al / aktif et

| Parametre | Anlamı |
|---|---|
| `hesap` | Takma ad |
| `durum` | `pasif` · `aktif` |

Deftere etkisi yok. Pasif hesap hiçbir formda seçilemez (§5.2). [PLAN Aşama 5 "Pasif hesap → 400"]

### 4.6 `hesap_eksi_politika` — hesap bazında eksi bakiye denetimi

| Parametre | Anlamı |
|---|---|
| `hesap` | Takma ad (102 ya da 309 türü) |
| `politika` | `uyar` · `engelle` · `kontrol_yok` |

[PLAN §3.9 "hesap kartında hesap bazında da değiştirilebilir"; kabul adım 37 "Garanti hesap kartında Eksi Bakiye 'Engelle'"].
Yalnız doğrulanmış hesapta kullanılır [BELİRSİZ-3]. Deftere etkisi yok.

### 4.7 `acilis_duzelt` — Açılışı Düzelt

| Parametre | Anlamı |
|---|---|
| `hesap` | Takma ad |
| `acilisTarihi`, `acilisBakiyesi` | Yeni D' ve S' (§4.4 anlamıyla) |
| `bakiyeDogrulandi` | hayır; verilirse hesabın doğrulanma durumu buna olur |

Etki: eski açılış fişinin ters kaydı (eski tarihle) + yeni açılış fişi (D' ile). Net etki: açılış satırları yeni değerle
değişmiş gibi. Hesabın açılış tarihi D' olur. [PLAN §3.8 "'Açılışı Düzelt' = ters + yeni"]

| Durum | Sonuç | Dayanak |
|---|---|---|
| D' hesaba bağlı ilk hareketin tarihinden sonra | 409 `bank-opening-after-first` | [PLAN §3.8] |
| eski D ≤ kilit | 409 | [PLAN §3.8 "Kilitli açılış düzeltilmez"] |
| D' > bugün | 400 | §5.1 |
| S' < 0 ve hesap vadesiz değil | 4xx | §4.4 (sürüm 2, D5) |
| vadesiz, S' < 0 ve \|S'\| > `kmhLimiti` | senaryo kurmaz | [BELİRSİZ-23] |

### 4.8 `kasa_acilis` — Kasa açılış bakiyesi

| Parametre | Anlamı |
|---|---|
| `tutar` | Kasa'daki nakit |

Yevmiye: `B 100 T / A 500 T` **[YAYGIN]**. Koşucu bunu programın Kasa → Açılış Bakiyesi işlemiyle girer (2.2.0, 12.10.2026: program açılışı
açıklama metninden değil bu işlemden tanır — yargıç Y2; beklenen yevmiye değişmedi; önceki sürüm koşucusu açıklaması "Açılış Bakiyesi" elle giriş yapıyordu).
Gerekçe: [PLAN §11.1 A8 "Açılış hesabını açıklama metni belirliyor (general-ledger.mjs:43) … Cari için davranış değişmez"]; plan
Kasa açılışını ayrıca tanımlamıyor. Program 500 yerine 649 yazarsa fark İNCELE'dir.

### 4.9 `kasa_hareket` — Kasa'ya elle giriş / Kasa'dan elle çıkış (carisiz)

| Parametre | Anlamı |
|---|---|
| `ad` | Takma ad (silinecekse zorunlu) |
| `yon` | `giris` · `cikis` |
| `tutar` | Tutar |
| `aciklama` | Metin; "açılış" sözcüğü geçmez (bkz. §4.8) |

Yevmiye: giriş `B 100 T / A 649 T`; çıkış `B 770 T / A 100 T`. [PLAN §2.3 "Elle Kasa girişi | `cash_entries`, yalnız nakit | 100 ↔
649/770"]. Çıkışta Kasa eksi bakiye denetimi (§5.3). Benzer İşlem yok [PLAN §3.10/2 "Carisiz Kasa elle girişinde güvenilir hedef
yoktur"].

### 4.10 `cari_ac` — cari aç

| Parametre | Anlamı |
|---|---|
| `ad` | Takma ad |
| `unvan` | Ör. "ABC Ltd." |
| `tur` | `musteri` · `tedarikci` |
| `iban` | hayır; geçerli TR IBAN |

Deftere etkisi yok; cari bakiye 0. Cari açılış bakiyesi bu dil sürümünde yok (plan A8 nedeniyle hesabı belirsiz).

### 4.11 `urun_ac` — stok kartı aç

| Parametre | Anlamı |
|---|---|
| `ad` | Takma ad |
| `urunAdi` | Ör. "Ürün A" |
| `birim` | Yalnız `"Adet"` |

Stok 0. Deftere etkisi yok.

### 4.12 `stok_giris` — parasız stok girişi

| Parametre | Anlamı |
|---|---|
| `urun` | Takma ad |
| `miktar` | Tamsayı ≥ 1 |

Stok + miktar. **Yevmiye yok.** [PLAN §12.5 ön koşul "Ürün A 10 Adet, Ürün B 25 Adet (parasız giriş)"; adım 33 mizanında 153 yok]

### 4.13 `fatura` — satış ya da alış faturası

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | evet | Takma ad |
| `tur` | evet | `satis` · `alis` |
| `cari` | evet | Takma ad |
| `kalemler` | evet | En az bir kalem (aşağıda) |
| `odeme` | hayır | Yoksa tamamı açık (aşağıda) |

**Kalem:**

| Alan | Anlamı |
|---|---|
| `urun` | Stoklu ürünün takma adı. Yoksa `hizmet` zorunlu. |
| `hizmet` | Stoksuz kalem açıklaması (ör. "Danışmanlık") |
| `miktar` | Tamsayı ≥ 1 |
| `birimFiyat` | Tutar |
| `kdvOrani` | 1 · 10 · 20 |
| `kdvDahil` | `true` · `false` (birim fiyat KDV dahil mi) |
| `iskontoOrani` | hayır; yüzde metni (ör. `"10"`) |
| `giderTuru` | Yalnız alış hizmet kaleminde, zorunlu: `"Banka Masrafları"` (hesap 770) [PLAN §3.7 #13 "gider türü **'Banka Masrafları' → 770**"]. Başka gider türü bu dil sürümünde yok (hesabı planda yazılı değil). |

Tutarlar §6.3 ile hesaplanır: her kalem için matrah Mᵢ, KDV Kᵢ, toplam Tᵢ; belge matrahı M = ΣMᵢ, KDV K = ΣKᵢ, toplam T = ΣTᵢ.

**Ödeme:**

```json
"odeme": {
  "pesin": [ { "yol": "havale", "tutar": "5000", "hesap": "ZIR" } ],
  "taksit": { "ad": "T1", "sayi": 3, "ilkVade": "08.11.2026" }
}
```

| Alan | Anlamı |
|---|---|
| `pesin` | Peşin satırları listesi (en çok 3). Her satır: `yol` (`nakit` · `havale` · `kart`), `tutar` (tutar ya da `"tamami"`), `hesap` (havale/kartta §5.2'ye göre). `"tamami"` = T − öbür peşin satırlar; taksitle birlikte kullanılamaz. |
| `taksit` | Yalnız satış faturasında [ÇIKARIM §3.6 "Taksit Tahsilatı / Ödemesi (iade)" → taksit tahsilat tarafındadır]. `ad` (taksit kartının takma adı), `sayi` (≥ 1), `ilkVade` (hayır). Kartın toplamı = T − Σ peşin. |
| (kalan) | Taksit yoksa T − Σ peşin açık kalır. |

`kart` yolu yalnız **alış** faturasında (kurumsal kartla ödeme) [PLAN §3.7 #5 "Alış faturası kurumsal kartla | B 320 / A 309.01"];
satışta kart = POS, kapsam dışı.

**Yevmiye:**
- Satış: `B c(cari) T / A 600 M / A 391 K` [PLAN §12.5 adım 33 mizanı: "600 Satışlar", "391 Hesaplanan KDV"]. Hizmet kalemi de 600'e
  [YAYGIN].
- Satış peşini: her satır için `B p(yol,H) Pᵢ / A c(cari) Pᵢ` [PLAN §3.7 #4 "Fatura maddesi + B 102.01 / A 120"].
- Alış: `B 153 ΣM(stoklu kalemler) / B 770 ΣM(hizmet kalemleri) / B 191 K / A c(cari) T` [PLAN §3.7 #13 "B 770 100 · B 191 20 / A 320
  120"; 153 için ÇIKARIM §2.3 "Stok peşini … ↔ 600/610/153"].
- Alış peşini: `B c(cari) Pᵢ / A p(yol,H) Pᵢ` [PLAN §3.7 #3, #5].
- Taksit kartı açılışı deftere satır yazmaz (borç zaten faturayla yazıldı) [YAYGIN].

**Diğer etkiler:** Satışta stoklu kalemin stoğu − miktar; alışta + miktar. `faturalar[ad]` = {toplam T, matrah M, kdv K, acik (§7)}.
Taksit varsa `taksitKartlari[taksit.ad]` = {toplam T − ΣP, odenen 0, kalan T − ΣP}.

**Retler:**

| Durum | Sonuç | Dayanak |
|---|---|---|
| Σ peşin > T | 4xx | [YAYGIN] |
| peşin havale/kart satırı hesabın açılışından önceki tarihte | 4xx `bank-before-opening` | §5.1 |
| satış ve stok eksiye düşer | senaryo kurmaz | [BELİRSİZ-14] |

Benzer İşlem: peşin satırın hedefi faturanın kendisidir; yeni fatura her zaman yeni hedeftir → peşin satırlar Benzer İşlem
reddi almaz. [PLAN §3.10/2 "**Hedef:** … fatura (Kapatılacak Fatura ya da peşin satırın faturası)"]

### 4.14 `iade` — satıştan iade / alıştan iade

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | evet | İade belgesinin takma adı |
| `asilFatura` | evet | İade edilen faturanın takma adı (taksitsiz olmalı [BELİRSİZ-8]) |
| `kalemler` | evet | `[{ "kalem": 1, "miktar": 3 }]` — `kalem` asıl faturadaki kalemin sıra numarası (1'den) |
| `geri` | evet | `{ "yol": "acik" }` · `{ "yol": "nakit" }` · `{ "yol": "havale", "hesap": "ZIR" }` — iade tutarının tamamı geri ödenir ya da hiç ödenmez |

Tür asıl faturadan gelir: satış → **Satıştan İade**, alış → **Alıştan İade**. Cari asıl faturanın carisidir.

**Tutar:** her iade kalemi, asıl kalemin `birimFiyat`, `kdvOrani`, `kdvDahil`, `iskontoOrani` değerleriyle ve iade miktarıyla §6.3'e
göre **yeniden** hesaplanır [YAYGIN; PLAN §12.5 adım 27–28 "Ürün B 3 Adet = 3.000" ve adım 33 mizanında "610 Satıştan İadeler
2.500,00" ile tutarlı].

**Yevmiye:**
- Satıştan iade: `B 610 M / B 391 K / A c(cari) T` [PLAN §12.5 adım 33 mizanı: 610 = 2.500, 391 = 7.000 − 500 = 6.500 → iadenin
  KDV'si 391'e borç yazılır]. Geri nakit/havale: `B c(cari) T / A p(yol,H) T`.
- Alıştan iade: `B c(cari) T / A 153 ΣM(stoklu) / A 770 ΣM(hizmet) / A 191 K` [YAYGIN]. Geri nakit/havale: `B p(yol,H) T / A c(cari)
  T`.

**Diğer etkiler:** Satıştan iadede stok + miktar; alıştan iadede − miktar. `faturalar[ad]` = iade belgesinin {toplam, matrah, kdv,
acik}.

**Retler:**

| Durum | Sonuç | Dayanak |
|---|---|---|
| iade miktarı > asıl kalem miktarı − o kalemin önceki iadeleri | 4xx | [YAYGIN] |
| iade tarihi < asıl fatura tarihi | 4xx | [YAYGIN; PLAN §4.6 POS için "İade tarihi satış tarihinden önce olamaz"] |
| geri havale tarihi < hesabın açılışı | 4xx `bank-before-opening` | §5.1 |

### 4.15 `cari_tahsilat` — cariden tahsilat

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | silinecekse | Takma ad |
| `cari` | evet | Takma ad |
| `tutar` | evet | Tutar |
| `yol` | evet | `nakit` · `havale` |
| `hesap` | §5.2'ye göre | Havalede banka hesabı |
| `kapatilacakFatura` | hayır | Aynı carinin taksitsiz alacak belgesi (satış faturası ya da alıştan iade) |
| `normalCari` | hayır (sürüm 4) | `true`: "Normal Cari Hesaba İşle" — satır şüpheli alacaktan DÜŞMEZ, `A 120` kalır (§4.42a) [PLAN §3.11b/2 (a)] |

Yevmiye: `B p(yol,H) T / A c(cari) T` [PLAN §3.7 #2 "B 102.01 20.000 / A 120. Ziraat 100.000 → 120.000"]. Fatura açığına etkisi §7.
`kapatilacakFatura` verilirse tutar o belgenin o anki açığını aşmaz [BELİRSİZ-10]. `kapatilacakFatura` verilen ya da `normalCari: true`
olan tahsilat şüpheli alacaktan düşmez (§4.42a) [PLAN §3.11b/2 (a)–(b)]; `normalCari` şüpheli kaydı olmayan caride etkisizdir.
Carinin **açık** şüpheli kaydı (kalanı > 0) varken böyle bir tahsilatın tutarı carinin 120 bakiyesini (= cari bakiyesi − açık kayıtların
kalanları toplamı, §4.39'daki tanım) aşarsa **409 `doubtful-normal-exceeds`** (§5.6 grup 4; hiçbir şey yazılmaz) [PLAN §3.11b/2 (a) "Sınır"];
açık kayıt yoksa sınır yoktur (fazlası alacak bakiyesi olur, §4 gösterim).

### 4.16 `cari_odeme` — cariye ödeme

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad`, `cari`, `tutar` | §4.15 gibi | |
| `yol` | evet | `nakit` · `havale` · `kart` (kurumsal kart) |
| `hesap` | §5.2'ye göre | Havalede banka hesabı, kartta kart hesabı |
| `kapatilacakFatura` | hayır | Aynı carinin borç belgesi (alış faturası ya da satıştan iade) |

Yevmiye: `B c(cari) T / A p(yol,H) T` [PLAN §3.7 #3 "B 320 / A 102.01 (ya da A 309.01)"]. Kaynak hesapta eksi bakiye denetimi
(§5.3).

### 4.17 `taksit_tahsilat` — taksit kartına tahsilat

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | silinecekse | Takma ad |
| `kart` | evet | Taksit kartının takma adı |
| `tutar` | evet | Tutar; kartın kalanıyla ilişkisi aşağıda (K8, sürüm 4; sürüm 2–3'te kalanı aşan tutar "senaryo kurmaz"dı) |
| `yol` | evet | `nakit` · `havale` |
| `hesap` | §5.2'ye göre | |
| `taksitNo` | hayır | Seçilen taksit (1'den); yalnız Benzer İşlem hedefini değiştirir. Sürüm 4: yalnız kartın hiç etkin tahsilatı yokken yazılır [BELİRSİZ-33] |
| `fazlaAvans` | hayır | `true`: "Fazlasını Avans Yaz" (programda `overpay:true`). Yalnız `tutar` > kalan iken yazılır [BELİRSİZ-33] (sürüm 4) |

Yevmiye: `B p(yol,H) T / A c(kartın carisi) T` [PLAN §3.7 #6 "B 102.02 / A 120"]. Kartın `odenen`i + T. [Talimat 11 "Taksit: Ödendi
· Cari: −10.000 · Banka: +10.000"]

**K8 taksit kuralı (sürüm 4)** [PLAN §3.10/3 "Kartın kalanı BEGIN IMMEDIATE içinde yeniden okunur. Kalan 0 ise 409 `plan-paid`. Tutar kalanı
aşarsa 409 `plan-overpay`. 'Fazlasını Avans Yaz' (`overpay:true`) yalnız `plans.manage` sahibine açık; fazlası kartta 'extra', caride alacak
olur. Seçilen taksit ödenmişse 409 `installment-paid`"]. Kalan = `toplam − Σ etkin taksit tahsilatı` (en az 0; §7).

| Durum | Sonuç | Dayanak |
|---|---|---|
| kalan = 0, `fazlaAvans` yok | **409 `plan-paid`** | [PLAN §3.10/3] |
| 0 < kalan < T, `fazlaAvans` yok | **409 `plan-overpay`** | [PLAN §3.10/3] |
| T > kalan (kalan 0 dahil), `fazlaAvans: true`, kullanıcı yetkili (§5.5 "taksit_tahsilat (fazlaAvans)") | yazılır: yevmiye yukarıdaki gibi **T'nin tamamı** (`A c(cari) T`); kartın `odenen`i + T, `kalan` 0; fazla (T − kalan) carinin alacağıdır (avans) | [PLAN §3.10/3 "fazlası kartta 'extra', caride alacak olur"]; kalan 0 iken de avans: [ÇIKARIM §3.10/3 — kalan 0, "tutar kalanı aşar"ın özel hâli; `plan-paid` iletisi de avans seçeneğini anar] |
| T > kalan, `fazlaAvans: true`, kullanıcı yetkisiz | **403 `plan-overpay-permission`** | [PLAN §3.10/3 "yalnız `plans.manage` sahibine açık"; kod: KABUL dışı, programın adı — bkz. §5.7] |
| seçilen taksit ödenmiş | senaryo kurmaz | [BELİRSİZ-33: taksit tutarlarının bölüşümü ve tahsilatın taksite dağıtımı planda yok] |

Fazlanın başka belgeleri kapatıp kapatmadığı planda yok: fazlası olan carinin `faturalar.*.acik` alanları `belirsizler`e [BELİRSİZ-34];
taksit kartı (`toplam`, `odenen`, `kalan`) karşılaştırılır. Fazla, §7 değişmezinde "dağıtılmamış giriş" (avans) terimidir.

### 4.18 `kasa_banka` — Kasa ↔ Banka

| Parametre | Anlamı |
|---|---|
| `ad` | Takma ad (silinecekse zorunlu) |
| `yon` | `bankadan_kasaya` · `kasadan_bankaya` |
| `hesap` | §5.2'ye göre (havale kuralıyla; vadesiz/ticari kullanılır [BELİRSİZ-21]) |
| `tutar` | Tutar |

Yevmiye: bankadan kasaya `B 100 T / A b(H) T`; kasadan bankaya `B b(H) T / A 100 T`. [PLAN §3.7 #10 "Bankadan Kasaya 10.000: B 100 / A
102.01. Ziraat 110.000, Kasa 10.000"; talimat 8 "Bu işlemler gelir veya gider olarak değerlendirilmemelidir"]. Eksi bakiye
denetimi kaynak tarafta (bankadan kasaya → banka hesabı; kasadan bankaya → Kasa). Silinebilir [PLAN §12.5 adım 34(b) "Kasa
transferi → … → Sil (`bank.cancel`)"]; ters kaydı yok [BELİRSİZ-16].

### 4.19 `transfer` — bankalar arası transfer

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | ters kaydedilecekse | Takma ad |
| `kaynak`, `hedef` | evet | 102 türü hesaplar (vadesiz, ticari, vadeli, diğer) |
| `tutar` | evet | A |
| `ucret` | hayır | U; yoksa ücretsiz |
| `ucretVergi` | `ucret` varsa zorunlu | `bsmv_haric` · `bsmv_dahil` · `yok` |

Ücret gideri G (U ve BSMV dahil, 770'e giden toplam) §6.4'e göre: `bsmv_haric` → G = U + rh(U×5, 100); `bsmv_dahil` → G = U; `yok`
→ G = U.

Yevmiye: `B b(hedef) A / B 770 G / A b(kaynak) A + G`. [PLAN §3.7 #11 "Ücretli (EFT 5,00 + BSMV 0,25): B 102.02 20.000 · B 770 5,25 /
A 102.01 20.005,25 → Ziraat 89.994,75"; talimat 7 "Transfer ücreti varsa ayrıca banka gideri olarak işlenmelidir"]. Ücret ve
BSMV'nin ayrımı yalnız Banka Masraf Raporu'nda görünür; bu dilin çıktısında ikisi de 770'tedir.

| Durum | Sonuç | Dayanak |
|---|---|---|
| kaynak = hedef | 400 | [PLAN Aşama 9 "Kaynak = hedef → 400"] |
| tarih < iki hesaptan birinin açılışı | 4xx `bank-before-opening` | §5.1 |
| kaynak ya da hedef kredi/kart hesabı | 400 `bank-account-invalid` | [ÇIKARIM §3.5 "Kredi Hesabı … kullanım ve geri ödeme transferle" → `kredi_kullanim`/`kredi_odeme` ayrı işlem] |

Eksi bakiye denetimi kaynakta (A + G).

### 4.20 `banka_masraf` — banka masrafı (Banka Fişi)

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | ters kaydedilecekse | Takma ad |
| `hesap` | evet | 102 türü hesap |
| `tutar` | evet | U (kullanıcının girdiği tutar) |
| `masrafTuru` | evet | `EFT` · `FAST` · `Havale` · `SWIFT` · `Hesap İşletim` · `Döviz İşlem` · `Diğer` — hepsi 770 [PLAN §8.11 "Banka Masrafları (770): EFT, FAST, Havale, SWIFT, Hesap İşletim, Döviz İşlem, Diğer"] |
| `vergi` | evet | `bsmv_dahil` · `bsmv_haric` · `yok` · `kdv_dahil` · `kdv_haric` |
| `saglayici` | KDV kipinde | Tedarikçi türü cari |
| `fatura` | KDV kipinde | Oluşan faturanın takma adı |
| `kdvOrani` | hayır | KDV kipinde; varsayılan 20 [PLAN §3.7 #13 "KDV Dahil 120: … B 191 20"] |

**BSMV ve Yok kipleri** [PLAN §3.7 #12 "BSMV Dahil 10,50: B 770 10,00 · B 770 0,50 (rol `tax`) / A 102.01 10,50. BSMV Hariç girilen
10,00'dan 10,50 çıkar."]:
- `bsmv_dahil`: gider = rh(U×100, 105), BSMV = U − gider → `B 770 gider / B 770 BSMV / A b(H) U`
- `bsmv_haric`: BSMV = rh(U×5, 100) → `B 770 U / B 770 BSMV / A b(H) U + BSMV`
- `yok`: `B 770 U / A b(H) U`

**KDV kipleri** [PLAN §3.7 #13 "Tek işlemde: fatura servisiyle sağlayıcı carisine 'Hizmet ve Gider Alışı' (gider türü 'Banka
Masrafları' → 770) + peşin havale … KDV Dahil 120: B 770 100 · B 191 20 / A 320 120; B 320 / A 102.01 120 → banka −120, cari 0"]:
- Bir alış faturası (hizmet kalemi, giderTuru "Banka Masrafları", tek kalem, miktar 1, birimFiyat U, `kdvDahil` = kip) +
  `"pesin": [{ "yol": "havale", "tutar": "tamami", "hesap": H }]` gibi işlenir (§4.13 kuralları, §6.3 tutarları).
- `kdv_dahil`: matrah = rh(U×100, 100+r), KDV = U − matrah, T = U. `kdv_haric`: matrah = U, KDV = rh(U×r, 100), T = U + KDV.
- `faturalar[fatura]` = {toplam T, matrah, kdv, acik 0}.

| Durum | Sonuç | Dayanak |
|---|---|---|
| KDV kipinde `saglayici` yok | 4xx | [ÇIKARIM §3.7 #13] |
| `tutarHam` 2'den çok ondalık | 400 | [PLAN §5.1] |
| `hesap` vadeli (BSMV ve Yok kipleri) | 400 `bank-account-invalid` | [ÇIKARIM §3.5 "Vadeli … Hayır; yalnız transfer ve faiz"] (sürüm 2, D6) |
| `hesap` vadeli (KDV kipleri) | senaryo kurmaz | [BELİRSİZ-24] |

Eksi bakiye denetimi hesapta (çıkan toplam).

### 4.21 `faiz_geliri` — faiz geliri (stopajlı)

| Parametre | Anlamı |
|---|---|
| `ad` | ters kaydedilecekse |
| `hesap` | 102 türü hesap |
| `brut` | Brüt faiz F |
| `stopajOrani` | Yüzde metni (`"0"` olabilir) |

Stopaj S = rh(F × bp, 10000); net = F − S. Yevmiye: `B b(H) net / B 193 S / A 642 F`. [PLAN §3.7 #14 "Brüt 1.000, stopaj %15 (oran
kullanıcıdan): B 102.04 850 · B 193 150 / A 642 1.000"]

### 4.22 `faiz_gideri` — faiz / KMH gideri

| Parametre | Anlamı |
|---|---|
| `ad`, `hesap`, `tutar` | |

Yevmiye: `B 780 T / A b(H) T`. [PLAN §3.7 #15 "B 780 / A 102.01"]. Vadeli hesapta faiz gideri kurulmaz [BELİRSİZ-24] (sürüm 2,
D6: plandaki "yalnız transfer ve faiz" faiz gelirini mi ikisini mi kapsıyor açık değil).

### 4.23 `diger_gelir` / `diger_gider`

| Parametre | Anlamı |
|---|---|
| `ad`, `hesap`, `tutar` | |

Yevmiye: gelir `B b(H) T / A 649 T`; gider `B 659 T / A b(H) T`. [PLAN §3.7 #18 "B 102 / A 649; B 659 / A 102"]

| Durum | Sonuç | Dayanak |
|---|---|---|
| `hesap` vadeli | 400 `bank-account-invalid` | [ÇIKARIM §3.5 "Vadeli … yalnız transfer ve faiz"] (sürüm 2, D6) |

### 4.24 `kart_borcu_odeme` — kurumsal kart borcu ödemesi

| Parametre | Anlamı |
|---|---|
| `ad` | ters kaydedilecekse |
| `kaynak` | 102 türü hesap (vadeli değil: [BELİRSİZ-24], sürüm 2) |
| `kart` | kurumsal_kart hesabı |
| `tutar` | |

Yevmiye: `B b(kart) T / A b(kaynak) T`. [PLAN §3.7 #16 "B 309.01 / A 102.01"]. Eksi bakiye denetimi kaynakta.

### 4.25 `kredi_kullanim` — kredi kullanımı

| Parametre | Anlamı |
|---|---|
| `ad`, `kredi` (kredi hesabı), `hedef` (102 türü hesap; vadeli değil: [BELİRSİZ-24], sürüm 2), `tutar` | |

Yevmiye: `B b(hedef) T / A b(kredi) T`. [PLAN §3.7 #17 "B 102.01 / A 300.01"]. Kredi hesabında eksi bakiye denetimi yok
[BELİRSİZ-2].

### 4.26 `kredi_odeme` — kredi geri ödemesi

| Parametre | Anlamı |
|---|---|
| `ad`, `kredi`, `kaynak` (102 türü; vadeli değil: [BELİRSİZ-24], sürüm 2), `anapara`, `faiz` (hayır) | |

Yevmiye: `B b(kredi) anapara / B 780 faiz / A b(kaynak) anapara + faiz`. [PLAN §3.7 #17 "B 300.01 · B 780 / A 102.01"]. Eksi bakiye
denetimi kaynakta. Anapara, kredi hesabının o anki borcunu (−bakiye(300.NN), bütün satırlarla) aşmaz [BELİRSİZ-25] (sürüm 2, D7).

### 4.27 `ters_kayit` — Ters Kaydet

| Parametre | Anlamı |
|---|---|
| `ad` | hayır |
| `hedef` | Şu işlemlerden birinin takma adı: `transfer`, `banka_masraf` (yalnız BSMV ve Yok kipi), `faiz_geliri`, `faiz_gideri`, `diger_gelir`, `diger_gider`, `kart_borcu_odeme`, `kredi_kullanim`, `kredi_odeme` |

Etki: hedefin bütün yevmiye satırları aynı tutarla, taraf değiştirerek yeniden yazılır; net etki sıfır. Tarih: hedefin tarihi kilit
sonrasındaysa hedefin tarihi, kilitliyse `bugun`. [PLAN §3.8 "Banka Fişi … Silinmez; 'Ters Kaydet'. Ters fiş tarihi: asıl fiş açık
dönemdeyse aynı tarih, kilitliyse bugün."; §3.11 bank:voucher "ters fiş asıl fişin aynası"]

| Durum | Sonuç | Dayanak |
|---|---|---|
| hedef zaten ters kaydedilmiş | 409 | [PLAN Aşama 4 "Ters kaydı iki kez → 409"] |
| hedef listede olmayan bir işlem | 4xx | [PLAN §3.8] (KDV kipi, Kasa↔Banka ve ters kaydın ters kaydı: [BELİRSİZ-16]) |
| ters kayıt bir kredi hesabını borç bakiyesine (bakiye(300.NN) > 0) çevirir | senaryo kurmaz | [BELİRSİZ-25] (sürüm 2, D7) |

Eksi bakiye denetimi azalan hesaplarda (§5.3) [ÇIKARIM §3.3 adım 8 "`guardFinal(prep)` ← K7: yazımdan SONRA hesap bazında son
durum"].

### 4.28 `sil` — hareketi sil

| Parametre | Anlamı |
|---|---|
| `hedef` | Şu işlemlerden birinin takma adı: `cari_tahsilat`, `cari_odeme`, `taksit_tahsilat`, `kasa_hareket`, `kasa_banka`; sürüm 4: `supheli_al` (kayıt) ve `karsilik_ayir` |

Etki: hedefin bütün yevmiye satırları ve yan etkileri kalkar (taksit kartının `odenen`i azalır; fatura açıkları §7 ile yeniden
hesaplanır). Hareket Silinenler'e gider; geri yükleme bu dil sürümünde yok.

Sürüm 4 [PLAN §3.11b/4 "Silinenler (geri alma ters kayıtla)"; KABUL K8 "kayıt/karşılık/değersiz silinince ters kayıt = defterden düşer"]:
- `supheli_al` kaydı silinince kaydın satırları (B 128 / A 120) kalkar; carinin alacak satırları §4.42a ile yeniden dağıtılır (kayıt hiç
  açılmamış gibi). Yalnız **karşılığı, değersiz yazımı ve çıkarması olmayan** kayıt silinir; ötekisi senaryo kurmaz [BELİRSİZ-37].
- `karsilik_ayir` silinince karşılık satırı (B 654 / A 129) ve ondan türeyen 644 satırları kalkar (kayıt sanki o karşılık ayrılmamış gibi
  yeniden türetilir). Değersiz yazımının silinmesi senaryo kurmaz [BELİRSİZ-37].
- Kilit: hedefin tarihi ≤ kilit → 409 `period-locked` (§4.3). Yetki: §5.5 "şüpheli işlemleri" satırı.

| Durum | Sonuç | Dayanak |
|---|---|---|
| hedef Banka Fişi ya da transfer | 4xx | [PLAN §3.8 "Banka Fişi … Silinmez; 'Ters Kaydet'"] |
| hedef zaten silinmiş | 404 | [ÇIKARIM Aşama 0 "Aynı satırı iki kişi aynı anda siler → biri 404"] |
| hedefin tarihi ≤ kilit | 409 `period-locked` | §4.3 |
| silme bir hesabı eksiye düşürür | §5.3 | [PLAN Aşama 0 "Kasa'yı eksiye düşüren silme → Uyar'da 409"; §9.2/4 "azalan her hesapta son durum eksi bakiye denetlenir"] |

### 4.29 `kontrol` — ara durum

| Parametre | Anlamı |
|---|---|
| `planMetni` | hayır; planın ilgili cümlesi, olduğu gibi |
| `planBeklenen` | hayır; planın sayıları, §8 çıktı biçiminde **kısmi** nesne (yalnız planın söylediği yaprak alanlar) |

Etki yok. Kâhin ve koşucu bu noktadaki durumu `araDurumlar[id]` olarak yazar (§8.6). Karşılaştırıcı önce `planBeklenen` ↔ kâhin,
sonra kâhin ↔ program.

### 4.30–4.38 Evrak (çek ve senet) işlemleri — sürüm 3

**Gösterim** [PLAN §3.11a tablo; §3.11 madde 5]:

| | Çek (`cek`) | Senet (`senet`) |
|---|---|---|
| `a(E)` alınan evrak, portföyde | **101.01** Portföydeki Çekler | **121.01** Portföydeki Senetler |
| `t(E)` alınan evrak, bankada tahsilde | **101.02** Tahsile Verilen Çekler | **121.02** Tahsile Verilen Senetler |
| `v(E)` verilen (kendi) evrak | **103** Verilen Çekler ve Ödeme Emirleri | **321** Borç Senetleri |

[PLAN §3.11a "§3.6/§3.7/§3.14'te 101.01/101.02 yazan her satır alınan SENET için 121.01/121.02 olarak okunur; 103 yazan her satır verilen
senet için 321"]

**Evrak durumu** (kâhinin iç durumu; çıktıda ayrı alan yok, etkisi mizandadır): alınan evrak `portfoy` → (`tahsilde` ⇄ `portfoy`) →
`tahsil` · `ciro` · `karsiliksiz`; verilen evrak `verildi` → `odendi`; her ikisi `silindi`. "Evrak portföyde" = durum `portfoy`.

**Ortak kurallar:**
- Her evrak işleminin tarihi `tarih` (yoksa `bugun`); §5.1 tarih kuralları (ileri tarih 400; kilit 409 `period-locked`) her evrak
  işleminde geçerlidir [PLAN §11.1 A6 "Alış/veriliş tarihi `movementDate` ile (ileri tarih 400, kilitli 409); `assertOpen`"; §3.14 "tarih
  için `movementDate` kuralı"]. Evrakın önceki dönemi kilitli olsa da sonraki işlemi açık dönemde yapılabilir [PLAN §3.14 "Kilitli ayda
  tahsile verilen çek açık ayda tahsil edilebilir"; §5.5 E2.19 "kilitli ayda alınan çek bugün tahsil edilebilmeli"].
- Bir evrak işleminin tarihi evrakın önceki işleminden (alış/veriliş, tahsile verme, geri alma) önce olamaz: Bankaya Tahsile Ver'de
  alış tarihinden önce → 4xx [PLAN §3.14]; öbür işlemlerde ve vadeden önce tahsil/karşılıksızda senaryo kurmaz [BELİRSİZ-28].
- Yetki: yalnız `yonetici` [§5.5; plan §9.1 çek yetkisini saymıyor → BELİRSİZ-18].
- Benzer İşlem: evrak tahsil/ödeme satırının hedefi evrakın kendisidir ve her evrak en çok bir kez tahsil/ödenir → Benzer İşlem reddi
  doğmaz [PLAN §3.10/2 "**Hedef:** … çek"]. Evrak işlemlerinde istek kimliği kullanılmaz (üreteç yazmaz; yazılırsa §5.4 geçerlidir).
- Evrakın fatura açığına etkisi planda yok → o carinin `faturalar.*.acik` alanları karşılaştırılmaz [BELİRSİZ-27].
- "Çek Kullan / Senet Kullan" hesap işaretleri ve verilen çekin "Çek Hesabı" (kullanıcı kararı 12.10.2026) planda yok; deftere etkileri
  yoktur, kâhin bilmez [BELİRSİZ-32].

#### 4.30 `evrak_al` — alınan çek / senet (portföye giriş)

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | evet | Evrakın takma adı (tür **evrak**) |
| `tur` | evet | `cek` · `senet` |
| `cari` | evet | Evrakı veren cari |
| `tutar` | evet | T |
| `vade` | hayır | Vade günü; yoksa = işlem tarihi. Deftere etkisi yok; vade < tarih senaryo kurmaz |

Yevmiye: `B a(E) T / A c(cari) T` [PLAN §3.11 madde 5 "receive → 101.01"; §3.11a; karşı hesabın cari olması ÇIKARIM §3.11b/1
"Karşılıksız çek / protestolu senet … carinin borcuna döner (B 120 / A 101 ya da 121)" — karşılıksız, alışın tersidir]. Durum `portfoy`.

#### 4.31 `evrak_ver` — verilen (kendi) çek / senet

Parametreler §4.30 gibi (`ad`, `tur`, `cari` = evrakın verildiği cari, `tutar`, `vade`).

Yevmiye: `B c(cari) T / A v(E) T` [ÇIKARIM §3.7 #9 "B 103 / A 102" (ödeme verilen evrakı 103'ten kapatır → veriliş 103'e alacak);
§3.11a "Senet · Verilen · 321 Borç Senetleri"]. Durum `verildi`.

#### 4.32 `evrak_ciro` — portföydeki alınan evrakı ciro et

| Parametre | Anlamı |
|---|---|
| `evrak` | Alınan evrakın takma adı |
| `cari` | Ciro edilen cari (evrakı verenden başka; BELİRSİZ-30) |

Yevmiye: `B c(cari) T / A a(E) T` [YAYGIN: ciroda evrak portföyden çıkar, ciro edilen carinin hesabı kapanır; PLAN §2.3 "endorse"].
Durum `ciro`.

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak tahsilde | **409 `cheque-deposited`** | [PLAN §3.14 "Tahsildeki çek ciro edilemez, silinemez … (409 `cheque-deposited`, 'önce Bankadan Geri Al')"] |
| evrak `tahsil` · `ciro` · `karsiliksiz` | 4xx | [YAYGIN] |
| evrak verilen evrak | senaryo kurmaz | — |

#### 4.33 `evrak_tahsil` — alınan evrak tahsil edildi

| Parametre | Anlamı |
|---|---|
| `evrak` | Alınan evrakın takma adı |
| `yol` | `nakit` · `havale` |
| `hesap` | Havalede (aşağıda) |

Yevmiye: `B p(yol,H) T / A a(E) T`; evrak **tahsildeyse** `A t(E) T` [PLAN §3.7 #9 "B 102 / A 101.01 (tahsildeyse A 101.02)"; §3.14
"Tahsil Edildi … Yevmiye: B 102.x / A 101.02"; §3.11a]. Durum `tahsil`.

Hesap:
- Portföydeki evrak: §5.2 havale kuralı (hiç uygun hesap yoksa 102.00; tekse kendiliğinden; çoksa `hesap` zorunlu, yoksa 400
  `bank-account-required`) [PLAN §3.5/6 "Çek tahsilinde varsayılan yol bank (…); hesap 'Tahsil Edilen Hesap' alanından"; §3.5/1–3].
- Tahsildeki evrak: yol `havale`; `hesap` verilmezse tahsil kaydının hesabı kullanılır; başka hesap → **400** (kod planda yok) [PLAN §3.14
  "yol bank, hesap tahsil kaydının hesabıyla ön seçili; başka hesap 400"; §3.5/6 "ön seçilidir ve değiştirilemez"]. Nakit tahsil ve
  tahsil kaydının hesabı pasifken tahsil senaryo kurmaz [BELİRSİZ-29].

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak `tahsil` · `ciro` · `karsiliksiz` | 4xx | [YAYGIN] |
| havale satırı hesabın açılışından önce | 4xx `bank-before-opening` | §5.1 |
| evrak verilen evrak | senaryo kurmaz | — |

#### 4.34 `evrak_odeme` — verilen evrak ödendi

| Parametre | Anlamı |
|---|---|
| `evrak` | Verilen evrakın takma adı |
| `yol` | `nakit` · `havale` |
| `hesap` | Havalede §5.2'ye göre |

Yevmiye: `B v(E) T / A p(yol,H) T` [PLAN §3.7 #9 "B 103 / A 102"; §3.11a "103 yazan her satır verilen senet için 321"]. Durum `odendi`.
Eksi bakiye denetimi kaynakta (§5.3).

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak `odendi` | 4xx | [YAYGIN] |
| havale satırı hesabın açılışından önce | 4xx `bank-before-opening` | §5.1 |
| evrak alınan evrak | senaryo kurmaz | — |

#### 4.35 `evrak_karsiliksiz` — alınan evrak karşılıksız / protestolu

| Parametre | Anlamı |
|---|---|
| `evrak` | Alınan evrakın takma adı |

Yevmiye: `B c(evrakı veren cari) T / A a(E) T`; evrak **tahsildeyse** `A t(E) T` [PLAN §3.11b/1 "Karşılıksız çek / protestolu senet (mevcut
bounce): bugünkü gibi carinin borcuna döner (B 120 / A 101 ya da 121)"; §3.14 "Karşılıksız (bankadan dönen) … Yevmiye mevcut bounce
maddesinde A 101.02"; §3.11 madde 5 "kaydın `close_event_id`'si olan collect/bounce → A 101.02; diğerleri A 101.01"]. Durum `karsiliksiz`.

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak `tahsil` · `karsiliksiz` | 4xx | [YAYGIN] |
| evrak `ciro` ya da verilen evrak | senaryo kurmaz | [BELİRSİZ-29] |

#### 4.36 `tahsile_ver` — Bankaya Tahsile Ver

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `evrak` | evet | Alınan evrakın takma adı (çek ya da senet [PLAN §3.11a]) |
| `hesap` | evet | Banka hesabı (her zaman açıkça verilir) |

Yevmiye (verilme tarihinde): `B t(E) T / A a(E) T` [PLAN §3.14 "Yevmiye: B 101.02 / A 101.01. 101 toplamı … değişmez"; §3.11 madde 5
"etkin tahsil kaydı → B 101.02 / A 101.01 (verilme tarihinde)"; §3.11a]. Durum `tahsilde`, tahsil kaydının hesabı H.

Hesap uygunluğu: aktif ve tür ∈ {vadesiz, ticari, diğer} [ÇIKARIM §3.5 tablo: "Döviz … çekte seçilemez", "Vadeli … Hayır", kredi ve kart
modül formlarında yok]. Pasif, kurumsal kart ya da kredi hesabı → **400 `bank-account-invalid`** [ÇIKARIM §5.2/4]; vadeli hesap senaryo
kurmaz [BELİRSİZ-30].

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak tahsilde | 4xx | [PLAN §3.11 "Çek başına en çok bir etkin kayıt"] |
| evrak `tahsil` · `ciro` · `karsiliksiz` | 4xx | [PLAN §3.14 "yalnız portföydeki (`status='portfolio'`) alınan çekte"] |
| tarih < evrakın alış tarihi | 4xx | [PLAN §3.14 "tarih alış tarihinden önce olamaz"] |
| tarih < hesabın açılış tarihi | 4xx `bank-before-opening` | [ÇIKARIM §3.11 bank:opening "açılıştan önce bağlı satır yok"; §5.1] |
| evrak verilen evrak | senaryo kurmaz | — |

Geri alınan evrak yeniden tahsile verilebilir [YAYGIN; PLAN §3.11 "Çek başına en çok bir **etkin** kayıt"].

#### 4.37 `bankadan_geri_al` — Bankadan Geri Al

| Parametre | Anlamı |
|---|---|
| `evrak` | Tahsildeki alınan evrakın takma adı |

Yevmiye (geri alma tarihinde): `B a(E) T / A t(E) T` [PLAN §3.14 "Bankadan Geri Al: … Yevmiye: B 101.01 / A 101.02"; §3.11 madde 5
"Bankadan Geri Al → B 101.01 / A 101.02 (kapanış tarihinde)"]. Durum `portfoy`; tahsil kaydı kapanır.

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak tahsilde değil (`portfoy` · `tahsil` · `ciro` · `karsiliksiz`) | 4xx | [YAYGIN] |
| tarih < verilme tarihi | senaryo kurmaz | [BELİRSİZ-28] |

#### 4.38 `evrak_sil` — evrakı sil

| Parametre | Anlamı |
|---|---|
| `evrak` | Evrakın takma adı |

Etki: evrakın alış (ya da veriliş) satırları kalkar; evrak hiç girilmemiş gibi [YAYGIN]. Durum `silindi`.

| Durum | Sonuç | Dayanak |
|---|---|---|
| evrak tahsilde | **409 `cheque-deposited`** | [PLAN §3.14 "Tahsildeki çek … silinemez … (409 `cheque-deposited`)"] |
| evrak zaten silinmiş | 404 | [ÇIKARIM §4.28] |
| evrakın tarihi ≤ kilit | 409 `period-locked` | [PLAN §11.1 A6 "`assertOpen`"] |
| evrakın alış/veriliş dışında geçmişi var (tahsile verilip geri alınmış, tahsil, ödeme, ciro, karşılıksız) | senaryo kurmaz | [BELİRSİZ-31] |

Silinmiş evrakla (ikinci silme dışında) işlem senaryo kurmaz [BELİRSİZ-31].

### 4.39–4.42 Şüpheli Ticari Alacaklar — sürüm 4

**Kaynak:** [PLAN §3.11b] (Tekdüzen 128/129, VUK md. 323); planın susan yerleri [KABUL K1–K12]. Hesaplar: **128** Şüpheli Ticari
Alacaklar (cariye bağlı satırlar), **129** Şüpheli Ticari Alacaklar Karşılığı (−), **644** Konusu Kalmayan Karşılıklar, **654** Karşılık
Giderleri, **659** Diğer Olağan Gider ve Zararlar.

**Ortak kurallar:**
- Yalnız **müşteri** carisi (120). Tedarikçi carisine → **409 `doubtful-customer-only`** [PLAN §3.11b/2 "B 128 / A 120"; KABUL K2, W].
- Tarih `tarih` (yoksa `bugun`); §5.1 (ileri tarih 400; kilit 409 `period-locked`) [PLAN §3.11b/4]. Kayıttan sonraki işlemlerin (karşılık,
  çıkarma, değersiz) tarihi kaydın tarihinden önce olamaz → **400 `date-before-record`** [KABUL §3/4].
- Yetki: `yonetici` ve `muhasebe` 200, `personel` 403 [PLAN §3.11b/4 "yetki (cari yönetimi + muhasebe)"; KABUL Q].
- İstek kimliği §5.4 gibi [PLAN §3.11b/4]. Benzer İşlem yok (hedef tanımsız; para satırı değil).
- Çıkarılmış (`cikarildi`) kayda karşılık / değersiz / ikinci çıkarma → **409 `doubtful-closed`** [KABUL U].
- Reddedilen kayıt adımının takma adı oluşmaz; onu anan adımlar `atlananlar`a (§8.5).

**Kaydın türetilen durumu (kâhinin iç durumu; çıktıda `supheliAlacaklar`, §8.3).** Her kayıt R: tutar A_R, tarih d_R, durum `acik` ·
`cikarildi`; türetilen: tahsilEdilen, degersiz, cikarilan, karsilik, kalan = A_R − tahsilEdilen − degersiz − cikarilan. Türetme §4.42a'da.

#### 4.39 `supheli_al` — Şüpheli Alacağa Al

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | evet | Kaydın takma adı (tür **supheli**) |
| `cari` | evet | Müşteri carisi |
| `tutar` | `evrak` yoksa | T |
| `neden` | `evrak` yoksa | `karsiliksiz_cek` · `protestolu_senet` · `dava` · `icra` · `diger` [PLAN §3.11b/2] |
| `evrak` | hayır | Karşılıksız dönmüş alınan evrakın takma adı (kısayol): tutar evrakın tutarı, neden türüne göre `karsiliksiz_cek` / `protestolu_senet`; `tutar` ve `neden` verilmez [PLAN §3.11b/2 "karşılıksız evrakın kartında kısayol"; KABUL K11, H] |
| `aciklama` | hayır | Metin |

Yevmiye: `B 128 T (cari) / A 120 T (cari)`; cari bakiyesi değişmez [PLAN §3.11b/2 "Yevmiye B 128 / A 120. Cari bakiyesi DEĞİŞMEZ"].
Yeni kayıt `acik`, kalan T.

| Durum | Sonuç | Dayanak |
|---|---|---|
| T > carinin 120 bakiyesi (= cari bakiyesi − açık kayıtların kalanları toplamı) ya da o bakiye ≤ 0 | **400 `doubtful-exceeds-balance`** | [PLAN §3.11b/2 "tutar (en çok carinin borç bakiyesi)"; KABUL K1, F "zaten şüphelide olan tutar düşülür"] |
| `evrak` durumu `karsiliksiz` değil (portföyde, tahsilde, tahsil, ciro, silinmiş) | **409** (kod yok) | [KABUL §3/13] |
| `evrak` başka carinin | senaryo kurmaz | — |

#### 4.40 `karsilik_ayir` — Karşılık Ayır

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | silinecekse | Takma ad (tür **hareket**) |
| `kayit` | evet | Şüpheli kaydının takma adı |
| `tutar` | evet | K |

Yevmiye: `B 654 K / A 129 K` [PLAN §3.11b/3 "B 654 Karşılık Giderleri / A 129 Şüpheli Ticari Alacaklar Karşılığı (−)"]. Kaydın karşılığı + K.

| Durum | Sonuç | Dayanak |
|---|---|---|
| kaydın karşılığı + K > kaydın kalanı | **400 `doubtful-provision-exceeds`** | [PLAN §3.11b/3 "yalnız şüpheli tutar kadar"; KABUL K5, G] |
| kayıt `cikarildi` | 409 `doubtful-closed` | [KABUL U] |
| tarih < d_R | 400 `date-before-record` | [KABUL §3/4] |

#### 4.41 `supheli_cikar` — Şüpheliden Çıkar

| Parametre | Anlamı |
|---|---|
| `kayit` | Şüpheli kaydının takma adı |

Yevmiye (çıkarma gününde): kalan X > 0 için `B 120 X (cari) / A 128 X (cari)`; kaydın o anki karşılığı Kk > 0 ise ayrıca `B 129 Kk / A 644 Kk`
(konusu kalmadı) [PLAN §3.11b/2 "'Şüpheliden Çıkar' (geri al) B 120 / A 128"; §3.11b/3 "…ayrılan karşılık kadar B 129 / A 644"; KABUL K4].
Durum `cikarildi`, cikarilan = X, kalan 0, karşılık 0.

| Durum | Sonuç | Dayanak |
|---|---|---|
| kalan 0 (tamamı tahsil edilmiş / değersiz yazılmış) | **409** (kod yok) | [KABUL K4 "çıkarılacak şey yok → 409"] |
| kayıt `cikarildi` | 409 `doubtful-closed` | [KABUL U] |
| tarih < d_R | 400 `date-before-record` | [KABUL §3/4] |

Çıkarılmış kayda yeniden "Şüpheli Alacağa Al" yeni kayıttır (eski kayıt `cikarildi` kalır) [KABUL §3/18].

#### 4.42 `degersiz_yaz` — Değersiz Alacak Yaz

| Parametre | Zorunlu | Anlamı |
|---|---|---|
| `ad` | hayır | Takma ad (tür **hareket**; bu dil sürümünde silinmez, BELİRSİZ-37) |
| `kayit` | evet | Şüpheli kaydının takma adı |
| `tutar` | evet | Z ≤ kaydın kalanı |

Yevmiye: kaydın o anki karşılığı Kk ise Y = min(Kk, Z): `B 129 Y / B 659 (Z − Y) / A 128 Z (cari)` [PLAN §3.11b/3 "karşılık varsa B 129 /
A 128, yoksa B 659 / A 128"; karışık durumda önce karşılık: KABUL K7]. Cari bakiyesi Z kadar kapanır [PLAN §3.11b/3]. Kaydın degersiz + Z,
karşılık − Y.

| Durum | Sonuç | Dayanak |
|---|---|---|
| Z > kaydın kalanı | **400 `doubtful-writeoff-exceeds`** | [KABUL K7, U] |
| kayıt `cikarildi` | 409 `doubtful-closed` | [KABUL U] |
| tarih < d_R | 400 `date-before-record` | [KABUL §3/4] |

Değersiz yazımının fatura açığına etkisi planda yok → o carinin `faturalar.*.acik` alanları `belirsizler`e [BELİRSİZ-36]; `cariler`,
`mizan` ve `supheliAlacaklar` karşılaştırılır.

#### 4.42a Alacak satırının şüpheliden düşmesi ve 644 kuralı (türetme)

[PLAN §3.11b/2 "Tahsilat gelince önce şüpheli tutardan düşer (A 128 yerine A 120 kalır; defter: B 100/102 / A 128 o tutar kadar)"; §3.11b/3
"karşılık hiçbir zaman kaydın kalan şüpheli tutarını aşmaz … kısmi tahsilatta yalnız karşılığın kalanı AŞAN kısmı aynı gün B 129 / A 644 …
tam tahsilde ve Şüpheliden Çıkar'da kalan karşılığın tamamı 644'e gider" (15.10.2026 kararıyla planın açık sözü; önceden KABUL K6); KABUL K3
(her alacak satırı, tarih sırası, en eski kayıt önce, saklanmaz-türetilir), K9 (cari bazında 120 + 128 = cari bakiyesi); §3.11b/2 "Tahsilatta
seçim" (a)–(c): normalCari / kapatilacakFatura / peşin satırı düşmez, taksit kartın tarihine göre]

Kâhin, carinin şüpheli durumunu **her çıktı anında bütün etkin satırlardan yeniden türetir** (hiçbir "tahsil edilen" saklanmaz; tahsilatın
silinmesi kendiliğinden tutarlı). Cari C için olaylar şu anahtarla sıralanır: **(tarih, tür sırası, adım sırası)**, tür sırası:
**al (0) → karşılık (1) → değersiz (2) → alacak satırı (3) → çıkar (4)** [KABUL K3 "Aynı gün sırası: al → karşılık → alacak satırı → çıkar";
değersizin yeri: YAYGIN — aynı günde alacak satırıyla birlikte senaryo kurmaz, BELİRSİZ-35]. Olaylar sırayla işlenir:

- **al R:** R açık kayıtlara eklenir (kalan = A_R, karşılık 0).
- **karşılık (R, K):** R.karşılık += K.
- **değersiz (R, Z):** Y = min(R.karşılık, Z); R.karşılık −= Y; R.degersiz += Z; R.kalan −= Z. Satırlar: `B 129 Y / B 659 (Z − Y) / A 128 Z`.
- **alacak satırı (T):** carinin `A c(C) T` satırı (bkz. aşağıdaki liste). Açık kayıtlar (tarih, adım sırası) sırasıyla — `taksit_tahsilat`
  satırı yalnız **kartın tarihi ≤ d_R** olan kayıtlara uğrar, kartın tarihinden sonra alınmış kayıt atlanır [PLAN §3.11b/2 (c)] — x = min(kalan T,
  R.kalan); R.tahsilEdilen += x; R.kalan −= x; kalan T −= x. Toplam düşülen D = T − kalan: satır **`A 128 D (cari)` + `A 120 (T − D) (cari)`**
  olarak yazılmış sayılır (işlemin kendi tablosundaki `A c(C) T` yerine). Sonra her kayıtta R.karşılık > R.kalan ise fazla F = R.karşılık −
  R.kalan: **`B 129 F / A 644 F`** aynı tarihle; R.karşılık = R.kalan [PLAN §3.11b/3 (15.10 kararı); önceden KABUL K6].
- **çıkar R:** X = R.kalan; `B 120 X / A 128 X`; Kk = R.karşılık: `B 129 Kk / A 644 Kk`; R.cikarilan = X; R.kalan = 0; R.karşılık = 0;
  durum `cikarildi`. Kalan 0 ise çıkarma yazılmaz (409).

**Alacak satırı sayılanlar** (müşteri carisinde `A 120 T` yazan etkin satırlar): `cari_tahsilat` (**`kapatilacakFatura` ve `normalCari`
olmayan**), `taksit_tahsilat` (fazlaAvans'lı T'nin tamamı; kartın tarihi kuralıyla), satıştan iade (`iade`, asıl satış), `evrak_al` (alınan
evrak) [KABUL K3 listesi: "tahsilat, alınan evrak, Alacak Yaz, iade faturası, taksit tahsilatı, kapatılan kartın vazgeçilen kalanı"].
**Düşmeyenler** [PLAN §3.11b/2 (a)–(b), 15.10 kararı]: `kapatilacakFatura` bağlı `cari_tahsilat`, `normalCari: true` tahsilatı ve satış
faturasının **peşin satırı** — `A 120 T` olduğu gibi kalır (yeni satışın parası). Alıştan iadenin geri ödemesi ve müşteri carisine alış
faturası planda ve kabul listesinde yok → şüpheli kaydı olan caride senaryo kurmaz [BELİRSİZ-38]. `cari_odeme`, satış faturası,
`evrak_karsiliksiz`, `evrak_ciro` borç satırıdır (B 120), düşmez.

Kayıt tarihinden **önce** tarihli alacak satırı kaydı düşürmez (sıralama tarihle). Düşülen tutar `kapatilacakFatura` ve §7 açık hesabını
etkilemez (yalnız 120/128 ayrımı). Kayıt silinince (§4.28) o kayıt sıralamadan çıkar ve her şey yeniden türetilir.

**Değişmezler (kâhin öz denetimi):** her kayıtta kalan ≥ 0, karşılık ≤ kalan (çıkarılmışta 0); mizan(128) = Σ açık kayıtların kalanı;
mizan(129) = −Σ karşılık; cari bakiyesi = bakiye(120, C) + bakiye(128, C) [KABUL K9].

---

## 5. Ortak kurallar

### 5.1 Tarih

- İşlem tarihi `bugun`den sonra olamaz → **400**. [PLAN §2.5 "İleri tarihli hareket girilmez"; Aşama 0 "İleri tarihli kayıt
  tahsilatı → 400"]
- Tarih ≤ kilit → **409 `period-locked`** (§4.3).
- Banka hesabına bağlı satırın (havale/kart, hesap atanmış; Banka Fişi; transfer; Kasa↔Banka banka bacağı) tarihi, o hesabın açılış
  tarihinden önce olamaz → **4xx `bank-before-opening`** (durum kodu planda yazılı değil). Açılış günü (D) dahil izinlidir. [PLAN §7
  yeni hata kodları "bank-before-opening"; §3.11 bank:opening "açılıştan önce bağlı satır yok"; §10.3 "Açılış tarihi D'nin **gün
  başındaki** banka bakiyesi S"]
- Hesap atanmamış (102.00/108.00) satırlarda açılış kuralı yoktur.

### 5.2 Hesap seçimi [PLAN §3.5]

**Uygun hesap** (aktif, TRY):
- `havale` yolu ve `kasa_banka`: tür ∈ {vadesiz, ticari, diger}. [PLAN §3.5 tablo "Vadesiz … Evet", "Ticari … Evet", "Diğer …
  Evet", "Vadeli … Hayır; yalnız transfer ve faiz", "Kredi Hesabı … Hayır"]
- `kart` yolu (yalnız ödeme yönü): tür = kurumsal_kart. [PLAN §3.5 "Kurumsal Kredi Kartı … Ödemede ve kurumsal karta gelen iadede"]
  Sürüm 2 (D3 [KARAR]) teyit: cari ödemesi ve alış faturası peşini (stoklu alış dahil) kartla yapılınca satır seçilen kart
  hesabına (309.NN) yazılır; kart hesabı kart limiti kadar eksiye serbesttir (§5.3, L = kartLimiti).

**Kurallar** (her para satırı için, kategori bazında):
1. Hiç uygun hesap yoksa satır hesapsız yazılır: havale → **102.00**, kart → **108.00**. Adımda `hesap` verilmişse → 400. [PLAN §3.5/1
   "Hiç uygun hesap yoksa eski davranış sürer: satıra `fin_ref=''` (102.00/108.00) yazılır"]
2. Tek uygun hesap varsa `hesap` verilmese de o kullanılır. [PLAN §3.5/3 "Tek uygun hesap varsa kendiliğinden seçilir"]
3. Birden çok uygun hesap varsa `hesap` zorunlu; yoksa **400 `bank-account-required`**. [PLAN §3.5/3]
4. Verilen hesap uygun değilse (pasif, vadeli, kredi, havalede kart hesabı, kartta 102 hesabı) **400 `bank-account-invalid`**.
   [ÇIKARIM: §7 kod listesi "bank-account-invalid"; Aşama 5 "Pasif hesap → 400"; Aşama 9 "Kredi hesabından cari ödemesi → 400"]
5. `nakit` yolunda `hesap` verilmez (senaryo hatası).

Banka Fişi, transfer, kart borcu ve kredi işlemlerinde hesap her zaman açıkça verilir; uygunluk o işlemin tablosundadır, pasif
hesap → 400 `bank-account-invalid`.

"**Hesaba bağlı satır**" = hesabı atanmış (102.00/108.00 olmayan) havale/kart satırı, Banka Fişi satırı, transfer ve Kasa↔Banka'nın
banka bacağı.

### 5.3 Eksi bakiye (K7)

**Etkin politika:**
- **Kasa (100):** `baslangic.ayarlar.kasaEksiBakiye` ya da sonraki `ayar` adımı. [BELİRSİZ-1: plan varsayılanı söylemiyor]
- **102 ve 309 türü hesap:** `bakiyeDogrulandi = false` ise `kontrol_yok`; `true` ise hesabın `hesap_eksi_politika` değeri, o yoksa
  `uyar`. [PLAN §3.9 "Hesap 'Bakiye Doğrulandı' olana kadar 'Kontrol Yok'… Sonrası varsayılan 'Uyar'"; §8.11 "Banka hesapları |
  **Uyar** (bakiye doğrulanana kadar Kontrol Yok; KMH ve kart limitine kadar serbest)"]
- **Kredi (300):** kâhin denetlemez; senaryo kredi hesabını `bakiyeDogrulandi: false` açar. [BELİRSİZ-2]
- **102.00 / 108.00:** denetim yok. [PLAN §3.9 "Kapsam dışı: Hesabı atanmamış satırlar ve POS (108.T)"]

**Denetim** (yalnız işlemin **azalttığı** her hesap h için, işlem yazıldıktan **sonra**) [PLAN §3.9 "Denetim hesap bazında, işlemin
içinde ve yazımdan **sonraki** son durumla yapılır. Bakiye = min(işlem günündeki bakiye, bütün hareketlerle bakiye) + KMH ya da kart
limiti."; §9.2/4 "azalan her hesapta son durum eksi bakiye denetlenir"]:

```
Bh(t)   = h'nin işaretli defter bakiyesi (Σborç − Σalacak), tarihi ≤ t olan satırlarla
Bh(tüm) = aynı, bütün satırlarla
d       = işlemin tarihi (silmede silinen satırın tarihi)
m       = min(Bh(d), Bh(tüm)) + Lh        Lh = kmhLimiti (102), kartLimiti (309), 0 (Kasa)
m < 0 ise ihlal
```

**Sonuç:**

| Politika | `yineDeKaydet` yok | `yineDeKaydet: true` |
|---|---|---|
| `kontrol_yok` | geçer | geçer |
| `uyar` | **409 `cash-negative`** [ÇIKARIM §7 "Mevcut `cash-negative` ve `cash-blocked` kodlarına `accountId` alanı eklenir"] | geçer [PLAN §3.9 "Uyarıyı geçmek ('Yine de Kaydet', `cashForce`) `bank.move` ister"] |
| `engelle` | **409 `cash-blocked`** [PLAN §12.5 adım 37 "öbürü 409 `cash-blocked`"] | 409 `cash-blocked` |

İhlal yoksa `yineDeKaydet` etkisizdir.

**Ret kodu her hesap türünde aynıdır** (sürüm 2, D2 [KARAR]): Kasa, 102.NN ve 309.NN için `cash-negative` (Uyar) ve `cash-blocked`
(Engelle); banka/kart hesabında yanıt ihlal eden hesabın `accountId`'sini de taşır (çıktıda karşılaştırılmaz). `bank-negative`,
`bank-blocked` gibi başka bir kod farktır (BULGU). Onay bayrağı tektir: `cashForce` (koşucu `yineDeKaydet: true` için yalnız bunu
gönderir) Kasa'nın ve banka/kart hesabının Uyar'ını birlikte geçer.

### 5.4 İstek kimliği ve Benzer İşlem

**İstek kimliği** [PLAN §3.3 adım 1 "`request_keys` kalıcı, aynı işlem; aynı kimlik + farklı içerik → 409"; §3.10/1 "anahtar
kullanıcı\|kapsam\|kimlik"]:
- Anahtar = (kullanıcı, `islem`, `istekKimligi`).
- Gövde = adımın `id`, `ad`, `not`, `istekKimligi`, `benzerOnay`, `yineDeKaydet`, `ayniAnda` dışındaki bütün alanları. İç içe takma ad
  tanımları da gövdeye girmez: `odeme.taksit.ad` ve `banka_masraf.fatura` (sürüm 2, D4). Anılan takma adlar andıkları varlık olarak
  karşılaştırılır (yinelemenin ikinci adıyla anılan varlık, ilk adla anılanla aynıdır). `kullanici` yoksa `Y`; deftere yazan işlemde
  `tarih` yoksa o günün tarihi.
- Aynı anahtarlı **başarılı** önceki adım varsa:
  - gövde aynıysa bu adım etkisizdir; `yinelenenler`e yazılır, ret değildir; `ad`'ı önceki adımın hareketini anar. [PLAN §3.10/1
    "Sunucu `replayed:true` döndüğünde arayüz yazar: 'Bu işlem zaten kaydedildi …; ikinci kez yazılmadı.'"] Yinelemenin tanımladığı
    her takma ad (`ad`, `odeme.taksit.ad`, `banka_masraf.fatura`) önceki adımın aynı türdeki varlığına bağlanır ve **çıktı haritalarında
    (`faturalar`, `taksitKartlari`, `bankaHesaplari`, `hesapKodlari`, `eksiBakiyeDenetimi`, `cariler`, `stok`) ikinci anahtar olarak
    aynı değerle yer alır** (sürüm 2, D4; §8.3 "her … adı"). Mizan ve özet hesap kodundan hesaplandığı için çift sayılmaz.
  - Yineleme tanıma, adımın "senaryo kurmaz" denetimlerinden (BELİRSİZ-4, 6, 10, 14 …) **önce** yapılır: aynı gövdeli yineleme
    etkisiz olduğundan ikinci kez uygulansaydı sınırı aşacak olması onu geçersiz yapmaz (sürüm 2; §5.6 sırası 3 → 4).
  - gövde farklıysa **409** (kod planda yok).
- Reddedilmiş adımın kimliği hatırlanmaz; aynı kimlikle yeniden gönderim yeni istek gibi değerlendirilir. [ÇIKARIM §3.3 adım 10
  "`requests.remember(key, hash, ref)` ← aynı işlemde" — başarısız işlem geri alınır]

**Benzer İşlem** (yalnız `benzerIslemUyarisi = acik` iken) [PLAN §3.10/2]:
- Kapsam: hesaba bağlı satır yazan `cari_tahsilat`, `cari_odeme`, `taksit_tahsilat`. Nakit ve hesap atanmamış satırlar denetlenmez.
  [PLAN §3.10/2 "Kapsam: Yalnız hesaba bağlı (`fin_ref` dolu) banka, POS ve kurumsal kart satırları. Nakit ve hesabı atanmamış
  satırlar denetlenmez."]
- Anahtar: (yön, yol, hesap, cari, tutar, tarih, hedef). Hedef: `cari_*` için `kapatilacakFatura` (yoksa "hedefsiz"); taksit için
  `taksitNo` verilmişse (kart, taksitNo), değilse kart. [PLAN §3.10/2 "**Anahtar:** yol, hesap/POS, cari, yön, tutar, tarih ve
  **hedef**. Pencere aynı iş günüdür"; "**Hedef:** taksit kalemi (seçilmemişse kart), fatura (Kapatılacak Fatura …)"]
- Aynı anahtarlı **etkin** (silinmemiş) önceki satır varsa ve `benzerOnay` yoksa → **409 `bank-similar`**. [YAYGIN: silinmiş satır
  sayılmaz — ama bkz. BELİRSİZ-19]
- Fatura peşin satırları ve iade geri ödemeleri hiçbir zaman benzer değildir: hedefleri o adımda yeni açılan belgedir (§4.13).
- Kasa↔Banka, transfer ve Banka Fişleri: kâhin Benzer İşlem reddi üretmez; senaryo aynı gün, aynı hesap ve aynı tutarlı ikincisini
  yalnız `benzerOnay: true` ile yazar. [BELİRSİZ-4]
- "Aynı iş günü" = aynı takvim günü; senaryo bu işlemleri hafta içi tarihle yazar. [BELİRSİZ-5]

### 5.5 Yetki

`200` = izin var · `403` = reddedilir · `B` = plan söylemiyor, senaryo bu birleşimi kurmaz [BELİRSİZ-18].

| İşlem | yonetici | muhasebe | personel | Dayanak |
|---|---|---|---|---|
| `ayar`, `donem_kilidi` | 200 | B | B | yönetim ucu |
| `hesap_ac`, `hesap_durum`, `hesap_eksi_politika` | 200 | 200 | 403 | [PLAN §9.1 `bank.accounts` "admin, muhasebe"] |
| `acilis_duzelt` | 200 | 200 | 403 | [PLAN §7 "accounts (düzeltmede + cancel)"] |
| `kasa_acilis`, `kasa_hareket` | 200 | B | B | — |
| `cari_ac`, `urun_ac`, `stok_giris`, `fatura`, `iade` | 200 | B | B | — |
| `cari_tahsilat` (nakit, havale) | 200 | 200 | 200 | [PLAN §2.5 "`accounts.collect` … herkese açık"; §9.2/2 "Personelin havale ve POS tahsilatı **bozulmaz**"; §12.5 adım 36 "tahsilat girişi 200"] |
| `cari_odeme` (havale, kart) | 200 | 200 | 403 | [PLAN §9.2/3 "Bankadan çıkış: Modülün yönetim yetkisi + `bank.move`"; Aşama 5 "Personel ödeme → 403"; §12.5 adım 37 muhasebe öder] |
| `cari_odeme` (nakit) | 200 | B | B | — |
| `taksit_tahsilat` | 200 | 200 | 200 | [PLAN §2.5 "`plans.collect` herkese açık"] |
| `kasa_banka` | 200 | B | 403 | [PLAN §9.2/3 "Kasa↔Banka için `cash.manage` + `bank.transfer`"; §12.5 adım 36 "transfer 403"] |
| `transfer`, `kredi_kullanim`, `kredi_odeme` | 200 | 200 | 403 | [PLAN §9.1 `bank.transfer` "admin, avukat, muhasebe"] |
| `banka_masraf` (BSMV/Yok), `faiz_*`, `diger_*`, `kart_borcu_odeme` | 200 | 200 | 403 | [PLAN §9.1 `bank.move`] |
| `banka_masraf` (KDV) | 200 | B | 403 | + `invoices.manage` |
| `ters_kayit` | 200 | 200 | 403 | [PLAN §9.1 `bank.cancel`] |
| `sil` (hesaba bağlı hedef) | 200 | B | 403 | [PLAN §9.2/4 "Silme: modül yetkisi + `bank.cancel`"; §12.5 adım 36 "kendi havale tahsilatını silme 403"] |
| `sil` (nakit hedef, adımı yapan kişinin kendi girdiği) | 200 | B | 200 | [PLAN §2.5 "Personel kendi girdiği tahsilatı düzeltip silebilir"; §9.2/4 "Nakit ve hesabı atanmamış satırlarda bugünkü kural sürer"] |
| `sil` (nakit hedef, başkasının girdiği) | 200 | B | B | — |
| `yineDeKaydet` bir banka hesabının Uyar'ını geçiyorsa | 200 | 200 | B | [PLAN §3.9 "`bank.move` ister"] |
| `evrak_al`, `evrak_ver`, `evrak_ciro`, `evrak_tahsil`, `evrak_odeme`, `evrak_karsiliksiz`, `tahsile_ver`, `bankadan_geri_al`, `evrak_sil` (sürüm 3) | 200 | B | B | [PLAN §3.7 #9, #21 "cheques.manage"; §9.1 bu yetkinin rollerini saymıyor] |
| `supheli_al`, `karsilik_ayir`, `supheli_cikar`, `degersiz_yaz`, `sil` (hedefi şüpheli kaydı ya da karşılık) (sürüm 4) | 200 | 200 | 403 | [PLAN §3.11b/4 "yetki (cari yönetimi + muhasebe)"; KABUL Q "admin ve muhasebe; personel 403"] |
| `taksit_tahsilat` (`fazlaAvans: true`, tutar > kalan) (sürüm 4) | 200 | B | 403 | [PLAN §3.10/3 "yalnız `plans.manage` sahibine açık"; §2.5 personelde yalnız `plans.collect`; muhasebenin `plans.manage`'ı planda yok → B] |

### 5.6 Ret önceliği [ÇIKARIM §3.3 sırası]

Bir adımda birden çok ihlal varsa kâhin ilkini yazar:
1. 403 yetki
2. 400 girdi (tutar biçimi/aralığı, ileri tarih, hesap seçimi, kaynak = hedef, IBAN, `ucretVergi` eksik; tahsildeki evrakta başka hesap)
3. İstek kimliği (yineleme ya da 409)
4. 404 hedef yok; 409 kilit, açılış öncesi, açılış kuralları, ters kaydı iki kez; iade sınırı; evrak durumu (`cheque-deposited`
   ve evrak durumu 4xx'leri, tahsile vermede alıştan önceki tarih; sürüm 3); sürüm 4: K8 taksit (`plan-paid`, `plan-overpay`,
   `plan-overpay-permission`; PLAN §3.10/3 "adım 2'de") ve şüpheli kuralları (`doubtful-*`, `date-before-record`, 409'lar; §4.15
   `doubtful-normal-exceeds` de burada — program girdi denetiminden sonra, eksi bakiye / Benzer İşlem'den önce bakar)
5. 409 `bank-similar`
6. 409 eksi bakiye

Sürüm 4: `plan-overpay-permission` 403 olsa da yetki (1) değil hedef kuralı (4) sırasındadır (yalnız tutar kalanı aşınca sorulur); senaryo
tek ihlal kurduğundan sıra sonucu değiştirmez.

Plan sıralamayı yalnız bankanın iç adımları için verir ("1 hit = requests.lookup … 2 prep … 4 similar … 8 guardFinal"); öncelik bu
yüzden ÇIKARIM'dır. Senaryo bir adımda **tek ihlal** kurar; kurarsa karşılaştırıcı o adımda yalnız durum sınıfını (4xx) karşılaştırır
[BELİRSİZ-17].

### 5.7 Ret kataloğu

Kâhin `retler`e (§8.5) şu değerleri yazar. `kodDayanak: "PLAN"` = plan bu durum için bu kodu adıyla söylüyor.

| Durum (§) | `durum` | `kod` | `kodDayanak` |
|---|---|---|---|
| Yetkisiz (§5.5) | 403 | null | null |
| Tutar biçimi/aralığı, 3 ondalık banka ucunda (§6.2) | 400 | null | null |
| İleri tarih (§5.1); açılış ileri tarih (§4.4) | 400 | null | null |
| Birden çok uygun hesap, hesap yok (§5.2/3) | 400 | `bank-account-required` | PLAN |
| Hesap uygun değil / pasif (§5.2/4) | 400 | `bank-account-invalid` | CIKARIM |
| Uygun hesap yokken `hesap` verildi (§5.2/1) | 400 | `bank-account-invalid` | CIKARIM |
| Geçersiz IBAN (§4.4) | 400 | null | null |
| Aynı IBAN (§4.4) | 409 | null | null |
| Aynı hesap kodu (§4.4) | `"4xx"` | null | null |
| KMH limiti ya da eksi açılış vadesiz dışı hesapta (§4.4, §4.7; sürüm 2) | `"4xx"` | null | null |
| Vadeli hesapta banka masrafı (BSMV/Yok), diğer gelir/gider (§4.20, §4.23; sürüm 2) | 400 | `bank-account-invalid` | CIKARIM |
| Transferde kaynak = hedef (§4.19) | 400 | null | null |
| Kilitli tarih (§4.3, §5.1) | 409 | `period-locked` | CIKARIM |
| Açılış öncesi tarih (§5.1) | `"4xx"` | `bank-before-opening` | CIKARIM |
| Açılış ilk hareketten sonraya (§4.7) | 409 | `bank-opening-after-first` | PLAN |
| Kilitli açılışı düzeltme (§4.7) | 409 | null | null |
| Aynı istek kimliği, farklı gövde (§5.4) | 409 | null | null |
| Silinmiş hedefi silme (§4.28) | 404 | null | null |
| Silinemeyen hedef (Banka Fişi, transfer) (§4.28) | `"4xx"` | null | null |
| Ters kaydı iki kez (§4.27) | 409 | null | null |
| Ters kaydedilemeyen hedef (§4.27) | `"4xx"` | null | null |
| İade miktarı ya da tarihi (§4.14) | `"4xx"` | null | null |
| Σ peşin > toplam (§4.13) | `"4xx"` | null | null |
| Tahsildeki evrakı ciro etme ya da silme (§4.32, §4.38; sürüm 3) | 409 | `cheque-deposited` | PLAN |
| Evrak durumu işleme uygun değil (§4.32–4.37; sürüm 3) | `"4xx"` | null | null |
| Tahsile vermede tarih alıştan önce (§4.36) | `"4xx"` | null | null |
| Tahsildeki evrakı başka hesaba tahsil (§4.33) | 400 | null | null |
| Tahsile vermede hesap uygun değil / pasif (§4.36) | 400 | `bank-account-invalid` | CIKARIM |
| Tahsile vermede hesabın açılışından önce (§4.36) | `"4xx"` | `bank-before-opening` | CIKARIM |
| Silinmiş evrakı silme (§4.38) | 404 | null | null |
| Benzer İşlem (§5.4) | 409 | `bank-similar` | PLAN |
| Eksi bakiye, Uyar (§5.3) | 409 | `cash-negative` | CIKARIM |
| Eksi bakiye, Engelle (§5.3) | 409 | `cash-blocked` | PLAN |
| Kapanmış karta taksit tahsilatı (§4.17; sürüm 4) | 409 | `plan-paid` | PLAN |
| Kalanı aşan taksit tahsilatı (§4.17; sürüm 4) | 409 | `plan-overpay` | PLAN |
| Fazlasını Avans Yaz yetkisiz (§4.17; sürüm 4) | 403 | `plan-overpay-permission` | CIKARIM (plan yalnız "`plans.manage` sahibine açık" der; kod adı programın) |
| Şüpheliye tedarikçi carisi (§4.39; sürüm 4) | 409 | `doubtful-customer-only` | KABUL |
| Şüpheli tutarı 120 bakiyesini aşar (§4.39) | 400 | `doubtful-exceeds-balance` | KABUL |
| Açık şüpheli kayıtlı caride `normalCari` / bağlı tahsilat 120 bakiyesini aşar (§4.15; sürüm 4 eki) | 409 | `doubtful-normal-exceeds` | PLAN |
| Kısayoldaki evrak karşılıksız değil (§4.39) | 409 | null | null |
| Karşılık kalanı aşar (§4.40) | 400 | `doubtful-provision-exceeds` | KABUL |
| Değersiz kalanı aşar (§4.42) | 400 | `doubtful-writeoff-exceeds` | KABUL |
| Çıkarılmış kayda işlem (§4.40–4.42) | 409 | `doubtful-closed` | KABUL |
| Kalanı 0 olan kaydı çıkarma (§4.41) | 409 | null | null |
| Kayıt tarihinden önce tarihli karşılık / çıkarma / değersiz (§4.39–4.42) | 400 | `date-before-record` | KABUL |

`kodDayanak: "KABUL"` = kod adını kabul belgesi veriyor (plan değil); program başka kod verirse fark İNCELE (§1 [KABUL] etiketi).

### 5.8 Eşzamanlı adımlar (`ayniAnda`)

- Aynı `ayniAnda` değerini taşıyan **ardışık** adımlar bir gruptur (en çok 4 adım). Koşucu grubun isteklerini aynı anda gönderir
  (her biri kendi kullanıcısıyla).
- Kâhin grubun her sıralamasını (en çok 24) ayrı ayrı uygular; farklı sonuçları `alternatifler` listesine yazar. Programın sonucu
  alternatiflerden birine eşit olmalıdır. [PLAN §9.2/12 "Hedef kuralları (taksit kalanı), eksi bakiye ve benzer işlem BEGIN IMMEDIATE
  içinde" → işlemler sıralanabilir]
- Grupta `kontrol` olmaz.

---

## 6. Tutar hesapları

### 6.1 Yuvarlama

Bütün hesaplar tamsayı kuruşla yapılır; kayan nokta kullanılmaz. Bölmede yarım birim sıfırdan uzağa yuvarlanır [PLAN §5.1 "yarım
birim sıfırdan uzağa (`roundMoney` ile aynı sonuç)"; §2.1]:

```
rh(a, b) = (2a + b) // (2b)        a ≥ 0, b > 0, tamsayı
```

Örnek: rh(2000000×100, 120) = rh(200000000, 120) = 1666667 (16.666,67); rh(1050, 105) = 10 (gerçek 10,0 → 10).

### 6.2 Ham tutar (`<alan>Ham`)

`<alan>Ham` (§3.3) ile gönderilen tutar:

- **Banka uçları** (`hesap_ac`, `acilis_duzelt`, `transfer`, `banka_masraf`, `faiz_*`, `diger_*`, `kart_borcu_odeme`, `kredi_*`):
  2'den çok ondalık, eksi, sıfır ya da 1e12 TL üstü → **400**. [PLAN §5.1 "Banka uçlarında `parseMinor`; 2'den çok ondalık 400,
  sessizce yuvarlanmaz"; Aşama 2 "3 ondalık, '0,005', 1e13 → 400"; Aşama 4 "Eksi tutar ya da 1e13 → 400"]
- **Modül uçları** (`cari_tahsilat`, `cari_odeme`, `fatura` kalem fiyatı): 3 ondalık rh ile kuruşa yuvarlanır ("1,005" → 1,01);
  sıfır, eksi ya da 1e12 TL üstü → 400. [PLAN §2.1 "Girişte `parseAmount` ve `roundMoney`; yarım kuruş sıfırdan uzağa
  yuvarlanır"] ve [ÇIKARIM §5.1: "2'den çok ondalık 400" kuralı açıkça "Banka uçlarında" diye sınırlanmış]
- Öbür işlemlerde `<alan>Ham` kullanılmaz [BELİRSİZ-22].

### 6.3 Fatura kalemi

Kalem için q = miktar, f = birimFiyat (kuruş), r = KDV oranı (1/10/20), p = iskonto baz puanı (yoksa 0). brüt = q × f.

| Durum | Matrah M | KDV K | Toplam T | Dayanak |
|---|---|---|---|---|
| KDV dahil, iskontosuz | rh(brüt × 100, 100 + r) | brüt − M | brüt | [PLAN §12.5 adım 6 "Matrah 16.666,67, KDV 3.333,33, Toplam 20.000"] |
| KDV dahil, iskontolu | H − rh(H × p, 10000); H = rh(brüt × 100, 100 + r) | rh(M × r, 100) | M + K | [YAYGIN: iskonto KDV hariç tutara uygulanır] |
| KDV hariç | brüt − rh(brüt × p, 10000) | rh(M × r, 100) | M + K | [YAYGIN] |

- Yuvarlama **kalem toplamı** üzerinden yapılır, birim fiyat üzerinden değil: [PLAN §12.5 adım 33 mizanı "600 Satışlar 35.000,00"
  = 16.666,67 + 8.333,33 (Ürün B 10 × 1.000, toplamdan) + 10.000,00; birim üzerinden 8.333,30 olurdu ve 600 = 34.999,97 çıkardı].
- Belge matrahı, KDV'si ve toplamı kalemlerin toplamıdır [YAYGIN]. Senaryo her belgede bir KDV oranı ve dahil/hariç birleşimi için
  en çok bir kalem yazar [BELİRSİZ-12]; iskontolu kalemde miktar 1'dir [BELİRSİZ-13].

### 6.4 BSMV, KDV'li masraf, stopaj

- BSMV oranı %5. [PLAN K2 "Banka masrafı ve banka POS'u komisyonunda BSMV %5 (KDVK 17/4-e)"]
  - hariç: BSMV = rh(U × 5, 100); dahil: gider = rh(U × 100, 105), BSMV = U − gider. [PLAN §3.7 #12; §4.3 "BSMV = kom − round(kom/1,05)"]
- KDV'li masraf: §4.20.
- Stopaj: S = rh(F × bp, 10000). [PLAN §3.7 #14; §8.11 "koda sabit oran yazılmaz"]

---

## 7. Fatura açığı ve taksit kartı

Belge: satış faturası, alış faturası, satıştan iade, alıştan iade, KDV'li masraf faturası (alış).

| | Alacak belgeleri (cari bize borçlu) | Borç belgeleri (biz cariye borçluyuz) |
|---|---|---|
| Belgeler | satış faturası, alıştan iade | alış faturası, satıştan iade, KDV'li masraf faturası |
| Onları kapatan satırlar | giriş satırları | çıkış satırları |

- **Giriş satırı:** `cari_tahsilat`, satış peşini, alıştan iadenin geri ödemesi, `taksit_tahsilat`.
- **Çıkış satırı:** `cari_odeme`, alış peşini, satıştan iadenin geri ödemesi.
- **Bağsız giriş** = `kapatilacakFatura`'sız `cari_tahsilat`; **bağsız çıkış** = `kapatilacakFatura`'sız `cari_odeme`. Peşin satırlar,
  iade geri ödemeleri ve taksit tahsilatları her zaman kendi belgesine/kartına bağlıdır; bağsız havuza girmez.
- [ÇIKARIM §2.5 "Fatura kapama: Ödeme havuzuna yalnız ödeme rolü (`recvPay`/`payPay`) taşıyan satır giriyor"]

**Kurallar** (her cari için; yalnız etkin satırlarla; sonuç son durumdan yeniden hesaplanır, sırası önemli değildir):

1. Belgenin peşin satırları kendi belgesini kapatır. [PLAN §3.7 #4; §5.3 "`invoices.payment_json.cash[]`"]
2. İadenin geri ödemesi (nakit/havale) iade belgesini kapatır. [YAYGIN]
3. Taksitli satış faturasının açığı = taksit kartının kalanı (= T − Σ peşin − Σ kart tahsilatı). [YAYGIN]
4. `kapatilacakFatura` ile bağlı satır o belgeyi kapatır. [PLAN §4.3/2 "Bu öğe yalnız 1. adımda (bağlı ödemeler …) kendi faturasına
   kapar"; §8.10 "Bağ türü: Peşin · Kapatılacak Fatura · Otomatik (En Eski) · Komisyon Kesintisi (Bağlı)"]
5. Geri ödenmemiş iadenin (`geri: acik`) tutarı, asıl faturanın 1–4'ten sonra kalan açığından düşülür (en çok o açık kadar). Aynı
   asıl faturanın birden çok iadesi belge sırasıyla (tarih, eşitse adım sırası) düşülür. Düşülemeyen kısım iadenin **artanıdır**.
   [YAYGIN]. Geri ödenen iade (kural 2) asıl faturaya hiç düşülmez.
6. **İade artanı — otomatik en eskiden kapama** (sürüm 2, D1 [KARAR, 10.10.2026: "geri ödenmemiş satıştan iadenin (ya da alıştan
   iadenin) asıl faturayı aşan alacağı, aynı carinin aynı yöndeki en eski açık belgesini kapatır; kapatamadığı kalan iade belgesinin
   açığıdır" — yaygın programlardaki otomatik en eskiden kapama]):
   - Satıştan iadenin artanı, aynı carinin **taksitsiz satış faturalarının** 1–5 sonrası kalan açıklarına; alıştan iadenin artanı aynı
     carinin **alış faturalarının ve KDV'li masraf faturalarının** kalan açıklarına **en eski belgeden** başlayarak dağıtılır (belge
     tarihi, eşitse adım sırası). Hedef yalnız asıl belge türüdür; iade belgeleri birbirini bu kuralla kapatmaz.
   - Birden çok iadenin artanı iade belge sırasıyla (tarih, adım sırası) dağıtılır.
   - Dağıtılamayan artan, o iade belgesinin açığı olarak kalır (avans sayılmaz).
7. **Bağsız satırlar — otomatik en eskiden kapama:** bağsız giriş satırlarının toplamı **taksitsiz** alacak belgelerinin (satış
   faturası, alıştan iade); bağsız çıkış satırlarının toplamı borç belgelerinin (alış faturası, satıştan iade, KDV'li masraf faturası)
   1–6 sonrası kalan açıklarına **en eski belgeden** başlayarak dağıtılır (belge tarihi, eşitse adım sırası). Dağıtılamayan artan
   avanstır. [PLAN §8.10 "Otomatik (En Eski)"; §4.3/2 "2. adım (FIFO, en eski yükümlülük)"; §12.5 adım 9–12 "Tahsilat 20.000 …
   fatura 'Ödendi'"; belge tarihi ve adım sırası: YAYGIN] (Sürüm 1'in kural 6'sı; sürüm 2'de iade artanından sonra uygulanır.)

```
açık(b) = 1–7 sonrası kalan, ≥ 0
taksitKartlari[k].toplam = T − Σpeşin ; odenen = Σ etkin taksit_tahsilat ; kalan = toplam − odenen
```

**Değişmez (kâhin öz denetimi):**

```
cariBakiye(C) = Σ açık(alacak belgeleri) − Σ açık(borç belgeleri) − dağıtılmamış giriş + dağıtılmamış çıkış
```

**Kesinlik.** Aşağıdakilerden biri bir caride varsa o carinin bütün `faturalar.*.acik` ve `taksitKartlari.*` alanları
`belirsizler`e yazılır ve karşılaştırılmaz:
- taksitli satış faturası + (bağsız giriş satırı ya da kural 5 sonrası artanı sıfırdan büyük satıştan iade) [BELİRSİZ-7] (sürüm 2:
  iade artanının taksitli faturayı / taksit kartını kapatıp kapatmadığı planda yok)
- bağsız giriş + borç belgesi, ya da bağsız çıkış + alacak belgesi [BELİRSİZ-11]
- (BELİRSİZ-9 sürüm 2'de kalktı: iade artanı ile bağsız satırın sırası kural 6 → 7 ile tanımlı; iadesi olan caride her bağsız satır
  zaten BELİRSİZ-11'e girer, çünkü iade belgesi ve asıl fatura karşı yönlerdedir.)
- (sürüm 3) carinin etkin evrak satırı var (alış, veriliş, ciro, karşılıksız; silinen evrakın satırları sayılmaz) [BELİRSİZ-27]: yalnız
  o carinin `faturalar.*.acik` alanları; taksit kartları evraktan etkilenmez, karşılaştırılır.

**Evrak ve değişmez (sürüm 3).** Evrak satırları §7 kurallarına girmez (hiçbir belgeyi kapatmaz, bağsız havuza girmez). Değişmez:
`cariBakiye(C) = Σ açık(alacak) − Σ açık(borç) − dağıtılmamış giriş + dağıtılmamış çıkış + evrakNet(C)`; evrakNet(C) = C'nin etkin
evrak satırlarının cari hesaptaki işaretli toplamı (alışta −T, verilişte +T, ciroda +T, karşılıksızda +T).

**Sürüm 4 ekleri.**
- Taksit kartı: `odenen = Σ etkin taksit_tahsilat` (fazlaAvans'lı tutarın tamamı dahil); `kalan = max(0, toplam − odenen)`; fazla =
  `max(0, odenen − toplam)` carinin avansıdır: değişmezde "dağıtılmamış giriş" terimine girer, hiçbir belgeyi kapatmaz [BELİRSİZ-34: o carinin
  `faturalar.*.acik` alanları karşılaştırılmaz]. Kural 3'te taksitli faturanın açığı = kart kalanı (0 olabilir).
- Şüpheli: "Şüpheli Alacağa Al", "Karşılık Ayır" ve "Şüpheliden Çıkar" §7'ye girmez (cari bakiyesi 120 + 128'in toplamıdır; §4 gösterimi).
  "Değersiz Alacak Yaz" cari bakiyesini Z kadar kapatır ama hangi belgeyi kapattığı planda yok [BELİRSİZ-36]; değişmezde ayrı terim:
  `cariBakiye(C) = … + evrakNet(C) − Σ degersiz(C)`; o carinin `faturalar.*.acik` alanları `belirsizler`e (taksit kartları karşılaştırılır).

---

## 8. Çıktı biçimi

### 8.1 Üst düzey

Örnek: `kabul-1-16` senaryosunun son durumu (tam hâli `senaryolar/kabul-1-16.beklenen.json`).

```json
{
  "dil": "destekofis-senaryo/2",
  "senaryo": "kabul-1-16",
  "kaynak": "kahin",
  "mizan":            { "100": { "borc": 1000000, "alacak": 0 }, "102.01": { "borc": 9000000, "alacak": 0 },
                        "102.02": { "borc": 7000000, "alacak": 0 }, "120": { "borc": 0, "alacak": 0 },
                        "391": { "borc": 0, "alacak": 333333 }, "500": { "borc": 0, "alacak": 15000000 },
                        "600": { "borc": 0, "alacak": 1666667 } },
  "bankaHesaplari":   { "ZIR": 9000000, "GAR": 7000000 },
  "kasa":             1000000,
  "cariler":          { "ABC": 0 },
  "stok":             { "URA": 9, "URB": 25 },
  "faturalar":        { "F1": { "toplam": 2000000, "matrah": 1666667, "kdv": 333333, "acik": 0 } },
  "taksitKartlari":   {},
  "supheliAlacaklar": {},
  "hesapKodlari":     { "ZIR": "102.01", "GAR": "102.02" },
  "eksiBakiyeDenetimi": { "ZIR": "uyar", "GAR": "uyar" },
  "ozet":             { "gercekBanka": 16000000, "hesabiAtanmamis": 0, "kartVeKrediBorcu": 0, "kasaVeGercekBanka": 17000000 },
  "retler":           [],
  "yinelenenler":     [],
  "atlananlar":       [],
  "araDurumlar":      {},
  "belirsizler":      []
}
```

- **Bütün tutarlar kuruş tamsayısıdır** (JSON tamsayı; ondalık nokta yok). Stok miktarı tamsayı.
- `kaynak`: `kahin` · `program` · `plan-elle` (elle yazılmış beklenen).
- Koşucu ayrıca `okumaKaynaklari` (her alanın hangi rapordan/ekrandan okunduğu), `programSurumu` ve `commit` yazar; karşılaştırıcı
  bunları karşılaştırmaz.

### 8.2 `mizan` — bakiye mizanı

- Anahtar: **yaprak** hesap kodu. Alt hesabı olan ana hesaplar (102, 108, 300, 309; sürüm 3: 101, 121) yalnız alt hesaplarıyla
  yazılır (`102.00`, `102.01`, `101.01`, `121.02`, …); `"102"`, `"101"`, `"121"` anahtarı hiç yazılmaz. 103 ve 321 üç haneyle. Alt hesabı olmayanlar üç haneyle (`100`, `120`, `391`, …). Cari hesapları (120, 320)
  ana kod düzeyinde toplanır; cari ayrıntısı `cariler`dedir.
- Değer: `{borc, alacak}` = **bakiye sütunları**: borc = max(0, ΣB − ΣA), alacak = max(0, ΣA − ΣB). İkisi birden 0'dan büyük olamaz.
  [PLAN §12.5 "Adım 33 sonunda mizan … Borç bakiyesi | Alacak bakiyesi"]
- Hareket görmüş her hesap yazılır (bakiyesi 0 olsa da). Yazılmayan hesap {0, 0} sayılır.
- Σ borc = Σ alacak olmalı (kâhin öz denetimi).
- Neden toplam değil bakiye: hareket toplamları programın ara kayıt düzenine (ör. peşin satırın 120 üzerinden geçmesi, ters kaydın
  ayrı fiş olması) duyarlıdır; bakiye duyarlı değildir.

### 8.3 Varlık alanları

| Alan | Anahtar | Değer |
|---|---|---|
| `bankaHesaplari` | açılmış her banka hesabının takma adı (kart ve kredi dahil) | alt hesabının işaretli defter bakiyesi (Σborç − Σalacak). 102'de artı = bankadaki para; 309/300'de eksi = borcumuz. |
| `kasa` | — | 100'ün işaretli bakiyesi |
| `cariler` | açılmış her cari | carinin işaretli bakiyesi (Σborç − Σalacak): **borçlu +**, alacaklı − |
| `stok` | açılmış her ürün | miktar |
| `faturalar` | her `fatura`, `iade` ve KDV kipli `banka_masraf`'ın `fatura` adı | `{toplam, matrah, kdv, acik}`; hepsi ≥ 0, belgenin kendi tutarları (iade de artı yazılır) |
| `taksitKartlari` | her taksit kartı | `{toplam, odenen, kalan}` |
| `supheliAlacaklar` (sürüm 4) | her `supheli_al` kaydı | `{tutar, karsilik, tahsilEdilen, degersiz, cikarilan, kalan, durum}`; `durum` `"acik"` · `"cikarildi"`; sayılar §4.42a türetmesi (hepsi ≥ 0) [PLAN §3.11b/5 rapor: "cari, neden, tarih, tutar, karşılık, tahsil edilen, kalan"] |

Reddedilen adımın oluşturacağı varlık çıktıda **yer almaz**. İstek kimliğiyle yinelenen adımın takma adları ise çıktıda asıl
varlığın değeriyle yer alır (§5.4, sürüm 2 D4).

### 8.4 Ek alanlar

| Alan | Anlamı | Dayanak |
|---|---|---|
| `hesapKodlari` | banka hesabı takma adı → alt hesap kodu (`"102.01"`) | [ÇIKARIM §3.5, §3.7 #1] |
| `eksiBakiyeDenetimi` | banka hesabı takma adı → etkin politika (`uyar` · `engelle` · `kontrol_yok`, §5.3) | [PLAN §12.5 adım 1–4 "denetim Uyar"] |
| `ozet.gercekBanka` | Σ bakiye(102.NN), NN ≠ 00 | [PLAN §8.4 "Gerçek Banka: Σ 102 alt hesapları (hesaba atanmış)"] |
| `ozet.hesabiAtanmamis` | bakiye(102.00) + bakiye(108.00) | [PLAN §8.4 "Σ 102.00 + Σ 108.00. Ayrı satır, hiçbir toplama girmez"] |
| `ozet.kartVeKrediBorcu` | −(Σ bakiye(309.NN) + Σ bakiye(300.NN)) — borç artı | [PLAN §8.4 "Σ 309 + Σ 300 (borç olarak)"] |
| `ozet.kasaVeGercekBanka` | bakiye(100) + gercekBanka | [PLAN §12.5 adım 15–16 "Kasa + Banka 170.000"] |

### 8.5 `retler`, `yinelenenler`, `atlananlar`

```json
"retler": [ { "adim": "37a", "durum": 409, "kod": "cash-blocked", "kodDayanak": "PLAN" } ]
```

- `durum`: 400 · 403 · 404 · 409 ya da `"4xx"` (plan durum kodunu söylemiyorsa).
- `kod`: planın adını verdiği kod (`bank-account-required`, `bank-similar`, …) ya da `null`.
- `kodDayanak`: `"PLAN"` · `"CIKARIM"` · `null`.
- `yinelenenler`: istek kimliğiyle yinelenip etkisiz kalan adımların `id`'leri (§5.4).
- `atlananlar`: andığı takma ad (reddedildiği için) hiç oluşmamış adımlar. Koşucu da bu adımları programa göndermez. Senaryo
  bundan kaçınmalıdır.
- Liste sırası adım sırasıdır.

### 8.6 `araDurumlar`

Her `kontrol` adımının `id`'si → o ana kadarki durum: §8.1'deki `mizan`, `bankaHesaplari`, `kasa`, `cariler`, `stok`, `faturalar`,
`taksitKartlari`, `supheliAlacaklar` (sürüm 4), `hesapKodlari`, `eksiBakiyeDenetimi`, `ozet` alanları (retler, yinelenenler ve belirsizler
yalnız üst düzeyde).
Üst düzeydeki aynı alanlar senaryonun **sonundaki** durumdur.

### 8.7 `alternatifler`

Senaryoda `ayniAnda` grubu varsa kâhin, üst düzeydeki karşılaştırılan alanlar yerine `alternatifler` yazar: her biri §8.1'deki
karşılaştırılan alanların tamamını (retler ve araDurumlar dahil) taşıyan nesneler listesi. Program çıktısı bunlardan birine eşitse
eşleşme vardır.

### 8.8 `belirsizler`

```json
"belirsizler": [ { "alan": "faturalar.F3.acik", "neden": "BELİRSİZ-7" } ]
```

Karşılaştırıcı bu yolları (araDurumlar içindekiler dahil: `araDurumlar.k5.faturalar.F3.acik`) atlar.

---

## 9. Karşılaştırma kuralları

1. **Kâhin ↔ plan:** Her `kontrol` adımındaki `planBeklenen`'in her yaprağı kâhinin `araDurumlar[id]` değerine **tam** eşit olmalı.
   Değilse kâhin (ya da plan) yanlıştır; program karşılaştırması yapılmaz, fark raporlanır.
2. **Program ↔ kâhin:** `mizan` (eksik anahtar = {0,0}), `bankaHesaplari`, `kasa`, `cariler`, `stok`, `faturalar`, `taksitKartlari`,
   `supheliAlacaklar` (sürüm 4), `hesapKodlari`, `eksiBakiyeDenetimi`, `ozet`, `retler`, `yinelenenler`, `atlananlar` ve `araDurumlar` alan
   alan, tamsayı tam eşitlikle. `mizan` dışındaki haritalarda eksik ya da fazla anahtar da farktır.
3. `retler`: aynı adımlar reddedilmeli; `durum` eşit (kâhin `"4xx"` yazdıysa programınki 400–499 arası olmalı); `kod` yalnız kâhinin
   `kod`'u `null` değilse karşılaştırılır (`kodDayanak: "CIKARIM"` ise farkı İNCELE).
4. `belirsizler`'deki yollar atlanır.
5. Her fark şu biçimde raporlanır: yol, kâhin değeri, program değeri, fark, sınıf (BULGU / İNCELE), o yola yazan adımların işlem
   türleri ve bu belgedeki dayanak etiketleri.
6. Fark yoksa bile rapor, karşılaştırılan yaprak sayısını ve atlanan (belirsiz) yaprak sayısını yazar. "Fark yok" tek başına
   yazılmaz.

---

## 10. Koşucu (program tarafı) için notlar

- Koşucu programı bir kullanıcının kullanacağı yoldan (API ya da ekran) sürer; çıktıyı programın **kendi raporlarından ve
  ekranlarından** okur, veritabanından doğrudan okumaz. Önerilen kaynaklar (planın adlarıyla):
  - `mizan` ← Alt Hesap Mizanı [PLAN §8.10 Ek] ve Ana Defter mizanı
  - `bankaHesaplari`, `hesapKodlari` ← Banka Bakiye Raporu ve hesap kartı [PLAN §8.10, §8.5]
  - `kasa` ← Kasa penceresi
  - `cariler` ← Cari Listesi ve Bakiyeler
  - `stok` ← stok listesi / Stok Durumu
  - `faturalar` ← fatura kartı (Toplam, Matrah, KDV, Açık)
  - `taksitKartlari` ← Taksit Kartları raporu
  - `supheliAlacaklar` ← cari kartındaki "Şüpheli Alacak" bilgisi / Raporlar → Şüpheli Alacaklar [PLAN §3.11b/5] (sürüm 4)
  - `ozet` ← Banka Genel Bakış ve ANLIK DURUM (K10 adları) [PLAN §8.4]
  - `eksiBakiyeDenetimi` ← hesap kartı ("Bakiye Doğrulandı" / "Açılış bakiyesi doğrulanmadı; eksi bakiye denetimi kapalı") [PLAN §3.9]
  Okunan her alanın kaynağı `okumaKaynaklari`na yazılır. İki kaynak aynı alanı farklı gösterirse ikisi de yazılır ve fark bulgudur.
- Ret: HTTP durum kodu ve yanıttaki `code` okunur. Reddedilen istek başarı sayılmaz; yanıt gövdesi ve sonraki okumayla doğrulanır.
- `yineDeKaydet` → programın "Yine de Kaydet": yalnız `cashForce:true` (silmede `?cashForce=1`); `negativeOk` gönderilmez (sürüm 2, D2);
  `benzerOnay` → `similarOk:true`; `istekKimligi` → istek kimliği başlığı. Bu alanlar yoksa koşucu onları göndermez (program soru
  sorarsa adım ret sayılır).
- İstek kimliğiyle yinelenen adımın programa giden gövdesi asıl adımınkiyle aynı olmalıdır (§5.4: `ad` gövdeye girmez). Koşucunun
  takma addan türettiği bir alan varsa (ör. alış faturasında tedarikçinin belge numarası) yinelemede asıl adımın değeri gönderilir
  (sürüm 2; hakem KOSUCU-ALIS-YINELEME-NUMARA).
- `bugun` ve `saat` → programın sahte saati. Koşucu sunucuyu sahte saatle başlatır.
- Takma kullanıcılar için o rolde kullanıcı açar.
- `kontrol` adımında bütün alanları okur ve `araDurumlar[id]`'ye yazar.
- Bir alanı okuyamazsa çıktıya yazmaz ve `okumaHatalari`na ekler; bu koşucu hatasıdır, bulgu değildir. Koşucu hatası olan koşu
  kanıt sayılmaz.

---

## 11. Kapsamdaki hesap planı

| Kod | Ad | Hangi işlemler |
|---|---|---|
| 100 | Kasa | nakit yollar, Kasa↔Banka, Kasa açılışı, Kasa elle giriş/çıkış |
| 102.00 | Bankalar · Hesabı Atanmamış Eski Hareketler | hesap yokken havale [PLAN §3.11] |
| 102.NN | Bankalar · <banka> · <hesap> | vadesiz, ticari, vadeli, diğer hesaplar |
| 108.00 | Diğer Hazır Değerler · Hesabı Atanmamış | kart hesabı yokken kartla ödeme |
| 101.01 | Alınan Çekler · Portföydeki Çekler | alınan çek (sürüm 3) [PLAN §3.11, §3.11a] |
| 101.02 | Alınan Çekler · Tahsile Verilen Çekler | Bankaya Tahsile Ver (sürüm 3) [PLAN §3.14] |
| 103 | Verilen Çekler ve Ödeme Emirleri (−) | verilen çek (sürüm 3) [PLAN §3.11a] |
| 120 | Alıcılar | müşteri carileri |
| 121.01 | Alacak Senetleri · Portföydeki Senetler | alınan senet (sürüm 3) [PLAN §3.11a] |
| 121.02 | Alacak Senetleri · Tahsile Verilen Senetler | senedi Bankaya Tahsile Ver (sürüm 3) [PLAN §3.11a] |
| 128 | Şüpheli Ticari Alacaklar (cariye bağlı) | Şüpheli Alacağa Al, tahsilatın düşmesi, Değersiz, Çıkar (sürüm 4) [PLAN §3.11b] |
| 129 | Şüpheli Ticari Alacaklar Karşılığı (−) | Karşılık Ayır, 644 kuralı, Değersiz, Çıkar (sürüm 4) [PLAN §3.11b/3] |
| 153 | Ticari Mallar | stoklu alış ve alıştan iade (ÇIKARIM) |
| 191 | İndirilecek KDV | alış ve KDV'li masraf |
| 193 | Peşin Ödenen Vergiler ve Fonlar | faiz stopajı [PLAN §3.7 #14] |
| 300.NN | Banka Kredileri | kredi hesapları |
| 309.NN | Diğer Mali Borçlar (Kurumsal Kredi Kartları) | kurumsal kart hesapları |
| 320 | Satıcılar | tedarikçi carileri |
| 321 | Borç Senetleri | verilen senet (sürüm 3) [PLAN §3.11a] |
| 391 | Hesaplanan KDV | satış (alacak), satıştan iade (borç) |
| 500 | Sermaye (Açılış) | banka ve Kasa açılışları [PLAN §12.5 "500 Açılış"] |
| 600 | Yurt İçi Satışlar | satış matrahı |
| 610 | Satıştan İadeler | satıştan iade matrahı |
| 642 | Faiz Gelirleri | faiz geliri |
| 644 | Konusu Kalmayan Karşılıklar | şüpheli alacağın tahsilinde / çıkarılmasında karşılığın çözülmesi (sürüm 4) [PLAN §3.11b/3] |
| 649 | Diğer Olağan Gelir ve Kârlar | Kasa elle giriş, diğer gelir |
| 654 | Karşılık Giderleri | Karşılık Ayır (sürüm 4) [PLAN §3.11b/3] |
| 659 | Diğer Olağan Gider ve Zararlar | diğer gider; karşılıksız değersiz alacak (sürüm 4) |
| 770 | Genel Yönetim Giderleri (Banka Masrafları) | banka masrafı, BSMV, transfer ücreti, Kasa elle çıkış, gider alışı |
| 780 | Finansman Giderleri | faiz gideri, kredi faizi |

Kapsam dışı (bu dil sürümünde hiç yazılmaz): 108.NN (POS), 127, 336, 621, 646, 653, 656. (Sürüm 2'de 101 ve 103, sürüm 3'te 128 ve 129 de
kapsam dışıydı.) Sürüm 4'te de dışarıda kalanlar: Banka Fişi rollerinde 128/129 seçimi (K10), kilit izi (K12), Silinenler'den geri yükleme,
Şirket Verisini Sıfırla, Mutabakat Testi'nin kendisi (koşucu programın Mutabakat Testi sonucunu yalnız bilgi olarak yazar), Alacak Yaşlandırma;
K8'in `update` (tutar artırma), `restore` ve `move` (Taksite Aktar) yolları, `installment-paid` (BELİRSİZ-33).

---

## 12. BELİRSİZ listesi

| # | Konu | Planın söylediği | Kâhinin davranışı / senaryo kuralı |
|---|---|---|---|
| 1 | Nakit Kasa eksi bakiye politikasının varsayılanı | §3.9 "`/api/admin/negative-policy` bugünkü biçimini korur (`{cash, bank:'off', card:'off'}`)" — `cash`'in varsayılanı yazılı değil | Kasa'dan çıkış içeren senaryo `kasaEksiBakiye`'yi açıkça yazar |
| 2 | Kredi hesabında eksi bakiye | §3.9 yalnız "KMH ve kurumsal kart limitine kadar serbest" diyor; kredi hesabı açılışta zaten eksidir | Kâhin kredi hesabını denetlemez; senaryo kredi hesabını `bakiyeDogrulandi: false` açar |
| 3 | Doğrulanmamış hesapta elle politika | K7 "Açılış bakiyesi bilinçli girilene … kadar denetim 'Kontrol Yok'tur" ile §3.9 "hesap kartında hesap bazında da değiştirilebilir" | Senaryo `hesap_eksi_politika`'yı yalnız doğrulanmış hesapta kullanır |
| 4 | Benzer İşlem: Kasa↔Banka, transfer, Banka Fişi | §3.10/2 anahtarda "hedef" var; bu işlemlerin hedefi tanımlı değil | Kâhin bunlarda `bank-similar` üretmez; senaryo aynı gün/hesap/tutarlı ikinciyi yalnız `benzerOnay: true` ile yazar |
| 5 | "Aynı iş günü" ve hafta sonu | §3.10/2 "Pencere aynı iş günüdür" | Hesaba bağlı tahsilat/ödeme hafta içi tarihle yazılır |
| 6 | ~~Kalanı aşan / kapanmış karta taksit tahsilatı~~ | Sürüm 4'te kalktı: §4.17 K8 kuralı tanımlı (PLAN §3.10/3) | — |
| 7 | Taksitli faturası olan caride bağsız tahsilat ya da artanı olan satıştan iade | Plan faturanın kendi taksit kartıyla bağsız tahsilat / iade artanı ilişkisini tanımlamıyor | O carinin açık ve kart alanları `belirsizler`e |
| 8 | Taksitli faturanın iadesi | Plan susuyor | Senaryo kurmaz |
| 9 | ~~Geri ödenmemiş iade ile FIFO sırası~~ | Sürüm 2'de kalktı: sıra §7 kural 5 → 6 → 7 (D1 [KARAR]) | — (bağsız satırlı caride BELİRSİZ-11 zaten geçerli) |
| 10 | Bağlı ödemenin belge açığını aşması | Plan susuyor | Senaryo kurmaz |
| 11 | Karşı yönde bağsız satır (müşteriye bağsız ödeme, tedarikçiden bağsız tahsilat) | §2.5 yalnız "ödeme rolü (`recvPay`/`payPay`)" diyor; §4.3/2 komisyon iadesi için "eksi tutarlı `payPay`" örneği var | O carinin açıkları `belirsizler`e |
| 12 | Aynı KDV oranında çok kalem (satır mı oran grubu mu yuvarlanır) | Plan yalnız tek kalemli fatura örnekliyor | Belge başına her (oran, dahil/hariç) için en çok bir kalem |
| 13 | İskontonun birim fiyata mı satır toplamına mı uygulandığı | Plan susuyor | İskontolu kalemde miktar 1 |
| 14 | Eksi stok | Plan susuyor | Senaryo stoğu eksiye düşürmez |
| 15 | Satılan malın maliyeti (621) | Plan susuyor; §12.5 mizanında 153/621 yok (stok parasız girildi) | Kâhin 621 yazmaz; senaryo stoklu alışı yapılmış ürünü satarsa `mizan.153` ve `mizan.621` `belirsizler`e |
| 16 | Ters kaydın ters kaydı; KDV'li masrafın ve Kasa↔Banka'nın ters kaydı | §3.8 yalnız Banka Fişi'ni tanımlar; KDV'li masraf fatura da açar | Senaryo kurmaz |
| 17 | Bir adımda birden çok ihlal | Sıra yalnız `bank.post` iç adımları için (§3.3) | Senaryo tek ihlal kurar; kurarsa yalnız 4xx sınıfı karşılaştırılır |
| 18 | Planın yetki tablosunda olmayan rol/işlem birleşimleri (§5.5'te `B`) | §9.1 yalnız banka yetkilerini sayar | Senaryo bu adımları `Y` (ya da `200` yazan rol) ile yazar |
| 19 | Silinmiş satırın Benzer İşlem'de sayılıp sayılmadığı | §3.10/2 susuyor | Senaryo, silinmiş satırla aynı anahtarlı yeni satırda `benzerOnay: true` yazar |
| 20 | Kasa'da geriye tarihli çıkış ve min formülü | §3.9 formülü banka hesabı için yazılı | Senaryo Kasa hareketlerini tarih sırasıyla yazar |
| 21 | Vadeli/diğer hesabın Kasa↔Banka'da kullanımı | §3.5 "Vadeli … yalnız transfer ve faiz" | Kasa↔Banka'da vadesiz ya da ticari hesap |
| 22 | Kasa↔Banka, taksit, iade gibi uçlarda 3 ondalıklı girdi | §5.1 "banka uçları" ile "mevcut modül uçları" ayrımı bu uçlar için açık değil | `<alan>Ham` yalnız §6.2'de sayılan işlemlerde |
| 23 | Vadesiz hesapta KMH limitini aşan eksi açılış | §3.7 #1 yalnız "KMH'de eksi açılış ters" diyor | Senaryo kurmaz (sürüm 2) |
| 24 | Vadeli hesapta faiz gideri, kart borcu kaynağı, kredi hedefi/kaynağı ve KDV kipli masraf | §3.5 "Vadeli … Hayır; yalnız transfer ve faiz" — "faiz"in gideri de kapsayıp kapsamadığı ve öbür banka fişleri açık değil | Senaryo kurmaz (sürüm 2) |
| 25 | Kredi anaparasının kalan kredi borcunu aşması; kredi hesabını borç bakiyesine çeviren ters kayıt | Plan susuyor | Senaryo kurmaz (sürüm 2) |
| 26 | Aynı türde (satış / alış / iade) belgenin, o türde daha önce girilmiş belgeden eski tarihli girilmesi | Plan susuyor (belge numarası ile tarih sırası) | Senaryo belgeleri tür içinde tarih sırasıyla yazar (sürüm 2; kâhin denetlemez) |
| 27 | Evrakın fatura açığına etkisi (alınan evrak faturayı kapatır mı, karşılıksız evrak açığı geri açar mı, ciro tedarikçi faturasını kapatır mı) | §2.5 yalnız "ödeme rolü (`recvPay`/`payPay`)" diyor; evrak satırının rolü yazılı değil | Evrak satırı olan carinin `faturalar.*.acik` alanları `belirsizler`e (sürüm 3) |
| 28 | Evrak işleminin, evrakın önceki işleminden (alış/veriliş, tahsile verme, geri alma) ya da vadesinden önce tarihli olması | Plan yalnız Bankaya Tahsile Ver için "tarih alış tarihinden önce olamaz" diyor | Senaryo kurmaz (tahsile_ver'in alıştan önceki tarihi hariç: 4xx) (sürüm 3) |
| 29 | Tahsildeki evrakın nakit tahsili; tahsil kaydının hesabı pasifken tahsil; ciro edilmiş ya da verilen evrakın karşılıksızı | §3.14 yalnız "yol bank, hesap ön seçili" | Senaryo kurmaz (sürüm 3) |
| 30 | Evrakın, evrakı veren cariye ciro edilmesi; vadeli hesaba tahsile verme | Plan susuyor; §3.5 "Vadeli … Hayır" modül formları için | Senaryo kurmaz (sürüm 3) |
| 31 | Geçmişi olan evrakın (tahsile verilip geri alınmış, tahsil, ödeme, ciro, karşılıksız) silinmesi; silinmiş evrakla işlem | Plan susuyor | Senaryo kurmaz; yalnız ikinci silme → 404 (sürüm 3) |
| 32 | Banka hesabının "Çek Kullan / Senet Kullan" işaretleri, verilen çekin "Çek Hesabı" | Kullanıcı kararı 12.10.2026; planda yok | Kâhin bilmez (deftere etkisi yok). Koşucu, program isterse hesapları işaretli açar ve bunu `okumaKaynaklari`na yazar (sürüm 3) |
| 33 | `installment-paid`: taksit tutarlarının bölüşümü, tahsilatın taksitlere dağıtımı, `taksitNo`'lu tahsilatın taksit tutarını aşması; `fazlaAvans`'ın tutar ≤ kalan iken ya da kalan 0 + yetkisizken etkisi | §3.10/3 yalnız "seçilen taksit ödenmişse 409" der | `taksitNo` yalnız kartın hiç etkin tahsilatı yokken; `fazlaAvans` yalnız tutar > kalan iken yazılır (sürüm 4) |
| 34 | Taksit fazlasının (avans) öbür belgeleri kapatıp kapatmadığı | §3.10/3 yalnız "caride alacak olur" | Fazlası olan carinin `faturalar.*.acik` alanları `belirsizler`e; kart ve cari karşılaştırılır (sürüm 4) |
| 35 | Aynı caride aynı gün (adım sırasıyla): alacak satırından SONRA girilen şüpheli işlemi (al, karşılık, değersiz, çıkar); değersiz ya da çıkarmadan SONRA girilen alacak satırı | §3.11b aynı gün sırasını yazmıyor; KABUL K3 yalnız al/karşılık/alacak/çıkar tür sırasını verir | Kâhin §4.42a tür sırasını uygular; senaryo bu birleşimleri kurmaz (kâhin çıkış 2) (sürüm 4) |
| 36 | Değersiz Alacak satırının fatura açığına etkisi | §3.11b/3 yalnız "cari bakiyesi o tutar kadar kapanır" | O carinin `faturalar.*.acik` alanları `belirsizler`e (sürüm 4) |
| 37 | Karşılığı / değersiz yazımı / çıkarması olan şüpheli kaydının silinmesi; değersiz yazımının silinmesi; Silinenler'den geri yükleme | §3.11b/4 yalnız "Silinenler (geri alma ters kayıtla)" | Senaryo kurmaz; yalnız sade kayıt ve karşılık silinir (sürüm 4) |
| 38 | Şüpheli kaydı olan müşteri carisinde alıştan iade geri ödemesi, alış faturası / KDV'li masraf (A 120 yazan ama KABUL K3 listesinde olmayan satırlar) ve Şüpheliden Çıkar'dan sonraki alacak satırının aynı gün çıkarmayla sırası. (Satış faturasının peşin satırı ve `kapatilacakFatura` bağlı tahsilat 15.10.2026 kararıyla tanımlandı — DÜŞMEZ, §4.42a; listeden çıktı.) | §3.11b/2 yalnız "tahsilat" der; KABUL K3 listesi sınırlı | Senaryo kurmaz (sürüm 4; peşin satırı ve bağlı tahsilat kurulur) |

---

## 13. Senaryo geçerlilik denetimi

Kâhin ve koşucu senaryoyu çalıştırmadan önce şunları denetler; biri tutmazsa senaryo **geçersizdir** (koşulmaz, hata yazılır):

1. `dil` doğru; `ad` dosya adıyla aynı; `baslangic.bugun` geçerli.
2. Her `id` tekil ve biçime uygun; her `islem` §4'te var; bilinmeyen alan yok.
3. Takma adlar biçime uygun ve bir kez tanımlı; anılan her takma ad daha önceki bir adımda tanımlı ve türü doğru.
4. Tutar, oran, tarih ve miktar biçimleri §3.3'e uygun.
5. `saat` geri gitmiyor; `ayniAnda` grupları ardışık, ≤ 4 adım, içinde `kontrol` yok.
6. §12'deki "senaryo kurmaz" kurallarına uyuluyor (BELİRSİZ-1, 2, 3, 4, 5, 8, 10, 12, 13, 14, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26,
   28, 29, 30, 31, 33, 34 (yalnız karşılaştırma), 35, 37, 38). (BELİRSİZ-6 sürüm 4'te kalktı: K8 kuralı tanımlı.)
9. (sürüm 3) Evrak işlemleri yalnız `"dil": "destekofis-senaryo/3"` ve üstü senaryoda; `evrak_ciro`, `evrak_tahsil`, `evrak_karsiliksiz`,
   `tahsile_ver`, `bankadan_geri_al` alınan evrakı (`evrak_al`), `evrak_odeme` verilen evrakı (`evrak_ver`) anar; evrak `tur`u `cek`
   ya da `senet`; `vade` ≥ evrakın tarihi.
10. (sürüm 4) Şüpheli işlemleri ve `fazlaAvans` yalnız `"dil": "destekofis-senaryo/4"` senaryosunda; `supheli_al`'da `evrak` varsa `tutar`
    ve `neden` yok, yoksa ikisi de var; `neden` listeden; `karsilik_ayir`, `supheli_cikar`, `degersiz_yaz` bir `supheli_al` kaydını anar;
    `taksitNo` yalnız kartın ilk tahsilatında; `fazlaAvans` yalnız kalanı aşan tutarla; `sil` hedefi şüpheli kaydıysa o kaydın karşılığı,
    değersizi ve çıkarması yok.
7. `kart` yolu yalnız ödeme yönünde; `taksit` yalnız satış faturasında; `pesin` ≤ 3 satır, `"tamami"` taksitle birlikte değil.
8. `transfer`'de `ucret` varsa `ucretVergi` var; `banka_masraf` KDV kipinde `saglayici` ve `fatura` var.

---

## 14. Kısa örnek (beklenen sonuçlu)

```json
{
  "dil": "destekofis-senaryo/2",
  "ad": "ornek-masraf",
  "baslangic": { "bugun": "09.10.2026", "sirket": "bos" },
  "adimlar": [
    { "id": "1", "islem": "hesap_ac", "ad": "ZIR", "banka": "Ziraat Bankası", "hesapAdi": "Ana TL Hesabı",
      "tur": "vadesiz", "paraBirimi": "TRY", "acilisTarihi": "01.10.2026", "acilisBakiyesi": "1000", "bakiyeDogrulandi": true },
    { "id": "2", "islem": "banka_masraf", "ad": "M1", "hesap": "ZIR", "tutar": "10,50",
      "masrafTuru": "EFT", "vergi": "bsmv_dahil" },
    { "id": "3", "islem": "ters_kayit", "hedef": "M1" },
    { "id": "4", "islem": "ters_kayit", "hedef": "M1" }
  ]
}
```

Beklenen: adım 2 → `B 770 1000 / B 770 50 / A 102.01 1050` (gider rh(1050×100, 105) = 1000, BSMV 50); adım 3 net sıfır; adım 4 →
`retler: [{"adim": "4", "durum": 409, "kod": null, "kodDayanak": null}]`. Son mizan: `102.01 {borc: 100000, alacak: 0}`, `500 {borc:
0, alacak: 100000}`, `770 {borc: 0, alacak: 0}`; `bankaHesaplari.ZIR = 100000`.
