# DestekOfis — ileriye dönük mimari ve ürün yol haritası (2.0.2 → 2.1 → 3.0)

Baş mimar / baş mühendis notu · 27.09.2026. Amaç: programı yalnızca "çalışır" değil, alanının en iyi programlarıyla yarışır kılmak. Her madde için *ne*, *neden* (hangi yaygın programdan öğrenildi), *nasıl* (bizim mimarimizde tasarım) ve *ölçüt* verilir. Öncelik: **P0** hemen (2.0.2'de yapıldı) · **P1** 2.0.3/2.1.0 · **P2** 2.1 sonrası · **P3** 3.0.

## 1. Yaygın programlar bize ne öğretiyor?

| Program | Kullanıcıların sevdiği şey | Bizim durum | Adım |
| --- | --- | --- | --- |
| **Excel** | Filtre okları, sıralama, dondurulmuş bölmeler, seçimde alt çubukta toplam/ortalama/adet, koşullu biçimlendirme | İlk kolon sabit, tüm kolonlar, arama var; kolon sıralama/filtre yok; seçim toplamı yok | P1 kolon menüsü (sırala, değere göre filtrele, gizle) · P1 seçim özeti |
| **Google Sheets** | Anında ortak çalışma, sürüm geçmişi, "Keşfet" paneli, açıklama/yorum | Canlı olaylar (kayıt, görev, sohbet), denetim kaydı var; hücre başına geçmiş ve yorum yok | P1 hücre geçmişi (düzeltmeler zaten saklanıyor → görünür kılmak) · P2 kayıt üzerinde yorum |
| **Airtable** | Tek seçimli alanlar renkli; görünümler (ızgara, galeri, takvim, kanban); gruplandırma; satır yüksekliği | **P0 yapıldı:** durum/kategori renkleri, sık/rahat görünüm. Takvim görünümü yok; gruplandırma yok | P1 takvim görünümü (son tarih + randevu + taksitler tek ajandada) · P2 gruplandırma (şube, durum) |
| **Notion** | Yan panelde kayıt "peek", özellik türleri, şablonlar, "yenilikler" | Detay paneli var; yeni kayıt şablonu yok | P1 kayıt şablonu (sektöre göre varsayılan alanlar) · P1 güncelleme sonrası "Yenilikler" penceresi |
| **monday.com** | Renkli durum sütunu, zaman çizelgesi, otomasyonlar ("durum X olunca Y'ye bildir") | Renkli durum P0 yapıldı; otomasyon yok | P2 kural motoru ("vade 3 gün kala sorumluya görev aç") — takvim motoru ve görev sistemi hazır |
| **HubSpot / Pipedrive** | Kayıt sayfasında etkinlik zaman çizelgesi, "sıradaki etkinlik", e-posta/WhatsApp şablonları | İşlem geçmişi ve WhatsApp bağlantısı var; şablon yok | P1 mesaj şablonları (sektöre göre "ödeme hatırlatma" metni, tek tıkla WhatsApp) |
| **Trello / Asana** | Görevlerde son gün, atanan, kontrol listesi; "Benim görevlerim" | Görev atama, rozet ve bildirim var | P2 görevde alt madde ve son gün; görev takvimde |
| **Logo / Mikro (TR muhasebe)** | Yoğun ızgara, klavyeyle hızlı giriş, fiş/dekont çıktısı | Serbest sayfa Excel gibi; Kasa PDF var | P1 tahsilat makbuzu PDF (dekont) · P2 tablo içinde klavye gezinme (↑↓ Enter) |
| **WhatsApp Web / Slack** | Sohbette dosya, yanıt, arama; dışa aktarma | Arşiv ve dosya numarası bağlantısı var; sohbette dosya/görsel yok | P2 sohbete belge ekleme (belge modülü hazır) |
| **Windows / macOS bildirim merkezi** | Sırayla, üst üste binmeyen bildirimler; sistem bildirimi | 20 sn / 10 sn kuyruğu yapıldı | P1 sekme arkadayken tarayıcı sistem bildirimi (Notification API, izinle) |
| **Power Query** | "Aşağı doldur", "ilk satırı başlık yap", tür algılama, hata değerleri | **P0 yapıldı:** birleştirilmiş hücre doldurma, gruplu başlık, hata değerleri, toplam satırı | P1 içe alma önizlemesinde "bu satır başlık mı?" düzeltme düğmesi |

## 2. UI/UX değerlendirmesi (2.0.2 ekranları)

Güçlü yanlar: sakin renk dili, tek vurgu rengi, eyebrow/başlık hiyerarşisi, detay panelinde alan başına kalem, analiz ekranında "neden bu sektör?" kanıtı, uyarı kartında tek tıkla kapatma, belge kartı. Ofis çalışanı ekranı ilk kez görünce ne yapacağını anlıyor.

Bulgular ve adımlar:

| Bulgu | Etki | Adım | Öncelik |
| --- | --- | --- | --- |
| Durum/kategori değerleri düz metin | Göz taramada "Pasif" ile "Aktif" ayrılmıyor | Renkli nokta + tonlu yazı (tablo ve detay) — **yapıldı** (`hof-chips.js`) | P0 |
| Satırlar yüksek (≈60 px); 200 kayıtta çok kaydırma | Yoğun listelerde verimsiz | Sık/rahat görünüm düğmesi, tercih hatırlanır — **yapıldı** | P0 |
| Kasa penceresinde liste ile açıklama bitişik | Sıkışık görünüm | Boşluk — **yapıldı** | P0 |
| Sayfa başlığı dosya adı ("okul-servisi-kilavuz") | Ürün değil dosya hissi | Başlık: oturum adı insan diliyle ("Okul servisi kılavuz"), dosya adı alt bilgide; oturum adı zaten değiştirilebilir | P1 |
| Detay panelinde 7 eylem çipi iki satıra taşıyor | Birincil eylem belirsiz | *Düzenle* dolu düğme, iletişim (WhatsApp/Telefon) simge grubu, kayıt eylemleri (Not/Tahsilat/Görev/Belge) ikinci grup | P1 |
| Kolon başlığına tıklayınca hiçbir şey olmuyor | Excel alışkanlığı | Kolon menüsü: sırala, filtrele, gizle, genişlik sıfırla (sunucu tarafı `sheets.getRows` sıralama parametresi + oturum ayarı) | P1 |
| Arama ipucunda ⌘ simgesi | Windows kullanıcısı tanımıyor | Platforma göre "Ctrl K" | P1 |
| Alan etiketleri açık gri, küçük, aralıklı | Kontrast sınırda (WCAG AA altı olabilir) | Etiket rengi bir ton koyu (#6b7a75 → #5a6963), boyut 10 → 11 px | P1 |
| Boş durumlar (kayıt yok, belge yok) metin ağırlıklı | İlk kullanımda yön eksik | Boş durum kartı: kısa açıklama + tek birincil düğme + örnek dosya bağlantısı | P1 |
| Sayfada 20 kayıt sabit | Büyük listelerde çok sayfa | 20/50/100 seçimi, tercih hatırlanır | P1 |
| Klavye: satırlar arasında ↑↓ ile gezinme yok | Hızlı veri girişi | Tabloda odak yönetimi (roving tabindex), Enter detay, Esc kapat | P2 |
| Tablet/telefon yerleşimi | Sahadaki şoför/eksper telefonla bakamıyor | 900 px altında tek sütun: liste → detay geçişli görünüm | P2 |
| Karanlık tema yok | Uzun kullanımda göz yorgunluğu | `prefers-color-scheme` + ayar; renk değişkenleri zaten `--do-*` | P2 |

## 3. Mimari adımlar

### P1 — 2.0.3 / 2.1.0

1. **Kolon menüsü ve sunucu tarafı sıralama/filtre.** `sheets.getRows`'a `sort: {column, dir}` ve `filter: {column, values[]}` parametreleri; sonuç oturum ayarında (`view.sort`, `view.filters`) kişi başına saklanır. Arayüz: `hof-grid.js`'e başlık menüsü (zaten `th`'leri ölçüyor ve süslüyor). Ölçüt: 10.000 satırda sıralama < 50 ms (bellekteki `loadRows` önbelleği).
2. **Takvim görünümü.** Takvim motoru (`dues.mjs`) ve son tarihler zaten hesaplı; yeni uç `GET /api/workspace/agenda?from&to` bunları gün gün döndürür. Arayüz: Operasyon Merkezi'nde "Ajanda" (ay ızgarası, gün listesi), kayda tıklayınca detay. Ölçüt: aynı veriyle takvim ve şerit hiç çelişmez (tek kaynak).
3. **Hücre geçmişi.** `overrides` tablosu zaten eski/yeni değeri ve kişiyi tutuyor; detayda alanın yanında "geçmiş" simgesi, son 10 değişiklik. Sıfır şema değişikliği.
4. **Mesaj şablonları.** Sektör kataloğuna `templates: [{id, title, text}]`; yer tutucular `{ad} {tutar} {vade}`; WhatsApp bağlantısına metin eklenir. Kendi sektörü kartına şablon alanı.
5. **Tahsilat makbuzu PDF.** Var olan bağımlılıksız PDF yazıcı (Kasa dökümü) ile tek tahsilat için makbuz; numara `M-2026-000123`, ofis adı ve imza alanı.
6. **Sistem bildirimi.** `Notification` izniyle sekme arkadayken uyarı; kuyruğun aynı kalemi iki kez göstermemesi korunur.
7. **İçe alma önizlemesinde düzeltme.** Yükleme kartında "başlık satırı bu mu?" ve "bu sayfayı alma" seçenekleri; sunucu `matrixToRecords`'a `headerRow` ipucu. Zor düzenlerde kalan %1'i kullanıcı iki tıkla çözer.
8. **Yenilikler penceresi.** Güncelleme şeridine ek olarak sürüm notlarının ilk 5 maddesi (CHANGELOG'dan üretilir) bir kez gösterilir.

### P2 — 2.1 sonrası

9. **Kural motoru (otomasyon).** `rules` tablosu: tetik (vade N gün kala, durum X oldu, belge bitişi), koşul, eylem (görev aç, mesaj şablonu hazırla, bildir). Takvim motoru günlük döngüsünde kuralları değerlendirir; her kural denetim kaydına yazar.
10. **Gruplandırma ve özet satırları.** `sheets.getRows` `groupBy`; arayüzde katlanır gruplar ve grup toplamı (Excel alt toplam / Airtable group).
11. **Sohbete belge ekleme.** Mesaja `document_id`; belge modülünün depolama ve yetki kuralları aynen.
12. **Tablet düzeni ve karanlık tema.** CSS değişkenleri hazır; bileşen başına iki kırılma noktası.
13. **Klavye gezinme.** Tabloda roving tabindex; serbest sayfadaki klavye modeliyle aynı tuşlar.

### P3 — 3.0

14. **Ofis dışından güvenli erişim.** Ters vekil + tek kullanımlık cihaz kaydı (WebAuthn/geçiş anahtarı), oturum başına IP ve cihaz izi; lisans servisine "uzak erişim" özelliği. Yerel-önce ilke korunur: veri yine ofis sunucusunda.
15. **Çok ofis (şube) ve yetki alanları.** Oturumlar zaten veri kümelerini ayırıyor; kullanıcı → oturum yetki matrisi ve şube bazlı Kasa.
16. **Eklenti/entegrasyon katmanı.** UYAP/e-Devlet dışa aktarımları, e-Fatura/e-Arşiv, banka ekstresi (MT940/CSV) içe alma; her biri ayrı modül, ortak "kaynak" arayüzü (`sources.mjs`).
17. **Yerel yapay zeka yardımcısı (isteğe bağlı, çevrimdışı).** Küçük bir yerel model ile "bu ayki gecikmiş tahsilatları listele", "Ali Veli'ye hatırlatma yaz" komutları; verinin ofis dışına çıkmama ilkesi bozulmaz. Mevcut analiz/takvim uçları araç olarak sunulur.

## 4. Mühendislik disiplini (sürekli)

- Her sürüm: birim (Node 22 + 24) → uçtan uca (43+ adım) → zor veri seti → örnek dosya korpusu → güncelleme provası (üç eski sürümden) → imzalı paket → kurulum. Bu zincir `docs/SURUM-YAYIMLAMA.md`'de; hepsi bu turda koşuldu.
- Zor veri seti sürümle büyür: kullanıcıdan gelen her yeni "okunamadı" dosyası anonimleştirilip sete eklenir (17 → hedef 50).
- Performans bütçesi: 200.000 satır içe alma < 20 sn, analiz < 3 sn (önbellekli), ilk boya < 1 sn (yerel ağ).
- Güvenlik bütçesi: her yeni uç yetkiyle doğar (`requirePermission`), her `innerHTML` kaçışlı, CSP satır içi betiksiz, zip okuyucu zip-slip/CRC denetimli; süreç seviyesi hata yakalayıcıları var.
