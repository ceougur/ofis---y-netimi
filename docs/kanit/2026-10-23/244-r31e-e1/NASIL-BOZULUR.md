# 31e E1-Y / İNCELE-1 / İNCELE-3 — "Nasıl bozulur?" (önce yazıldı, 23.10.2026; taban aday 11 88aaf09)
Y1 Durum Sorgula'nın "bulunamadı" yanıtı yoldayken başka oturum Gönder'e basar (iz + SendSMM EDM'de) → geç yanıt clearE ile izi siler; kesintide belge "Gönderilmedi".
Y2 Durum Sorgula'nın eski "bulundu" yanıtı, sorgudan sonra yazılan yeni durumu (gönderim sonucu / iz) ezer.
Y3 Koruma yanlış pozitif: belge değişmediği hâlde Durum Sorgula reddedilir (resmî görüntü vb. başka İşlem Geçmişi kaydı; durağan sahte saat → aynı e_at).
Y4 11048 + durum yanıtında ETTN YOK → belge "gönderildi" sayılır (numara başka belgede olabilir: yedekten geri yükleme, ortak test hesabı).
Y5 11048 + bulunamadı → Hata + 30b iletisi (aynen kalmalı); 11048 + kendi ETTN'i → gönderildi (aynen); 11048 + başka ETTN → Hata (aynen).
Y6 İptal EDM'de KESİN reddedildi (EDM hata kodu) → iptal izi kalır → 8 gün sonra İptal Et açık, "süre doldu" nedeni yazmaz.
Y7 İptal isteği gittikten sonra koptu (belirsiz) → iz KAPANMAMALI (31d K10 aynen: süre dolunca EDM'ye sorar).
Y8 Kesin ret → sonra yeniden İptal Et → istek koptu → iz yeniden açık sayılmalı (son kayıt "iptal başladı").
Y9 Eski veri (2.4.3: iz yok) ve 002 şirketi: kural aynen.
