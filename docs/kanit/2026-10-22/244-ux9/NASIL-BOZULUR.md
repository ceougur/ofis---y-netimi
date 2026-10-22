# ux9 — Nasıl bozulur? (işe başlarken, 22.10)
UX9 (faturadan cariyi düzelt)
1. Kalem/ödeme girilmiş formda cari düzeltilir → kalemler, fiyatlar, ödeme satırları kaybolur ya da fiyat önerisi yazılanı ezer.
2. Cari formunda Vazgeç / Esc → fatura formu bozulur ya da sorun listesi kaybolur.
3. Cari düzenlenirken başkası aynı cariyi değiştirir (UX1 409 account-stale) → onSaved çağrılmamalı; fatura eski bilgiyle kalmamalı.
4. Nihai Tüketici (paylaşılan 11111111111 carisi) "Cariyi Düzenle" ile değiştirilir → bütün perakende faturaları bozulur → düğme YOK, gerçek cari seçme yolu.
5. Yetkisiz kullanıcı (invoices.manage var, accounts.manage yok) → düğme görünmemeli; sunucu zaten 403.
6. Daha önce kesilmiş (numaralı/gönderilmiş) belgenin alıcı bilgisi cari düzeltmesiyle değişir → party_json değişmemeli.
7. Fatura penceresi cari formu açıkken kapanır / başka forma geçilir → onSaved eski forma yazmamalı.
8. Mükellefiyet (e-Fatura) değişen cari → belge türü yeniden hesaplanmalı (form.profile sıfırlanır).
UX10 (odak)
9. Odak verince cari seçici listesi açılır ve kalem alanlarını örter (e2e tıklamaları takılır) → sessiz odak.
10. renderForm başka yerlerden (iade asıl seç, kur, kalem sil) çağrılır → odak her çizimde zıplar → yalnız ilk çizim/bayrak.
11. Doğrulama hatasında odak boş/gizli alana gider (iade formunda cari seçici yok) → hedef yoksa eski davranış.
12. Sunucu kalem hatası "N. kalem" boş satırları saymaz → yanlış satıra odak.
13. Yeni cari kaydında odak, pencere kapanışının focusBack'i ile "+ Yeni Cari"ye geri döner.
