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

## 1. TARAMA (koddan önce; `git grep openItems( / .open / payState / coveredBy / covered` server + client/assets, mobil, PDF / Excel, paylaşım metinleri)
| Yol | Bugün (taban) | Kapsamda mı | Yapılan |
|---|---|---|---|
| Açık Faturalar raporu (report-center `acik-faturalar` → `openItems(day, { returns: true })`; ekran + PDF + Excel + TOPLAM + özet) | faturanın kendi açığı | S229 | `openItems` net istemeyen yol gösterilen açığı okur (shownState); kartın tamamını aldığı fatura satır vermez |
| Anlık Durum fatura özeti (overview `openItems(day)`: açık / vadesi geçen satış, alış) — mobil `/api/mobil/overview` aynı uç | kendi açığı | S230 baş mimar yorumu (S229'u izler) | otomatik (openItems) |
| Fatura kartı: Açık satırı, ödeme durumu, büyük rakam, Tahsilat Ekle görünürlüğü ve önerisi, "Açık tutar" metni | kendi açığı | S230 | shape → shownState; `inPlans` (Taksit Kartında: <kart> · tutar, `data-open-plan`); `inPlan`, `ownOpen` alanları; Kalan büyük rakamı kart payında da |
| Faturalar listesi: Kalan, Açık Bakiye, Vadesi Geçmiş, Ödeme Durumu süzgeci (sayfalı leanRow + sayfasız), PDF (`liste.pdf`), Excel (`export.xlsx`) | kendi açığı | S230 | leanRow + shape → shownState (LIST_SQL'e plan_id eklendi — taksitli fatura kendi kuralında); kartın tamamını aldığı fatura "Taksitte" ('Açık' süzgecinde, 'Ödenmedi'de değil) |
| Mahsup Et formu (offsets GET): "Açık tutar", önerilen tutar, karşı fatura etiketi | kendi açığı | S230 | `suggest` (gösterilen) + karşı faturada `shownOpen`; SINIR `open` (kendi açığı) DEĞİŞMEDİ; kartın tamamını aldığı karşı fatura seçenek listesinde görünmez (istemci; taksitli fatura gibi) |
| Cari kartının fatura sekmesi (hof-accounts, liste ucu `tab=all&account`) | kendi açığı | aynı kalem → aynı kural | otomatik (liste ucu) |
| Cari tahsilat formu "Kapatılacak Fatura" seçenekleri (hof-accounts, liste ucu `pay=open`) | kendi açığı ("açık X") | aynı kalem → aynı kural | otomatik: kısmi "açık 20.000"; kartın tamamını aldığı fatura seçenek değil (taksitli gibi). Sunucu kabulü değişmedi |
| Satış / Alış / İade Faturaları raporları (report-center invoiceListReport → `list`): Ödenen, Kalan, Durum | kendi açığı | aynı kalem → aynı kural | otomatik; Ödenecek = Ödenen + Kalan + taksit kartında (sütun yok → 2.5.1) |
| Fatura e-posta / WhatsApp paylaşım metni (vade satırı `doc.open > 0`) | kendi açığı | aynı kural | otomatik: kartın tamamını aldığı faturada vade satırı yok |
| payDoc (zil / takvimden Tahsilat) | — | gösterim | kartta olan faturada "taksit kartında; tahsilat kartın taksitlerinden" bildirimi |
| Birleşik listeler (`openItems(day, { net: true })`: yaşlandırma, nakit akışı, Vade Takip, zil / takvim, `dueItems`) | TYK net (kart payı + karar (5) + şüpheli) | KAPSAM DIŞI | değişmedi (eski kapamanın net yolu da aynı formül) |
| Kapama, yazma yolları (`coverState`, `ownTarget`, `settledFor`, `repairScreen`), Mahsup sınırı (`addOffset`), editInvoice taksitlendirme reddi (`state.covered`) | kendi açığı | KAPSAM DIŞI | değişmedi (paymentStates çıktısı aynı; gösterim ayrı işlevde) |
| Kartın kendi kalanı, bakiye, gecikmiş, defter, mutabakat | — | KAPSAM DIŞI | değişmedi (para değişmezi betiği: BİREBİR) |
| e-Belge (UBL `covered` = ödeme kodu, ilgisiz), WhatsApp çekirdeği, banka | — | ilgisiz | dokunulmadı |
