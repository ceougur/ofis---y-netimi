# Numara tekil — verilmiş kâğıt / fiş numarası bir daha kullanılmaz (2.4.4, karar 22.10.2026)

**Karar (baş mimar):** bırakılan belge ("Müşteri Fişi / Kâğıt Makbuz Olarak Bırak") sonra e-Belge olarak gönderilse de FIS / SMM numarası seride
"kullanılmış" sayılır; sıradaki numara serinin o güne dek verilmiş en büyük numarasından sonra gelir. Bırakılmış belgenin yeniden gönderimi açık kalır.

**Kök neden (7502485):** `numberForSend` bırakılmış belgeyi e-Belge serisine taşır, kâğıt numarası yalnız Kâğıt Fatura No'da (o alan boşsa) kalır;
`nextNumber` seride DURAN belgelerin `MAX(seq)`'ini sayar → boşalan numara sıradaki belgeye yeniden verilir (gözlem: SMM2026000000001 ve FIS2026000000001
iki belgede).

**Düzeltme (server/routes/invoices.mjs):** `invoice.numberFloor` ayarı (kullanıcı ayarı değil): seri + yıl başına seriden ayrılan en büyük numara (sıra,
numara, belge tarihi), `numberForSend` işleminin içinde yazılır (`reserveNumber`, küçüğü büyüğün üzerine yazmaz). `nextNumber` = max(MAX(seq)+1, ayrılan+1,
Sıradaki No). İşlem geçmişi `invoice.numbered` → `paperNumber` (Kâğıt Fatura No önceden doluysa iz burada). Şirket Verisini Sıfırla faturalarla birlikte bu
kaydı da siler (server/app.mjs; MAX(seq) gibi).

**Tutarlılık kararı (BASKA-FIS-SIRA):** serinin "son verilen numarası" ayrılan numarayı KAPSAR (`lastIssued`): kâğıt fatura kaydı / form ön hesabı
(chronologyProblem), bırakma (withdraw), gönderilemeyen belgede "… Olarak Bırak" önerisi (sendBlockOf readPaper), Düzenle'de komşu (editChronologyProblem;
yalnız en büyük ayrılan numara), O1 (olderPending). İleti: "… (belge sonra e-Belge olarak gönderildi; numara kullanılmış sayılır)".

| Kanıt | Sonuç |
|---|---|
| kirmizi-7502485-numara-tekil (eski kod, ayrı worktree) | 12/42 kırmızı: numara-tekil 11/12 (T9 sıfırlama koruyucu, eski kodda da yeşil) + einvoice-edm beklentisi değişen test |
| yesil-numara-tekil | 11/11 (ara kayıt, T1 sıra testi eklenmeden önce) |
| mutasyon-ozet.json | 8/8 yakalandı (N1 sıradaki numara izi saymaz … N8 küçük ayrılış büyüğün üzerine yazar — ilk turda kaçtı, T1 sıra testi eklendi) |
| komsu-numara-tekil | 28 dosya 390/391: tek kırmızı einvoice-edm "Müşteri Fişi olarak bırakılabilir" — eski kodun numara TEKRARINA dayanıyordu; beklenti yeni kurala güncellendi (ders 28: koşuldu, 30/30) |
| komsu-son (son hâl; iki iş birlikte) | 35 dosya 490/490: numara-tekil 12/12, einvoice-edm, e-Belge/e-SMM/fatura/sıfırlama/şirket komşuları, esmm-ubl, edm-gercek-duzenek, ebelge-uygunluk, platform, lisans izolasyonu, yazım düzeni |
| e2e-gg244-esmm-gonder / e2e-uiux-b-243 / e2e-senaryo-215 (flock) | 33/33 · 51/51 · 73/73 (bırakma ekrandan; senaryo-215 CI dışı, elle koşuldu) |
| eski-243-olcum.txt (v2.4.3 gerçek kodu → güncel) | 2.4.3'te tekrar verilmiş FIS…001 olduğu gibi kalır; güncellemeden ÖNCE ayrılmış en büyük numara (FIS…002) kayıtlı olmadığı için güncellemeden sonra ilk bırakmada BİR KEZ daha verilir; sonra kural işler; bütünlük tamam. (Ölçüm anı: göç yok. Sonradan karar: v32 bir kezlik tarama bu sınırı kapattı — 244-numara-tabani.) |
| kahin-ebelge-yeni / -taban-7502485 | 20 senaryo: fark 0, ihlal 1 (I23 hedefli-244-k37-ux15: ön hesap "son belge" ↔ kayıt "son gönderilen belge" iletisi) — tabanda da aynı, bu değişiklikten değil |

**Bilinen sınırlar:** (1) eski veri — v32 taramasıyla kapandı (244-numara-tabani); (2) Düzenle'de yalnız en büyük ayrılan numara komşu sayılır — ortadaki ayrılmış numaralar silinmiş belge
gibi boşluktur; (3) silinen (iz bırakmayan) son belgenin numarası 2.0.17 tasarımıyla yeniden verilir — bu karar onu değiştirmez.
