# DAR KONTROL — Ç7b birleşimi (83030db5; ilk ebeveyn 83030db5^1 = Ç7b öncesi)

Kodda değişiklik, commit ya da push yapmadım. Worktree'de yalnız node_modules bağı var (izlenmeyen). Her sayıyı programı kendim çalıştırarak ürettim (HUKUK_LICENSE_URL=http://127.0.0.1:9, sahte saat).

## GERİLEMELER
**YOK.** Karşılaştırmayı temiz-100k verisinde yaptım (1.484 cari, 11.448 kart, bunların 2.756'sı kapalı; kilitsiz; 08.10.2026). Her kod kendi taze kopyasını açtı, eski kod ↔ yeni kod:
- Cari bakiyesi ve gecikmiş tutar: fark 0.
- Kart durumu, Ödenen, Kalan: fark 0.
- Zil: iki kodda da 39.460 kalem, 453.073.463,23 TL.
- Vade Takip toplamları aynı.
- Mutabakat Testi iki kodda da temiz.
- Mizan ana hesaplarında fark yalnız kararlı kurallarda:
  - 191 +2.514.592,42 / 391 −2.514.592,42 (net 0; KG-8 / F-08, dosya kilitsiz olduğu için yeni yön).
  - 600 −41.729.562,72 ve 336 −38.675.590,36. İkisinin toplamı 602'deki +80.405.153,08 farkını tam karşılıyor (Yeni Borç 602 → 600.90, kayıt tahsilatı 602 → 336.90).
- Bu karşılaştırma tek saat diliminde (varsayılan) koşuldu.

## İLK MADDELER
1. **Nasıl bozulur (13:39 (5)):**
   - (a) Kesilmiş fatura POST /invoices/:id/edit ile düzenleniyor.
     - Borçta Kalsın ile kapanmış, tahsilatsız kendi kartında Düzenle (3 → 4 adet) kapalı kartı SİLİYOR ve yeni AÇIK kart açıyor.
     - Sonuç: bakiye 1.200, gecikmiş 900 → 400 (09.10). Kartı Kapat'ın 'plan bitti' etkisi sessizce kalkıyor.
     - Eski kodda da kart yeniden açılıyordu; orada düşülmüş 900 de geri geliyordu (bakiye 0 → 1.200). Gerileme değil, ama gecikmiş tutarı değiştiren bir kural boşluğu (KULLANICIYA SORULMALI-1).
     - Tahsilatlı kartta Düzenle 409 (iki kodda da); İptal Et S217 iletisiyle 409.
     - Tarih değiştir → 400 ('İlk vade fatura tarihinden önce olamaz').
   - (b) Kapalı Mevcut Borç kartının faturasına iade: **BULGU-1 (ORTA aday)**, aşağıda.
2. **Kartı Kapat:**
   - Kalan borçta kalıyor, 689 maddesi yok. S205 ve S220 testleri yeşil.
   - BULGU 1 düzeldi. K1 ile yeniden ürettim: 'Kalan 2.500' tek onayla kapanıyor.
   - Eskimiş onay: tahsilat ile Kapat aynı anda gönderilince 200 / 409 plan-close-stale ('güncel kalan 800,00'), kart açık kalıyor.
   - Eşzamanlı iki Kapat 200 / 200 dönüyor; tek plan.updated kaydı yazılıyor, Mutabakat Testi temiz.
   - Kapalı karta Taksit Tahsilatı 200 kabul ediliyor. Kalan önce 700'e, ardından cari kartından girilen 300 ile 400'e iniyor; pencere kuyruktan okuyor.
   - Kilitli gün Kapat 409.
   - Carisiz kart '' işaretiyle kapanıyor ve kalemleri zilde kalıyor (pencere metni 'kalan kartta açık kalır' diyor).
3. **Kural geçiş günü:**
   - c7b-gecis-gunu testinin v2.4.9 gerçek-kod senaryosunu okudum. Kapsıyor: sınır günü ≤, eski mahsup ayı, Ters Kaydet → yeni yön, kilidi ileri alma / kaldırma, göçün yeniden koşması, göç öncesi yedeğin geri yüklenmesi, kilitsiz dosya.
   - Türetme, beklenen değer (expected), süzgeç ve mahsup aynı yardımcıyı okuyor: ledger-rule-shift.mjs. journal, ledger.mjs expected/rows, integrity-scope ve tax (build üzerinden) için kodda doğruladım.
   - İki şirketli kurulum ve şirket kopyalama: DENENMEDİ.
4. **Kilit izi:**
   - plans_close_lock'ta `since` yok ama göç 53'ten sonra satırları aynı kalıyor (bütün eski kapalı kartlar '2.4.9').
   - Yeni girdiler since 2.5.1 / 2.5.2 ile ekleniyor. c7b-kilit-izi ve goc52 testleri yeşil; eski kodda kırmızı.
5. **KG-7:**
   - Alan doğrulaması yalnız alışta, belge ayı ile izleyen yılın Aralık'ı arasında.
   - Kopyala ve Tekrarla dönemi taşımıyor; Düzenle taşıyor.
   - Mahsup (figureTable) ile KDV Özeti aynı dönem gününü kullanıyor. Testler yeşil; eski kodda kırmızı.
6. **S4:** carriedBefore cebirini kodda kontrol ettim; çift sayım yok, max(0, C) taşınıyor. c7b-kdv-s4 testi yeşil; eski kodda kırmızı.
7. **Taksit kartı (4) / S15 / S206 / S210 / S211 / S216 / S217 / S218:** c7b-tur3-kart ve c7b-degismez (tohum 11 ve 23, rastgele sıra) yeşil; eski kodda kırmızı.
8. **Excel taksit (S219 / S221 / S222):**
   - planDuplicate mantığını vaka vaka izledim; S221 → kart açılıyor, S222 → 'unknown', aynı Excel ikinci kez → 'same'.
   - Başka yükleme yolunda yalnız ada bakan kart denetimi kalmamış: Tablodan Aktar her kayda ayrı kart açıyor; çek içe aktarmadaki ad eşleşmesi S223'ün konusu.
9. **Beklentisi değişen testler:** hepsi 'BEKLENTİ BİLEREK DEĞİŞTİ' notu ve karar numarasıyla geliyor. Yedi tanesini iki kodda koştum (TZ İstanbul):
   - Yeni test yeni kodda 111/111. Eski test eski kodda 108 geçti / 0 başarısız / 2 atlandı (v2.4.9 etiketi kopyada yok).
   - Kendi hesabım:
     - POS kabul: 391 eskide 6.500; yenide 7.000 ve 191 500 (KG-8).
     - ertelenen-224: bakiye 12.720 + kartın kalanı 6.000 = 18.720 (karar (6)).
     - GG2 fiş: 191 +20 / 391 −20 (F-08).
     - accounts-stock: 602.90 / 770.90 (KG-4).
10. **Testin dişi:**
    - Ç7b'nin 18 yeni test dosyası yeni kodda 86/86 (kanit dkc7b-yeni-c7b).
    - Ç7b öncesi kodda hemen her alt sınama kırmızı; nedenleri beklenen yönde (eski hesaplar, eski davranış). Ör. c7bt'de 'Aynı adla açık kart var' — eski ad denetimi.
    - Mutasyon araçlarını koşmadım.

## BULGULAR
**BULGU-1 — ORTA aday: kapalı (Borçta Kalsın) Mevcut Borç kartında kart 'Kalan'ı carinin borcundan büyük görünüyor**
- Yer: server/routes/plans.mjs:742 (trimCovers `if (plan.status === "closed") continue;`) ve shrinkPlan (`row.status === "closed"` → 0).
- Betik: probe/p2.mjs, `CLOSE=1 MODE=return`.
- Senaryo: fatura 900 → Mevcut Borç kartı 900 (3 × 300) → kart tahsilatı 300 → Kartı Kapat ('Kalan 600') → faturaya iade 300, borçtan düşülür.
- Sonuç:
  - Bakiye 300; 09.10'da gecikmiş 300 (doğru).
  - Kart penceresi, cari kartı özeti ve Taksitler listesi 'Kalan 600'. Satır kalanlarının toplamı 300.
  - Kesilen taksit 10.12 (sondaki), kalan taksit 10.11. Bu karar (4)'ün tersi; vadeler kapanış gününe çekildiği için gecikmiş aynı.
  - Yeniden Aç → Kartı Kapat onayı 'Kalan 600' soruyor, gerçek borç 300.
- Kontrol (kart açık, `CLOSE=0`): aynı iade kartı 600'e küçültüyor, Kalan 300 — doğru.
- Eski kodda kapalı kart düşülmüş sayılıyordu: bakiye −300, Kalan 600 'düşülen' anlamındaydı.
- Komşular:
  - Faturayı Düzenle ile 900 → 300'e indirmek aynı sonucu veriyor (p3 a3 / p4): Kalan 900, bakiye 300.
  - Faturanın iptali aynı sonucu veriyor ama S226 = C ile BİLİNEN SINIR.
  - Açık kartta Alacak Yaz 300 de Kalan 600 / satırlar 300 gösteriyor; eski kodda da aynı. Ç7b'nin değil, önceden var.
- Para etkisi: bakiye, mizan ve gecikmiş doğru; yanlış olan kullanıcıya gösterilen tutar ve onay penceresindeki tutar.
- Kök neden: Borçta Kalsın kapalı kartın kalanını borçta tutuyor, ama küçültme yolları kapalı kartı atlıyor.
- En küçük düzeltme: trimCovers / shrinkPlan, kalanı düşülmemiş (`!waivesRemaining`) kapalı kartı da karar (4) sırasıyla küçültsün. Bu bir kural seçimi → KULLANICIYA SORULMALI-2.

**Düşük gözlem:** Taksitler rozeti ve Geciken sekmesi, kapalı Borçta Kalsın kartının gecikmişini saymıyor; zil ve cari sayıyor. Değişen e2e beklentisi bunu kabul ediyor. Sakınca süzgeci: para / bakiye / defter yok → 2.5.1.

## SIRA / EŞZAMANLILIK / YETKİ
- Sıra: kapat → tahsilat, kapat → iade, kapat → Düzenle, kapat → iptal, kapat → yeni borç denendi; sonuçlar yukarıda.
- Eşzamanlılık: iki Kapat 200 / 200; tahsilat + Kapat 200 / 409.
- Yetki: rol × değişen uçlar DENENMEDİ.

## K1–K12
- K1 kitapla uyumlu: G-8, §7.5 (6), KG-3 'Kasa + Tahsilat A' (649), S49 ile aynı hesap.
- K3 / K4 (B-6 / B-8): kodda tek tanım (ledger-rule-shift.mjs), göç 51 yalnız işaret yazıyor (tutar yok).
- K5 / K6 (Sıfırla vat_offsets + geçiş günü): app.mjs'de var; c7b-sifirla testi yeşil.
- K9 (S210 / S217 / S218 cutTargets "tail"): kod kararla aynı.
- K10: iptal yolunu kodda okudum; coverCancelText fatura GET'inde carinin bütün defterini (coverState) okuyabiliyor. Ölçülmedi → DOĞRULANMADI.
- K12: DENENMEYEN listesindeki eşzamanlı iki Kapat, kilitli gün ve carisiz yeni kartı ben denedim; sorun yok.
- Aykırılık bulmadım.

## KULLANICIYA SORULMALI
Bu iki soruyu iş listesi C / D'nin bu göreve verilen kısmında (karar dosyası) aradım; sorulmuş değil. S226 en yakın akraba.

1. **Borçta Kalsın ile kapanmış, tahsilatsız taksitli faturada fatura Düzenle**
   - A: kapanış korunsun; yeni kart da kapalı açılsın, kalan kapanış gününden gecikmiş.
   - B (öneri): bugünkü gibi kalsın — Düzenle yeni ödeme planı kurar, kart açılır. Düzenle penceresi kartın yeniden açılacağını söylesin.
   - C: uç durum böyle kalsın (BİLİNEN SINIR).
   - Bakiye her seçenekte 1.200. Gecikmiş A'da 1.200, B / C'de 400 (09.10, örnekte).
2. **Kapalı (Borçta Kalsın) Mevcut Borç kartının içine aldığı faturaya iade ya da Düzenle ile azaltma** (BULGU-1)
   - A (öneri): karar (4) kapalı karta da uygulansın; kart küçülsün, Kalan 300.
   - B: kart küçülmesin, pencerenin Kalan'ı satırlardan hesaplansın (300).
   - C: S226 = C gibi uç durum böyle kalsın (BİLİNEN SINIR).
   - Bakiye her seçenekte 300, gecikmiş 300. Fark yalnız gösterilen tutar ve onay penceresi (A / B'de 300, C'de 600).
   - Yaygın programlarda nasıl yapıldığı: doğrulanmış kaynak okunmadı.

## SONRAKİ SÜRÜME (2.5.1)
- Taksitler rozetinin Borçta Kalsın gecikmişini saymaması (görünüm).
- Açık Mevcut Borç kartında Alacak Yaz sonrası Kalan ≠ satırlar (önceden var).
- Değişen donmuş-defter testlerinde fikstür verisinin değiştirilmesi (kapsam nüansı).

## DOĞRULANMADI
- coverCancelText'in fatura GET süresi (hız). Yük 4,56'ya çıktığı için ölçüm başlatmadım.

## DENENMEYEN
- Mutasyon araçları.
- Rol × uç yetki tablosu.
- İki şirketli kurulum ve şirket kopyalamada geçiş günü.
- GERİLEME karşılaştırmasının ikinci saat dilimi ve v2.4.9 kilitli büyük veri (yalnız testlerdeki v2.4.9 senaryolarıyla).
- e2e senaryoları.
- KDV Özeti ekran / PDF / Excel toplamları (yalnız testler).

## Not defteri
- Klasör: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c7b-r1
- İçinde: rapor-taslak.md, probe/p1–p5.mjs, dump.mjs, hiz-fatura.mjs, dump-eski.json / dump-yeni.json, yeni-c7b.log, eski-c7b.log, mod-yeni.log, mod-eski-eskitest.log, kanit/.
- Eski kod kopyasını ve veri kopyalarını sildim; boş disk 5,7 GB.
