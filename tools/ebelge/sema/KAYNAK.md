# e-Belge kâhin dosyaları — kaynak ve bütünlük

Bu klasördeki dosyalar resmî kaynaklarından **değiştirilmeden** alınmıştır (satır sonları dahil; `.gitattributes` → `-text`).
Programla dağıtılmaz; yalnız `tools/ebelge/dogrula.mjs` ve `test/ebelge-uygunluk.test.mjs` kullanır.

| Klasör | Kaynak | İndirme | Arşiv sha256 |
|---|---|---|---|
| `ubl-2.1/` (maindoc/UBL-Invoice-2.1.xsd + common/) | OASIS UBL 2.1 — https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.zip (Copyright © OASIS Open 2013; OASIS IPR Policy kapsamında, telif notuyla kopyalanabilir) | 16.10.2026 | 60b80d76… |
| `gib/` (UBL-TR_Main_Schematron.xml, UBL-TR_Common_Schematron.xml, UBL-TR_Codelist.xml) | GİB e-Fatura Paketi — https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-FaturaPaketi%20(29).zip, `schematron/` (dosya tarihi 21.08.2026) | 16.10.2026 | 12901476… |
| `edm/EFaturaEDM-test-singleWsdl.xml` | EDM Bilişim test e-Fatura servisinin sözleşmesi — https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc?singleWsdl (herkese açık adres; kimlik bilgisi içermez). Kâhin: test/edm-gercek-sozlesme.test.mjs | 16.10.2026 | ba4e1c1c… |
| `schxslt-1.9.5/` (2.0/ ve LICENSE) | SchXslt 1.9.5 (David Maus, MIT lisansı) — npm `node-xsl-schematron@1.1.0` paketindeki kopya | 16.10.2026 | — |

Kod adlarının ve istisna/tevkifat açıklamalarının kaynağı: GİB "UBL-TR Kod Listeleri" v1.43 (Temmuz 2026),
https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/UBLTR_1.2.1_Kilavuzlar.zip (sha256 0f7c720d…; depoya konmadı).

## Uyarlamalar (yalnız `dogrula.mjs` içinde, bellekte; dosyalar değişmez)
1. Ana şematronun kök öğesine `queryBinding="xslt2"`: dosya sorgu dilini yazmıyor (ISO varsayılanı XSLT 1.0), kurallar XPath 2.0
   `matches()` kullanıyor; GİB'in kendi doğrulayıcısı da XSLT 2.0 ile çalışır.
2. `UBL-TR_Codelist.xml#codes` deseninin 41 `<sch:let>` değişkeni şema düzeyine taşınır: GİB'in doğrulayıcısında (ISO iskeleti) desen
   değişkenleri bütün desenlerde görünür; SchXslt bunları desene kapatır.
3. `type` parametresi: e-Fatura için `'efatura'`, e-Arşiv için `'earchive'` (GİB "Açıklamalar.txt", 28.04.2017).

## Kâhinin doğrulanması (16.10.2026)
- EDM'nin güncel örnek faturaları (17 adet; yalnız boş bırakılan fatura numarası GİB biçimine çevrilerek): 14'ü XSD + şematrondan temiz;
  3'ü örneğin kendi eksiğiyle düşer (boş IssueTime; iade referansı 16 hane değil; 702 istisnasında GTİP yok — Ağustos 2026 kuralı).
- GİB paketindeki eski örnekler (UBL 2.0, TR1.0, para birimi "TRL") beklendiği gibi sürüm/kod hatası verir.
- Bilerek bozulan belge düşer: `test/ebelge-uygunluk.test.mjs` → "Kâhin aracı".

