# S229 + S230 küçük program turu — rapor taslağı (adım adım)

Taban: surucu5-uc = fce3d272. Ajan ağacı: .claude/worktrees/agent-a343eda2c3de7a0a1. Eski kod kopyası: scratchpad/s229-a343/eski (git archive surucu5-uc).

## 0. NASIL BOZULUR (koddan ÖNCE)
Gösterilen açık = faturanın kendi açığı − kart(lar)ın aldığı kısım. Bozulma yolları ve her birinde beklenen:
1. Kart faturanın bir KISMINI alır (S200 = A örneği: F1 50.000 + Borç Yaz 30.000, kart 60.000) → Açık Faturalar F1 20.000; fatura kartı "Açık 20.000" + "Taksit Kartında: <kart> · 30.000"; Faturalar listesi Kalan 20.000; Tahsilat Ekle / Mahsup Et 20.000 önerir.
2. Kart faturanın TAMAMINI alır → Açık Faturalar'da satır yok; Anlık Durum toplamına girmez; fatura kartı / liste "Taksitte"; Ödeme Durumu "Açık" süzgecinde (taksitli gibi), "Ödenmedi" süzgecinde değil.
3. Bir faturayı İKİ kart alır → iki "Taksit Kartında" satırı; gösterilen açık iki kartın payı düşülmüş.
4. Kart elle borç + iki fatura alır (S200 sırası: önce elle borçlar, eksik kısım faturalardan vade sırasıyla) → yalnız eski vadeli fatura düşer; iki TZ'de aynı.
5. Kartın taksiti tahsil edilir → fatura gösterilen açığı DEĞİŞMEZ (kart ödemesi önce kartın tükettiği eski kaleme — tüketim sırası); kartın kendi kalanı düşer (S118 = B).
6. Faturaya doğrudan tahsilat → kapama bugünkü gibi (fatura kendi açığına, fazlası en eski açık borca); veri tabanı satırları eski kodla BİREBİR.
7. Kart silinir / iptal edilir / Kartı Kapat 'Borçta Kalsın' (S205 / S220) → kartın kuralına göre fatura açığı geri gelir mi (kapsam payı sıfırlanırsa açık geri gelir).
8. Fatura iptali (S210 = A: kart kapanır) → iptal fatura listede İptal; kart kuralı değişmez.
9. İade faturası kartı küçültür (v2.0.24 coveredBy) → gösterilen açık iade sonrası.
10. Alış faturası / Alacak Yaz'lı cari (karar (5) netleşmesi) → Açık Faturalar'a GİRMEZ: alış faturası kendi tarafında, satış faturası netleşmeden.
11. Şüpheliye alınmış fatura (S213 = B) → Açık Faturalar'da kalır (withoutDoubtful YOK).
12. Değersiz yazılmış kısım (S227 = C) → bugünkü kural.
13. Mahsup edilmemiş iade belgesi (K1) → kendi satırında kalır.
14. Eski kapama düzeni (legacyView / legacyClosing) açık şirket → aynı kural (covered eski hesaptan).
15. Kilitli dönem; iki şirket; gün dönümü ve iki TZ (UTC, Europe/Istanbul); boş dönem; ileri tarihli kart / fatura; yetkisiz kullanıcı (Muhasebe rolü).
16. SINIR: Tahsilat / Mahsup formunun kabul ettiği tutar ve sunucunun kapaması DEĞİŞMEZ (aynı istek → aynı satırlar); Mahsup sunucu sınırı faturanın KENDİ açığı.
17. Yanlış düzeltme tuzakları (mutant listesi): kart payını düşmeyi unut; net: true'ya geç (karar (5) netleşmesi sızar); tam alınan faturayı listede bırak; iki karttan yalnız birini düş; Tahsilat Ekle önerisinde eski açığı bırak; Anlık Durum'u eski hesapta bırak.
