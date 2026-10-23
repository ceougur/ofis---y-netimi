# 31e tur 16 — aday 23 gerilemeleri R1 / R2 (DONDURMA: yalnız gerileme) — is/r31e-f, kod 23cf851 (taban aday 23 = 0c42a85; aday 22 = 49072ca)

## Bulgular (dar kontrol tur 13 dökümü; senaryo r31e/tur13/taahhut-borc.json; ikisi de tur 13–14 farkından)
- **R1 ORTA:** `isBarePromiseHeader` borç / alacak / kalan / bakiye / toplam sözcüklü taahhüt sütunlarını da yalın söz (para dışı) sayıyordu.
  - "Taahhüt Alacağı": Takvim / Vade kalemi 3.300 / 3.600 → boş.
  - "Aylık Ücret 300 + Taahhüt Bakiyesi 2.100": Kişiler / Açılış Bakiyesi 300 (bakiye yok sayılıyor).
  - Nakit: aday 22 25.900 → aday 23 19.000.
- **R2 DÜŞÜK:** `dues.mjs` söz tutarı adayı sayı rolündeyken gün / ay / % başlığını süzmüyordu. "Taahhüt Miktarı (Ay)" 12 söz kalemi oluyordu; aday 22'de Kalan 5.000.

## Karar (koordinatör: Y1 + N4 + K3) ve uygulama
- R1: borç / alacak / kalan / bakiye / toplam ailesi sözcüğü taşıyan söz ailesi başlığı yalın söz DEĞİLDİR; aday 22 gibi para kolonudur.
  - `debt-column.mjs` `DEBT_FAMILY_WORD`. Ekli biçimler ("Alacağı", "Bakiyesi", "Borcu", "Toplamı") YALNIZ bu muafiyette tanınır.
  - REMAINING / TOTAL borç kalıpları genişlemedi. "Bakiyesi" Kalan sayılmaz; 2.5.0 adayı 2, dokunulmadı.
- R2: `dues.mjs` promiseAmount `!isNotAmountHeader(column)`. "Söz Miktarı" (Z6) yine söz tutarı.

## Sonuç (yeniden üretim `betik/taahhut-borc.json` = tur13 senaryosu + TaahhutMiktariAy)
- Kaynak çıktılar: `ham/taahhut-borc-{v243,aday22-49072ca,aday23-0c42a85,23cf851}.out`.
- Takvim kalem tutarları ve Vade / Nakit 30.900 aday 22 ile birebir. Değerler: Gül 3.300, Hale 3.600, Can / Deniz 300, Nur 5.000.
- Tablodaki Kişiler:
  - "Taahhüt Alacağı" sekmenin tek tutar sütunu olarak borç: Gül 3.300, Hale 3.600. Aday 22'de Kişiler'de yoktu; tur 13 kuralı ("tek tutar sütunu borç", söz tutarı dışında).
  - "Aylık Ücret" + "Taahhüt Bakiyesi" sekmesinde borç seçilemiyor: Can / Deniz Kişiler'de yok (aday 22 gibi), Açılış Bakiyesi boş. Ek olarak görünür "seçilemedi" notu var; aday 22'de notsuzdu.

## Kanıt
- Kırmızı → yeşil:
  - Aday 23'ün ayrı kopyasında yeni testler 2/2 kırmızı (`kirmizi-aday23-0c42a85-yeni-testler`). Nedenleri iletide:
    - R1: Takvim Can / Deniz borcu 300, Gül / Hale kalemi boş; Kişiler +Can 300 +Deniz 300 −Gül −Hale.
    - R2: Nur 12.
  - Aday 22 kopyasında yalnız Gül / Hale borcu farklı (`kirmizi-aday22-49072ca-yeni-testler`; tur 13 kuralı, yukarıda).
  - Yeni kodda: `tablo-borc-r31e-yesil` 15/15 (tur 11–16), `komsu-testler` 1201/1201.
- Mutasyon `mutasyon-kimlik-bag-dar` (MUT_SEC: M49, M54, M55, M60–M62, M68–M70) 9/9 yakalandı.
  - Yeni mutasyonlar:
    - M68: borç ailesi muafiyeti yok.
    - M69: ekli biçim ("Alacağı", "Bakiyesi") tanınmaz.
    - M70: "(Ay)" süzülmez.
  - M62 değişen satıra uyarlandı. 69 mutasyonun dizgesi kodda tek kez geçiyor.
- e2e (flock altında, 23cf851): run 50/50, senaryo-kayit-tahsilat-244 46/46, senaryo-rapor 90/90, uiux-ui11-244 153/153, senaryo (Tablodan Aktar) 47/47, senaryo-cari-243 48/48, senaryo-216 54/54, senaryo-219 42/42, senaryo-kayit-bag-31e 43/43.
- `goc-v243` 46/46.
- Bağımsız cari kâhini `kahin-cari-4e68411-tum` (is/kahin-244 4e68411, koşu anında log -1; dokunulmadı; program 23cf851): 35 senaryo, 3873/3883, 10 fark (BULGU 6) + 1 BİLİNEN. Farkların hepsi b3y'de.
  - b3y'yi üç sürümde ayrıca koştum (`ham/kahin-b3y-*.out`).
  - R1 (1011 "Taahhüt Alacağı") ve R2 (1014 "(Ay)") farkları aday 23'te var, 23cf851'de KAPANDI.
  - Kalan farklar 1012 / 1013 satırlarında ("Aylık Ücret" + "Taahhüt Bakiyesi"): rapor borcu, Açılış Bakiyesi, grup, k4 toplamları.
    - Nedeni ertelenen 2.5.0 adayı 2: "Bakiyesi" Kalan tanınmıyor. Kâhin bakiyeyi Kalan sayıyor (4.000 / 300).
    - Aday 22'de bu satırlarda AYNI farklar var (borç 0, Açılış boş, grup yok, Takvim 920.000). Yani gerileme değil; 23cf851 aday 22 ile aynı, ek olarak "seçilemedi" notu var.
    - Kâhinin BILINEN.json kaydı aday 23 değerini (program 1.000 = Aylık Ücret borç) yazmıştı. Koordinatör R1'de bu 300 / 1.000 değerini gerileme saydı. Kayıt "BİLİNEN DEĞİŞTİ" diyor; kâhin tarafında güncellenmeli (program 0 / boş + not). Kâhine dokunulmadı.

## Yalnız rapor (düzeltilmedi — DONDURMA)
- Gül / Hale "Taahhüt Alacağı" Kişiler'de borç oldu (aday 22'de yoktu). Bu, onaylanmış tur 13 kuralının (söz tutarı borç adayı değil → sekmenin tek tutar sütunu borç) sonucudur. Muafiyet kararı "aday 22 sınıflamasıyla aynı" dediği için ayrıca belirtilir.
