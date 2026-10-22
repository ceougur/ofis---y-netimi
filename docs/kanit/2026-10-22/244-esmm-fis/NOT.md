# 2.4.4 madde 22/24 ek — e-SMM "Kâğıt Makbuz Olarak Bırak" ve UBL-TR 1.2.1 XSD denetimi (esmm-fis, taban 60a411f)

| Kayıt | Ne | Sonuç |
|---|---|---|
| eski-60a411f-kagit-makbuz | yeni rota testleri, taban 60a411f (ayrı worktree) | 18/23 — 5 kırmızı (N14 + 4 yeni: FIS numarası, kâğıt makbuz serisinde sıra, engel iletisi, yeniden gönderim) |
| yeni-esmm-gonderim | aynı testler, yeni kod | 23/23 |
| f57245a-kendi-denetimi-oasis | f57245a'nın (Person'da yalnız FirstName) kendi esmm-ubl testi, kendi (yalnız OASIS) aracıyla | 15/15 GEÇTİ — OASIS şeması EDM'nin reddettiği belgeyi geçiriyordu |
| f57245a-ubl-tr-denetimi | aynı test, yeni araçla (OASIS + GİB UBL-TR 1.2.1) | 14/15 — kırmızı: "Person: Missing child element(s). Expected is FamilyName" (EDM 11029'un karşılığı) |
| komsu-ebelge-fatura | 52 dosya: ebelge/einvoice/edm/edoc/esmm/gg243/goc-244/karekod/kontrol-241/fatura/yazım/uiux-b/soap — UBL-TR denetimi bütün e-Fatura / e-Arşiv / e-SMM çıktılarına uygulanmış hâlde | 492/492 |
| mutasyon-F1…F3, X1…X3 | seri, engel iletisi, ad; UBL-TR kökü, birleşik denetim, imza yeri | 6/6 yakalandı (mutasyon-ozet.json) |
| e2e-* | gg244-esmm-gonder (adım 4 yeni), gg244-secilenleri-gonder, uiux-b-243, senaryo-215; eski kodda gg244-esmm-gonder | ayrı kayıtlar |

Kaynak: GİB UBLTR_1.2.1_Paketi.zip (sha256 aeb69079128b05a603b01956baec0fd92f2e56a3c0fed8c83c18c82dbd941422), `xsdrt/` dosyaları aynen
`tools/ebelge/sema/ubl-tr-1.2.1/`; dosya özetleri `tools/ebelge/sema/KAYNAK.md`. Uyarlama 4 (imza yeri) KAYNAK.md'de.
