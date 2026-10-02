# Fatura Modülü — Kaynak Araştırması ve Karşılaştırma (01.10.2026)

Kullanıcı isteği: ana teste başlamadan önce güncel resmî ve resmî olmayan, en çok önerilen kaynaklardan "bir fatura
modülünde neler olmalı, nasıl çalışır, arayüzde neler olmalı, mantığı nasıl işler" araştırılsın; yapılan modülle
karşılaştırılsın; gerekenler yapılsın/düzeltilsin.

## Kaynaklar

Resmî / mevzuat odaklı:
- VUK 231 ve 7 gün kuralı: alomaliye.com (M. Bahadır Altaş, YMM, 08.01.2026), sanalofisonline.com "7 Gün Kuralı 2026".
- 2026 sınırları: TÜRMOB e-kütüphane "2026 yılı fatura düzenleme tutarı sınırı ve e-arşiv", finrota.com (VUK 589 rehberi),
  faturaport.com "E-Arşiv Fatura Limitleri 2026", stb-cpaturkey.com.
- İptal / itiraz: parasut.com "e-Fatura İptali 2026", bizimhesap.com, workon.com.tr "8 Günlük GİB Rehberi",
  vergiteknolojileri.com.tr.
- e-Belge teknik: GİB UBL-TR kılavuzları (Signature, e-Arşiv gönderim şekli), EDM Web API belgeleri (docs.edmbilisim.com.tr).

Resmî olmayan / ürün ve kullanıcı deneyimi:
- Yaygın programlar: Paraşüt kullanım kılavuzu (satış faturası, otomatik tekrarlayan fatura, e-fatura iptal-iade,
  irsaliye), mukellef.co "En İyi e-Fatura Programları", faturaport.com "En çok tercih edilen e-Fatura programları 2026".
- Ürün özellik listeleri: ramp.com, runcloud.io, flowlu.com, apps365.com, aviy.ai "2026 Buyer's Checklist",
  gennai.io "10 must-have", worksbuddy.ai.
- Form / fatura UX: designstudiouiux.com "Form UI/UX 2026", artsyltech.com "Invoice Form", lido.app "Invoice line items".

## Karşılaştırma

| Kaynakların önerdiği | Modülde | Durum |
|---|---|---|
| Hızlı fatura oluşturma; kayıtlı müşteri ve ürün (yeniden yazmama) | Cari seçici, ürün araması (ad/kod), birim/fiyat stok kartından | Vardı |
| Satır kalemleri, otomatik toplam, vergi, iskonto | Kalem ızgarası; sunucu hesap motoru (kuruş); KDV, tevkifat, stopaj, satır ve genel iskonto | Vardı |
| Durum takibi (taslak, kesildi, ödendi, vadesi geçti, iptal) | Taslak/Kesildi/İptal + Ödendi/Kısmen/Açık/Vadesi Geçti/Taksitte; e-Belge durumu | Vardı |
| Fatura üzerinden tahsilat ekleme | Yoktu (cariden yapılıyordu) | **Eklendi**: kartta "Tahsilat Ekle / Ödeme Yap" (taksitliyse taksit kartı) |
| Tekrarlayan fatura (abonelik, kira, aidat) | Yoktu | **Eklendi**: "Tekrarla" (1/2/3/6/12 ay, bitiş); günü gelen dönem TASLAK olur, kullanıcı keser |
| Hatırlatma / gönderme | WhatsApp (PDF + mesaj), e-Arşiv'de EDM e-postası | Vardı (e-posta ileride) |
| Çoklu para birimi ve kur | Döviz + kur, deftere TL karşılığı | Vardı |
| Yaşlandırma, açık bakiye, müşteri bazında gelir | Açık Faturalar, Cari Bazında Satış/Alış, Vade Takip, ANLIK DURUM | Vardı |
| Şablon / logo | Firma bilgisi, banka, alt not; logo yok | Kısmi (logo sonraki sürüm önerisi) |
| Muhasebe entegrasyonu | Ana Defter (mizan), KDV Özeti, Ba-Bs, Excel/PDF | Vardı |
| Kısmi iade; iade faturası asıl faturaya bağlı | İade arama motoru, kalan miktar kadar iade | Vardı |
| İrsaliyeli / irsaliyesiz | İrsaliye no ve tarihi | Vardı |
| **VUK 231: teslimden itibaren 7 gün** | Yoktu | **Eklendi**: irsaliye tarihinden 7+ gün sonra ya da 7+ gün geriye tarihli belgede uyarı (engellemez) |
| **e-Arşiv: 30.000 TL üstü nihai tüketicide gerçek kimlik ve adres** (2026) | 11111111111 her tutarda kabul ediliyordu | **Düzeltildi**: 30.000 TL üstünde engellenir, nedeni yazılır |
| **e-Belge iptali 8 gün** | Süre denetimi yoktu | **Eklendi**: 8 günü geçen e-Arşiv entegratörde iptal edilmez, iade faturası yönlendirmesi |
| e-Fatura mükellefi olmayana e-Arşiv; mükellefe e-Fatura | GİB kuralı `allowedProfiles` | Vardı |
| e-Fatura itirazı (alıcı reddi) | EDM durumunda "Reddedildi" + programda iptal önerisi | Vardı |
| 2026 fatura düzenleme sınırı 12.000 TL | Bilgi; program her satışta belge keser | Uygulanmadı (gerek yok) |
| Gelen faturaların takibi | Gelen e-Fatura kutusu (e-Belge açıkken), alış taslağı olarak al | Vardı |
| Mükerrer belge koruması | Satıcı no + cari tekil, ETTN tekil | Vardı |

## Sonraki sürüme öneriler (bu sürümde yapılmadı)

- Faturaya logo; e-postayla PDF gönderimi.
- Tekrarlayan faturada "kendiliğinden kes" seçeneği (şu an bilinçli olarak yalnız taslak: kesilen belge geri alınamaz).
- İrsaliye modülü (sevk irsaliyesi ayrı belge) ve e-İrsaliye.
