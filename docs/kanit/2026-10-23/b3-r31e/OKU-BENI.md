# 31e tur 8 (Y1, Y2, Y3 + kâhin K4 / 5b ayrıntıları) — is/r31e-f, kod commit 975217f (taban aday 18 = 983af10)

## Nasıl bozulur
- **Y1 (kimlik / tarih / kişi kolonu borç sanılır):**
  - "Borç…" başlıklı telefon ya da TC kolonu: Borçlu Telefon, Borçlu TC (sağlaması tutsa da tutmasa da), Borç İletişim.
  - Tutar rolü almış sicil numarası (Borçlu Sicil); kişi adı başlığı (Alacaklı).
  - Bunlar kalem tutarı da olabilir, Açılış Bakiyesi'ni de doldurabilir.
  - Ters yönde risk: Tutar + Masraf sekmesi notsuz düşer; "Borçlu Tutarı" / "Bakiye Borçlu" tutar olmaktan çıkar.
- **Y3 (seyrek Kalan):**
  - Kalan dolu satırda kalem tutarı Kalan'ın önüne geçer.
  - Kalan boşken ana tutar yok sayılır.
  - İki adaylı satır sessizce düşer ya da biri seçilir.
  - Yazıyla doldurulmuş Kalan yok sayılır.
  - Söz kalemi Kalan'ı alır.
  - Açılış Bakiyesi raporlardan farklı olur; aylık ücret açılış borcu yapılır.
- **Y2 (aynı ad):**
  - İki Ali farklı telefonla ayrılmaz.
  - Telefon ya da kimlik yalnız bir tabloda olunca yanlış eşleşme olur.
  - İki Ali aynı telefonu taşıyınca yanlış eşleşme olur.

## Kırmızı (aday 18) → yeşil (975217f)
- `ham/kirmizi-aday18-983af10-yeni-testler.out`: 11 yeni testten 10'u kırmızı. Testler aday 18'in ayrı kopyasında koşuldu (git archive 983af10). Nedenler iletide:
  - Kişiler'de 5.321.112.233 / 10.000.000.146 TL.
  - Vadeler 48.309.027.906.
  - Oğuz 250 yerine 500.
  - Takvim'de Gül 500 (borcu belirlenemiyor).
  - K4: 5.000 ≠ 3.780.
  - Kira Kalan Borç boş.
  - Y2: 409 "eşleşmedi: Ali Veli".
  - Söz sınır testi aday 18'de de yeşil (koruma testi; M40 mutasyonu ile dişli).
- Tur 8 senaryosu (`betik/seyrek-komsu.json`, `betik/tablo-kos.mjs`):

| | aday 18 (`ham/tur8-senaryo-aday18-983af10.out`) | 975217f (`ham/tur8-senaryo-975217f.out`) |
|---|---|---|
| Kişiler toplamı | 48.309.025.436 | 9.530 |
| Not | yok | BorcluTC (Tutar, Masraf) + SeyrekKalan (Kalan boş satırlar) |

  - Vade ve Nakit 11.030 (fark 1.500 = söz kalemleri; söz borç değil, U2).
  - Takvim'de telefon / TC yok.
- Y2 (`betik/y2-yeniden.mjs`): kolon eklenip bağlı Ali'nin tutarı değişince aday 18'de 409, onaydan sonra tahsilat yok. 975217f'te tahsilat ve not kendi Ali'sine onaysız taşınıyor (`ham/y2-*.out`).
- Bağımsız cari kâhini (is/kahin-244 72b66ce; kodu görmeden yazılmış; `KAHIN_PROGRAM_KOKU=/home/user/wt/r31e-f`, program 975217f):
  - `kahin-cari-72b66ce-tum`: 26 senaryo 3511/3511, 0 fark. Aday 18'de 23 fark vardı; b3n/b3o/b3p/b3b dahil.
  - Kâhinin kendisine dokunulmadı.
- Testler:
  - `komsu-testler` 1179/1179 (82 dosya).
  - `mutasyon-kimlik-bag` 40/40 (M30–M41 tur 8). Kanıt aracı commit'i "26c452e +9" yazıyor: koşu commit'ten önce başladı, içerik 975217f ile aynı, sonra kod değişmedi.
  - `goc-v243` 46/46.
- e2e (flock altında): senaryo-kayit-bag-31e 43/43, senaryo-rapor 90/90, senaryo (Tablodan Aktar) 47/47, senaryo-219 42/42, senaryo-kayit-tahsilat-244 46/46, senaryo-212 24/24, senaryo-216 54/54, uiux-ui11-244 153/153, e2e (run) 50/50.

## Kararın uygulanışı ve istisna
- **Y3:** "ana tutar" = borç başlıklı / tek tutar / Genel Toplam (30a). Aidat + Gecikme Faizi, Tutar + Masraf iki aday sayılır → not (kâhin b3o ile aynı okuma). Not Tablodaki Kişiler, Vade Takip, Nakit Akışı ve Tahsilat Takvimi'nde.
- **K4:** tek vadeli tabloda takvim kaleminin tutarı satır borcudur. Ödeme sözü kalemi söz tutarı kalır.
- **5b:** Açılış Bakiyesi = satır borcu. İstisna: ay kolonlu / aylık ödemeli sekmede aylık ücret açılış borcu değildir (8871ccf kuralı).
  - İstisnasız ilk denemede `npm run test:e2e` okul servisinde kırmızıydı (`ham/e2e-run-5b-istisnasiz-kirmizi.out`). Pilden açılan carinin Açılış Bakiyesi 4.500 aylık ücretle doldu; Tablodan Aktar "aynı borç mu belli değil" deyip öğrenciyi aktarmadı.
  - Kâhin b3b (Kira, tek vadeli) yine 4.000 ile yeşil.
- **Beklenti değişikliği (karar):** `test/tablo-borc-r31e.test.mjs` T4, Can Yıldız ("Taksit Tutarı", tek vadeli). Kalan Borç boş yerine 1.000. 8871ccf'nin tek vadeli sekme kuralı 5b kararıyla kalktı.
- **Tablodan Aktar** kendi kolon seçicisini kullanır (installments.mjs paymentColumns: toplam / tutar / ödenen / kalan başlıkları). "Borçlu …" başlığını almaz; bu turda değişmedi.
