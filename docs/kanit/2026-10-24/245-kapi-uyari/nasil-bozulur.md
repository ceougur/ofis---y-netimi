# 245-kapi-uyari — "Nasıl bozulur?" (madde 4 + 5), işe başlarken

1. Öbür sayfa (foreign) yolu unutulur: açık sayfada tablo kalemi kalkar, öbür sayfanın kalemleri (reports.calendar → dues foreignItems) zile/takvime girmeye devam eder.
2. Taksit kartı olan kişinin ödeme SÖZÜ (bugün carded filtresinden muaf, "promise" ayrı tutuluyordu) kalır.
3. Önbellek anahtarı: tableKey'den tahsilat/kart parmak izi çıkınca deadlines eskimez mi; settle sonrası temizlik; gün dönümü.
4. Vade Takip ile Tahsilat Takvimi farklı kaynaktan (Vade Takip reports.calendar, takvim computeDues) — biri kapanır öbürü açık kalır; Projeksiyon üçüncü yol (tableItems).
5. Deadline davranışı değişir: tutarlı kalem doğuran tarih sütunu artık deadline'a düşer (para tarihi ajandaya dönüşür) — dar yorum: DÜŞMEZ (exclude sources aynen).
6. 002 şirketi / çok sayfa: başka şirketin ya da sayfanın tablosu.
7. Yetkisiz kullanıcı: reports.view'siz / overview.view'siz kişi; taksit/çek/fatura/banka süzgeçleri değişmez.
8. Tablo yeniden yüklenince (aynı veri, yeni oturum anahtarı) eski önbellek kalemi döner.
9. Tablo Raporları: etiket değişince ekran/PDF/Excel ayrışır; Kasa sütunu kalkınca TOPLAM / özet / cashHidden notu tutarsız kalır.
10. İstemci: Projeksiyon "Tablodaki ödeme günlerini ekle" kutusu ve Vade Takip "Tablo"/"Ödeme Sözü" süzgeci boşa düşer; eski ayarla `table=1` gönderilir.
