# Ç7b TUR 2 — ajan raporu (AYNEN; ajan afbfc981262c5b2b8)

Ç7b TUR 2 — ARA RAPOR (YARIM). Bağlamım daraldığı için durdum (görev metni, "SIRA ve ARA RAPOR"). Dal worktree-agent-afbfc981262c5b2b8, taban fc0d1999 (sıfırlandı ve doğrulandı), 7 commit, PUSH YOK. Bende süren arka plan işi yok. Ortam: yük 1,1 / 4 çekirdek, bellek boş 11 GB, disk boş 9,9 GB. Ölçüm kilidi (olcum.lock) ana oturumun hız kabul işinde (ana-hiz/hiz.sh kilitsiz) DOLU olduğu için hiçbir yük koşusunu başlatamadım. Son dört maddeyi bu yüzden koşmadım.

**Kod yazıldı ama birleşmeye hazır DEĞİL.** f1c8bbe5'ten sonra G2 komşu taraması (185 dosya, UTC) 2048 testten 1970'ini geçirdi: 66 başarısız, 12 iptal. Kırıkların bir kısmını düzelttim ama düzeltmeleri koşamadım. Kalanına hiç dokunmadım.

**Değişen davranış (önce → sonra; Yevmiye, Mizan, Alt Hesap Mizanı):**
- K-01 / K-02 (KG-3 A + BAŞ MİMAR KARARI 19.11): carisiz Kasa girişi A 649 → A 649.90, Kasa çıkışı B 770 → B 770.90. Kasa açılışı, vergi ödemesi ve transfer değişmedi.
- C-01 / C-02 (KG-4 A): Borç Yaz A 602 → A 602.90, Alacak Yaz B 770 → B 770.90. Açılış işaretli olanlar 519'da kaldı.
- KG-2 = A: stok veresiye ve peşin satış 600 → 600.90, müşteri iadesi 610 → 610.90. Taksit Yeni Borç A 602 → A 600.90 (ana hesap değişti). KDV ayrılmıyor. Mevcut Borç kartı ve Excel kartı değişmedi.
- KG-3 = A: kayıt tahsilatı A 602 → A 336.90. Satır cariye bağlı değil. Defter Mutabakatı'nda 336'nın beklenenine kayıt tahsilatlarının toplamı katıldı (B-2).
- KG-24 = A: satış ve SMM'nin 301 / 302 kodlu kalemi 600 → 601. Karma faturada yalnız o kalem ayrılıyor. Hesap planına 601 "Yurt Dışı Satışlar" eklendi. rows().invoices artık `exportJson` taşıyor (B-3 = A). Satıştan iade 610'da kaldı.
- KG-8 = A / F-08: satıştan iade KDV'si B 391 → B 191, alıştan iade KDV'si A 191 → A 391. expected()'te 191 / 391 de aynı turda değişti. Mahsup sonucu iki kuralda aynı: Eylül örneğinde H 2.800 / İ 920 / ödenecek 1.880; eski kuralla H 2.400 / İ 520 / ödenecek 1.880.
- S4 = A (tax.mjs): mahsuptan sonra girilen ve İ'yi azaltan kayıt sonraki mahsuba taşınıyor; geçmiş ayın saklı fişi değişmiyor. Böyle bir ay artık "Güncel Değil" sayılmıyor. Ön izlemede `carriedInMinor` alanı ve bir bilgi satırı var. İ'yi artıran geç fatura bugünkü gibi "Güncel Değil". Aylar tek geçişte hesaplanıyor (ders 47).
- YB-1: Kartı Kapat eskimiş "Kalan X" onayıyla verilemiyor. İstemci `closeRemaining` gönderiyor; kalan değiştiyse 409 `plan-close-stale` dönüyor, kart açık kalıyor ve pencere güncel kalanla yeniden soruyor. Alan gönderilmezse bugünkü davranış sürüyor. Kapatmanın defter / cari etkisi değişmedi (tur 3'ün işi).

**Kod değişmeden uyan kural:** F-06 / M14 (770 / 760 / 255 / 653). Kalıcı testi var.

**Testler** (ikisi de UTC ve Europe/Istanbul'da yeşil; tabanın ayrı kopyasında kırmızı, nedeni okundu):
- `test/c7b-kitap-turetme-250.test.mjs`: 7/7. Tabanda 0/7 — örneğin 649 / 649.90, 602 / 336.90, 600 / 601, 391 / 191 farkları.
- `test/c7b-kdv-s4-250.test.mjs`: 4/4. Tabanda 3'ü kırmızı — Eylül stale true !== false.
- `test/c7b-kart-kapat-onay-250.test.mjs`: 2/2. Tabanda eski onay 200 ile kabul ediliyor, kart kapanıyordu.
- Mutantlar KOŞULMADI.

**Taban (önce) koşuları** (docs/kanit/2026-11-19/):
- Kâhin defter 187/187 (tek TZ).
- Kâhin cari 17253/17253.
- Sürücü 5836/6426, 548 fark. s17 arşiv kopyasında git etiketi olmadığı için koşu hatası verdi.
- "Sonra" koşuları (kabul A, B, C) kilit dolu olduğu için KOŞULMADI.

**Kırık komşular** (tasarım notu §11.4):
- Düzeltildi, koşulmadı: acilis-519-250 (KG-4), hesap-plani-sinif-250 (601), banka-210-gg2-fis (F-08), banka-220-pos-kabul (KG-8). Mutabakat motorunun 336 modeli düzeltildi (test aracı, aynı el; gg-cari, gg2-hiz, hiz-esdegerlik bunu kullanıyor). `test/guvenilirlik/defter-olgulari.mjs` eski düzen katlamasına Ç7b kuralları eklendi (altin, goc-zinciri bunu kullanıyor).
- Dokunulmadı: banka-220-senet-121, banka-220-tahsile-ver-tur2, kapi-para-245, kasa-acilis-once-250, kural-farki-duzeltme-250, kural-farki-yil-250, donmus-defter-250 / -bellek / -tur1 / -tur3 / -tur4 / -yasam (Ç3'ün açıklama kümelerine Ç7b kimlikleri eklenmeli), defter-kaynak-iz-250 (aşağıda B-7).

**BAŞ MİMAR KARARI GEREKİYOR:**
- **B-6 (§11.2):** KG-8'den önce yazılmış, ayında iade olan KDV mahsupları "Güncel Değil" görünüyor. Mahsuptan sonra 191 +Δ ve 391 −Δ kalıyor (toplam 0, 360 doğru). Kilitli ayda 191 / 391 alt defter hesabı olduğu için fişle düzeltilemiyor. Öneri: göç 51'de bütün eski mahsupların H ve İ değerine o ayın iade KDV'si eklensin. Göç 51'in izni yalnız KG-7 olduğu için kodlamadım.
- **B-7:** KG-24'ün okuduğu `invoice_lines.exemption_code / gl_account / net` kilit izinde değil. Öneri: bu sütunlar kilit izine eklensin (kilit izi sürümü artar). Bu turda `integrity.mjs` kilit izine dokunmak yasaktı.

**KULLANICIYA SORULMALI:** KDV Özeti raporu beyanname düzeninde kaldı (Hesaplanan = satış − satıştan iade); defter artık KG-8 düzeninde. Ödenecek aynı, kalemler ayrışıyor. Seçenekler: (A) rapor beyanname düzeninde kalsın — öneri; (B) rapor defterle aynı kalemleri göstersin.

**KAPSAM DIŞI BULGU — S15 = A kodda YOK:** tasarım notu §2.5 "Ç5-B'de yapıldı" diyordu, bu yanlış. Tahsilatı olan taksitli faturanın İptal Et'i bugün 409 `plan-has-payments` dönüyor; test/ertelenen-224 de bu reddi bekliyor. Kodu `routes/invoices.mjs` içinde ve dosya sınırımın dışında olduğu için durdum. Yeniden üretim testi depoya girmedi; not defterinde.

**YAPILMADI:**
- KG-7 (göç 51, alan, mahsup seçimi) ve kılavuz.
- E (hız): betik hazır, ölçmedim.
- D (kilitli v2.4.9 verisinde kural farkı sınıf testi).
- Mutantlar, G kabulü (ekran), Istanbul TZ komşu taraması.
- Sürücü eşleme notu: sürücüdeki `__kdvIndirimAyi` yeri KG-7 alanına (önerdiğim ad `vatPeriod`) bağlanmalı; sürücü dosyalarına dokunmadım.

**Sıradaki temiz ajana:** (1) `komsu.sh` ile kirik-yardimci.txt ve kirik1.txt listelerini koş, kalan beklentileri kararla düzelt. (2) Kâhin / sürücü "sonra" koşuları; s17 için `git worktree` kopyası gerekir. (3) Hız ölçümü: `olcum/olc-c7b2.mjs` ve `c7a-t2b/olcum/hiz.sh` kalıbı. (4) KG-7. (5) S15, B-6, B-7 kararları.

**Commit'ler:** f1c8bbe5, 7b9b068b, 32d33c71, 8c38b81b, 20d1bbbb, f8e9c7fc, b88d4402 (kanıt). Ayrıntı ve okuyucular: `docs/erp/C7B-FATURA-TASARIM.md` §11.

**Not defteri klasörleri:**
- Taban kopyası: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/taban
- Kırmızı kopya: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/kirmizi
- Komşu koşu betiği: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/komsu.sh
- Kırık komşu listeleri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/kirik1.txt, /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/kirik-yardimci.txt
- Komşu taraması ham çıktısı: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/komsu-utc1.out
- Taban sürücü çıktısı: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/surucu-once
- Hız betiği: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/olcum/olc-c7b2.mjs
- S15 yeniden üretim testi: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2/s15/c7b-s15-iptal-250.test.mjs
