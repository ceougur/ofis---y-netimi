#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
e-Belge DAYANIKLILIK TESTİ — BAĞIMSIZ KÂHİN (temiz oda; ders 5).

Programın tutar hesaplayan kodu (server/routes/invoices.mjs, server/lib/einvoice/*, server/lib/invoice-math.mjs vb.) OKUNMADAN,
yalnız GİB / UBL-TR kurallarından ve ekrana yazılan girdilerden (plan.jsonl) beklenen tutarları hesaplar; programın ürettiği
UBL-TR XML'iyle (xml/<no>.xml), karekod JSON'uyla (karekod.jsonl) ve programın kendi ödenecek tutarıyla (belgeler.jsonl)
karşılaştırır. Python 3, yalnız standart kütüphane (decimal).

KURALLAR (kâhinin kendi kuralları; programdan alınmadı):
  kalem brüt      = miktar × birim fiyat                       (kuruşa yuvarla, yarım yukarı)
  kalem iskonto   = brüt × iskonto oranı / 100                (kuruşa yuvarla, yarım yukarı)
  kalem net       = brüt − iskonto                             (UBL 2.1: InvoiceLine/LineExtensionAmount)
  KDV matrahı(r)  = r oranlı kalemlerin net toplamı
  KDV(r)          = matrah(r) × r / 100                        (oran başına kuruşa yuvarla)          [--kdv-kurali oran, varsayılan]
                  = Σ (kalem net × r / 100, kalem başına kuruşa yuvarla)                            [--kdv-kurali satir]
  tevkifat(kod,r) = [ (kod,r) kalemlerinin KDV'si (yukarıdaki kurala göre) ] × pay / payda   (kuruşa yuvarla)
  malhizmettoplam = Σ net   (UBL 2.1 tanımı: LegalMonetaryTotal/LineExtensionAmount = kalem tutarları toplamı)
  vergi hariç     = Σ net   (belge düzeyinde iskonto/artırım yok)
  vergi dahil     = Σ net + Σ KDV
  ödenecek        = vergi dahil − Σ tevkifat
Tevkifat oranları: GİB KDV Genel Uygulama Tebliği (I/C-2.1.3) — yalnız aşağıdaki tabloda olan kodlar; bilinmeyen kod FARKLI sayılır.

Görev tanımındaki kural "oran başına yuvarlama"dır (varsayılan). Varsayılan kuralla FARKLI çıkan belgede, "satır başına yuvarlama" kuralı
programla aynı sonucu veriyorsa satırın sonuna yalnız BİLGİ olarak "[satır başına yuvarlamayla AYNI]" yazılır; hüküm değişmez (FARKLI kalır).
Kural farkı mı hata mı kararı kâhinin değil, ana oturumundur; karar "satır başına" ise --kdv-kurali satir ile yeniden koşulur.

Kullanım:
  python3 kahin.py <çıktı-klasörü> [--plan DOSYA] [--belgeler DOSYA] [--xml KLASÖR] [--karekod DOSYA] [--cikis DOSYA] [--kdv-kurali oran|satir]
Çıkış kodu: 0 = bütün belgeler AYNI; 1 = en az bir FARKLI / eksik; 2 = kullanım hatası.
"""
import json
import os
import sys
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP

KURUS = Decimal("0.01")

# GİB KDV tevkifat oranları (pay, payda). Kaynak: KDV Genel Uygulama Tebliği I/C-2.1.3 (kısmi tevkifat).
TEVKIFAT = {
    "602": (9, 10),  # Etüt, plan-proje, danışmanlık, denetim ve benzeri hizmetler
    "604": (5, 10),  # Yemek servis hizmeti
    "606": (9, 10),  # İşgücü temin hizmetleri
    "612": (9, 10),  # Temizlik hizmeti
    "616": (5, 10),  # Diğer hizmetler
}

NS = {
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
}


def kurus(value):
    return Decimal(value).quantize(KURUS, rounding=ROUND_HALF_UP)


def dec(text):
    return Decimal(str(text).strip().replace(",", "."))


def beklenen(plan, kural="oran"):
    """Plan kaydındaki ekran girdilerinden beklenen tutarlar."""
    matrah = {}  # oran -> Decimal
    satir_kdv = {}  # oran -> Σ kalem başına yuvarlanmış KDV
    tev_grup = {}  # (kod, oran) -> net toplamı
    tev_grup_satir = {}  # (kod, oran) -> Σ kalem başına yuvarlanmış KDV
    brut_top = Decimal(0)
    iskonto_top = Decimal(0)
    net_top = Decimal(0)
    hatalar = []
    if plan.get("fiyat_kdv_dahil"):
        hatalar.append("plan KDV dahil fiyat diyor; kâhin yalnız KDV hariç fiyatı bilir")
    for kalem in plan["kalemler"]:
        miktar = dec(kalem["miktar"])
        fiyat = dec(kalem["birim_fiyat"])
        oran = dec(kalem.get("iskonto") or 0)
        kdv = int(dec(kalem["kdv"]))
        brut = kurus(miktar * fiyat)
        isk = kurus(brut * oran / Decimal(100))
        net = brut - isk
        brut_top += brut
        iskonto_top += isk
        net_top += net
        matrah[kdv] = matrah.get(kdv, Decimal(0)) + net
        satir_kdv[kdv] = satir_kdv.get(kdv, Decimal(0)) + kurus(net * Decimal(kdv) / Decimal(100))
        kod = str(kalem.get("tevkifat") or "")
        if kod:
            if kod not in TEVKIFAT:
                hatalar.append(f"bilinmeyen tevkifat kodu {kod}")
                continue
            tev_grup[(kod, kdv)] = tev_grup.get((kod, kdv), Decimal(0)) + net
            tev_grup_satir[(kod, kdv)] = tev_grup_satir.get((kod, kdv), Decimal(0)) + kurus(net * Decimal(kdv) / Decimal(100))
    if kural == "satir":
        kdv_oran = dict(satir_kdv)
    else:
        kdv_oran = {r: kurus(m * Decimal(r) / Decimal(100)) for r, m in matrah.items()}
    tev_kod = {}
    tev_kod_matrah = {}
    for (kod, r), net in tev_grup.items():
        pay, payda = TEVKIFAT[kod]
        kdv_g = tev_grup_satir[(kod, r)] if kural == "satir" else kurus(net * Decimal(r) / Decimal(100))
        tev_kod[kod] = tev_kod.get(kod, Decimal(0)) + kurus(kdv_g * Decimal(pay) / Decimal(payda))
        tev_kod_matrah[kod] = tev_kod_matrah.get(kod, Decimal(0)) + kdv_g
    kdv_top = sum(kdv_oran.values(), Decimal(0))
    tev_top = sum(tev_kod.values(), Decimal(0))
    dahil = net_top + kdv_top
    return {
        "brut": brut_top, "iskonto": iskonto_top, "malhizmet": net_top, "haric": net_top,
        "dahil": dahil, "odenecek": dahil - tev_top, "kdv_top": kdv_top, "tev_top": tev_top,
        "matrah": matrah, "kdv": kdv_oran, "tev_kod": tev_kod, "tev_kod_matrah": tev_kod_matrah, "hatalar": hatalar,
    }


def xml_tutarlari(path):
    """XML'den belge düzeyindeki tutarlar (Invoice kökünün doğrudan çocukları)."""
    root = ET.parse(path).getroot()
    out = {"no": "", "ettn": "", "lmt": {}, "kdv_oran": {}, "kdv_oran_matrah": {}, "kdv_top": None, "tev_kod": {}, "tev_kod_matrah": {}, "tev_top": None}
    out["no"] = (root.findtext("cbc:ID", default="", namespaces=NS) or "").strip()
    out["ettn"] = (root.findtext("cbc:UUID", default="", namespaces=NS) or "").strip()
    lmt = root.find("cac:LegalMonetaryTotal", NS)
    if lmt is not None:
        for alan in ("LineExtensionAmount", "TaxExclusiveAmount", "TaxInclusiveAmount", "AllowanceTotalAmount", "PayableAmount"):
            el = lmt.find(f"cbc:{alan}", NS)
            if el is not None and el.text:
                out["lmt"][alan] = dec(el.text)
    vergi_toplamlari = root.findall("cac:TaxTotal", NS)
    if vergi_toplamlari:
        out["kdv_top"] = Decimal(0)
    for tt in vergi_toplamlari:
        out["kdv_top"] += dec(tt.findtext("cbc:TaxAmount", default="0", namespaces=NS))
        for st in tt.findall("cac:TaxSubtotal", NS):
            yuzde = st.findtext("cbc:Percent", default=None, namespaces=NS)
            if yuzde is None:
                yuzde = st.findtext("cac:TaxCategory/cbc:Percent", default="0", namespaces=NS)
            r = int(dec(yuzde))
            out["kdv_oran"][r] = out["kdv_oran"].get(r, Decimal(0)) + dec(st.findtext("cbc:TaxAmount", default="0", namespaces=NS))
            out["kdv_oran_matrah"][r] = out["kdv_oran_matrah"].get(r, Decimal(0)) + dec(st.findtext("cbc:TaxableAmount", default="0", namespaces=NS))
    tevler = root.findall("cac:WithholdingTaxTotal", NS)
    if tevler:
        out["tev_top"] = Decimal(0)
    for wt in tevler:
        out["tev_top"] += dec(wt.findtext("cbc:TaxAmount", default="0", namespaces=NS))
        for st in wt.findall("cac:TaxSubtotal", NS):
            kod = (st.findtext("cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode", default="", namespaces=NS) or "").strip()
            out["tev_kod"][kod] = out["tev_kod"].get(kod, Decimal(0)) + dec(st.findtext("cbc:TaxAmount", default="0", namespaces=NS))
            out["tev_kod_matrah"][kod] = out["tev_kod_matrah"].get(kod, Decimal(0)) + dec(st.findtext("cbc:TaxableAmount", default="0", namespaces=NS))
    return out


def jsonl(path):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def karsilastir(plan, belge, xml_yolu, karekodlar, kural="oran"):
    """[(alan, beklenen, gelen)] farklar; boş liste = AYNI."""
    b = beklenen(plan, kural)
    farklar = [("kâhin", "-", h) for h in b["hatalar"]]
    if not os.path.exists(xml_yolu):
        return farklar + [("XML", "var", "YOK")], b
    x = xml_tutarlari(xml_yolu)

    def esit(alan, bek, gel):
        if gel is None:
            farklar.append((alan, str(bek), "YOK"))
        elif Decimal(gel) != Decimal(bek):
            farklar.append((alan, str(bek), str(gel)))

    if x["no"] != belge.get("no"):
        farklar.append(("XML ID", belge.get("no"), x["no"]))
    if belge.get("ettn") and x["ettn"].lower() != str(belge.get("ettn")).lower():
        farklar.append(("XML UUID", belge.get("ettn"), x["ettn"]))
    esit("LineExtensionAmount", b["malhizmet"], x["lmt"].get("LineExtensionAmount"))
    esit("TaxExclusiveAmount", b["haric"], x["lmt"].get("TaxExclusiveAmount"))
    esit("TaxInclusiveAmount", b["dahil"], x["lmt"].get("TaxInclusiveAmount"))
    esit("PayableAmount", b["odenecek"], x["lmt"].get("PayableAmount"))
    esit("TaxTotal/TaxAmount", b["kdv_top"], x["kdv_top"])
    for r in sorted(set(b["matrah"]) | set(x["kdv_oran_matrah"])):
        esit(f"TaxSubtotal %{r} TaxableAmount", b["matrah"].get(r, Decimal(0)), x["kdv_oran_matrah"].get(r))
        esit(f"TaxSubtotal %{r} TaxAmount", b["kdv"].get(r, Decimal(0)), x["kdv_oran"].get(r))
    if b["tev_kod"] or x["tev_top"] is not None:
        esit("WithholdingTaxTotal/TaxAmount", b["tev_top"], x["tev_top"])
        for kod in sorted(set(b["tev_kod"]) | set(x["tev_kod"])):
            esit(f"Tevkifat {kod} TaxAmount", b["tev_kod"].get(kod, Decimal(0)), x["tev_kod"].get(kod))
            esit(f"Tevkifat {kod} TaxableAmount (KDV)", b["tev_kod_matrah"].get(kod, Decimal(0)), x["tev_kod_matrah"].get(kod))
    if belge.get("odenecek") is not None:
        esit("program ödenecek (try_payable)", b["odenecek"], kurus(dec(belge["odenecek"])))
    for kk in karekodlar:
        j = kk.get("json") or {}
        kaynak = kk.get("kaynak", "?")
        if not j:
            farklar.append((f"karekod[{kaynak}]", "okunur JSON", kk.get("hata") or "OKUNAMADI"))
            continue
        if j.get("no") != belge.get("no"):
            farklar.append((f"karekod[{kaynak}] no", belge.get("no"), j.get("no")))
        if str(j.get("ettn", "")).lower() != str(belge.get("ettn", "")).lower():
            farklar.append((f"karekod[{kaynak}] ettn", belge.get("ettn"), j.get("ettn")))
        if plan.get("satici_vkn") and j.get("vkntckn") != plan["satici_vkn"]:
            farklar.append((f"karekod[{kaynak}] vkntckn", plan["satici_vkn"], j.get("vkntckn")))
        if plan.get("alici_kimlik") and j.get("avkntckn") != plan["alici_kimlik"]:
            farklar.append((f"karekod[{kaynak}] avkntckn", plan["alici_kimlik"], j.get("avkntckn")))
        for alan, bek in (("malhizmettoplam", b["malhizmet"]), ("vergidahil", b["dahil"]), ("odenecek", b["odenecek"])):
            esit(f"karekod[{kaynak}] {alan}", bek, dec(j[alan]) if alan in j else None)
        for r in sorted(b["matrah"]):
            esit(f"karekod[{kaynak}] kdvmatrah({r})", b["matrah"][r], dec(j[f"kdvmatrah({r})"]) if f"kdvmatrah({r})" in j else None)
            esit(f"karekod[{kaynak}] hesaplanankdv({r})", b["kdv"][r], dec(j[f"hesaplanankdv({r})"]) if f"hesaplanankdv({r})" in j else None)
        fazla = [k for k in j if k.startswith("kdvmatrah(") and int(k[len("kdvmatrah("):-1]) not in b["matrah"]]
        for k in fazla:
            farklar.append((f"karekod[{kaynak}] {k}", "yok", j[k]))
    return farklar, b


def main(argv):
    if len(argv) < 2 or argv[1].startswith("--"):
        print(__doc__)
        return 2
    cikti = argv[1]
    opts = {"--plan": os.path.join(cikti, "plan.jsonl"), "--belgeler": os.path.join(cikti, "belgeler.jsonl"),
            "--xml": os.path.join(cikti, "xml"), "--karekod": os.path.join(cikti, "karekod.jsonl"),
            "--cikis": os.path.join(cikti, "kahin-sonuc.txt"), "--kdv-kurali": "oran"}
    i = 2
    while i < len(argv):
        if argv[i] in opts and i + 1 < len(argv):
            opts[argv[i]] = argv[i + 1]
            i += 2
        else:
            print(f"bilinmeyen bağımsız değişken: {argv[i]}")
            return 2
    kural = opts["--kdv-kurali"]
    if kural not in ("oran", "satir"):
        print("--kdv-kurali oran | satir")
        return 2
    planlar = {p["plan_id"]: p for p in jsonl(opts["--plan"])}
    belgeler = [b for b in jsonl(opts["--belgeler"]) if b.get("no")]
    karekod = {}
    for k in jsonl(opts["--karekod"]):
        karekod.setdefault(k.get("no"), []).append(k)
    satirlar = []
    satir_ile_ayni = []
    ayni = farkli = 0
    ozet = []
    if not belgeler:
        satirlar.append("BELGE YOK — belgeler.jsonl boş ya da okunamadı; sonuç kanıt sayılmaz.")
        farkli += 1
    for belge in sorted(belgeler, key=lambda r: (r.get("sirket", ""), r.get("no", ""))):
        plan = planlar.get(belge.get("plan_id"))
        if plan is None:
            farkli += 1
            satirlar.append(f"{belge.get('no')}  FARKLI  plan kaydı yok (plan_id {belge.get('plan_id')})")
            continue
        xml_yolu = os.path.join(opts["--xml"], f"{belge['no']}.xml")
        farklar, b = karsilastir(plan, belge, xml_yolu, karekod.get(belge["no"], []), kural)
        bilgi = ""
        if farklar and kural == "oran" and not karsilastir(plan, belge, xml_yolu, karekod.get(belge["no"], []), "satir")[0]:
            bilgi = "  [BİLGİ: satır başına yuvarlamayla AYNI]"
            satir_ile_ayni.append(belge["no"])
        kk = ",".join(sorted({k.get("kaynak", "?") for k in karekod.get(belge["no"], [])})) or "-"
        if farklar:
            farkli += 1
            satirlar.append(f"{belge['no']}  FARKLI  {plan.get('senaryo', '')}  beklenen ödenecek {b['odenecek']}  (karekod: {kk}){bilgi}")
            for alan, bek, gel in farklar:
                satirlar.append(f"    {alan:<44} beklenen {bek:>14}   gelen {gel}")
        else:
            ayni += 1
            satirlar.append(f"{belge['no']}  AYNI    {plan.get('senaryo', '')}  ödenecek {b['odenecek']}  (karekod: {kk})")
    ozet.append(f"KÂHİN (KDV kuralı: {'oran başına' if kural == 'oran' else 'satır başına'} yuvarlama): {len(belgeler)} belge — AYNI {ayni}, FARKLI {farkli}")
    if kural == "oran":
        ozet.append(f"  FARKLI olanlardan satır başına yuvarlama kuralıyla AYNI çıkan (bilgi; hüküm değişmez): {len(satir_ile_ayni)}")
    ozet.append(f"plan kaydı {len(planlar)}, sonucu olmayan plan {len(set(planlar) - {b.get('plan_id') for b in belgeler})} (ekranda yarım kalan deneme; tutar karşılaştırması yok)")
    metin = "\n".join(ozet + [""] + satirlar) + "\n"
    with open(opts["--cikis"], "w", encoding="utf-8") as f:
        f.write(metin)
    print("\n".join(ozet))
    for s in satirlar:
        if "FARKLI" in s or s.startswith("    ") or s.startswith("BELGE YOK"):
            print(s)
    return 1 if farkli else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
