# 2.5.1 Son Aday — Belge ve Sürüm Ajanı Raporu (taslak; adım adım doldurulur)

Görev metni: `docs/devir/2.5.1-DEVAM/aday-belge-istem.txt`. Taban: `t251-aday-belge-taban` = 5afa15f4. Kod davranışı DEĞİŞMEZ (sunucu / istemci koduna dokunulmadı).

## 0. NASIL BOZULUR (işten ÖNCE yazıldı)
1. Sürüm package.json'da 2.5.1, package-lock.json'da (kök ya da `packages[""]`) 2.5.0 kalır → kurulum / güncelleme paketi karışık sürüm taşır.
2. Kılavuz kapağı güncellenir, dip notu unutulur (ya da tersi) → `test/kilavuz-surum.test.mjs` kırmızı.
3. Kılavuz HTML güncellenir, PDF yeniden üretilmez ya da `client/kilavuz/`'a kopyalanmaz (ders 42) → programdaki PDF eski sürüm / eski metin.
4. CHANGELOG başlığı `## 2.5.1 — …` biçiminde değilse güncelleme paketinin sürüm notu boş çıkar (`releaseNotes`).
5. Kılavuza yazılan kalın / eğik ad programda yoksa (yanlış not adı, eski ad) `npm run test:kilavuz-metin` kırmızı; madde başı vurgusu ekran adı sanılır.
6. Kılavuza sürüm notu / teknik bilgi (2.5.1'de…, dosya adı) girer → kılavuz kuralına aykırı.
7. Yazım düzeni: kılavuzdaki ekran adlarında küçük harfli sözcük; cümlelerde gereksiz büyük harf.
8. CHANGELOG ya da DEĞİŞİKLİKLER'de olmayan özellik (devir ekranı, kilit paketi, Gelir Tablosu) anlatılır → kullanıcı yanıltılır.
9. BİLİNEN SINIRLAR'da iş listesindeki bir sınır eksik kalır (ör. Değersiz'li caride stok satışı / verilen çek yolu, S-MS251-1, KDVK 29/4).
10. Eski kılavuz önerisi (KDV tur 6, Değersiz tur 5) yenisiyle birlikte girer → çelişen iki talimat.
11. PDF üretimi yarıda kalır / tek sayfa resimsiz çıkar (ders 20) → pdf-denetle resim sayısı denetimi.
12. Kılavuzdaki eski KDV Özeti cümlesi ("altta Net: … Net KDV") yeni rapor düzeniyle çelişir (Net KDV satırı kalktı).
