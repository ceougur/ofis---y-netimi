# r31e-b — "Nasıl bozulur?" (B1/B2/B3 + Devamı olarak ekle ezme), işe başlarken (23.10.2026)

Bağ = kayda (case_key) bağlı veri: kayıt tahsilatı, not, kayıt notu, telefon, haciz, görev, belge, düzeltme, silme işareti, cari bağı,
taksit kartı bağı, "Ödendi say", "Sorun yok"; (sayılmayan, taşınan) mesaj / sohbet bağlantısı, zilden kaldırılan bildirim.

N1 Bir hücre değişir (Tutar 1.000 → 1.200): parmak izi değişir, row_id aynı → bağ kopar (Yerine koy / Devamı / Sheets).
N2 Kolon eklenir (Telefon) ya da boş kolon eklenir: bütün satırların parmak izi değişir → bütün bağlar kopar.
N3 Sıra değişir: row_id kayar; parmak izi aynı → bağ durmalı; körlemesine row_id taşıması burada YANLIŞ kişiye götürür.
N4 Satır silinir: sonraki satırlar kayar; silinen kişinin bağı başka kişiye GİTMEMELİ (eşleşmeyen → uyarı + onay).
N5 Aynı adlı iki kişi: ad tek değil → ad ile taşınmaz; aynı konum + aynı ad + aynı çokluk → taşınabilir; biri silinip öbürü değişirse taşınmaz.
N6 Ad değişir + tutar değişir: kişi değeri tutmaz → eşleşmeyen → uyarı + onay (sessiz kopma yok).
N7 İki satır yer değiştirir + biri değişir: değişen tek adlıysa taşınır, değilse uyarı.
N8 Kimlik kolonu eklenir (Dosya No 2026/x, D-x) / silinir / Müşteri No silinir (kip değişir): anahtar biçimi değişir → tek adlı kişide taşınır.
N9 Devamı olarak ekle, aynı konumda FARKLI kişi (Lale Ak → Yeni Kişi): mevcut satırı EZMEMELİ (yeni kayıt; Lale ve bağları durur).
N10 Devamı olarak ekle, Dosya No eklenmiş aynı dosya: çift kayıt → "N satır mevcut kayıtlarla aynı görünüyor" + onay.
N11 Sheets eşitlemesi N1/N2/N9: eşleşen taşınır; eşleşmeyen varsa eşitleme BEKLER (yönetici onayı), sessiz uygulama yok.
N12 İki kullanıcı aynı anda: önizlemeden sonra başka kullanıcı bağ ekler (not/tahsilat) → onaylanmamış yeni eşleşmeyen → 409, yeniden bak.
N13 Yarıda kesilme: taşıma ortasında hata → satırlar da bağlar da eski hâlinde (tek işlem).
N14 v2.4.3 verisi (gerçek v2.4.3 koduyla girilmiş tahsilat/not/Ödendi say/cari) → adayda değişmiş tablo: aynı sonuç.
N15 Başka sayfada (veri oturumu) aynı anahtar: genel tablolardaki bağ başka sayfanın kaydını taşımamalı → taşınmaz, uyarı.
N16 Onaysız API çağrısı (kâhin/eski istemci): eşleşmeyen bağ varken onay bayrağı yoksa 409 (sessiz değil).
N17 Taşınan hedefte aynı alanda düzeltme / kayıt notu zaten var: üzerine yazmaz, eskisi yerinde kalır.