## Dosya özetleri (sha256)
```
b6809ae4d38401b6d3f35e63e52d9ab3a0e014d746e3883514895e919e23b8b2  ./gib/UBL-TR_Codelist.xml
90501b6ad503479d445c16dcbac33146ec458d06ad6e2204afdc517fddce609f  ./gib/UBL-TR_Common_Schematron.xml
324d6b8e96d4a83c102a335feee1907625bf5125199b0a8b2e62aff4521d23dc  ./gib/UBL-TR_Main_Schematron.xml
9f64f1ea1164094f1b6dd20d67b40af8b124f3a3579fa2dec07c64359cc108b3  ./schxslt-1.9.5/2.0/compile-for-svrl.xsl
d4df046564af3ba3d9f10976e29cbea1a6c45c746e3e53efcea8377c42c3c8e9  ./schxslt-1.9.5/2.0/compile/api-2.0.xsl
3ad970b64b335105ccdf603ecc7edc8b1ad03795dd4e8a784444ac91c8d469d1  ./schxslt-1.9.5/2.0/compile/compile-2.0.xsl
8c3cb8edc4c377ab84c8b087ca895e4db9d943963ca15a9bceb8822c92771e6e  ./schxslt-1.9.5/2.0/compile/functions.xsl
afd07c44eeb70b8e9daf0feb1319ca655468f06543437c8ecf0e5a232b3038c8  ./schxslt-1.9.5/2.0/compile/templates.xsl
3226d5655899e4b296649f2e47fa31a845ba6ae2d6f711c559a324ca651e1210  ./schxslt-1.9.5/2.0/expand.xsl
2dc512fedc266855c86bfd8cbd05d58e3a58105a5e96cdcf528de2b864a25f4d  ./schxslt-1.9.5/2.0/include.xsl
64a535e6d0f0baa809f987d27d9e5b825d420e9ebda7344ef53edf136cdd42fa  ./schxslt-1.9.5/2.0/pipeline-for-svrl.xsl
5efa3e2f73f5c8a08da891cc32ae91e5ff80a8b72ea5c9028b3cdac4dafc46d9  ./schxslt-1.9.5/2.0/pipeline.xsl
11dcc84821999878761498d4ffd92d79496b3b9a3e6bea8171eaf71b86ec7d72  ./schxslt-1.9.5/2.0/svrl.xsl
37a75ed72e61a820a29e583e483ac9f32bb9d0615513f27f944ac9b2b1e5ed68  ./schxslt-1.9.5/2.0/util/normalize-svrl.xsl
ec4258bc20ab9818cde6e8a1564fea6c199cead5cc8d9690726dfabb25f03f6d  ./schxslt-1.9.5/2.0/version.xsl
74a1f0e7dcb8d2d4a619180c331e1ed5692850cc278866fc21f460e1252f2f42  ./schxslt-1.9.5/LICENSE
3a0157d29bd660457bd34d93d039b12f8a0455b8b9be49e9d4ed2830ab581fd5  ./schxslt-1.9.5/README.md
dd546e4809df86b6445589f69f0d6c9df162840ae386574ddfc1da7638103e15  ./ubl-2.1/common/CCTS_CCT_SchemaModule-2.1.xsd
939172ad8dd057cd403e7f763f6532184dd5ed4b9de24c42ebb35db4792ba613  ./ubl-2.1/common/UBL-CommonAggregateComponents-2.1.xsd
bd4ad043ee1d9da1c7f8018dabf739cfafdfb59143d0d16b9ef769e6b7c408a7  ./ubl-2.1/common/UBL-CommonBasicComponents-2.1.xsd
ad7a4e490978adfbcfc5ec0bb20941cf11ac960ccf0c4de8791a7c731a8dbe87  ./ubl-2.1/common/UBL-CommonExtensionComponents-2.1.xsd
3db472305f029bba5c1ae157bfd0178f715c3f9b94bd8e6c557dbce5e88da874  ./ubl-2.1/common/UBL-CommonSignatureComponents-2.1.xsd
8be3379dbdcbcc7802fafdd16bac72c48fff1c0bb364213a31a17911dd06100b  ./ubl-2.1/common/UBL-CoreComponentParameters-2.1.xsd
fcee77a11870208e6377ea6311b9f2a050bca24bdad8606ea02d71e9f9e72f8d  ./ubl-2.1/common/UBL-ExtensionContentDataType-2.1.xsd
7dcb156e610239c97ae70940cf4653b88e48c3595bf5f56a2204a32e2893e6cf  ./ubl-2.1/common/UBL-QualifiedDataTypes-2.1.xsd
17bb6b62d709b4fd81449a37655af36aa6a1276ad4fdb1b2e249a5ed4b7c2172  ./ubl-2.1/common/UBL-SignatureAggregateComponents-2.1.xsd
cef924d7ba3d1d8ade14469325cde1364f8c174e46f0198ec02da8e9e748a489  ./ubl-2.1/common/UBL-SignatureBasicComponents-2.1.xsd
09052d406b4293e2a5f9c2bfee6df10ad4d8d5f0b36e24a6349d7f7936d89eb6  ./ubl-2.1/common/UBL-UnqualifiedDataTypes-2.1.xsd
a4f726bcf8cc3f7d9ffa4dab99e005535a8e8b60dced1e5d94578d2e05afa96e  ./ubl-2.1/common/UBL-XAdESv132-2.1.xsd
1fa4625e9cefcb7a9abb5ac1b64315547450031eece8a55bd584e4ba4b79dbc1  ./ubl-2.1/common/UBL-XAdESv141-2.1.xsd
101909c9f06456d61ddcc4fb982f1d40dc357b439f393b1a2eb46e42acd60809  ./ubl-2.1/common/UBL-xmldsig-core-schema-2.1.xsd
40fae8cb436f3a9506d7acce65ba162caef3b0bed4d5cbc0992b2153ded4edf4  ./ubl-2.1/maindoc/UBL-Invoice-2.1.xsd
ba4e1c1c270390e0e5a96341bfef4f575c4030a7a851ce3a263e92ea1e3b3bfc  ./edm/EFaturaEDM-test-singleWsdl.xml
```
