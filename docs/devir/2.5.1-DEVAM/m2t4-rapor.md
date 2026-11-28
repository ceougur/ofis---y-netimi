# 2.5.1 — Değersiz Alacak sınırı TUR 4 raporu (taslak; adım adım yazılır)

Taban: `t251-m2t4-taban` (74ba2a84). Görev metni: docs/devir/2.5.1-DEVAM/m2t4-istem.txt.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)
Eksenler ve bu turda denenecekler:
1. ORTA-1 (Silinenler taraması — değişmez (i) "sonradan değişmiş" sayımı):
   (a) Silinenler'de 0 / 5.000 / 20.000 fatura × Değersiz satırlı 1 / 10 cari — süre Silinenler'le büyümemeli;
   (b) silme Değersiz yazımından ÖNCE / SONRA — daraltma (en eski Değersiz satırının yazımından sonraki silmeler) sonucu değiştirmemeli (önceki silme hiçbir satırın dünyasını değiştirmez mi — kanıt);
   (c) geri yüklenmiş (restored_at dolu) ve taslak silinmiş fatura — bugünkü sayım AYNEN (gevşetme sonraki sürüme);
   (d) carinin kimliği başka carinin yükünde geçerse (instr) — bugünkü gibi;
   (e) Değersiz satırının yazım anı boş (eski veri) — daraltma bütün satırlara döner;
   (f) eşdeğerlik: bugünkü (eski) sayım ↔ yeni sayım rastgele tohumlarda birebir (iki TZ; Silinenler'de fatura olan tohumlar dahil).
2. ORTA-2 (önerilen tutar kapıda reddediliyor):
   (a) dar kontrolün örneği AYNEN (S1 500'e Değersiz 500 → sil → bağlı tahsilat → geri yükle; S2 1.500 Şüpheliye Al) — öneri kabul edilmeli;
   (b) formun önerisi × aynı gün / farklı gün bağlı tahsilat × ikinci şüpheli kayıt (daha eski tarihli ikinci kayıt — sonraki Değersiz satırının kuyruk payı değişir);
   (c) listenin 'yazılabilir' alanı ve formun ucu aynı öneriyi vermeli; öneriden 1 kuruş fazlası reddedilmeli (sınır gerçek mi);
   (d) rastgele tohumlarda 'önerinin yazımı kabul edilir' değişmezi (öneri > 0 ise yazım 200).
3. S-DKM2T3-1 = A (Borç Yaz silme / düzeltme):
   (a) taban T + Değersiz 3.000 → Borç Yaz 3.400 SİL → RET, 423,55 kalır; tutar 100'e düşür → RET;
   (b) tutar ARTIŞI, yalnız tarih / açıklama değişikliği → kabul (bakiyeyi düşürmeyen işlem reddedilmez);
   (c) eksiye götürmeyen silme / azaltma → kabul; Değersiz satırı olmayan caride → bugünkü gibi;
   (d) Borç Yaz'ın Alacak Yaz'a çevrilmesi ve başka cariye taşınması (eski cari eksiye düşer) → RET;
   (e) silinen Borç Yaz'ın Silinenler'den geri yüklenmesi (bakiyeyi YÜKSELTİR) → kabul;
   (f) Değersiz satırı silinince aynı silme kabul (ileti 'ne yapmalı'yı izlemek işi kabul ettirir);
   (g) taksit kartı silme ve kart tutarının düşürülmesi — ölç, aynı sınıfsa aynı kural; ayrışırsa KULLANICIYA SORULMALI;
   (h) tahsilatın tutar artışı / Alacak Yaz (yeni) — kararın kapsamı dışı (avans meşru): DOKUNULMAZ, ölçülüp rapora yazılır.
4. DÜŞÜK-1 ('ne yapmalı' kullanıcıyı boşuna sildiriyor): sınırı 0 iletili ret (Düzenle 2.900 → 100; cari değişikliği; taksitli fatura iptali) — Değersiz satırı silinse de S155 reddediyorsa ileti
   başka yolu söylemeli; ileti izlenince işlem GERÇEKTEN kabul edilmeli (testte adım adım). 'Ne yapmalı'nın S155'i geçirdiği durumda ileti AYNEN.
5. DÜŞÜK-2 (M8 sınıfı): aynı gün, kayıttan SONRA yazılmış bağlı tahsilat + S155 — kalıcı test, M8 mutantı yakalanmalı.
6. Genel: iki saat dilimi (UTC, Europe/Istanbul); kilitli dönem iletisi önce; yedek geri yükleme / iki şirket (komşu testleri); v2.5.0 gerçek verisi (komşu testlerinin gerçek veri dosyaları);
   tek borç sırası / defter rotası / şüpheli defter türetmesi DOKUNULMAZ (diff ile denetlenir).
