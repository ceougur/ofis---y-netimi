# e-SMM taraf adı — EDM kuralına dönüş (2.4.4, 22.10.2026)

**EDM Teknik Operasyon yanıtı (22.10.2026 14:43):** tüzel kişilerde (VKN'li mükellef) unvan `cac:PartyName`'den alınır; şahıs mükellefte ad ve soyad
`cac:Person` FirstName + FamilyName'den. Canlıda e-SMM karekodu GİB standardında; test ortamının görüntüsü canlıdan farklı (VKN'li düzenleyende unvan
basılmıyor, karekod yalnız ETTN).

**Değişiklik:**
- `server/lib/einvoice/ubl-tr.mjs`: f57245a / 32e59c0'daki `issuerPerson` (VKN'li e-SMM düzenleyeninde unvanın Person'a bölünmesi) GERİ ALINDI; VKN'li
  tarafta yalnız PartyName, TCKN'li tarafta Person (+ ad-soyaddan farklı ticari unvan PartyName'de) aynen. party() f57245a öncesi hâline döndü.
- `test/esmm-ubl.test.mjs` "e-SMM, VKN'li düzenleyen": PartyName = unvan, düzenleyende ve VKN'li alıcıda Person YOK, UBL 2.1 + UBL-TR 1.2.1 XSD geçer;
  TCKN'li düzenleyende Person FirstName/FamilyName ve ticari unvan.
- `tools/edm-gercek.mjs`: resmî PDF'te düzenleyenin unvanı — e-SMM'de VKN'li düzenleyende BİLGİ (adımın `bilgiler`'i, ozet.json `bilgi`, OZET.md
  "Bilgi (denetim değil)"), denetim sayılmaz; e-Arşiv / e-Fatura ve TCKN'li e-SMM düzenleyende denetim kalır (`unvanDenetimi`). Adres-bir-kez denetimi
  değişmedi. `test/edm-gercek-duzenek.test.mjs` D8.

| Kanıt | Sonuç |
|---|---|
| kirmizi-7502485-taraf-adi (7502485 = 32e59c0'ın ubl-tr.mjs ve edm-gercek.mjs'i, ayrı worktree) | 2 kırmızı: esmm-ubl VKN'li düzenleyen (Person var) + edm-gercek-duzenek (unvanDenetimi yok) |
| yesil-taraf-adi (esmm-ubl + edm-gercek-duzenek + ebelge-uygunluk) | 80/80 |

**Denenmeyen:** gerçek EDM test ortamına yeni XML ile gönderim (bu iş gerçek EDM'ye bağlanmaz; madde 24 koşusu ana oturumda).
