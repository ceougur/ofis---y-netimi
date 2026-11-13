<!-- Dar kontrol raporu AYNEN (13.11.2026; bağımsız incelemeci; bulguların ana oturumca yeniden üretimi KAYIT'ta) -->
## DAR KONTROL — BİRLEŞİK TUR 7 (cac2d8b2^1..cac2d8b2)

Ortam başta yük 1,85 / 4 çekirdek, sonda yük 5,06. Boş bellek 9 GB, boş disk 9,3 GB. Worktree temiz; commit ve push yok. Eski kod kopyam, mutant kopyam ve onun orijinalleri tam yollarıyla silindi.

Kısa sonuç: GERİLEME YOK. Bir ORTA bulgu var; bu farkın getirdiği bir hata değil, A1 kararının sınırında kalan yeni bir yüz. Bir de iki DÜŞÜK var. Önceki raporun ORTA-1, DÜŞÜK-1, DÜŞÜK-3 ve DÜŞÜK-4 maddeleri ile M8–M12 mutantlarının hepsi KAPANDI.

### GERİLEMELER
Karşılaştırma cac2d8b2^1'e göre yapıldı, yok. Aynı betikler iki kodda koşuldu: r.mjs ×8, a1 ×4, c, s, k, e2. Eski kodda geçip yenide düşen bir yol çıkmadı.
- Uyarı dışındaki bulgu ve günlük satırları iki kodda birebir aynı: S5'te bank:event, S6'da money:event, Kasa 5.550 → 6.539 iki kodda da.
- v2.4.9 ile karşılaştırma yapılmadı (DENENMEYEN).

### KAPANIŞ TABLOSU (önceki dar kontrolün kendi betikleri ürünü çağırıyor; iki TZ'de aynı sonuç)
| Madde | cac2d8b2^1 | cac2d8b2 | Durum |
|---|---|---|---|
| ORTA-1, S1 (satır içi tarama) | 2 → 3, alarm yok | alarm: "(2 → 3 hareket; kapının görmediği yazım: 1 hareket)" | KAPANDI |
| ORTA-1, S1b (iş parçacığı taraması) | 2 → 3, alarm yok | alarm, aynı ileti | KAPANDI |
| S9 (sil + dış yazım, sayı aynı) | 2 → 2, alarm yok | "uyarısına yeni hareket girdi (2 → 2 …: 1 hareket)" | kapandı |
| DÜŞÜK-1, S2 ileti | "1 → 3 hareket; kapının görmediği yazım" | "(1 → 3 hareket; kapının görmediği yazım: 1 hareket)" | KAPANDI |
| DÜŞÜK-3: replace + skip-worktree, varsayılan çağrı (release.mjs yolu) | GEÇTİ | RET | KAPANDI |
| DÜŞÜK-4: Çek / Senet ve Fatura listesi tarih kutusu (resmî senaryo) | kırmızı: çek "0026-07-20" ve "", fatura "0020-02-06", rapor-vade "0026-07-20" | 42/42 yeşil (11 kip × yarış ve kontrol × 2 deneme; ön koşul her denemede oluştu) | KAPANDI |
| M8 / M9 / M10 / M11 / M12 (yeni koda uyarlandı) | — | 1 / 1 / 2 / 1 / 1 kırmızı | KAPANDI |

Eski kodda kasa-tarih ve rapor-mizan kontrol kipleri yeşil. Bu beklenen bir sonuç: Kasa'da kod değişmedi, raporlarda tarih "Raporu Getir" ile uygulanıyor. Bu iki kip gerileme bekçisidir, eski kodda kırmızı olması gerekmez.

### BULGULAR

**ORTA-1 (gerileme değil; yeni yüz) — Silinenler'deki gizli satıra yapılan dış yazım, geri yüklemeyle "açıklanmış" sayılıyor.**
- Yer: `server/lib/cash-opening.mjs`, restoringCash, settle bölümü (`added = after − before`, yaklaşık satır 239–246).
- Betik: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-b7-q/betik/k.mjs`. Çıktılar `…/dk-b7-q/k-yeni.json` ve `k-eski.json`.
- Kurgu:
  1. Açılış 10.03. Taksit kartı, 12.03 ve 13.03 tarihli iki nakit tahsilat.
  2. Kart silinir; satırlar gizlenir, uyarı 0.
  3. Dışarıdan gizli satırın tarihi 05.03'e alınır (işlem başlığıyla birlikte).
  4. Tarama: sayı 0, alarm 0, sapma 0.
  5. Kart Silinenler'den geri yüklenir (200).
  6. Tarama: sayı 1, alarm 0, sapma 0, günlük 0. Kasa 5.050; 25 TL açılış bakiyesiyle birlikte iki kez sayılıyor.
- İki kodda da aynı sonuç.
- Kök neden: geri yükleme "SONRA'da olup ÖNCE'de olmayan" her kimliği açıklar. Satırın silinirken açılıştan önce olup olmadığına bakılmaz. Karar metni de ("Silinenler geri yüklemeleri sayılır") bunu ayırmıyor.
- Sakınca süzgeci: Kasa'da bildirimsiz çift sayım, bu yüzden ORTA. Dış araç gerektiriyor; önceki ORTA-1 ile aynı aile.
- En küçük düzeltme: üst kayıt (kart / çek / cari) silinirken çocuk para satırlarının kimlik + tarih + tutar özeti Silinenler yüküne yazılır. Geri yüklemede yalnız özetle eşleşen ve silinirken de açılıştan önce olan kimlikler açıklanır. Gerisi alarm verir. Tek satırlık geri yüklemede yükteki tarih asıl kayıtla karşılaştırılır.
- Bu bir tespit tasarımı, para kuralı değil. Ancak A1 karar metnini daralttığı için kullanıcıya gösterilmeli.

**DÜŞÜK-1 — Yeni testlerde dişsiz yerler (yaşayan mutantlar).**
- Mutant sonuçları: `…/dk-b7-q/mutant2-sonuc.txt`.
- **N5:** geri yükleme bütün kümeyi açıklanmış yazıyor; 24/24 yeşil. Ürün doğru: `betik/a1b.mjs` ile S10 ("dış artış, SONRA geri yükleme") gerçek kodda 2 → 4 alarm verdi, N5'te sessiz kaldı; S11'de (iş parçacığı) de aynısı. Eksik test: dış yazımın geri yüklemeden ÖNCE geldiği sıra.
- **N8:** `noticeKeys` alanı sayılan alana çevrildi; 26/26 yeşil. Mutabakat Testi yanıtına sızmadığını denetleyen test yok.
- **N15:** geri alınan işlemin bekleyen kimlik kaydı temizlenmiyor; 24/24 yeşil. Eşdeğere yakın; iz yalnız dışarıdan aynı kimlikle yazımda etkili olur.
- Sakınca süzgeci: yalnız test, ürün davranışı doğru.

**DÜŞÜK-2 — `GIT_DIR` / `GIT_WORK_TREE` ortam değişkeniyle kapı başka deponun boş listesini okuyor (iki kodda aynı).**
- Betik: `…/dk-b7-q/betik/e2.mjs`. Bunun için bilerek ortam değişkeni vermek gerekiyor.
- releaseGate'in CI denetimi (başka deponun HEAD'i) bunu muhtemelen durdurur; koşmadım, DOĞRULANMADI.
- Sakınca: para yok.
- Öneri: kapı `GIT_*` değişkenlerini silerek ve `--git-dir=<ROOT>/.git` ile çağırsın.

### (A) Yollar tablosu
Betik: `…/dk-b7-q/betik/r.mjs`. Açılış öncesi 8 satır eski veri gibi hazırlandı: açılış dışarıdan işaretlendi, program yeniden başlatıldı, taban sessiz.

Sonuçlar yeni ve eski kodda, satır içi ve iş parçacığı taramasında, UTC ve İstanbul'da ayrı ayrı alındı (toplam 8 koşu). Kasa iki kodda da 5.726.

| Yol | Meşru yol sessiz mi (yeni / eski) | Dış yazım alarm veriyor mu (yeni / eski) |
|---|---|---|
| Kasa hareketi tutar düzeltmesi | sessiz / sessiz | — |
| Cari nakit tahsilat düzeltmesi | sessiz / sessiz | — |
| Fatura Düzenle (peşin yeni kimlikle yazılır) | sessiz / sessiz | — |
| Taksit tahsilatı düzeltmesi | sessiz / sessiz | — |
| Kayıt tahsilatı düzeltmesi | sessiz / sessiz | — |
| Nakit stok satışı düzeltmesi | sessiz / sessiz | — |
| Taksite Aktar | sessiz / sessiz | — |
| Aktarımı Geri Al | sessiz / sessiz | — |
| Aktar + Geri Al + Aktar (arada tarama yok) | sessiz / sessiz | — |
| Fatura Düzenle iki kez | sessiz / sessiz | — |
| Fatura Düzenle + dış tarih taşıma | — | alarm, açıklanamayan 1 / alarm |
| Fatura Düzenle + yeni peşin satırının dışarıdan başka kimlikle değiştirilmesi | — | alarm "9 → 9 …: 1" / **eski: yok** |
| Aktarılmış kart satırının dışarıdan başka kimlikle yazılması | — | alarm "9 → 9 …: 1" / **eski: yok** |
| Gizli satır + Silinenler geri yüklemesi (k.mjs) | — | yok / yok (ORTA-1) |

Önceki raporun tablosundaki kalan yollar (açılışı öne alma, iki geri yükleme, dış ekleme, tutar değişikliği) a1 ile yeniden koşuldu; aynı sonuç.

### (B) Tarih kutuları
İstemcide `type="date"` taramasıyla çıkan süzgeç kutuları ve sonuçları:

| Ekran | Senaryo kipi | Yeni kod | Eski kod |
|---|---|---|---|
| Banka Hareketleri | banka-tarih | yeşil | — |
| POS | pos-tarih | yeşil | — |
| Rapor Merkezi | rapor-tarih | yeşil | — |
| Gelen e-Fatura | gelen-tarih | yeşil | — |
| Çek / Senet | cek-tarih | yeşil | kırmızı (yarış ve kontrol) |
| Fatura listesi | fatura-tarih | yeşil | kırmızı (kontrol) |
| Kasa → Tarih Aralığı | kasa-tarih (yalnız kontrol) | yeşil | yeşil |
| Raporlar: Cari Mizanı ve Ekstresi | rapor-mizan | yeşil | yeşil (kontrol) |
| Raporlar: Vade Takip | rapor-vade | yeşil | kırmızı (yarış) |
| Raporlar: Nakit Akış | rapor-akis | yeşil | — |
| Raporlar: Çek / Senet | rapor-cek | yeşil | — |
| WhatsApp Gönderimleri, Tablo Raporları | — | KOŞULMADI | KOŞULMADI |

- Yeni kodda her kip yarış ve kontrol olarak 2'şer deneme koşuldu (Kasa yalnız kontrol); toplam 42/42 yeşil.
- Eski kodda yalnız tabloda değeri yazan kipler koşuldu.
- Senaryo, gözcü düğümün çubuğun dışında yenilendiğini denetliyor; liste bayat kalmıyor.
- WhatsApp kodu kutuları yeniden kurmuyor ve yarım yazımı bekliyor; Tablo Raporları bir form, canlı yenilemesi yok. Bunlar yalnız kod okuması, koşarak doğrulanmadı.

### (C) Süzgeç / komşu tablosu ve üç sorunun sayıları
- **S130 / S136 / S139** (`betik/c.mjs`, 6 cari × 5 adım):
  - Her adımda ve her gruplamada (gün / hafta / ay / yok; gecikmişleri başlangıca ekle açık / kapalı) Nakit Akışı = Vade Takip = bakiye − açık şüpheli.
  - Eksi satır yok, çift düşme yok.
  - Şüpheli tutarın bakiyeden büyük kaldığı kurgu doğru: "Fazla Şüpheli" carisinde 1.000 şüpheli + 600 tahsilat → bakiye 400, açık şüpheli 400, iki ekranda da 0.
  - Karşı yönlü alış faturalı cari, sözlü cari ve şüpheliden geri alma / kaydı silme adımlarında da eşitlik tutuyor.
  - Şüphelisi olmayan cari ve avanslı tedarikçi iki kodda birebir aynı (800 / 400).
- **Eski testteki beklenti değişikliği** (`defter-243-raporlar`, faturasız dengeleme satırı → `{}`): S130 = A'nın zorunlu sonucu. Gevşetme yok; eşitlik korunmuş.
- **Komşular:** Cari Listesi, cari kartı ve Anlık Durum iki kodda aynı. Vade Takip'te yalnız sözlü vadesi geçmiş kalemler değişti; S52 / S67 / S69'un kararıyla uyumlu.
- **Üç soru** (`betik/s.mjs`; 20.10 için sahte saat, İstanbul; elle borçlar):
  1. **Vade 10 gün geçmiş, söz 15 gün sonra, 500 TL:**
     - Vade Takip "Tüm Açık": Gecikmiş Tahsilat 1.000 (bu 500 dahil).
     - Nakit Akışı: gecikmiş alacak 200; bu 500, 04.11'de beklenen giriş satırı.
     - Anlık Durum gecikmiş 800, Cari Listesi gecikmiş 500.
     - Tedarikçi tarafı simetrik: Vade Takip Gecikmiş Ödeme 700; Nakit Akışı'nda 04.11'de çıkış.
     - Eski kodda Vade Takip bu kalemi "Yaklaşan 500" gösteriyordu.
  2. **Vade 10 gün sonra, söz 5 gün geçmiş, 200 TL:** Vade Takip ve Nakit Akışı gecikmiş 200; Cari Listesi gecikmiş 0; Anlık Durum'da yok (800 = 500 + 300).
  3. **"Gecikmiş" hazır aralığı:** yalnız 200 görünüyor. Sözü ileride olan 500, sözü bugün olan 300 ve tedarikçinin 700'ü görünmüyor. "Tüm Açık" aralığı 1.000 / 700 gösteriyor.

  Bakiye bütün ekranlarda aynı: alacak 1.000, borç 700.

### (D) Kapı tablosu
Betik: `betik/e2.mjs`. Her denemede release.mjs'nin varsayılan çağrısı ayrı süreçte koşuldu.

| Deneme | Eski | Yeni |
|---|---|---|
| replace blob + skip-worktree | GEÇTİ | RET |
| replace commit + skip-worktree | GEÇTİ | RET |
| replace ağaç + skip-worktree | GEÇTİ | RET |
| GIT_REPLACE_REF_BASE başka ad alanı | GEÇTİ | RET |
| sığ klon + replace | GEÇTİ | RET |
| ayrık HEAD + replace | GEÇTİ | RET |
| GIT_INDEX_FILE | RET | RET |
| git bulunamaz (PATH boş) | RET ("okunamadı") | RET ("okunamadı") |
| depo dışından çağrı | RET | RET |
| worktree içinden | RET | RET |
| info/exclude + rm --cached | RET | RET |
| **GIT_DIR başka depo** | **GEÇTİ** | **GEÇTİ** (DÜŞÜK-2) |

- `kanit-araci.test.mjs` yeni kodda 50/50 yeşil.
- `tools/release.mjs` kendi git çağrısı yapmıyor; yalnız kanit.mjs'yi kullanıyor.

### Mutantlar
Önceki listelerden farklı 11 yeni mutant ve uyarlanmış M8–M12 koşuldu. Mutantsız kod (orijinal) 57/57 yeşil.
- **Yakalananlar:**
  - N1 (seq `<` since): 3 kırmızı.
  - N6 (işaret kümesi güncellenmiyor): 20.
  - N7 (iş parçacığı kümeyi iletmiyor): 10.
  - N9 (gün sayısı tarihten): 2.
  - N10 (şüpheli yalnız alışlı caride düşülüyor): 3.
  - N11 (taksit kalemi withoutDoubtful yok): 1.
  - N12 (fatura kalemi withoutDoubtful yok): 1.
  - N13 (kapıda --no-replace-objects yok): 1.
  - N14 (kimlik değişimi geri yükleme gibi kaydediliyor): 2.
- **Yaşayanlar:** N5, N8, N15 (DÜŞÜK-1).
- N16, kimlik değişimi kaydını tamamen kaldıran denetim mutantı; aşağıdaki değerlendirmede kullanıldı.

### Ölçüm
ÖLÇÜLEMEDİ. Özel kilit iki denemede de doluydu (başka paylaşımlı yük koşuları sürüyordu). Yük 2,4–6,2 arasıydı, yani > 2; aşağıdaki sayılar yalnız GÖSTERGE.

Kurgu: 20.000 açılış öncesi satır + 1.000 geri yükleme. Silinenler listesi 1.000 öğede kesildiği için 2.000 değil 1.000 geri yüklendi (`betik/h.mjs`).

| Ölçü | Yeni | Eski |
|---|---|---|
| Geri yükleme başına ortalama | 348 ms (p95 450) | 358 ms (p95 456) |
| Heap | 35 → 37 MB | 33 → 35 MB |
| Açıklanan kimlik sayısı | 1.000 | — |
| Satır içi tarama | 656 → 720 ms | 766 → 628 ms |
| İş parçacığı taraması | 1.183 / 1.067 ms | 1.053 / 1.047 ms |

Kötüleşme işareti yok. Bilgi notu: açılış öncesi satır çok olduğunda her geri yüklemede O(N) bir okuma var; bu iki kodda da aynı.

### Baş mimar yorumlarının değerlendirmesi
- **"Kapının kabul ettiği kimlik değişimi kayda alınır":** gerekli ve yerinde. N16 ile kayıt kaldırılınca beş meşru yol yanlış alarm verdi: fatura Düzenle, Taksite Aktar, Aktarımı Geri Al, Aktar + Geri Al + Aktar ve iki kez Düzenle; her biri "8 → 8; 1 hareket". Kayıt dış yazımı örtmüyor: yeni peşin ya da kart satırının dışarıdan başka kimlikle değiştirilmesi alarm veriyor; eski kod bunu görmüyordu. Ama kayıt yalnız kapının gördüğü yazımı kapsıyor; gizli satır + geri yükleme açığı kapanmıyor (ORTA-1).
- **12.11 12:52 kararı (sayı yerine kimlik):** karar metnine uygun uygulanmış.

### KULLANICIYA SORULMALI
Yeni para kuralı sorusu yok. ORTA-1'in düzeltmesi A1 karar metnini daralttığı için kullanıcıya gösterilmeli. Bilinen üç sorunun sayıları yukarıda (C) bölümünde.

### DOĞRULANMADI
- Satır içi tarama, sürmekte olan iş parçacığı taramasından önce bitince aynı satır ikinci kez alarm verebilir. Bu yalnız kod okuması; eski kodda da aynı yapı var.
- GIT_DIR denemesinde releaseGate'in CI denetiminin durdurup durdurmadığı.
- WhatsApp listesi canlı yenilemede tarih kutusunun bozulmadığı.

### DENENMEYEN
- (A) yollarının ekrandan koşusu (yalnız API).
- Yedekten geri yükleme, şirket değişimi, Şirket Verisini Sıfırla.
- Çek / senet tahsili, iade, banka fişi, Vergi Ödemesi ve Excel / Sheets yükleme yollarının kimlik değişimi.
- v2.4.9 gerçek koduyla üretilmiş veri.
- (B): tarayıcı geri / ileri, Esc ve hazır aralık düğmesi etkileşimi; WhatsApp ve Tablo Raporları kutuları.
- (C): Vade Takip PDF / Excel (testte var); gün dönümü / gece yarısı; UTC (c ve s yalnız İstanbul'da koşuldu).
- Kesin hız ölçümü.

### Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-b7-q/` — betikler `betik/` altında, ham çıktılar klasörde (r-*, a1-*, a1b-*, c-*, s-*, k-*, e2-*, b-*, h-*, mut2-*.tap, mutant2-sonuc.txt). Kod kopyaları silindi.

YÜKSEK YOK.
