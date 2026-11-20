# S231 küçük turu — rapor taslağı (ajan a344e59ce09e2239a; taban s223-uc = b169e197)

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
1. Grup adı harf varyantları: 'Işık Servisi' ↔ 'IŞIK SERVİSİ' ↔ 'ışık servisi' ↔ 'IşIK sErVİsİ'; İ / i, I / ı; Ş Ğ Ü Ö Ç büyük / küçük ('ÇAĞLAR ŞUBE' ↔ 'Çağlar Şube'); boşluk ('Işık  Servisi', baş / son boşluk, sekme).
2. Alt grup (güzergâh / blok) aynı varyantlarla; aynı adlı alt grup FARKLI ana grupta (ana grup ayrımı korunmalı: 'A Blok' iki ayrı sitede iki ayrı alt grup kalır).
3. Var olan ÇİFT grup (eski hatanın açtığı 'Işık Servisi' + 'IŞIK SERVİSİ'): birebir yazım bugünkü grubuna (NOCASE önce); üçüncü yazım iki aday bulur → bugünkü gibi yeni grup.
4. Aynı dosyada iki yazım: ilk satırın açtığı grup ikinci satıra görünmeli (yükleme içi harita); ilk satır kilit / atlanma yüzünden GERİ ALINDIYSA (iç işlem) haritadaki grup kimliği artık yok → ikinci satır yok olan gruba bağlanmamalı.
5. Telefonsuz kişi + aynı grup (S223 kişi kuralı): S231 örneği 'Elif Su' / 'Işık Servisi' sonra 'ELİF SU' / 'IŞIK SERVİSİ' → AYNI grup, AYNI cari, tek borç; aynı Excel ikinci kez → 'Aynı adla açık kart var'.
6. Telefonlu kişi: grup eşleşmesi kişi eşleşmesini DEĞİŞTİRMEZ (telefon tutuyorsa grup farkı önemsiz; bugünkü gibi).
7. Tablodan Aktar: ön izleme (groupExisting) ↔ aktarım (groupId) aynı grubu bulmalı; ön izleme 'match' diyorsa aktarım aynı cariye bağlamalı. Geri Al: aktarımın açtığı grup silinir, var olan (katlamayla bulunan) grup SİLİNMEZ.
8. Geri Al (taksit Excel aktarım kaydı): yalnız yüklemenin açtığı gruplar geri alınır; katlamayla bulunan var olan grup kalır.
9. Kilitli dönem: satır atlanınca açtığı grup geri alınır, rapor 'groups' sayısı doğru.
10. İki şirket: harita şirketin kendi store'undan; bir şirketin grubu ötekine görünmez.
11. Elle grup açma (POST groups) ve yeniden adlandırma formu, tek kart formu (groupName) DEĞİŞMEZ: 'Işık Servisi' varken elle 'IŞIK SERVİSİ' açmak bugünkü gibi YENİ grup açar; yeniden adlandırmada çakışma denetimi bugünkü gibi NOCASE.
12. Cari Excel'in grup sütunu (aynı ensure yolu): 'IŞIK SERVİSİ' yazımı var olan 'Işık Servisi' grubunu bulmalı (yoksa sonraki taksit Excel'inde telefonsuz kişi grubu tutmaz).
13. Çek / Senet hız düzeltmesi: önbellek anahtarı yanlış olursa iki yazım aynı sonucu paylaşır (S223'ün düzelttiği hata geri gelir).
14. Para: borç yalnız grup varyantı satırlarında yer değiştirir; Mutabakat Testi + Defter Mutabakatı temiz.
