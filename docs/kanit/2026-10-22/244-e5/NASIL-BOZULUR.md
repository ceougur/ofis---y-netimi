# E5 Personel kartı eşzamanlı düzenleme — Nasıl bozulur? (koddan önce yazıldı)
1. İki kişi: B formu A'dan önce açar; A maaşı kaydeder; B yalnız IBAN'ı kaydeder → A'nın maaşı sessizce geri alınır. (API T1, e2e, t10)
2. Saat donuk / aynı milisaniye / sahte saat geri alındı → updated_at aynı kalır, sürüm denetimi kaçırır. (API T1 donuk saatle koşar; T2 saat geri)
3. Gövde okunurken (await readJson) öbür yazım gelir; satır gövdeden ÖNCE okunduysa denetim eski satıra bakar. (API T3 yavaş gövde)
4. Silinmiş karta yazım (A siler, B kaydeder) → anlamsız hata ya da kartın yeniden doğması. (API T4, e2e)
5. Hiç değişiklik olmayan kayıt sürümü değiştirmemeli (B'yi boşa reddetmemeli); eski sürümle "değişiklik yok" kaydı da 409. (API T1/T5)
6. 409 sonrası istemci: kullanıcının yazdığı kaybolur ya da güncel olmayan değerle ikinci kayıt öbürünü yine siler; fotoğraf alanı da. (e2e)
7. KVKK: 409 iletisi/gövdesi ya da işlem geçmişi alan DEĞERİ taşır; reddedilen yazım işlem geçmişine düşer. (API T1/T4)
8. Sürüm göndermeyen kısmi çağrı (yalnız gönderilen alanlar) eskisi gibi çalışmalı (mevcut testler). 002 şirketi aynı kural (API T5). Yetkisiz kişi 409 değil 403.
