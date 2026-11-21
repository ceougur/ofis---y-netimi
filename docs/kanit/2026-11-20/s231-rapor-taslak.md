# S231 küçük turu — rapor taslağı (ajan a5ab5fcddbbc37322; taban s223-uc = b169e197; nasıl bozulur listesi önceki ajanın 30c0638f commit'inden alındı, değerlendirildi, uygun)

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

## 1. TARAMA (koddan ÖNCE; `git grep -n -E "plan_groups|ensureGroup|groupExisting|groupId\(|resolveGroups" -- server client/assets`)
| Yol | Ne karşılaştırıyor (taban s223-uc) | Kapsamda mı | Ne yapıldı |
|---|---|---|---|
| plans.mjs ensureGroup (satır 94) | ad NOCASE + aynı üst grup; yoksa yeni grup | ORTAK (elle + içe aktarma) | davranış aynen; isteğe bağlı 4. parametre (içe aktarmanın bulucusu) — yalnız verilince NOCASE bulamazsa Türkçe katlamalı tek grup |
| plans.mjs POST /plans/groups (137) — elle grup açma | ensureGroup NOCASE | HAYIR (elle form) | DEĞİŞMEZ (parametresiz çağrı) |
| plans.mjs PUT /plans/groups/:id (148) — yeniden adlandırma çakışması | NOCASE | HAYIR | DEĞİŞMEZ |
| plans.mjs resolveGroups ← tek kart formu (588) | ensureGroup NOCASE | HAYIR (BAŞ MİMAR KARARI 20.11 22:45 (2)) | DEĞİŞMEZ |
| accounts.mjs 551 — tek cari formu (resolveGroups) | ensureGroup NOCASE | HAYIR (elle form) | DEĞİŞMEZ |
| plans.mjs 1513–1514 — taksit Excel / Sheets grup + alt grup | ensureGroup NOCASE | EVET | S228 sırasıyla bulucu (yükleme başına bir) |
| accounts.mjs 1592 — cari Excel / Sheets 'ensure' (grup kolonu + 'Grup kolonu yoksa hepsi bu gruba') | resolveGroups → ensureGroup NOCASE | EVET (görev metni KAPSAM: 'cari Excel'in grup sütunu varsa o da') | S228 sırasıyla bulucu — DİKKAT: accounts.mjs'nin dosya sınırı 'yalnız çek hızı / S223 ad yardımcıları' diyor; KAPSAM satırıyla çelişki raporda |
| plan-transfer.mjs 219 groupExisting — Tablodan Aktar ön izleme | NOCASE, üst grup | EVET | NOCASE bulamazsa Türkçe katlamalı tek grup (okuma) |
| plan-transfer.mjs 432–438 groupId — Tablodan Aktar aktarım | NOCASE ham ad; yoksa ensureGroup + undo.groups | EVET | NOCASE bulamazsa bulucu; undo.groups'a YALNIZ gerçekten açılan grup (katlamayla bulunan var olan grup Geri Al'da silinmez) |
| plan-transfer.mjs 714 — Geri Al grup silme | kimlik | HAYIR | DEĞİŞMEZ |
| plans.mjs 1428 / 1437 / 1556–1557 — rapor 'groups' sayısı ve Geri Al kümesi (önce / sonra kimlik farkı) | kimlik | — | DEĞİŞMEZ (katlamayla bulunan grup yeni sayılmaz) |
| accounts.mjs 120, plans.mjs 182 / 532, trash.mjs 180, app.mjs 1234 | birleştirme / görüntü / kart tablosu listesi | HAYIR | DEĞİŞMEZ |
| client/assets | grup adı yalnız görüntü / form alanı (hof-plans 520 'Yeni Grup Adı', hof-accounts 1596, hof-plan-transfer 131) | HAYIR | DEĞİŞMEZ |
